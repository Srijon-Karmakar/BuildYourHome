import type { Vec2 } from '@hd/scene-schema';
import type { MeshData } from '../wall/mesh';
import { pointInPolygon } from '../wall/footprint';

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
// Railings
// ------------------------------------------------------------------------------------------------

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

interface RailPoint {
  p: Vec2;
  /** Height of the step edge here (the rail runs RAIL_HEIGHT_M above it). */
  y: number;
}
interface RailPath {
  pts: RailPoint[];
  inward: (p: Vec2) => Vec2;
  /** Which side of the person climbing the rail is on (flights only; the rail of a spiral is always the outer one). */
  side?: 'left' | 'right';
}

const dist = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** The sides of a straight / L / U stair that need a rail: every edge of its outline except where you step on and off. */
function flightPaths(layout: StairLayout): RailPath[] {
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
    // Left or right of the climber: look at the step beside the rail.
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
    const side: 'left' | 'right' = (mid[0] - cx) * owner.dir[1] + (mid[1] - cz) * -owner.dir[0] > 0 ? 'left' : 'right';
    paths.push({ pts, inward: () => inw, side });
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

class Solids {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];

  tri(a: [number, number, number], b: [number, number, number], c: [number, number, number], inside: [number, number, number]): void {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!];
    const len = Math.hypot(n[0]!, n[1]!, n[2]!);
    if (len < 1e-12) return;
    n = n.map((v) => v / len);
    const m = [(a[0] + b[0] + c[0]) / 3 - inside[0], (a[1] + b[1] + c[1]) / 3 - inside[1], (a[2] + b[2] + c[2]) / 3 - inside[2]];
    if (n[0]! * m[0]! + n[1]! * m[1]! + n[2]! * m[2]! < 0) {
      [b, c] = [c, b];
      n = n.map((v) => -v);
    }
    for (const p of [a, b, c]) {
      this.pos.push(...p);
      this.nor.push(n[0]!, n[1]!, n[2]!);
      this.uv.push(p[0] + p[2], p[1]);
    }
  }

  quad(a: [number, number, number], b: [number, number, number], c: [number, number, number], d: [number, number, number], inside: [number, number, number]): void {
    this.tri(a, b, c, inside);
    this.tri(a, c, d, inside);
  }

  /** A bar from a to b, `w` wide (sideways) and `h` tall. */
  bar(a: [number, number, number], b: [number, number, number], w: number, h: number): void {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const l = Math.hypot(d[0]!, d[1]!, d[2]!);
    if (l < 1e-6) return;
    d[0]! /= l; d[1]! /= l; d[2]! /= l;
    // side = up × d (horizontal); up2 = d × side.
    let s = [d[2]!, 0, -d[0]!];
    const sl = Math.hypot(s[0]!, s[2]!);
    s = sl < 1e-6 ? [1, 0, 0] : [s[0]! / sl, 0, s[2]! / sl];
    const u = [d[1]! * s[2]! - d[2]! * s[1]!, d[2]! * s[0]! - d[0]! * s[2]!, d[0]! * s[1]! - d[1]! * s[0]!];
    const sgn = u[1]! < 0 ? -1 : 1;
    const corner = (p: [number, number, number], i: number, j: number): [number, number, number] => [p[0] + s[0]! * (w / 2) * i + u[0]! * sgn * (h / 2) * j, p[1] + s[1]! * (w / 2) * i + u[1]! * sgn * (h / 2) * j, p[2] + s[2]! * (w / 2) * i + u[2]! * sgn * (h / 2) * j];
    const mid: [number, number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    const A = [corner(a, -1, -1), corner(a, 1, -1), corner(a, 1, 1), corner(a, -1, 1)];
    const B = [corner(b, -1, -1), corner(b, 1, -1), corner(b, 1, 1), corner(b, -1, 1)];
    for (let k = 0; k < 4; k++) this.quad(A[k]!, A[(k + 1) % 4]!, B[(k + 1) % 4]!, B[k]!, mid);
    this.quad(A[0]!, A[1]!, A[2]!, A[3]!, mid);
    this.quad(B[0]!, B[1]!, B[2]!, B[3]!, mid);
  }

  /** A round rod from a to b (an `n`-sided prism). */
  rod(a: [number, number, number], b: [number, number, number], r: number, n = 8): void {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const l = Math.hypot(d[0]!, d[1]!, d[2]!);
    if (l < 1e-6) return;
    d[0]! /= l; d[1]! /= l; d[2]! /= l;
    let s1 = [d[2]!, 0, -d[0]!];
    const sl = Math.hypot(s1[0]!, s1[2]!);
    s1 = sl < 1e-6 ? [1, 0, 0] : [s1[0]! / sl, 0, s1[2]! / sl];
    const u = [d[1]! * s1[2]! - d[2]! * s1[1]!, d[2]! * s1[0]! - d[0]! * s1[2]!, d[0]! * s1[1]! - d[1]! * s1[0]!];
    const ring = (p: [number, number, number], k: number): [number, number, number] => {
      const t = (k / n) * Math.PI * 2;
      const c = Math.cos(t) * r;
      const s = Math.sin(t) * r;
      return [p[0] + s1[0]! * c + u[0]! * s, p[1] + s1[1]! * c + u[1]! * s, p[2] + s1[2]! * c + u[2]! * s];
    };
    const mid: [number, number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    for (let k = 0; k < n; k++) {
      this.quad(ring(a, k), ring(a, k + 1), ring(b, k + 1), ring(b, k), mid);
      this.tri(a, ring(a, k), ring(a, k + 1), mid);
      this.tri(b, ring(b, k), ring(b, k + 1), mid);
    }
  }

  post(x: number, z: number, y0: number, y1: number, w: number): void {
    this.bar([x, y0, z], [x, y1, z], w, w);
  }

  /** A thin panel between two vertical edges. */
  panel(p: Vec2, q: Vec2, y0p: number, y1p: number, y0q: number, y1q: number, thick: number): void {
    const d = [q[0] - p[0], q[1] - p[1]];
    const l = Math.hypot(d[0]!, d[1]!) || 1;
    const nx = (-d[1]! / l) * (thick / 2);
    const nz = (d[0]! / l) * (thick / 2);
    const mid: [number, number, number] = [(p[0] + q[0]) / 2, (y0p + y1q) / 2, (p[1] + q[1]) / 2];
    const f = (s: number): [[number, number, number], [number, number, number], [number, number, number], [number, number, number]] => [
      [p[0] + nx * s, y0p, p[1] + nz * s],
      [q[0] + nx * s, y0q, q[1] + nz * s],
      [q[0] + nx * s, y1q, q[1] + nz * s],
      [p[0] + nx * s, y1p, p[1] + nz * s],
    ];
    const A = f(1);
    const B = f(-1);
    this.quad(A[0], A[1], A[2], A[3], mid);
    this.quad(B[0], B[1], B[2], B[3], mid);
    this.quad(A[3], A[2], B[2], B[3], mid);
    this.quad(A[0], A[1], B[1], B[0], mid);
    this.quad(A[0], A[3], B[3], B[0], mid);
    this.quad(A[1], A[2], B[2], B[1], mid);
  }

  column(cx: number, cz: number, r: number, y0: number, y1: number, n = 10): void {
    const mid: [number, number, number] = [cx, (y0 + y1) / 2, cz];
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      const p0: [number, number, number] = [cx + r * Math.cos(a0), y0, cz + r * Math.sin(a0)];
      const p1: [number, number, number] = [cx + r * Math.cos(a1), y0, cz + r * Math.sin(a1)];
      this.quad(p0, p1, [p1[0], y1, p1[2]], [p0[0], y1, p0[2]], mid);
      this.tri([cx, y1, cz], [p0[0], y1, p0[2]], [p1[0], y1, p1[2]], mid);
    }
  }
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
}

export const DEFAULT_RAIL: RailOptions = { infill: 'balusters', height: RAIL_HEIGHT_M, handrail: 'flat', gap: 0.12, post: 0.045, sides: 'both' };

/** Handrail section (width, height) per shape. */
const HANDRAIL: Record<RailHandrail, [number, number]> = { round: [0.05, 0.05], flat: [0.06, 0.04], wide: [0.14, 0.045] };

/**
 * Handrail, posts and infill for a stair, in the same local frame as the steps.
 * The rail runs on every open side: both sides of a flight, round the landing, along the inner edge of a U, and round the
 * stairwell on the upper floor; only where you step on and off is it left open. Spiral stairs get a helical rail and a centre pole.
 * `options` shape it (infill, height, handrail, spacing, posts, sides); `true` is the old shorthand for a glass railing.
 */
export function buildStairRailing(layout: StairLayout, options: Partial<RailOptions> | boolean = {}): RailMesh | null {
  const o: RailOptions = { ...DEFAULT_RAIL, ...(options === true ? { infill: 'glass' as const } : options === false ? {} : options) };
  const H = Math.min(1.3, Math.max(0.6, o.height));
  const gap = Math.min(0.4, Math.max(0.05, o.gap));
  const post = Math.min(0.15, Math.max(0.02, o.post));
  let paths = layout.spiral ? spiralPaths(layout) : flightPaths(layout);
  if (!layout.spiral && o.sides !== 'both') paths = paths.filter((p) => p.side === o.sides);
  if (paths.length === 0) return null;
  const frame = new Solids();
  const gl = new Solids();
  const pn = new Solids();
  const [hw, hh] = HANDRAIL[o.handrail];
  for (const path of paths) {
    const pts = path.pts;
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      const len = dist(a.p, b.p);
      if (o.handrail === 'round') frame.rod([a.p[0], a.y + H, a.p[1]], [b.p[0], b.y + H, b.p[1]], hw / 2);
      else frame.bar([a.p[0], a.y + H, a.p[1]], [b.p[0], b.y + H, b.p[1]], hw, hh); // handrail
      if (o.infill === 'glass') {
        gl.panel(a.p, b.p, a.y + 0.04, a.y + H - hh - 0.01, b.y + 0.04, b.y + H - hh - 0.01, 0.012);
      } else if (o.infill === 'solid') {
        pn.panel(a.p, b.p, a.y, a.y + H - hh * 0.5, b.y, b.y + H - hh * 0.5, 0.07);
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
          const under = stairHeightAt(layout, [p[0] + inw[0] * 0.03, p[1] + inw[1] * 0.03]) ?? Math.min(a.y, b.y);
          if (top - under > 0.3) frame.post(p[0], p[1], under, top, 0.014);
        }
      }
    }
    for (const q of pts) frame.post(q.p[0], q.p[1], q.y, q.y + H, post);
  }
  if (layout.spiral) frame.column(0, 0, layout.spiral.pole, 0, layout.rise + H, 12);

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
  return { positions: new Float32Array(pos), normals: new Float32Array(nor), uvs: new Float32Array(uv), indices: Uint32Array.from({ length: at }, (_, i) => i), groups };
}
