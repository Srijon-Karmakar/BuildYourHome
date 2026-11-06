import type { Id, Scene, Vec2, Wall } from '@hd/scene-schema';
import { pointInPolygon } from '@hd/geometry';
import { levelRooms } from './rooms';

/** Which face of a wall is which: `a` = the left face (material A), `b` = the right face (material B). */
export type FaceSide = 'a' | 'b';
export type FaceKind = 'in' | 'out';
export type PaintTarget = 'both' | 'interior' | 'exterior';

const PROBE_M = 0.25; // how far beyond the wall face we look for a room

/**
 * Tell which face of a wall looks into a room (interior) and which looks outside (exterior).
 * A face is interior when a point just beyond it lies inside a detected room of that floor.
 * Walls with no room around them (not yet closed) count as exterior on both faces.
 */
export function wallFaceKinds(scene: Scene, wall: Wall): Record<FaceSide, FaceKind> {
  const a = scene.nodes[wall.a];
  const b = scene.nodes[wall.b];
  if (!a || !b) return { a: 'out', b: 'out' };
  const dx = b.p[0] - a.p[0];
  const dz = b.p[1] - a.p[1];
  const len = Math.hypot(dx, dz) || 1;
  const left: Vec2 = [-dz / len, dx / len]; // same as leftNormal in the geometry package
  const mid: Vec2 = [(a.p[0] + b.p[0]) / 2, (a.p[1] + b.p[1]) / 2];
  const off = wall.thickness / 2 + PROBE_M;
  const rooms = levelRooms(scene, wall.levelId);
  const inside = (p: Vec2) => rooms.some((r) => pointInPolygon(p, r.polygon));
  return {
    a: inside([mid[0] + left[0] * off, mid[1] + left[1] * off]) ? 'in' : 'out',
    b: inside([mid[0] - left[0] * off, mid[1] - left[1] * off]) ? 'in' : 'out',
  };
}

/** The faces a paint action applies to. If a wall has no face of the requested kind, both faces are used. */
export function facesFor(scene: Scene, wall: Wall, target: PaintTarget): FaceSide[] {
  if (target === 'both') return ['a', 'b'];
  const kinds = wallFaceKinds(scene, wall);
  const want: FaceKind = target === 'interior' ? 'in' : 'out';
  const sides = (['a', 'b'] as const).filter((s) => kinds[s] === want);
  return sides.length ? [...sides] : ['a', 'b'];
}

/** Plan-line side (+1 = left face, −1 = right face) for the highlight of the selected walls. */
export function highlightSides(scene: Scene, ids: readonly Id[], target: PaintTarget): Array<{ id: Id; side: 1 | -1 }> {
  if (target === 'both') return [];
  const out: Array<{ id: Id; side: 1 | -1 }> = [];
  for (const id of ids) {
    const w = scene.walls[id];
    if (!w) continue;
    for (const s of facesFor(scene, w, target)) out.push({ id, side: s === 'a' ? 1 : -1 });
  }
  return out;
}
