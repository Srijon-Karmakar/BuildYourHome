import type { Id, Room, Scene, Vec2 } from '@hd/scene-schema';
import { detectRooms, loopSignature } from '@hd/geometry';
import { isHouseWall } from '@hd/editor-core';

export interface RoomView {
  polygon: Vec2[];
  centroid: Vec2;
  area: number;
  /** Scene room carrying the user's name/materials (matched by wall set). */
  room: Room | undefined;
}

let last: { nodes: Scene['nodes']; walls: Scene['walls']; rooms: Scene['rooms']; level: Id; out: RoomView[] } | null = null;

/**
 * Room outlines for one level, shared by the 2D and 3D views.
 * Memoized on the identity of the (structurally shared) scene maps, so re-renders while the
 * plan is unchanged — pan, zoom, orbit — cost nothing.
 */
export function levelRooms(scene: Scene, levelId: Id): RoomView[] {
  if (last && last.nodes === scene.nodes && last.walls === scene.walls && last.rooms === scene.rooms && last.level === levelId) {
    return last.out;
  }
  const walls = Object.values(scene.walls).filter((w) => w.levelId === levelId && isHouseWall(w));
  const bySig = new Map<string, Room>();
  for (const r of Object.values(scene.rooms)) if (r.levelId === levelId) bySig.set(loopSignature(r.wallLoop), r);
  const out = detectRooms(scene.nodes, walls).map((d) => ({
    polygon: d.polygon,
    centroid: d.centroid,
    area: d.area,
    room: bySig.get(d.signature),
  }));
  last = { nodes: scene.nodes, walls: scene.walls, rooms: scene.rooms, level: levelId, out };
  return out;
}
