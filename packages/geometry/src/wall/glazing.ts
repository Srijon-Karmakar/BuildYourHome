import type { Vec2 } from '@hd/scene-schema';
import { Solids } from '../stairs/solids';
import { axialOf, type OpeningCut } from './openings';
import type { WallFootprint } from './footprint';

/**
 * A full glass wall (floor-to-ceiling glazing): the wall keeps a thin solid band at the top (and an optional low upstand at
 * the bottom); everything between is one big cut filled with glass panes in a frame of mullions.
 */
export interface GlazingOptions {
  /** Target width of one pane (m); the run is split into equal bays. */
  pane: number;
  /** Width of the frame members seen from the front (m). */
  frame: number;
  /** Solid wall left under the glass (m), 0 = glass to the floor. */
  sill: number;
  /** A horizontal bar across every pane at this height above the floor (m); 0 = none. */
  transom: number;
}

export const DEFAULT_GLAZING: GlazingOptions = { pane: 1.2, frame: 0.06, sill: 0, transom: 0 };
export const GLAZING_FRAMES = { slim: 0.035, standard: 0.06, bold: 0.11 } as const;
/** Solid band kept at the top of a glass wall (the slab edge / lintel). */
export const GLAZING_HEAD_M = 0.1;

export interface GlazingRun {
  /** Where the glass starts and ends along the wall (distance from node a). */
  from: number;
  to: number;
  /** Bottom and top of the glass above the floor. */
  bottom: number;
  top: number;
}

/** Solid wall kept at each end of the glass, past the corner zone (m). */
export const GLAZING_JAMB_M = 0.04;

/**
 * The part of the wall that turns to glass: between the corner zones of the footprint (where the walls meeting it overlap),
 * less a slim solid jamb, and from the upstand to just under the top band.
 */
export function glazingRun(fp: WallFootprint, height: number, sill: number): GlazingRun | null {
  const [aL, bL, bR, aR] = fp.footprint;
  const from = Math.max(axialOf(fp, aL), axialOf(fp, aR)) + GLAZING_JAMB_M;
  const to = Math.min(axialOf(fp, bL), axialOf(fp, bR)) - GLAZING_JAMB_M;
  const bottom = Math.max(0, Math.min(sill, height - GLAZING_HEAD_M - 0.3));
  const top = height - GLAZING_HEAD_M;
  return to - from > 0.2 && top - bottom > 0.2 ? { from, to, bottom, top } : null;
}

/**
 * The cuts that make room for the glass. Cuts never overlap along the wall (the wall builder needs that), so with an upstand
 * a door (or any opening reaching below the glass) gets its own cut from its sill to the top of the glass, and the glass cuts
 * run between those. Openings that sit inside the glass are covered by the glass cut.
 */
export function glazingCuts(run: GlazingRun, openings: readonly OpeningCut[]): OpeningCut[] {
  const low = run.bottom > 0.01 ? openings.filter((o) => o.sill < run.bottom - 1e-6).map((o): [number, number, number] => [Math.max(run.from, o.offset - o.width / 2), Math.min(run.to, o.offset + o.width / 2), o.sill]).filter(([a, b]) => b - a > 0.05).sort((a, b) => a[0] - b[0]) : [];
  const out: OpeningCut[] = [];
  const glass = (a: number, b: number) => {
    if (b - a > 0.02) out.push({ offset: (a + b) / 2, width: b - a, sill: run.bottom, height: run.top - run.bottom });
  };
  let cur = run.from;
  for (const [a, b, sill] of low) {
    if (a < cur) continue; // overlapping openings: keep the first
    glass(cur, a);
    out.push({ offset: (a + b) / 2, width: b - a, sill, height: run.top - sill });
    cur = b;
  }
  glass(cur, run.to);
  return out;
}

export type GlazingSlot = 'frame' | 'glass';
export interface GlazingMesh {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
  groups: { slot: GlazingSlot; start: number; count: number }[];
}

/**
 * Glass panes and their frame for a glass wall, in world coordinates. `origin` / `dir` are the wall's frame (node a, unit
 * direction), `elevation` its floor. Doors and windows in the wall (`openings`) leave a gap in the glass (they draw their own
 * frames), with a mullion on each side.
 */
export function buildGlazing(origin: Vec2, dir: Vec2, thickness: number, elevation: number, run: GlazingRun, opts: Partial<GlazingOptions>, openings: readonly OpeningCut[] = []): GlazingMesh {
  const o = { ...DEFAULT_GLAZING, ...opts };
  const S: Record<GlazingSlot, Solids> = { frame: new Solids(), glass: new Solids() };
  const fw = Math.min(0.2, Math.max(0.02, o.frame));
  const depth = Math.min(thickness, Math.max(0.06, fw * 1.4));
  const at = (t: number): Vec2 => [origin[0] + dir[0] * t, origin[1] + dir[1] * t];
  const y0 = elevation + run.bottom;
  const y1 = elevation + run.top;

  // Gaps the openings make in the glass (with the opening's bottom and top above the floor).
  const gaps = openings
    .map((c): [number, number, number, number] => [Math.max(run.from, c.offset - c.width / 2), Math.min(run.to, c.offset + c.width / 2), c.sill, c.sill + c.height])
    .filter(([a, b]) => b - a > 0.05)
    .sort((a, b) => a[0] - b[0]);

  // Glass stretches between gaps, each split into equal bays.
  const stretches: Array<[number, number]> = [];
  let cur = run.from;
  for (const [a, b] of gaps) {
    if (a - cur > 0.05) stretches.push([cur, a]);
    cur = Math.max(cur, b);
  }
  if (run.to - cur > 0.05) stretches.push([cur, run.to]);

  // A vertical member: a bar along the wall's height, `fw` wide along the wall, `depth` deep across it.
  const mullion = (t: number) => {
    const p = at(t);
    const n: Vec2 = [-dir[1], dir[0]];
    const hw = fw / 2;
    const hd = depth / 2;
    const c = (s: number, k: number, y: number): [number, number, number] => [p[0] + dir[0] * hw * s + n[0] * hd * k, y, p[1] + dir[1] * hw * s + n[1] * hd * k];
    const mid: [number, number, number] = [p[0], (y0 + y1) / 2, p[1]];
    const B = [c(-1, -1, y0), c(1, -1, y0), c(1, 1, y0), c(-1, 1, y0)];
    const T = [c(-1, -1, y1), c(1, -1, y1), c(1, 1, y1), c(-1, 1, y1)];
    for (let k = 0; k < 4; k++) S.frame.quad(B[k]!, B[(k + 1) % 4]!, T[(k + 1) % 4]!, T[k]!, mid);
    S.frame.quad(B[0]!, B[1]!, B[2]!, B[3]!, mid);
    S.frame.quad(T[0]!, T[1]!, T[2]!, T[3]!, mid);
  };
  /** A horizontal member from t0 to t1 at height y (its centre). */
  const rail = (t0: number, t1: number, y: number) => {
    if (t1 - t0 < 0.01) return;
    const a = at(t0);
    const b = at(t1);
    S.frame.bar([a[0], y, a[1]], [b[0], y, b[1]], depth, fw);
  };

  for (const [s0, s1] of stretches) {
    const n = Math.max(1, Math.round((s1 - s0) / Math.max(0.4, o.pane)));
    const w = (s1 - s0) / n;
    for (let i = 0; i <= n; i++) mullion(s0 + i * w + (i === 0 ? fw / 2 : i === n ? -fw / 2 : 0));
    rail(s0, s1, y0 + fw / 2);
    rail(s0, s1, y1 - fw / 2);
    const tr = o.transom > 0 ? elevation + o.transom : 0;
    if (tr > y0 + 0.3 && tr < y1 - 0.3) rail(s0, s1, tr);
    // One pane per bay, just inside the frame.
    for (let i = 0; i < n; i++) {
      const a = at(s0 + i * w + fw / 2);
      const b = at(s0 + (i + 1) * w - fw / 2);
      S.glass.panel(a, b, y0 + fw, y1 - fw, y0 + fw, y1 - fw, 0.012);
    }
  }
  // Frame the sides of each gap that sits inside the glass; glass over a door / window and under a window.
  for (const [a, b, lo, hi] of gaps) {
    if (a > run.from + 0.05) mullion(a - fw / 2);
    if (b < run.to - 0.05) mullion(b + fw / 2);
    const pa = at(a);
    const pb = at(b);
    const top = elevation + hi;
    if (top < y1 - fw * 2 - 0.05) {
      rail(a, b, top + fw / 2);
      S.glass.panel(pa, pb, top + fw, y1 - fw, top + fw, y1 - fw, 0.012);
    }
    const bot = elevation + lo;
    if (bot > y0 + fw * 2 + 0.05) {
      rail(a, b, bot - fw / 2);
      S.glass.panel(pa, pb, y0 + fw, bot - fw, y0 + fw, bot - fw, 0.012);
    }
  }

  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const groups: GlazingMesh['groups'] = [];
  for (const slot of ['frame', 'glass'] as const) {
    const s = S[slot];
    const count = s.pos.length / 3;
    if (!count) continue;
    groups.push({ slot, start: pos.length / 3, count });
    pos.push(...s.pos);
    nor.push(...s.nor);
    uv.push(...s.uv);
  }
  const indices = new Uint32Array(pos.length / 3);
  for (let i = 0; i < indices.length; i++) indices[i] = i;
  return { positions: new Float32Array(pos), normals: new Float32Array(nor), uvs: new Float32Array(uv), indices, groups };
}
