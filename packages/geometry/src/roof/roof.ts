import type { Vec2 } from '@hd/scene-schema';
import type { MeshData } from '../wall/mesh';

export type RoofStyleId = 'gable' | 'hip' | 'flat' | 'shed';

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
