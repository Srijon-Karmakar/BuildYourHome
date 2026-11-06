import type { Vec2 } from '@hd/scene-schema';
import type { MeshData } from '../wall/mesh';

export type RoofStyleId = 'gable' | 'hip' | 'flat' | 'shed' | 'butterfly' | 'mansard' | 'barrel';

export interface RoofParams {
  style: RoofStyleId;
  /** Slope in degrees (ignored for flat). Clamped to 5-60. */
  pitchDeg: number;
  /** How far the roof projects beyond the outside of the walls (m). */
  overhang: number;
  /** Run the ridge along the SHORT side instead of the long one. */
  swap?: boolean;
}

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

class Tris {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];

  /** Adds a triangle whose normal points AWAY from `inside` (a point strictly inside the solid). */
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
    for (const p of [a, b, c]) {
      this.pos.push(...p);
      this.nor.push(n[0]!, n[1]!, n[2]!);
      this.uv.push(p[0], p[2]);
    }
  }

  quad(a: V3, b: V3, c: V3, d: V3, inside: V3): void {
    this.tri(a, b, c, inside);
    this.tri(a, c, d, inside);
  }
}

/**
 * Roof over the oriented bounding rectangle of `points` (wall centre-line nodes of one floor).
 * `wallHalf` = half the wall thickness, so the roof clears the outside face. `elevation` = top of the walls.
 * Limitation (documented): L / U shaped houses get the roof of their bounding rectangle.
 */
export function buildRoofMesh(points: readonly Vec2[], elevation: number, params: RoofParams, wallHalf = 0.115): MeshData | null {
  const box = orientedBox(points);
  if (!box) return null;
  const swap = !!params.swap;
  const angle = box.angle + (swap ? Math.PI / 2 : 0);
  const length = swap ? box.width : box.length;
  const width = swap ? box.length : box.width;
  const ext = wallHalf + Math.max(0, params.overhang);
  const a = length / 2 + ext;
  const b = width / 2 + ext;
  const tan = Math.tan((Math.min(MAX_PITCH_DEG, Math.max(MIN_PITCH_DEG, params.pitchDeg)) * Math.PI) / 180);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const y0 = elevation;
  const P = (u: number, v: number, y: number): V3 => [box.cx + u * c - v * s, y, box.cz + u * s + v * c];
  const T = new Tris();

  const C1 = (y = y0) => P(-a, -b, y);
  const C2 = (y = y0) => P(a, -b, y);
  const C3 = (y = y0) => P(a, b, y);
  const C4 = (y = y0) => P(-a, b, y);

  if (params.style === 'flat') {
    const t = FLAT_ROOF_THICKNESS_M;
    const inside = P(0, 0, y0 + t / 2);
    T.quad(C1(y0 + t), C2(y0 + t), C3(y0 + t), C4(y0 + t), inside);
    T.quad(C1(), C2(), C3(), C4(), inside);
    for (const [p, q] of [[C1, C2], [C2, C3], [C3, C4], [C4, C1]] as const) T.quad(p(), q(), q(y0 + t), p(y0 + t), inside);
  } else if (params.style === 'butterfly') {
    // Two slopes falling toward a gutter along the middle (a V), rising to the long edges.
    const h = Math.min(MAX_RISE_M, b * tan * 0.7);
    const low = 0.12;
    const L1 = P(-a, 0, y0 + low);
    const L2 = P(a, 0, y0 + low);
    const far = P(0, 0, y0 - 3); // below the surface: slopes face up
    T.quad(C1(y0 + h), C2(y0 + h), L2, L1, far);
    T.quad(C4(y0 + h), C3(y0 + h), L2, L1, far);
    T.quad(C1(), C2(), C3(), C4(), P(0, 0, y0 + h)); // underside faces down
    for (const [s0, s1, end] of [[C1, C4, -1], [C2, C3, 1]] as const) {
      const inside = P(-end, 0, y0 + h / 2); // a point on the other side of this end: normals face outward
      T.tri(s0(), s1(), end < 0 ? L1 : L2, inside);
      T.tri(s1(), s1(y0 + h), end < 0 ? L1 : L2, inside);
      T.tri(s0(), end < 0 ? L1 : L2, s0(y0 + h), inside);
    }
  } else if (params.style === 'mansard') {
    // A steep lower slope, then a gentle upper slope to a flat top.
    const m = Math.min(a, b);
    const H = Math.min(MAX_RISE_M, b * tan * 0.9); // total rise: a little less than a gable of the same slope
    const h1 = H * 0.6;
    const h2 = H * 0.4;
    const i1 = Math.min(m * 0.45, h1 / Math.tan((70 * Math.PI) / 180)); // the steep lower slope
    const i2 = m * 0.82; // the flat top starts here
    const ring = (i: number, y: number): V3[] => [P(-a + i, -b + i, y), P(a - i, -b + i, y), P(a - i, b - i, y), P(-a + i, b - i, y)];
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
  } else if (params.style === 'barrel') {
    // A curved vault across the width.
    const h = Math.min(MAX_RISE_M, b * tan * 0.8);
    const n = 12;
    const arc = (u: number): V3[] => Array.from({ length: n + 1 }, (_, i) => P(u, -b + (2 * b * i) / n, y0 + h * Math.sin((Math.PI * i) / n)));
    const A = arc(-a);
    const B = arc(a);
    const inside = P(0, 0, y0 + h * 0.3);
    for (let i = 0; i < n; i++) {
      T.quad(A[i]!, B[i]!, B[i + 1]!, A[i + 1]!, inside);
      T.tri(C1(), A[i]!, A[i + 1]!, inside); // end caps fan out from a base corner
      T.tri(C2(), B[i]!, B[i + 1]!, inside);
    }
    T.quad(C1(), C2(), C3(), C4(), inside);
  } else if (params.style === 'shed') {
    const h = Math.min(MAX_RISE_M, 2 * b * tan);
    const inside = P(0, 0, y0 + h * 0.2);
    T.quad(C1(), C2(), C3(y0 + h), C4(y0 + h), inside); // the slope
    T.quad(C4(), C3(), C3(y0 + h), C4(y0 + h), inside); // high back face
    T.tri(C1(), C4(), C4(y0 + h), inside);
    T.tri(C2(), C3(), C3(y0 + h), inside);
    T.quad(C1(), C2(), C3(), C4(), inside);
  } else {
    const h = Math.min(MAX_RISE_M, b * tan);
    const r = params.style === 'hip' ? Math.max(0, a - b) : a; // half length of the ridge
    const R1 = P(-r, 0, y0 + h);
    const R2 = P(r, 0, y0 + h);
    const inside = P(0, 0, y0 + h * 0.25);
    T.quad(C1(), C2(), R2, R1, inside);
    T.quad(C3(), C4(), R1, R2, inside);
    T.tri(C1(), C4(), R1, inside); // gable end / hip end
    T.tri(C2(), C3(), R2, inside);
    T.quad(C1(), C2(), C3(), C4(), inside);
  }

  const n = T.pos.length / 3;
  return {
    positions: new Float32Array(T.pos),
    normals: new Float32Array(T.nor),
    uvs: new Float32Array(T.uv),
    indices: Uint32Array.from({ length: n }, (_, i) => i),
    groups: [{ slot: 'top', start: 0, count: n }],
  };
}
