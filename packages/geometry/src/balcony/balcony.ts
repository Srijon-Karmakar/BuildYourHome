import type { Vec2 } from '@hd/scene-schema';

/** Slab thickness below the floor level, and railing height above it (a safe 1.0 m). */
export const BALCONY_SLAB_M = 0.15;
export const BALCONY_RAIL_HEIGHT_M = 1.0;
export const BALCONY_MIN_AREA_M2 = 1;
/** How far a balcony edge may sit from a wall's centre line and still count as "against the house". */
export const BALCONY_WALL_TOL_M = 0.2;

export type RailingKind = 'glass' | 'metal' | 'wood' | 'wall' | 'none';

export interface Segment {
  a: Vec2;
  b: Vec2;
}

function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const abx = b[0] - a[0];
  const abz = b[1] - a[1];
  const len2 = abx * abx + abz * abz || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * abx + (p[1] - a[1]) * abz) / len2));
  return Math.hypot(p[0] - (a[0] + abx * t), p[1] - (a[1] + abz * t));
}

/**
 * For each edge of the balcony outline: is it against a house wall (no railing needed there)?
 * An edge counts when both its end points and its middle lie within `tol` of one wall.
 */
export function edgesAgainstWalls(outline: readonly Vec2[], walls: readonly Segment[], tol = BALCONY_WALL_TOL_M): boolean[] {
  return outline.map((a, i) => {
    const b = outline[(i + 1) % outline.length]!;
    const mid: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    return walls.some((w) => [a, mid, b].every((p) => distToSegment(p, w.a, w.b) <= tol));
  });
}

/** The edges that need a railing: every edge not against a wall (none when the railing kind is 'none'). */
export function railingRuns(outline: readonly Vec2[], against: readonly boolean[], kind: RailingKind): Segment[] {
  if (kind === 'none') return [];
  const out: Segment[] = [];
  outline.forEach((a, i) => {
    if (!against[i]) out.push({ a, b: outline[(i + 1) % outline.length]! });
  });
  return out;
}
