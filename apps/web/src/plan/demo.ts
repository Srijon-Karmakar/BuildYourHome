import { createEmptyScene, type Scene, type Vec2 } from '@hd/scene-schema';
import { addOpening, addWall, batch, createEditor, nearestWallPoint, setRoomProps } from '@hd/editor-core';

/**
 * A small sample home (living room, bedroom, bathroom) built with the real commands,
 * so it exercises junction splitting, room detection and openings. Open the app with `?demo=1`.
 */
export function buildDemoScene(): Scene {
  const e = createEditor(createEmptyScene({ name: 'Sample home' }));
  const levelId = e.getState().activeLevelId;
  const w = (from: [number, number], to: [number, number], kind: 'exterior' | 'interior' = 'interior') =>
    addWall({ levelId, from, to, kind });

  // Outer shell 10 × 6 m.
  e.execute(
    batch('Outer walls', [
      w([0, 0], [10, 0], 'exterior'),
      w([10, 0], [10, 6], 'exterior'),
      w([10, 6], [0, 6], 'exterior'),
      w([0, 6], [0, 0], 'exterior'),
    ]),
  );
  // Living | bedrooms split, then bedroom | bathroom split.
  e.execute(w([6, 0], [6, 6]));
  e.execute(w([6, 3.5], [10, 3.5]));

  const rooms = Object.values(e.getState().scene.rooms);
  const byLoop = [...rooms].sort((a, b) => b.wallLoop.length - a.wallLoop.length);
  const names = ['Living', 'Bedroom', 'Bath'] as const;
  const types = ['living', 'bedroom', 'bathroom'] as const;
  byLoop.forEach((r, i) => {
    if (names[i]) e.execute(setRoomProps(r.id, { name: names[i]!, type: types[i]! }));
  });

  // Doors and windows, placed by pointing near a wall (the nearest wall + free spot is used).
  // `from` is a point on the side the door should open toward.
  const put = (type: 'door' | 'window' | 'arch', at: Vec2, from?: Vec2, width?: number) => {
    const scene = e.getState().scene;
    const hit = nearestWallPoint(scene, levelId, at, 0.5);
    if (!hit) return;
    const side = from ? nearestWallPoint(scene, levelId, from, 5)?.side ?? hit.side : hit.side;
    e.execute(addOpening({ wallId: hit.wallId, type, offset: hit.offset, swing: side < 0, width }));
  };
  put('door', [3, 6], [3, 5]); // front door, opens into the living room
  put('window', [3, 0]);
  put('window', [0, 3]);
  put('door', [6, 1.75], [5, 1.75]); // living → bedroom
  put('door', [6, 4.75], [7, 4.75]); // bath door opens into the bath
  put('window', [8, 0]);
  put('window', [8.5, 6], undefined, 0.7);
  put('window', [10, 1.8]);

  return e.getState().scene;
}
