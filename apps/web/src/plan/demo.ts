import { getAsset } from '@hd/assets';
import { createEmptyScene, type Scene, type Vec2 } from '@hd/scene-schema';
import {
  addItem,
  addOpening,
  addWall,
  batch,
  createEditor,
  nearestWallPoint,
  setOpeningProps,
  setRoomProps,
  setWallsProps,
  solvePlacement,
} from '@hd/editor-core';

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

  // Finishes: the outside face (side 2 of the clockwise outer walls) is brick; a floor per room.
  const outer = Object.values(e.getState().scene.walls).filter((w) => w.kind === 'exterior').map((w) => w.id);
  e.execute(setWallsProps(outer, { materialB: { id: 'wall-brick-red' } }));
  const floors: Record<string, string> = { Living: 'floor-wood-oak', Bedroom: 'floor-carpet-sand', Bath: 'floor-tile-white' };
  for (const r of Object.values(e.getState().scene.rooms)) {
    const f = floors[r.name];
    if (f) e.execute(setRoomProps(r.id, { floorMaterial: { id: f } }));
  }

  // Doors and windows, placed by pointing near a wall (the nearest wall + free spot is used).
  // `from` is a point on the side the door should open toward.
  const put = (type: 'door' | 'window' | 'arch', at: Vec2, from?: Vec2, width?: number) => {
    const scene = e.getState().scene;
    const hit = nearestWallPoint(scene, levelId, at, 0.5);
    if (!hit) return;
    const side = from ? nearestWallPoint(scene, levelId, from, 5)?.side ?? hit.side : hit.side;
    e.execute(addOpening({ wallId: hit.wallId, type, offset: hit.offset, swing: side < 0, width }));
  };
  put('door', [3, 6], [3, 5], 1.4); // front door, opens into the living room
  const front = Object.values(e.getState().scene.openings)[0];
  if (front) e.execute(setOpeningProps(front.id, { style: 'double', frameColor: '#2b2a28', leafColor: '#7a5238' }));
  put('window', [3, 0]);
  put('window', [0, 3]);
  put('door', [6, 1.75], [5, 1.75]); // living → bedroom
  put('door', [6, 4.75], [7, 4.75]); // bath door opens into the bath
  put('window', [8, 0]);
  const slider = Object.values(e.getState().scene.openings).find((o) => o.type === 'window' && o.offset > 6);
  if (slider) e.execute(setOpeningProps(slider.id, { style: 'sliding', frameColor: '#2b2a28' }));
  put('window', [8.5, 6], undefined, 0.7);
  put('window', [10, 1.8]);

  // Furniture: placed by pointing near where it should go; the placement solver snaps it flush to walls.
  const furnish = (assetId: string, at: Vec2, variant?: string, rotationY = 0) => {
    const asset = getAsset(assetId);
    if (!asset) return;
    const p = solvePlacement(e.getState().scene, levelId, asset, at, { rotationY });
    if (p) e.execute(addItem({ levelId, assetId, position: p.position, rotationY: p.rotationY, variant }));
  };
  // Living room
  furnish('rug', [3, 3.4], '#c9b79c');
  furnish('sofa-2', [4.7, 5.4], '#8f9f86');
  furnish('coffee-table', [3.6, 4.0], '#b98a5b');
  furnish('tv-unit', [0.45, 4.8], '#7a5238');
  furnish('armchair', [1.0, 0.5], '#c9b79c');
  furnish('bookshelf', [5.2, 0.4], '#b98a5b');
  furnish('floor-lamp', [2.0, 0.45]);
  furnish('plant-tall', [5.55, 3.1]);
  furnish('wall-art', [4.7, 5.85]);
  furnish('ceiling-light', [3, 3]);
  // Bedroom
  furnish('bed-double', [8.0, 1.2], '#4d6783');
  furnish('nightstand', [9.3, 0.35], '#b98a5b');
  furnish('nightstand', [6.7, 0.35], '#b98a5b');
  furnish('wardrobe', [6.55, 2.85], '#f1efea');
  furnish('ceiling-light', [8, 1.8]);
  // Bathroom
  furnish('toilet', [9.35, 3.95]);
  furnish('washbasin', [7.9, 3.95]);
  furnish('bathtub', [8.9, 5.45]);
  furnish('mirror', [7.9, 3.7]);

  // The roof comes by itself: the floor has automatic roofs on, so closing the rooms already put a (flat, by default) roof on.

  return e.getState().scene;
}
