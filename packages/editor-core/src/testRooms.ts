import { detectRooms } from '@hd/geometry';
import type { Id, Scene, Vec2 } from '@hd/scene-schema';

/** Room outlines of one floor (test helper; the web app uses its memoised `levelRooms`). */
export function levelRoomsOf(scene: Scene, levelId: Id): Vec2[][] {
  const walls = Object.values(scene.walls).filter((w) => w.levelId === levelId && w.kind !== 'boundary');
  return detectRooms(scene.nodes, walls).map((r) => r.polygon.map((p): Vec2 => [p[0], p[1]]));
}
