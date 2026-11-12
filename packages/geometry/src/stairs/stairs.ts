import type { Vec2 } from '@hd/scene-schema';
import type { MeshData } from '../wall/mesh';
import { pointInPolygon } from '../wall/footprint';
import { DEFAULT_RAIL, buildRailFromPaths, type RailMesh, type RailOptions, type RailPath, type RailPoint } from './railing';

/** Comfortable proportions (≈ 17.5 cm rise, 28 cm tread — the 2R + T ≈ 63 cm rule of thumb). */
export const RISER_M = 0.175;
export const TREAD_M = 0.28;
/** Gap between the two flights of a U stair. */
export const STAIR_GAP_M = 0.1;
export const MIN_STAIR_WIDTH_M = 0.6;
export const MAX_STAIR_WIDTH_M = 3;

export type StairKind = 'straight' | 'L' | 'U' | 'spiral';

/** Spiral stairs: radius of the centre pole, and the turn per step (at most; tall stairs turn less per step so they stay under 300°, leaving a gap to walk in through). */
export const SPIRAL_POLE_R_M = 0.08;
export const SPIRAL_STEP_DEG = 21;

export interface StairParams {
  kind: StairKind;
  width: number;
  /** Floor-to-floor height to climb (metres). */
  rise: number;
  /** L / U stairs turn left by default; mirrored they turn right. */
  mirror?: boolean;
}

/**
 * One step. Coordinates are LOCAL: x across the stair, z along it; the origin is the centre of the first step's
 * bottom edge and the run climbs toward −z. `height` is the top of the step above the lower floor.
 */
export interface Tread {
  /** [xMin, zMin, xMax, zMax] */
  rect: [number, number, number, number];
  height: number;
  landing: boolean;
  /** Direction of travel while climbing this step (local). */
  dir: Vec2;
  /** Wedge-shaped steps (spiral): the outline of the step, the line drawn across it on the plan, and its centre. `rect` is then its bounding box. */
  poly?: Vec2[];
  line?: [Vec2, Vec2];
  centre?: Vec2;
}

export interface StairLayout {
  kind: StairKind;
  width: number;
  rise: number;
  /** Number of risers (the last one is the step up onto the upper floor). */
  risers: number;
  riserHeight: number;
  treads: Tread[];
  /** Outline of all treads (local), i.e. the opening the stair needs in the floor above. */
  outline: Vec2[];
  /** Spiral stairs only: the circle they turn on. `delta` is the signed turn per step (radians). */
  spiral?: { radius: number; pole: number; delta: number };
}

export const stairRiserCount = (rise: number): number => Math.max(2, Math.round(rise / RISER_M));

const flip = (r: [number, number, number, number]): [number, number, number, number] => [-r[2], r[1], -r[0], r[3]];

/** Work out every step of a stair. Pure; the same input always gives the same stair. */
export function stairLayout(p: StairParams): StairLayout {
  const w = Math.min(MAX_STAIR_WIDTH_M, Math.max(MIN_STAIR_WIDTH_M, p.width));
  const risers = stairRiserCount(p.rise);
  const rh = p.rise / risers;
  const count = risers - 1; // treads; the last riser lands on the upper floor
  const t = TREAD_M;
  const g = STAIR_GAP_M;
  const treads: Tread[] = [];
  let outline: Vec2[];

  // L and U stairs need a step before the landing and one after it.
  const kind: StairKind = p.kind !== 'straight' && count < 3 ? 'straight' : p.kind;

  if (kind === 'spiral') {
    const rp = SPIRAL_POLE_R_M;
    const R = rp + w;
    const sgn = p.mirror ? -1 : 1;
    const delta = Math.min((SPIRAL_STEP_DEG * Math.PI) / 180, (300 * Math.PI) / 180 / count);
    const pt = (r: number, th: number): Vec2 => [r * Math.sin(th), r * Math.cos(th)];
    for (let i = 1; i <= count; i++) {
      const a0 = (i - 1) * delta * sgn;
      const a1 = i * delta * sgn;
      const am = (a0 + a1) / 2;
      const poly = [pt(R, a0), pt(R, am), pt(R, a1), pt(rp, a1), pt(rp, am), pt(rp, a0)];
      const xs = poly.map((q) => q[0]);
      const zs = poly.map((q) => q[1]);
      treads.push({
        rect: [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)],
        height: i * rh,
        landing: false,
        dir: [Math.cos(am) * sgn, -Math.sin(am) * sgn],
        poly,
        line: [pt(rp, a1), pt(R, a1)],
        centre: pt((rp + R) / 2, am),
      });
    }
    const outline = Array.from({ length: 32 }, (_, i) => pt(R, (i / 32) * Math.PI * 2));
    return { kind, width: w, rise: p.rise, risers, riserHeight: rh, treads, outline, spiral: { radius: R, pole: rp, delta: delta * sgn } };
  }

  if (kind === 'straight') {
    for (let i = 1; i <= count; i++) {
      treads.push({ rect: [-w / 2, -i * t, w / 2, -(i - 1) * t], height: i * rh, landing: false, dir: [0, -1] });
    }
    const len = count * t;
    outline = [[-w / 2, 0], [w / 2, 0], [w / 2, -len], [-w / 2, -len]];
  } else {
    // Index of the landing. With an even number of steps the first flight gets the extra one, so the second
    // flight never runs past the start of the first.
    const m = Math.floor(count / 2) + 1;
    const f2 = count - m; // steps after the landing
    const zL1 = -(m - 1) * t; // landing, near edge
    const zL0 = zL1 - w; // landing, far edge
    for (let i = 1; i <= m - 1; i++) {
      treads.push({ rect: [-w / 2, -i * t, w / 2, -(i - 1) * t], height: i * rh, landing: false, dir: [0, -1] });
    }
    if (kind === 'L') {
      treads.push({ rect: [-w / 2, zL0, w / 2, zL1], height: m * rh, landing: true, dir: [-1, 0] });
      for (let j = 1; j <= f2; j++) {
        treads.push({ rect: [-w / 2 - j * t, zL0, -w / 2 - (j - 1) * t, zL1], height: (m + j) * rh, landing: false, dir: [-1, 0] });
      }
      const x2 = -w / 2 - f2 * t;
      outline = [[-w / 2, 0], [w / 2, 0], [w / 2, zL0], [x2, zL0], [x2, zL1], [-w / 2, zL1]];
    } else {
      const xl = -w / 2 - g - w;
      treads.push({ rect: [xl, zL0, w / 2, zL1], height: m * rh, landing: true, dir: [-1, 0] });
      for (let j = 1; j <= f2; j++) {
        treads.push({ rect: [xl, zL1 + (j - 1) * t, -w / 2 - g, zL1 + j * t], height: (m + j) * rh, landing: false, dir: [0, 1] });
      }
      const top = zL1 + f2 * t;
      outline = [[-w / 2, 0], [w / 2, 0], [w / 2, zL0], [xl, zL0], [xl, top], [-w / 2 - g, top], [-w / 2 - g, zL1], [-w / 2, zL1]];
    }
  }

  if (p.mirror && kind !== 'straight') {
    for (const tr of treads) {
      tr.rect = flip(tr.rect);
      tr.dir = [-tr.dir[0], tr.dir[1]];
    }
    outline = outline.map((q): Vec2 => [-q[0], q[1]]).reverse();
  }
  return { kind, width: w, rise: p.rise, risers, riserHeight: rh, treads, outline };
}

/** Local → world (x, z) for a stair placed at `origin` and turned by `rotationY` (same convention as Three.js). */
export function stairToWorld(origin: Vec2, rotationY: number, p: Vec2): Vec2 {
  const c = Math.cos(rotationY);
  const s = Math.sin(rotationY);
  return [origin[0] + p[0] * c + p[1] * s, origin[1] - p[0] * s + p[1] * c];
}

/** World → local (inverse of `stairToWorld`). */
export function stairToLocal(origin: Vec2, rotationY: number, p: Vec2): Vec2 {
  const c = Math.cos(rotationY);
  const s = Math.sin(rotationY);
  const dx = p[0] - origin[0];
  const dz = p[1] - origin[1];
  return [dx * c - dz * s, dx * s + dz * c];
}

/** The stair's outline in world coordinates. */
export function stairOutlineWorld(layout: StairLayout, origin: Vec2, rotationY: number): Vec2[] {
  return layout.outline.map((q) => stairToWorld(origin, rotationY, q));
}

/** Height of the step under a LOCAL point (above the lower floor), or null when the point is not on the stair. */
export function stairHeightAt(layout: StairLayout, local: Vec2, eps = 1e-6): number | null {
  let best: number | null = null;
  for (const tr of layout.treads) {
    const [x0, z0, x1, z1] = tr.rect;
    if (local[0] >= x0 - eps && local[0] <= x1 + eps && local[1] >= z0 - eps && local[1] <= z1 + eps) {
      if (tr.poly && !pointInPolygon(local, tr.poly, 1e-4)) continue;
      if (best === null || tr.height > best) best = tr.height;
    }
  }
  return best;
}

/**
 * Solid steps as one mesh in LOCAL coordinates (wrap it in a group placed at the stair's origin, rotated by rotationY).
 * Every step is a block from the lower floor up to its top; the underside is left out.
 */
export function buildStairMesh(layout: StairLayout): MeshData {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const quad = (a: number[], b: number[], c: number[], d: number[], n: number[], uv: (p: number[]) => [number, number]) => {
    const base = positions.length / 3;
    for (const p of [a, b, c, d]) {
      positions.push(p[0]!, p[1]!, p[2]!);
      normals.push(n[0]!, n[1]!, n[2]!);
      uvs.push(...uv(p));
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };

  for (const tr of layout.treads) {
    const [x0, z0, x1, z1] = tr.rect;
    const h = tr.height;
    if (tr.poly) {
      // A wedge: a fan on top, and a wall down to the floor along every edge (the underside is left out).
      const P = tr.poly;
      const cx = P.reduce((a, q) => a + q[0], 0) / P.length;
      const cz = P.reduce((a, q) => a + q[1], 0) / P.length;
      const tri = (a: number[], b: number[], c: number[], inside: number[], uv: (p: number[]) => [number, number]) => {
        const e1 = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!];
        const e2 = [c[0]! - a[0]!, c[1]! - a[1]!, c[2]! - a[2]!];
        let n = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!];
        const len = Math.hypot(n[0]!, n[1]!, n[2]!);
        if (len < 1e-12) return;
        n = n.map((v) => v / len);
        const m = [(a[0]! + b[0]! + c[0]!) / 3 - inside[0]!, (a[1]! + b[1]! + c[1]!) / 3 - inside[1]!, (a[2]! + b[2]! + c[2]!) / 3 - inside[2]!];
        if (n[0]! * m[0]! + n[1]! * m[1]! + n[2]! * m[2]! < 0) {
          [b, c] = [c, b];
          n = n.map((v) => -v);
        }
        const base = positions.length / 3;
        for (const q of [a, b, c]) {
          positions.push(q[0]!, q[1]!, q[2]!);
          normals.push(n[0]!, n[1]!, n[2]!);
          uvs.push(...uv(q));
        }
        indices.push(base, base + 1, base + 2);
      };
      const inside = [cx, h / 2, cz];
      for (let i = 0; i < P.length; i++) {
        const q0 = P[i]!;
        const q1 = P[(i + 1) % P.length]!;
        tri([cx, h, cz], [q0[0], h, q0[1]], [q1[0], h, q1[1]], inside, (p) => [p[0]!, p[2]!]);
        tri([q0[0], 0, q0[1]], [q1[0], 0, q1[1]], [q1[0], h, q1[1]], inside, (p) => [p[0]! + p[2]!, p[1]!]);
        tri([q0[0], 0, q0[1]], [q1[0], h, q1[1]], [q0[0], h, q0[1]], inside, (p) => [p[0]! + p[2]!, p[1]!]);
      }
      continue;
    }
    // Counter-clockwise seen from outside.
    quad([x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0], [0, 1, 0], (p) => [p[0]!, p[2]!]); // top
    quad([x0, 0, z1], [x1, 0, z1], [x1, h, z1], [x0, h, z1], [0, 0, 1], (p) => [p[0]!, p[1]!]); // +z
    quad([x1, 0, z0], [x0, 0, z0], [x0, h, z0], [x1, h, z0], [0, 0, -1], (p) => [p[0]!, p[1]!]); // −z
    quad([x1, 0, z1], [x1, 0, z0], [x1, h, z0], [x1, h, z1], [1, 0, 0], (p) => [p[2]!, p[1]!]); // +x
    quad([x0, 0, z0], [x0, 0, z1], [x0, h, z1], [x0, h, z0], [-1, 0, 0], (p) => [p[2]!, p[1]!]); // −x
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices),
    groups: [{ slot: 'top', start: 0, count: indices.length }],
  };
}

// ------------------------------------------------------------------------------------------------
// The opening in the floor above
// ------------------------------------------------------------------------------------------------

/** Clear height wanted above the steps (m): the floor above only has to open where the steps are closer to it than this. */
export const STAIR_HEADROOM_M = 2.05;

/** Outline (local, in order) of the union of axis-aligned rectangles [x0, z0, x1, z1] that touch or overlap into one shape. */
export function unionRects(rects: ReadonlyArray<readonly [number, number, number, number]>): Vec2[] {
  const round = (v: number) => Math.round(v * 1e6) / 1e6;
  const xs = [...new Set(rects.flatMap((r) => [round(r[0]), round(r[2])]))].sort((a, b) => a - b);
  const zs = [...new Set(rects.flatMap((r) => [round(r[1]), round(r[3])]))].sort((a, b) => a - b);
  const filled = (i: number, j: number): boolean => {
    if (i < 0 || j < 0 || i >= xs.length - 1 || j >= zs.length - 1) return false;
    const cx = (xs[i]! + xs[i + 1]!) / 2;
    const cz = (zs[j]! + zs[j + 1]!) / 2;
    return rects.some((r) => cx > r[0] && cx < r[2] && cz > r[1] && cz < r[3]);
  };
  // Directed boundary edges with the filled cell on the left.
  const next = new Map<string, Vec2>();
  const key = (p: Vec2) => `${round(p[0])},${round(p[1])}`;
  const add = (a: Vec2, b: Vec2) => next.set(key(a), b);
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < zs.length - 1; j++) {
      if (!filled(i, j)) continue;
      const x0 = xs[i]!;
      const x1 = xs[i + 1]!;
      const z0 = zs[j]!;
      const z1 = zs[j + 1]!;
      if (!filled(i, j - 1)) add([x0, z0], [x1, z0]);
      if (!filled(i + 1, j)) add([x1, z0], [x1, z1]);
      if (!filled(i, j + 1)) add([x1, z1], [x0, z1]);
      if (!filled(i - 1, j)) add([x0, z1], [x0, z0]);
    }
  }
  // Follow the chains; the biggest loop is the outline.
  const seen = new Set<string>();
  let best: Vec2[] = [];
  let bestArea = -1;
  for (const [k, start] of [...next.entries()].map(([kk]) => [kk, kk.split(',').map(Number) as Vec2] as const)) {
    if (seen.has(k)) continue;
    const loop: Vec2[] = [];
    let cur: Vec2 = start;
    for (let guard = 0; guard < 4000; guard++) {
      const ck = key(cur);
      if (seen.has(ck)) break;
      seen.add(ck);
      loop.push(cur);
      const n = next.get(ck);
      if (!n) break;
      cur = n;
    }
    let area = 0;
    for (let i = 0; i < loop.length; i++) {
      const q = loop[(i + 1) % loop.length]!;
      area += loop[i]![0] * q[1] - q[0] * loop[i]![1];
    }
    if (Math.abs(area) > bestArea) {
      bestArea = Math.abs(area);
      best = loop;
    }
  }
  // Drop the points that sit on a straight line.
  return best.filter((p, i) => {
    const a = best[(i + best.length - 1) % best.length]!;
    const b = best[(i + 1) % best.length]!;
    return Math.abs((p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0])) > 1e-9;
  });
}

/**
 * The opening the stair needs in the floor above (local): only where the steps are closer to that floor than the headroom.
 * The lower steps pass under the floor, which keeps its full area (so a flight stacked on top of this one starts on floor,
 * and a person on the upper floor can stand there). A spiral, and a stair too short to pass under, open up in full.
 */
export function stairHole(layout: StairLayout): Vec2[] {
  const limit = layout.rise - STAIR_HEADROOM_M;
  const inside = layout.treads.filter((t) => t.height > limit + 1e-6);
  if (layout.spiral || inside.length === layout.treads.length || inside.length === 0) return layout.outline;
  return unionRects(inside.map((t) => t.rect));
}

/** The opening in world coordinates. */
export function stairHoleWorld(layout: StairLayout, origin: Vec2, rotationY: number): Vec2[] {
  return stairHole(layout).map((q) => stairToWorld(origin, rotationY, q));
}

// ------------------------------------------------------------------------------------------------
// Railings
// ------------------------------------------------------------------------------------------------

/** Tells the railing which runs to leave out (e.g. a side that stands flush against a wall). Local coordinates. */
export interface StairRailContext {
  skip?: (a: Vec2, b: Vec2, kind: 'flight' | 'guard') => boolean;
}

const dist = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1]);

const onSegment = (p: Vec2, a: Vec2, b: Vec2, tol: number): boolean => {
  const abx = b[0] - a[0];
  const abz = b[1] - a[1];
  const len2 = abx * abx + abz * abz || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * abx + (p[1] - a[1]) * abz) / len2));
  return Math.hypot(p[0] - (a[0] + abx * t), p[1] - (a[1] + abz * t)) < tol;
};

/** The sides of a straight / L / U stair that need a rail: every edge of its outline except where you step on and off. */
function flightPaths(layout: StairLayout, ctx: StairRailContext): RailPath[] {
  const o = layout.outline;
  const n = o.length;
  const last = layout.treads[layout.treads.length - 1]!;
  const first = layout.treads[0]!;
  const [lx0, lz0, lx1, lz1] = last.rect;
  const [dx, dz] = last.dir;
  // The far side of the top step (where you step onto the upper floor) as a line coordinate.
  const onArrival = (p: Vec2): boolean => (dz < -0.5 ? Math.abs(p[1] - lz0) < 1e-6 && p[0] >= lx0 - 1e-6 && p[0] <= lx1 + 1e-6 : dz > 0.5 ? Math.abs(p[1] - lz1) < 1e-6 && p[0] >= lx0 - 1e-6 && p[0] <= lx1 + 1e-6 : dx < -0.5 ? Math.abs(p[0] - lx0) < 1e-6 && p[1] >= lz0 - 1e-6 && p[1] <= lz1 + 1e-6 : Math.abs(p[0] - lx1) < 1e-6 && p[1] >= lz0 - 1e-6 && p[1] <= lz1 + 1e-6);
  const startZ = first.rect[3];
  const paths: RailPath[] = [];
  for (let i = 0; i < n; i++) {
    const a = o[i]!;
    const b = o[(i + 1) % n]!;
    const len = dist(a, b);
    if (len < 0.05) continue;
    if (onArrival(a) && onArrival(b)) continue; // the exit
    if (Math.abs(a[1] - startZ) < 1e-6 && Math.abs(b[1] - startZ) < 1e-6) continue; // the entrance
    if (ctx.skip?.(a, b, 'flight')) continue;
    const u: Vec2 = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    const mid: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let inw: Vec2 = [-u[1], u[0]];
    if (!pointInPolygon([mid[0] + inw[0] * 0.03, mid[1] + inw[1] * 0.03], o, 0)) inw = [-inw[0], -inw[1]];
    // Breakpoints: every step corner that lies on this edge.
    const ss = new Set<number>([0, len]);
    for (const t of layout.treads) {
      const [x0, z0, x1, z1] = t.rect;
      for (const c of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]] as Vec2[]) {
        const perp = Math.abs((c[0] - a[0]) * -u[1] + (c[1] - a[1]) * u[0]);
        const s = (c[0] - a[0]) * u[0] + (c[1] - a[1]) * u[1];
        if (perp < 0.02 && s > 1e-6 && s < len - 1e-6) ss.add(Math.round(s * 1e6) / 1e6);
      }
    }
    const pts: RailPoint[] = [...ss]
      .sort((p, q) => p - q)
      .map((s) => {
        const p: Vec2 = [a[0] + u[0] * s, a[1] + u[1] * s];
        const at: Vec2 = [p[0] + inw[0] * 0.01, p[1] + inw[1] * 0.01];
        // Corners of the exit edge are level with the upper floor; elsewhere the step edge under the rail (higher of the two steps meeting here).
        const y = onArrival(p) ? layout.rise : (stairHeightAt(layout, at) ?? stairHeightAt(layout, p) ?? 0);
        return { p, y };
      });
    paths.push({ pts, inward: () => inw, side: sideOf(layout, mid, inw) });
  }
  return paths;
}

/** Left or right of the climber: look at the step beside the rail. */
function sideOf(layout: StairLayout, mid: Vec2, inw: Vec2): 'left' | 'right' {
  const probe: Vec2 = [mid[0] + inw[0] * 0.05, mid[1] + inw[1] * 0.05];
  let owner = layout.treads[0]!;
  for (const t of layout.treads) {
    const [x0, z0, x1, z1] = t.rect;
    if (probe[0] >= x0 - 1e-6 && probe[0] <= x1 + 1e-6 && probe[1] >= z0 - 1e-6 && probe[1] <= z1 + 1e-6) {
      owner = t;
      break;
    }
  }
  const cx = (owner.rect[0] + owner.rect[2]) / 2;
  const cz = (owner.rect[1] + owner.rect[3]) / 2;
  // Facing along (dx, dz) on the plan (x east, z south), the left-hand side is (dz, -dx).
  return (mid[0] - cx) * owner.dir[1] + (mid[1] - cz) * -owner.dir[0] > 0 ? 'left' : 'right';
}

/**
 * Guard rail at the level of the upper floor round its opening: along the cut edge where the steps pass under the floor, and
 * along the sides as far as the stair's own rail is still too low to guard the edge. Not across the exit.
 */
function guardPaths(layout: StairLayout, ctx: StairRailContext): RailPath[] {
  const hole = stairHole(layout);
  const o = layout.outline;
  const last = layout.treads[layout.treads.length - 1]!;
  const [lx0, lz0, lx1, lz1] = last.rect;
  const [dx, dz] = last.dir;
  const onArrival = (p: Vec2): boolean => (dz < -0.5 ? Math.abs(p[1] - lz0) < 1e-6 && p[0] >= lx0 - 1e-6 && p[0] <= lx1 + 1e-6 : dz > 0.5 ? Math.abs(p[1] - lz1) < 1e-6 && p[0] >= lx0 - 1e-6 && p[0] <= lx1 + 1e-6 : dx < -0.5 ? Math.abs(p[0] - lx0) < 1e-6 && p[1] >= lz0 - 1e-6 && p[1] <= lz1 + 1e-6 : Math.abs(p[0] - lx1) < 1e-6 && p[1] >= lz0 - 1e-6 && p[1] <= lz1 + 1e-6);
  const sideEdge = (a: Vec2, b: Vec2): boolean => {
    const mid: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    return o.some((q, i) => onSegment(a, q, o[(i + 1) % o.length]!, 1e-4) && onSegment(b, q, o[(i + 1) % o.length]!, 1e-4) && onSegment(mid, q, o[(i + 1) % o.length]!, 1e-4));
  };
  const paths: RailPath[] = [];
  for (let i = 0; i < hole.length; i++) {
    let a = hole[i]!;
    let b = hole[(i + 1) % hole.length]!;
    const len = dist(a, b);
    if (len < 0.05) continue;
    if (onArrival(a) && onArrival(b)) continue; // the exit
    const side = sideEdge(a, b);
    if (ctx.skip?.(a, b, 'guard')) continue;
    const u: Vec2 = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    const mid: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let inw: Vec2 = [-u[1], u[0]];
    if (!pointInPolygon([mid[0] + inw[0] * 0.03, mid[1] + inw[1] * 0.03], hole, 0)) inw = [-inw[0], -inw[1]];
    if (side) {
      // The stair's own rail takes over once it stands high enough above the floor: keep the part of the edge below that.
      const low = (s: number): boolean => {
        const p: Vec2 = [a[0] + u[0] * s, a[1] + u[1] * s];
        const h = stairHeightAt(layout, [p[0] + inw[0] * 0.01, p[1] + inw[1] * 0.01]) ?? stairHeightAt(layout, p) ?? 0;
        return h < layout.rise - 0.3;
      };
      const steps = Math.max(2, Math.ceil(len / 0.05));
      let s0 = -1;
      let s1 = -1;
      for (let k = 0; k <= steps; k++) {
        const s = (len * k) / steps;
        if (low(s)) {
          if (s0 < 0) s0 = s;
          s1 = s;
        }
      }
      if (s0 < 0 || s1 - s0 < 0.05) continue;
      const a2: Vec2 = [a[0] + u[0] * s0, a[1] + u[1] * s0];
      const b2: Vec2 = [a[0] + u[0] * s1, a[1] + u[1] * s1];
      a = a2;
      b = b2;
    }
    paths.push({ pts: [{ p: a, y: layout.rise }, { p: b, y: layout.rise }], inward: () => inw, flat: true, side: side ? sideOf(layout, mid, inw) : undefined });
  }
  return paths;
}

/** The outer rail of a spiral stair (a helix, then flat round the rest of the opening on the upper floor). */
function spiralPaths(layout: StairLayout): RailPath[] {
  const sp = layout.spiral!;
  const R = sp.radius - 0.035;
  const count = layout.treads.length;
  const pt = (r: number, th: number): Vec2 => [r * Math.sin(th), r * Math.cos(th)];
  const pts: RailPoint[] = [];
  for (let j = 0; j <= count; j++) {
    const th = j * sp.delta;
    const y = j === count ? layout.rise : layout.treads[j]!.height;
    if (j > 0) pts.push({ p: pt(R, th - sp.delta / 2), y: (pts[pts.length - 1]!.y + y) / 2 });
    pts.push({ p: pt(R, th), y });
  }
  // Flat on the upper floor round the part of the circle the steps do not reach.
  const turned = Math.abs(count * sp.delta);
  const sign = Math.sign(sp.delta) || 1;
  for (let a = turned + (12 * Math.PI) / 180; a < 2 * Math.PI - 1e-3; a += (12 * Math.PI) / 180) pts.push({ p: pt(R, a * sign), y: layout.rise });
  pts.push({ p: pt(R, 2 * Math.PI * sign), y: layout.rise });
  return [{ pts, inward: (p) => { const l = Math.hypot(p[0], p[1]) || 1; return [-p[0] / l, -p[1] / l]; } }];
}

/**
 * Handrail, posts and infill for a stair, in the same local frame as the steps.
 * The rail runs on every open side: both sides of a flight, round the landing, along the inner edge of a U, and (at floor level)
 * round the opening on the upper floor; only where you step on and off is it left open. Spiral stairs get a helical rail and a
 * centre pole. `options` shape it (infill, height, handrail, spacing, posts, sides); `true` is the old shorthand for a glass railing.
 */
export function buildStairRailing(layout: StairLayout, options: Partial<RailOptions> | boolean = {}, ctx: StairRailContext = {}): RailMesh | null {
  const o: RailOptions = { ...DEFAULT_RAIL, spacing: 1.2, ...(options === true ? { infill: 'glass' as const } : options === false ? {} : options) };
  let paths = layout.spiral ? spiralPaths(layout) : [...flightPaths(layout, ctx), ...guardPaths(layout, ctx)];
  if (!layout.spiral && o.sides !== 'both') paths = paths.filter((p) => p.side === o.sides);
  const H = Math.min(1.3, Math.max(0.6, o.height));
  const spiral = layout.spiral;
  return buildRailFromPaths(paths, o, {
    under: (p) => stairHeightAt(layout, p),
    extra: spiral && o.pole !== false ? (frame) => frame.column(0, 0, spiral.pole, 0, layout.rise + H, 12) : undefined,
  });
}
