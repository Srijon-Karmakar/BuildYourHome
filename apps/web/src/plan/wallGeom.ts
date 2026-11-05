import type { Id, Opening, Scene, Vec2 } from '@hd/scene-schema';
import { computeFootprints, wallPlanPieces, type OpeningCut, type WallFootprint } from '@hd/geometry';

export interface LevelGeometry {
  footprints: Record<Id, WallFootprint>;
  /** Solid parts of each wall in plan, with gaps at doors/windows. */
  pieces: Record<Id, Vec2[][]>;
  /** Openings of each wall in the geometry package's wall-local form. */
  cuts: Record<Id, OpeningCut[]>;
}

const cache = new Map<
  Id,
  { nodes: Scene['nodes']; walls: Scene['walls']; openings: Scene['openings']; out: LevelGeometry }
>();

export const toCut = (o: Opening): OpeningCut => ({ offset: o.offset, width: o.width, height: o.height, sill: o.sill });

/**
 * Mitered footprints + plan pieces for one level, shared by the 2D and 3D views.
 * Memoized per level on the identity of the (structurally shared) scene maps, so pan / zoom / orbit
 * and edits to other levels never recompute it.
 */
export function levelGeometry(scene: Scene, levelId: Id): LevelGeometry {
  const hit = cache.get(levelId);
  if (hit && hit.nodes === scene.nodes && hit.walls === scene.walls && hit.openings === scene.openings) return hit.out;

  const walls = Object.values(scene.walls).filter((w) => w.levelId === levelId);
  const footprints = computeFootprints(scene.nodes, walls);
  const cuts: Record<Id, OpeningCut[]> = {};
  for (const o of Object.values(scene.openings)) (cuts[o.wallId] ??= []).push(toCut(o));

  const pieces: Record<Id, Vec2[][]> = {};
  for (const w of walls) {
    const fp = footprints[w.id];
    if (fp) pieces[w.id] = wallPlanPieces(fp, cuts[w.id] ?? [], w.height);
  }
  const out = { footprints, pieces, cuts };
  cache.set(levelId, { nodes: scene.nodes, walls: scene.walls, openings: scene.openings, out });
  return out;
}
