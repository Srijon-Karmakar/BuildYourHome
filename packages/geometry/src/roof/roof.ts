import earcut from 'earcut';
import type { Vec2 } from '@hd/scene-schema';

export type RoofStyleId = 'gable' | 'hip' | 'flat' | 'shed' | 'butterfly' | 'mansard' | 'barrel';

export interface OrientedBox {
  cx: number;
  cz: number;
  /** Direction of the long axis in plan (radians, atan2(z, x)). */
  angle: number;
  length: number;
  width: number;
}

export const MIN_PITCH_DEG = 5;
export const MAX_PITCH_DEG = 60;
export const FLAT_ROOF_THICKNESS_M = 0.18;
const MAX_RISE_M = 6;

function convexHull(points: readonly Vec2[]): Vec2[] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o: Vec2, a: Vec2, b: Vec2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Vec2[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: Vec2[] = [];
  for (const q of [...p].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** Smallest-area rectangle (any rotation) around the points; the long side is `length`. Null if degenerate. */
export function orientedBox(points: readonly Vec2[]): OrientedBox | null {
  const hull = convexHull(points);
  if (hull.length < 3) return null;
  let best: { area: number; angle: number; minU: number; maxU: number; minV: number; maxV: number } | null = null;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i]!;
    const b = hull[(i + 1) % hull.length]!;
    const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const q of hull) {
      const u = q[0] * c + q[1] * s;
      const v = -q[0] * s + q[1] * c;
      minU = Math.min(minU, u);
      maxU = Math.max(maxU, u);
      minV = Math.min(minV, v);
      maxV = Math.max(maxV, v);
    }
    const area = (maxU - minU) * (maxV - minV);
    if (!best || area < best.area - 1e-9) best = { area, angle, minU, maxU, minV, maxV };
  }
  if (!best) return null;
  const c = Math.cos(best.angle);
  const s = Math.sin(best.angle);
  const cu = (best.minU + best.maxU) / 2;
  const cv = (best.minV + best.maxV) / 2;
  let length = best.maxU - best.minU;
  let width = best.maxV - best.minV;
  let angle = best.angle;
  if (width > length) {
    [length, width] = [width, length];
    angle += Math.PI / 2;
  }
  if (width < 0.1) return null;
  return { cx: cu * c - cv * s, cz: cu * s + cv * c, angle: Math.atan2(Math.sin(angle), Math.cos(angle)), length, width };
}

type V3 = [number, number, number];

/** Material slot per triangle group; the app maps each to a material. */
export type RoofSlot = 'roof' | 'gable' | 'trim' | 'gutter' | 'chimney' | 'glass';
export const ROOF_SLOTS: readonly RoofSlot[] = ['roof', 'gable', 'trim', 'gutter', 'chimney', 'glass'];

export interface RoofMeshData {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
  /** Non-empty groups only, in ROOF_SLOTS order. */
  groups: { slot: RoofSlot; start: number; count: number }[];
}

class Tris {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];

  /**
   * Adds a triangle whose normal points AWAY from `inside` (a point strictly inside the solid).
   * Texture coordinates are laid on the face itself (metres along the eave, metres up the slope), so tile rows
   * and ribs follow the roof instead of being stretched by the slope.
   */
  tri(a: V3, b: V3, c: V3, inside: V3): void {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!];
    const len = Math.hypot(n[0]!, n[1]!, n[2]!);
    if (len < 1e-9) return; // degenerate (e.g. the end triangles of a pyramid hip)
    n = n.map((x) => x / len);
    const m = [(a[0] + b[0] + c[0]) / 3 - inside[0], (a[1] + b[1] + c[1]) / 3 - inside[1], (a[2] + b[2] + c[2]) / 3 - inside[2]];
    if (n[0]! * m[0]! + n[1]! * m[1]! + n[2]! * m[2]! < 0) {
      [b, c] = [c, b];
      n = n.map((x) => -x);
    }
    // Face basis: t1 runs level along the face, t2 runs up / across it.
    let t1: V3;
    if (Math.abs(n[1]!) > 0.98) t1 = [1, 0, 0];
    else {
      const h = Math.hypot(n[0]!, n[2]!);
      t1 = [-n[2]! / h, 0, n[0]! / h];
    }
    const t2: V3 = [n[1]! * t1[2] - n[2]! * t1[1], n[2]! * t1[0] - n[0]! * t1[2], n[0]! * t1[1] - n[1]! * t1[0]];
    for (const p of [a, b, c]) {
      this.pos.push(...p);
      this.nor.push(n[0]!, n[1]!, n[2]!);
      this.uv.push(p[0] * t1[0] + p[1] * t1[1] + p[2] * t1[2], p[0] * t2[0] + p[1] * t2[1] + p[2] * t2[2]);
    }
  }

  quad(a: V3, b: V3, c: V3, d: V3, inside: V3): void {
    this.tri(a, b, c, inside);
    this.tri(a, c, d, inside);
  }

  /** Like `tri`, but the face looks along `dir` (up for a roof surface, down for a soffit). Robust for sloped faces. */
  triDir(a: V3, b: V3, c: V3, dir: V3): void {
    const probe: V3 = [(a[0] + b[0] + c[0]) / 3 - dir[0], (a[1] + b[1] + c[1]) / 3 - dir[1], (a[2] + b[2] + c[2]) / 3 - dir[2]];
    this.tri(a, b, c, probe);
  }

  quadDir(a: V3, b: V3, c: V3, d: V3, dir: V3): void {
    this.triDir(a, b, c, dir);
    this.triDir(a, c, d, dir);
  }

  /** An axis-aligned-in-the-roof-frame box (u, v, y extents given as centre + size) — used for caps, gutters, chimneys. */
  box(P: (u: number, v: number, y: number) => V3, cu: number, cv: number, y0: number, su: number, sv: number, h: number): void {
    const u0 = cu - su / 2, u1 = cu + su / 2, v0 = cv - sv / 2, v1 = cv + sv / 2, y1 = y0 + h;
    const inside = P(cu, cv, y0 + h / 2);
    this.quad(P(u0, v0, y1), P(u1, v0, y1), P(u1, v1, y1), P(u0, v1, y1), inside);
    this.quad(P(u0, v0, y0), P(u1, v0, y0), P(u1, v0, y1), P(u0, v0, y1), inside);
    this.quad(P(u1, v0, y0), P(u1, v1, y0), P(u1, v1, y1), P(u1, v0, y1), inside);
    this.quad(P(u1, v1, y0), P(u0, v1, y0), P(u0, v1, y1), P(u1, v1, y1), inside);
    this.quad(P(u0, v1, y0), P(u0, v0, y0), P(u0, v0, y1), P(u0, v1, y1), inside);
  }
}

export interface RoofParams {
  style: RoofStyleId;
  /** Slope in degrees (ignored for flat). Clamped to 5-60. */
  pitchDeg: number;
  /** How far the roof projects beyond the outside of the walls along the eaves (m). */
  overhang: number;
  /** Run the ridge along the SHORT side instead of the long one. */
  swap?: boolean;
  /** How far the gable ends project (barge). Default: the same as the overhang. */
  rake?: number;
  /** Thickness of the roof edge (m). Default 0.12 (flat roofs 0.18). */
  thickness?: number;
  ridgeCap?: boolean;
  gutter?: boolean;
  /** A brick chimney through the roof (gable, hip, flat, shed). */
  chimney?: boolean;
  /** Flat roofs: height of the low wall round the edge (m); 0 = none. */
  parapet?: number;
  /** Dormer windows on the long slopes of gable and hip roofs: `pos` -1..1 along the ridge, `side` ±1 = which slope. */
  dormers?: { pos: number; side: 1 | -1; width: number }[];
  /**
   * Flat roofs: openings cut through the slab (world x, z), e.g. where stairs climb on through the roof. Each is clipped to
   * the roof (kept 2 cm in from its edge); the cut faces get the trim colour.
   */
  holes?: readonly (readonly Vec2[])[];
}

/** `poly` (roof-frame u, v) cut to the rectangle |u| <= a, |v| <= b. */
function clipToRect(poly: readonly Vec2[], a: number, b: number): Vec2[] {
  let out: Vec2[] = poly.map((p): Vec2 => [p[0], p[1]]);
  const planes: Array<(p: Vec2) => number> = [(p) => a - p[0], (p) => p[0] + a, (p) => b - p[1], (p) => p[1] + b];
  for (const d of planes) {
    const next: Vec2[] = [];
    for (let i = 0; i < out.length; i++) {
      const p = out[i]!;
      const q = out[(i + 1) % out.length]!;
      const dp = d(p);
      const dq = d(q);
      if (dp >= 0) next.push(p);
      if (dp >= 0 !== dq >= 0) {
        const k = dp / (dp - dq);
        next.push([p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k]);
      }
    }
    out = next;
    if (out.length < 3) return [];
  }
  return out;
}

const signedArea = (p: readonly Vec2[]): number => {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[(i + 1) % p.length]!;
    s += p[i]![0] * q[1] - q[0] * p[i]![1];
  }
  return s / 2;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const ROOF_MIN_THICKNESS_M = 0.05;
export const ROOF_MAX_THICKNESS_M = 0.4;

/**
 * Roof over the oriented rectangle `box` (the wall centre lines of the part it covers).
 * `wallHalf` = half the wall thickness, so the roof clears the outside face. `elevation` = top of the walls.
 * Pitched roofs are a plate of real thickness (fascia on the eaves, a recessed gable wall at the ends, optional ridge
 * cap, gutters and chimney); butterfly, mansard and barrel are solid shapes.
 */
export function buildRoofPart(box: OrientedBox, elevation: number, params: RoofParams, wallHalf = 0.115): RoofMeshData {
  const swap = !!params.swap;
  const angle = box.angle + (swap ? Math.PI / 2 : 0);
  const length = swap ? box.width : box.length;
  const width = swap ? box.length : box.width;
  const eaveExt = wallHalf + Math.max(0, params.overhang);
  const rakeExt = wallHalf + Math.max(0, params.rake ?? params.overhang);
  const a = length / 2 + rakeExt;
  const b = width / 2 + eaveExt;
  const tan = Math.tan((clamp(params.pitchDeg, MIN_PITCH_DEG, MAX_PITCH_DEG) * Math.PI) / 180);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const y0 = elevation;
  const P = (u: number, v: number, y: number): V3 => [box.cx + u * c - v * s, y, box.cz + u * s + v * c];
  const S: Record<RoofSlot, Tris> = { roof: new Tris(), gable: new Tris(), trim: new Tris(), gutter: new Tris(), chimney: new Tris(), glass: new Tris() };
  const T = S.roof;
  const style = params.style;
  const flat = style === 'flat';
  const t = clamp(params.thickness ?? (flat ? FLAT_ROOF_THICKNESS_M : 0.12), ROOF_MIN_THICKNESS_M, ROOF_MAX_THICKNESS_M);
  const E = y0 + t; // top of the roof at the eaves; the soffit (underside) is at y0, flush with the ceiling above the rooms
  const down = (p: V3, d: number): V3 => [p[0], p[1] - d, p[2]];

  /** A face of the plate: a quad on the top surface plus its parallel underside and the way round. */
  const plate = (q1: V3, q2: V3, q3: V3, q4: V3): void => {
    T.quadDir(q1, q2, q3, q4, [0, 1, 0]);
    T.quadDir(down(q1, t), down(q2, t), down(q3, t), down(q4, t), [0, -1, 0]);
  };
  /** The vertical edge of the plate along p → q (fascia on an eave, barge board on a rake). */
  const edge = (p: V3, q: V3, slot: RoofSlot, towards: V3): void => {
    S[slot].quad(p, q, down(q, t), down(p, t), towards);
  };

  let ridgeU = 0; // half length of the ridge line (for the cap)
  let ridgeY = E; // ridge height
  let chimneyAt: { u: number; v: number; y: number } | null = null;

  if (style === 'butterfly' || style === 'mansard' || style === 'barrel') {
    // Solid shapes (no plate): kept as before, standing on the wall tops.
    const C1 = (yy = y0) => P(-a, -(width / 2 + eaveExt), yy);
    const C2 = (yy = y0) => P(a, -(width / 2 + eaveExt), yy);
    const C3 = (yy = y0) => P(a, width / 2 + eaveExt, yy);
    const C4 = (yy = y0) => P(-a, width / 2 + eaveExt, yy);
    if (style === 'butterfly') {
      const h = Math.min(MAX_RISE_M, b * tan * 0.7);
      const low = 0.12;
      const L1 = P(-a, 0, y0 + low);
      const L2 = P(a, 0, y0 + low);
      const far = P(0, 0, y0 - 3);
      T.quad(C1(y0 + h), C2(y0 + h), L2, L1, far);
      T.quad(C4(y0 + h), C3(y0 + h), L2, L1, far);
      T.quad(C1(), C2(), C3(), C4(), P(0, 0, y0 + h));
      for (const [s0, s1, end] of [[C1, C4, -1], [C2, C3, 1]] as const) {
        const inside = P(-end, 0, y0 + h / 2);
        T.tri(s0(), s1(), end < 0 ? L1 : L2, inside);
        T.tri(s1(), s1(y0 + h), end < 0 ? L1 : L2, inside);
        T.tri(s0(), end < 0 ? L1 : L2, s0(y0 + h), inside);
      }
    } else if (style === 'mansard') {
      const m = Math.min(a, b);
      const H = Math.min(MAX_RISE_M, b * tan * 0.9);
      const h1 = H * 0.6;
      const h2 = H * 0.4;
      const i1 = Math.min(m * 0.45, h1 / Math.tan((70 * Math.PI) / 180));
      const i2 = m * 0.82;
      const ring = (i: number, yy: number): V3[] => [P(-a + i, -b + i, yy), P(a - i, -b + i, yy), P(a - i, b - i, yy), P(-a + i, b - i, yy)];
      const e = ring(0, y0);
      const mid = ring(i1, y0 + h1);
      const top = ring(i2, y0 + h1 + h2);
      const inside = P(0, 0, y0 + (h1 + h2) * 0.3);
      for (let k = 0; k < 4; k++) {
        const n = (k + 1) % 4;
        T.quad(e[k]!, e[n]!, mid[n]!, mid[k]!, inside);
        T.quad(mid[k]!, mid[n]!, top[n]!, top[k]!, inside);
      }
      T.quad(top[0]!, top[1]!, top[2]!, top[3]!, inside);
      T.quad(e[0]!, e[1]!, e[2]!, e[3]!, inside);
    } else {
      const h = Math.min(MAX_RISE_M, b * tan * 0.8);
      const n = 12;
      const arc = (u: number): V3[] => Array.from({ length: n + 1 }, (_, i) => P(u, -b + (2 * b * i) / n, y0 + h * Math.sin((Math.PI * i) / n)));
      const A = arc(-a);
      const B = arc(a);
      const inside = P(0, 0, y0 + h * 0.3);
      for (let i = 0; i < n; i++) {
        T.quad(A[i]!, B[i]!, B[i + 1]!, A[i + 1]!, inside);
        S.gable.tri(C1(), A[i]!, A[i + 1]!, inside); // vaulted ends show the wall colour
        S.gable.tri(C2(), B[i]!, B[i + 1]!, inside);
      }
      T.quad(C1(), C2(), C3(), C4(), inside);
    }
  } else if (flat) {
    const c1 = P(-a, -b, E), c2 = P(a, -b, E), c3 = P(a, b, E), c4 = P(-a, b, E);
    // Openings in the slab, in the roof's own frame (u along `angle`, v across).
    const toUV = (w: Vec2): Vec2 => {
      const dx = w[0] - box.cx;
      const dz = w[1] - box.cz;
      return [dx * c + dz * s, -dx * s + dz * c];
    };
    const holes = (params.holes ?? []).map((h) => clipToRect(h.map(toUV), a - 0.02, b - 0.02)).filter((h) => h.length >= 3 && Math.abs(signedArea(h)) > 0.05);
    if (holes.length === 0) {
      T.quadDir(c1, c2, c3, c4, [0, 1, 0]); // top
      T.quadDir(down(c1, t), down(c2, t), down(c3, t), down(c4, t), [0, -1, 0]); // soffit
    } else {
      const outer: Vec2[] = [[-a, -b], [a, -b], [a, b], [-a, b]];
      const all = [...outer, ...holes.flat()];
      const starts: number[] = [];
      let at = outer.length;
      for (const h of holes) {
        starts.push(at);
        at += h.length;
      }
      const tri = earcut(all.flatMap((p) => [p[0], p[1]]), starts);
      for (let k = 0; k < tri.length; k += 3) {
        const [p, q, r] = [all[tri[k]!]!, all[tri[k + 1]!]!, all[tri[k + 2]!]!];
        T.triDir(P(p[0], p[1], E), P(q[0], q[1], E), P(r[0], r[1], E), [0, 1, 0]);
        T.triDir(P(p[0], p[1], E - t), P(q[0], q[1], E - t), P(r[0], r[1], E - t), [0, -1, 0]);
      }
      // The cut faces round each opening, facing into it.
      for (const h of holes) {
        const ccw = signedArea(h) > 0;
        for (let i = 0; i < h.length; i++) {
          const p = h[i]!;
          const q = h[(i + 1) % h.length]!;
          const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
          if (len < 1e-4) continue;
          // Normal pointing out of the hole region (into the slab).
          const nx = ((q[1] - p[1]) / len) * (ccw ? 1 : -1);
          const nz = (-(q[0] - p[0]) / len) * (ccw ? 1 : -1);
          const solid = P((p[0] + q[0]) / 2 + nx * 0.05, (p[1] + q[1]) / 2 + nz * 0.05, E - t / 2);
          S.trim.quad(P(p[0], p[1], E), P(q[0], q[1], E), P(q[0], q[1], E - t), P(p[0], p[1], E - t), solid);
        }
      }
    }
    edge(c1, c2, 'trim', P(0, 0, E - t / 2));
    edge(c2, c3, 'trim', P(0, 0, E - t / 2));
    edge(c3, c4, 'trim', P(0, 0, E - t / 2));
    edge(c4, c1, 'trim', P(0, 0, E - t / 2));
    const para = clamp(params.parapet ?? 0, 0, 0.9);
    if (para > 0.05) {
      // A low wall round the edge: wall colour, a coping on top.
      const pw = 0.12;
      const i = 0.04;
      const uu = a - i - pw / 2;
      const vv = b - i - pw / 2;
      S.gable.box(P, 0, -vv, E, 2 * a - 2 * i, pw, para);
      S.gable.box(P, 0, vv, E, 2 * a - 2 * i, pw, para);
      S.gable.box(P, -uu, 0, E, pw, 2 * vv - pw, para);
      S.gable.box(P, uu, 0, E, pw, 2 * vv - pw, para);
      S.trim.box(P, 0, -vv, E + para, 2 * a - 2 * i + 0.04, pw + 0.05, 0.035);
      S.trim.box(P, 0, vv, E + para, 2 * a - 2 * i + 0.04, pw + 0.05, 0.035);
      S.trim.box(P, -uu, 0, E + para, pw + 0.05, 2 * vv - pw, 0.035);
      S.trim.box(P, uu, 0, E + para, pw + 0.05, 2 * vv - pw, 0.035);
    }
    chimneyAt = { u: a * 0.45, v: -b * 0.35, y: E };
  } else if (style === 'shed') {
    const h = Math.min(MAX_RISE_M, 2 * b * tan);
    const c1 = P(-a, -b, E), c2 = P(a, -b, E), c3 = P(a, b, E + h), c4 = P(-a, b, E + h);
    plate(c1, c2, c3, c4);
    const inner = P(0, 0, E + h / 2 - t / 2);
    edge(c1, c2, 'trim', inner); // low eave
    edge(c4, c3, 'trim', inner); // high edge
    // The sloped sides of the plate.
    S.trim.quad(c1, c4, down(c4, t), down(c1, t), P(a, 0, E + h / 2 - t / 2));
    S.trim.quad(c2, c3, down(c3, t), down(c2, t), P(-a, 0, E + h / 2 - t / 2));
    // The wall continues up to the sloping soffit at both ends.
    for (const end of [-1, 1] as const) {
      const U = end * (length / 2 + wallHalf);
      const V = width / 2 + wallHalf;
      const yb = (v: number) => y0 + ((v + b) / (2 * b)) * h;
      S.gable.quad(P(U, -V, y0), P(U, V, y0), P(U, V, yb(V)), P(U, -V, yb(-V)), P(U - end, 0, y0 + 0.3));
    }
    ridgeY = E + h;
    chimneyAt = { u: a * 0.4, v: 0, y: E + h / 2 };
  } else {
    // gable / hip
    const h = Math.min(MAX_RISE_M, b * tan);
    const r = style === 'hip' ? Math.max(0, a - b) : a; // half length of the ridge
    ridgeU = r;
    ridgeY = E + h;
    const R1 = P(-r, 0, E + h);
    const R2 = P(r, 0, E + h);
    const c1 = P(-a, -b, E), c2 = P(a, -b, E), c3 = P(a, b, E), c4 = P(-a, b, E);
    const fascia = P(0, 0, E - t / 2);
    plate(c1, c2, R2, R1);
    plate(c3, c4, R1, R2);
    edge(c1, c2, 'trim', fascia);
    edge(c3, c4, 'trim', fascia);
    if (style === 'hip') {
      // The two hipped ends slope down to the eave as well.
      plate(c4, c1, R1, R1);
      plate(c2, c3, R2, R2);
      edge(c4, c1, 'trim', fascia);
      edge(c2, c3, 'trim', fascia);
    } else {
      // Gable: a barge edge along each rake, and the gable wall recessed to the wall plane.
      for (const end of [-1, 1] as const) {
        const ua = end * a;
        const peak = P(ua, 0, E + h);
        const left = P(ua, -b, E);
        const right = P(ua, b, E);
        const inner = P(ua - end * 0.2, 0, E + h / 2 - t / 2);
        S.trim.quad(left, peak, down(peak, t), down(left, t), inner);
        S.trim.quad(peak, right, down(right, t), down(peak, t), inner);
        const U = end * (length / 2 + wallHalf);
        const V = width / 2 + wallHalf;
        const yb = y0 + h * (1 - V / b); // the soffit above the outer wall face
        const inside = P(U - end, 0, y0 + 0.3);
        S.gable.quad(P(U, -V, y0), P(U, V, y0), P(U, V, yb), P(U, -V, yb), inside);
        S.gable.tri(P(U, -V, yb), P(U, V, yb), P(U, 0, y0 + h), inside);
      }
    }
    // Dormers: a little gabled house with a window poking out of a long slope.
    for (const dm of (params.dormers ?? []).slice(0, 8)) {
      const dw = clamp(dm.width, 0.6, 3);
      const reach = (style === 'hip' ? r : a - 0.5) - dw / 2 - 0.25;
      if (reach < 0) continue;
      const sd = dm.side >= 0 ? 1 : -1;
      const u0 = clamp(dm.pos, -1, 1) * reach;
      const ul = u0 - dw / 2;
      const ur = u0 + dw / 2;
      const slopeY = (v: number) => E + h * (1 - Math.abs(v) / b);
      const vf = sd * b * 0.66;
      const yf = slopeY(vf);
      const gableH = (dw / 2) * Math.tan((22 * Math.PI) / 180);
      const wallH = Math.min(1.1, E + h - 0.18 - yf - gableH);
      if (wallH < 0.6) continue; // the roof is too flat or low for a dormer here
      const yt = yf + wallH;
      const ya = yt + gableH;
      const ve = sd * b * (1 - (yt - E) / h); // where the dormer eave meets the main slope
      const vr = sd * b * (1 - (ya - E) / h); // where its ridge does
      const inside = (v: number, y: number): V3 => P(u0, v, y);
      // Front wall and gable triangle (wall colour), the two cheeks, the two small roof slopes.
      S.gable.quad(P(ul, vf, yf), P(ur, vf, yf), P(ur, vf, yt), P(ul, vf, yt), inside(vf - sd * 0.4, yf + 0.3));
      S.gable.tri(P(ul, vf, yt), P(ur, vf, yt), P(u0, vf, ya), inside(vf - sd * 0.4, yt));
      S.gable.tri(P(ul, vf, yf), P(ul, vf, yt), P(ul, ve, yt), P(u0, vf, yf + 0.2));
      S.gable.tri(P(ur, vf, yf), P(ur, vf, yt), P(ur, ve, yt), P(u0, vf, yf + 0.2));
      T.quadDir(P(ul, vf, yt), P(u0, vf, ya), P(u0, vr, ya), P(ul, ve, yt), [0, 1, 0]);
      T.quadDir(P(u0, vf, ya), P(ur, vf, yt), P(ur, ve, yt), P(u0, vr, ya), [0, 1, 0]);
      // The window: painted frame and a glass pane, a little proud of the wall.
      const ww = dw * 0.58;
      const wh = Math.min(wallH * 0.62, 0.95);
      const wy = yf + Math.min(0.28, wallH * 0.2);
      const vw = vf + sd * 0.035;
      const fr = 0.06;
      S.trim.box(P, u0, vw, wy, ww + fr, 0.07, fr);
      S.trim.box(P, u0, vw, wy + wh - fr, ww + fr, 0.07, fr);
      S.trim.box(P, u0 - ww / 2, vw, wy, fr, 0.07, wh);
      S.trim.box(P, u0 + ww / 2, vw, wy, fr, 0.07, wh);
      S.trim.box(P, u0, vw, wy + wh / 2 - fr / 2, fr * 0.7, 0.06, fr);
      S.glass.quad(P(u0 - ww / 2, vf + sd * 0.012, wy + fr), P(u0 + ww / 2, vf + sd * 0.012, wy + fr), P(u0 + ww / 2, vf + sd * 0.012, wy + wh - fr), P(u0 - ww / 2, vf + sd * 0.012, wy + wh - fr), inside(vf - sd * 0.4, wy + wh / 2));
      // A sill under the window and a painted edge along the front of the dormer roof.
      S.trim.box(P, u0, vw + sd * 0.03, wy - 0.05, ww + 0.2, 0.12, 0.05);
      S.trim.quad(P(ul - 0.04, vf + sd * 0.04, yt - 0.04), P(u0, vf + sd * 0.04, ya - 0.0), P(u0, vf + sd * 0.04, ya - 0.07), P(ul - 0.04, vf + sd * 0.04, yt - 0.11), inside(vf - sd * 0.4, yt));
      S.trim.quad(P(u0, vf + sd * 0.04, ya), P(ur + 0.04, vf + sd * 0.04, yt - 0.04), P(ur + 0.04, vf + sd * 0.04, yt - 0.11), P(u0, vf + sd * 0.04, ya - 0.07), inside(vf - sd * 0.4, yt));
    }
    chimneyAt = { u: r * 0.5 || a * 0.2, v: 0, y: E + h };
  }

  // Ridge cap along the top of gable / hip roofs.
  if (params.ridgeCap !== false && (style === 'gable' || style === 'hip') && ridgeU > 0.2) {
    S.roof.box(P, 0, 0, ridgeY - 0.03, 2 * ridgeU + 0.12, 0.2, 0.1);
  }
  // Gutters hang on the eave fascia of the plate styles.
  if (params.gutter && (style === 'gable' || style === 'hip' || style === 'flat' || style === 'shed')) {
    const ga = a - 0.02;
    const gy = E - t - 0.075;
    S.gutter.box(P, 0, -b - 0.045, gy, 2 * ga, 0.09, 0.08);
    S.gutter.box(P, 0, b + 0.045, gy, 2 * ga, 0.09, 0.08);
  }
  // Chimney: a brick stack with a cap, sunk into the roof.
  if (params.chimney && chimneyAt && (style === 'gable' || style === 'hip' || style === 'flat' || style === 'shed')) {
    const w = 0.55;
    const top = chimneyAt.y + 0.95;
    S.chimney.box(P, chimneyAt.u, chimneyAt.v, y0 + 0.1, w, w, top - y0 - 0.1);
    S.trim.box(P, chimneyAt.u, chimneyAt.v, top, w + 0.1, w + 0.1, 0.06);
  }

  // Concatenate the slots in a fixed order.
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const groups: RoofMeshData['groups'] = [];
  let at = 0;
  for (const slot of ROOF_SLOTS) {
    const g = S[slot];
    const n = g.pos.length / 3;
    if (n === 0) continue;
    positions.push(...g.pos);
    normals.push(...g.nor);
    uvs.push(...g.uv);
    groups.push({ slot, start: at, count: n });
    at += n;
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: Uint32Array.from({ length: at }, (_, i) => i),
    groups,
  };
}

/** Roof over the oriented bounding rectangle of `points` (wall centre lines of one floor). Null for a degenerate plan. */
export function buildRoofMesh(points: readonly Vec2[], elevation: number, params: RoofParams, wallHalf = 0.115): RoofMeshData | null {
  const box = orientedBox(points);
  return box ? buildRoofPart(box, elevation, params, wallHalf) : null;
}

/**
 * The four corners (in order, seen from above) of a flat roof's top surface and the height of that surface, for a terrace
 * railing. `parapet` is the height of the low wall round the edge (0 when there is none). Null when the style is not flat.
 */
export function flatRoofEdge(box: OrientedBox, elevation: number, params: RoofParams, wallHalf = 0.115): { corners: Vec2[]; y: number; parapet: number; wall: number } | null {
  if (params.style !== 'flat') return null;
  const swap = !!params.swap;
  const angle = box.angle + (swap ? Math.PI / 2 : 0);
  const length = swap ? box.width : box.length;
  const width = swap ? box.length : box.width;
  const a = length / 2 + wallHalf + Math.max(0, params.rake ?? params.overhang);
  const b = width / 2 + wallHalf + Math.max(0, params.overhang);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const P = (u: number, v: number): Vec2 => [box.cx + u * c - v * s, box.cz + u * s + v * c];
  const t = clamp(params.thickness ?? FLAT_ROOF_THICKNESS_M, ROOF_MIN_THICKNESS_M, ROOF_MAX_THICKNESS_M);
  const para = clamp(params.parapet ?? 0, 0, 0.9);
  return { corners: [P(-a, -b), P(a, -b), P(a, b), P(-a, b)], y: elevation + t, parapet: para > 0.05 ? para : 0, wall: 0.12 };
}
