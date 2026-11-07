import type { Vec2 } from '@hd/scene-schema';
import { isSimplePolygon, polygonArea } from '../wall/footprint';

export const ZONE_MIN_AREA_M2 = 0.5;
export const PATH_MIN_WIDTH_M = 0.3;
export const PATH_MAX_WIDTH_M = 6;
export const PATH_DEFAULT_WIDTH_M = 1;

/**
 * The outline of a path of constant `width` along a centre line (mitred corners, with the mitre limited so sharp
 * turns don't spike). Needs at least two distinct points. Counter-clockwise on the plan.
 */
export function pathPolygon(line: readonly Vec2[], width: number, maxWidth: number = PATH_MAX_WIDTH_M): Vec2[] {
  const pts: Vec2[] = [];
  for (const p of line) {
    const last = pts[pts.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 1e-3) pts.push([p[0], p[1]]);
  }
  if (pts.length < 2) return [];
  const h = Math.min(maxWidth, Math.max(PATH_MIN_WIDTH_M, width)) / 2;
  // Unit direction and left normal of each segment.
  const dirs = pts.slice(0, -1).map((p, i) => {
    const q = pts[i + 1]!;
    const l = Math.hypot(q[0] - p[0], q[1] - p[1]);
    return [(q[0] - p[0]) / l, (q[1] - p[1]) / l] as Vec2;
  });
  const normal = (d: Vec2): Vec2 => [-d[1], d[0]];
  const side = (sign: 1 | -1): Vec2[] =>
    pts.map((p, i) => {
      if (i === 0) {
        const n = normal(dirs[0]!);
        return [p[0] + n[0] * h * sign, p[1] + n[1] * h * sign];
      }
      if (i === pts.length - 1) {
        const n = normal(dirs[i - 1]!);
        return [p[0] + n[0] * h * sign, p[1] + n[1] * h * sign];
      }
      const n0 = normal(dirs[i - 1]!);
      const n1 = normal(dirs[i]!);
      let mx = n0[0] + n1[0];
      let mz = n0[1] + n1[1];
      const ml = Math.hypot(mx, mz);
      if (ml < 1e-6) return [p[0] + n1[0] * h * sign, p[1] + n1[1] * h * sign]; // U-turn: no mitre
      mx /= ml;
      mz /= ml;
      const cos = mx * n1[0] + mz * n1[1]; // mitre length = h / cos
      const k = h / Math.max(cos, 0.5); // limit to 2 × h
      return [p[0] + mx * k * sign, p[1] + mz * k * sign];
    });
  const left = side(1);
  const right = side(-1).reverse();
  return [...left, ...right];
}

/** Does a path/area outline make sense (≥ 3 points, no self-crossing, big enough)? */
export function validZoneOutline(p: readonly Vec2[]): boolean {
  return p.length >= 3 && isSimplePolygon(p) && polygonArea(p) >= ZONE_MIN_AREA_M2;
}
