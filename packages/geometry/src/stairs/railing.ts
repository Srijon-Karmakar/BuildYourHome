import type { Vec2 } from '@hd/scene-schema';
import { Solids } from './solids';

/** Height of the handrail above the step edge / floor (m). */
export const RAIL_HEIGHT_M = 0.9;

export type RailSlot = 'frame' | 'glass' | 'panel';

export interface RailMesh {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
  groups: { slot: RailSlot; start: number; count: number }[];
}

export interface RailPoint {
  p: Vec2;
  /** Height of the step edge / floor here (the rail runs `height` above it). */
  y: number;
}

/** One run of railing: a line of points, each with the height of whatever it stands on. */
export interface RailPath {
  pts: RailPoint[];
  inward: (p: Vec2) => Vec2;
  /** Which side of the person climbing the rail is on (flights only; the rail of a spiral is always the outer one). */
  side?: 'left' | 'right';
  /** Stands on level floor all along (balusters then start at the lowest point, not at whatever is under the line on the plan). */
  flat?: boolean;
}

export type RailInfill = 'balusters' | 'cables' | 'glass' | 'solid' | 'none';
export type RailHandrail = 'round' | 'flat' | 'wide';
export type RailSides = 'both' | 'left' | 'right';

export interface RailOptions {
  /** What fills the space under the handrail: upright balusters, horizontal cables, a glass panel, a solid panel, or nothing. */
  infill: RailInfill;
  /** Height of the handrail above the step edge (m). */
  height: number;
  /** Shape of the handrail. */
  handrail: RailHandrail;
  /** Gap between balusters / cables (m). */
  gap: number;
  /** Size of the square posts (m). */
  post: number;
  /** Which side(s) of the stair get a rail (flights; spiral stairs always have their outer rail). */
  sides: RailSides;
  /** Long straight runs get a post at least this often (m). Unset = only the posts the path already has. */
  spacing?: number;
  /** Thickness of a solid panel (m). */
  thickness?: number;
  /** Draw the centre pole of a spiral stair with the rail (the stair body draws it itself in the open builds). */
  pole?: boolean;
}

export const DEFAULT_RAIL: RailOptions = { infill: 'balusters', height: RAIL_HEIGHT_M, handrail: 'flat', gap: 0.12, post: 0.045, sides: 'both' };

/** Handrail section (width, height) per shape. */
const HANDRAIL: Record<RailHandrail, [number, number]> = { round: [0.05, 0.05], flat: [0.06, 0.04], wide: [0.14, 0.045] };

const dist = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export interface RailContext {
  /** Height of whatever stands under the rail at `p` (for balusters); unset = the lower of the two ends. */
  under?: (p: Vec2, inward: Vec2) => number | null;
  /** Extra frame parts (e.g. the pole of a spiral stair). */
  extra?: (frame: Solids) => void;
}

/** Add posts along a path so no run is longer than `spacing`. */
function subdivide(pts: RailPoint[], spacing: number): RailPoint[] {
  const out: RailPoint[] = [pts[0]!];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const n = Math.max(1, Math.ceil(dist(a.p, b.p) / spacing - 1e-6));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      out.push({ p: [a.p[0] + (b.p[0] - a.p[0]) * t, a.p[1] + (b.p[1] - a.p[1]) * t], y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

/**
 * Handrail, posts and infill along any set of paths (stairs, balconies, roof terraces). One buffer of flat-shaded
 * triangles, in three material slots: `frame` (posts, handrail, balusters, cables), `glass` and `panel`.
 */
export function buildRailFromPaths(paths: readonly RailPath[], options: Partial<RailOptions> = {}, ctx: RailContext = {}): RailMesh | null {
  const o: RailOptions = { ...DEFAULT_RAIL, ...options };
  const H = Math.min(1.3, Math.max(0.6, o.height));
  const gap = Math.min(0.4, Math.max(0.05, o.gap));
  const post = Math.min(0.15, Math.max(0.02, o.post));
  const live = paths.filter((p) => p.pts.length >= 2);
  if (live.length === 0 && !ctx.extra) return null;
  const frame = new Solids();
  const gl = new Solids();
  const pn = new Solids();
  const [hw, hh] = HANDRAIL[o.handrail];
  for (const path of live) {
    const pts = o.spacing ? subdivide(path.pts, o.spacing) : path.pts;
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      const len = dist(a.p, b.p);
      if (o.handrail === 'round') frame.rod([a.p[0], a.y + H, a.p[1]], [b.p[0], b.y + H, b.p[1]], hw / 2);
      else frame.bar([a.p[0], a.y + H, a.p[1]], [b.p[0], b.y + H, b.p[1]], hw, hh); // handrail
      if (o.infill === 'glass') {
        gl.panel(a.p, b.p, a.y + 0.04, a.y + H - hh - 0.01, b.y + 0.04, b.y + H - hh - 0.01, 0.012);
      } else if (o.infill === 'solid') {
        pn.panel(a.p, b.p, a.y, a.y + H - hh * 0.5, b.y, b.y + H - hh * 0.5, o.thickness ?? 0.07);
      } else if (o.infill === 'cables') {
        const rows = Math.max(1, Math.floor((H - 0.18) / gap));
        for (let r = 0; r < rows; r++) {
          const dy = 0.1 + ((H - 0.2) * (r + 0.5)) / rows;
          frame.bar([a.p[0], a.y + dy, a.p[1]], [b.p[0], b.y + dy, b.p[1]], 0.008, 0.008);
        }
      } else if (o.infill === 'balusters') {
        const n = Math.max(0, Math.floor(len / gap));
        for (let k = 1; k <= n; k++) {
          const t = k / (n + 1);
          const p: Vec2 = [a.p[0] + (b.p[0] - a.p[0]) * t, a.p[1] + (b.p[1] - a.p[1]) * t];
          const top = a.y + (b.y - a.y) * t + H - hh * 0.5;
          const inw = path.inward(p);
          const found = path.flat ? null : ctx.under?.([p[0] + inw[0] * 0.03, p[1] + inw[1] * 0.03], inw);
          const under = found ?? Math.min(a.y, b.y);
          if (top - under > 0.3) frame.post(p[0], p[1], under, top, 0.014);
        }
      }
    }
    for (const q of pts) frame.post(q.p[0], q.p[1], q.y, q.y + H, post);
  }
  ctx.extra?.(frame);

  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const groups: RailMesh['groups'] = [];
  let at = 0;
  for (const [slot, g] of [['frame', frame], ['glass', gl], ['panel', pn]] as const) {
    const n = g.pos.length / 3;
    if (n === 0) continue;
    pos.push(...g.pos);
    nor.push(...g.nor);
    uv.push(...g.uv);
    groups.push({ slot, start: at, count: n });
    at += n;
  }
  if (at === 0) return null;
  return { positions: new Float32Array(pos), normals: new Float32Array(nor), uvs: new Float32Array(uv), indices: Uint32Array.from({ length: at }, (_, i) => i), groups };
}

/** Straight runs of railing (no stair under them): each segment is one path at height `y`. */
export function railPathsFromSegments(segments: readonly { a: Vec2; b: Vec2 }[], y = 0): RailPath[] {
  return segments
    .filter((s) => dist(s.a, s.b) > 0.05)
    .map((s) => ({ pts: [{ p: s.a, y }, { p: s.b, y }], inward: () => [0, 0] as Vec2 }));
}
