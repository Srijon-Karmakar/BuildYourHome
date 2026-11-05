import { createEmptyScene, type Scene } from '@hd/scene-schema';
import { addWall, batch, createEditor, setRoomProps } from '@hd/editor-core';

/**
 * A small sample home (living room, bedroom, bathroom) built with the real commands,
 * so it exercises junction splitting and room detection. Open the app with `?demo=1`.
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
  const byArea = [...rooms].sort((a, b) => b.wallLoop.length - a.wallLoop.length);
  const names = ['Living', 'Bedroom', 'Bath'] as const;
  const types = ['living', 'bedroom', 'bathroom'] as const;
  byArea.forEach((r, i) => {
    if (names[i]) e.execute(setRoomProps(r.id, { name: names[i]!, type: types[i]! }));
  });
  return e.getState().scene;
}
