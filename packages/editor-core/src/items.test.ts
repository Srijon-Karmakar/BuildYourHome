import { describe, expect, it } from 'vitest';
import { getAsset } from '@hd/assets';
import { createEmptyScene, type Vec2 } from '@hd/scene-schema';
import {
  addItem,
  addLevel,
  addWall,
  batch,
  copyLevel,
  createEditor,
  duplicateItems,
  removeItems,
  rotateItems,
  setItemsProps,
  setItemTransform,
  setLevelProps,
  solvePlacement,
  translateItems,
  wrapAngle,
  type Editor,
} from './index';

const mk = () => createEditor(createEmptyScene());
const L = (e: Editor) => e.getState().activeLevelId;
const scene = (e: Editor) => e.getState().scene;
const items = (e: Editor) => Object.values(scene(e).items);

/** A 8 × 6 m room (centre-line), interior walls 0.115 m thick. */
function room() {
  const e = mk();
  const l = L(e);
  e.execute(
    batch('room', [
      addWall({ levelId: l, from: [0, 0], to: [8, 0] }),
      addWall({ levelId: l, from: [8, 0], to: [8, 6] }),
      addWall({ levelId: l, from: [8, 6], to: [0, 6] }),
      addWall({ levelId: l, from: [0, 6], to: [0, 0] }),
    ]),
  );
  return e;
}
const solve = (e: Editor, id: string, p: Vec2, o = {}) => solvePlacement(scene(e), L(e), getAsset(id)!, p, o)!;

describe('solvePlacement — floor items', () => {
  it('in open floor: grid-snapped, no wall, rotation as asked', () => {
    const e = room();
    const p = solve(e, 'sofa-2', [4.013, 3.02], { rotationY: Math.PI / 2 });
    expect(p.position).toEqual([4, 0, 3]);
    expect(p.rotationY).toBeCloseTo(Math.PI / 2);
    expect(p.wallId).toBeUndefined();
  });

  it('near the north wall: back flush against the wall face, facing into the room', () => {
    const e = room();
    const p = solve(e, 'sofa-2', [4, 0.7]); // depth 0.9 → half 0.45
    expect(p.wallId).toBeDefined();
    expect(p.position[2]).toBeCloseTo(0.115 / 2 + 0.45 + 0.005, 6);
    expect(p.position[0]).toBeCloseTo(4);
    expect(p.rotationY).toBeCloseTo(0); // front = +z (south, into the room)
  });

  it('near the south wall it turns around; near the east wall it faces west', () => {
    const e = room();
    const s = solve(e, 'sofa-2', [4, 5.3]);
    expect(Math.abs(s.rotationY)).toBeCloseTo(Math.PI);
    expect(s.position[2]).toBeCloseTo(6 - 0.0575 - 0.45 - 0.005, 6);
    const w = solve(e, 'sofa-2', [7.3, 3]);
    // facing −x: front vector (sin θ, cos θ) = (−1, 0) → θ = −π/2
    expect(w.rotationY).toBeCloseTo(-Math.PI / 2);
    expect(w.position[0]).toBeCloseTo(8 - 0.0575 - 0.45 - 0.005, 6);
  });

  it('too far from any wall: no snapping; snapWalls:false turns it off', () => {
    const e = room();
    expect(solve(e, 'sofa-2', [4, 1.5]).wallId).toBeUndefined();
    expect(solve(e, 'sofa-2', [4, 0.7], { snapWalls: false }).wallId).toBeUndefined();
  });

  it('round items touch the wall but keep the chosen rotation', () => {
    const e = room();
    const p = solve(e, 'plant-small', [4, 0.4], { rotationY: 1 });
    expect(p.wallId).toBeDefined();
    expect(p.rotationY).toBeCloseTo(1);
    expect(p.position[2]).toBeCloseTo(0.0575 + 0.15 + 0.005, 6);
  });

  it('scale changes how far from the wall it sits', () => {
    const e = room();
    const p = solve(e, 'sofa-2', [4, 0.9], { scale: [1, 1, 2] }); // depth 1.8 → half 0.9
    expect(p.position[2]).toBeCloseTo(0.0575 + 0.9 + 0.005, 6);
  });
});

describe('solvePlacement — wall and ceiling items', () => {
  it('wall art hangs on the wall face at its mount height; none away from walls', () => {
    const e = room();
    const p = solve(e, 'wall-art', [3, 0.5]);
    expect(p.position[1]).toBeCloseTo(1.6);
    expect(p.position[2]).toBeCloseTo(0.0575 + 0.02 + 0.005, 6);
    expect(p.rotationY).toBeCloseTo(0);
    expect(solvePlacement(scene(e), L(e), getAsset('wall-art')!, [4, 3])).toBeNull();
  });

  it('ceiling lights hang from the ceiling of that floor', () => {
    const e = room();
    const p = solve(e, 'ceiling-light', [4.02, 3.01]);
    expect(p.position).toEqual([4, 3, 3]);
  });
});

describe('item commands', () => {
  it('adds an item and ignores unknown assets', () => {
    const e = room();
    e.execute(addItem({ levelId: L(e), assetId: 'sofa-2', position: [4, 0, 3], rotationY: 1 }));
    expect(items(e)).toHaveLength(1);
    expect(items(e)[0]).toMatchObject({ assetId: 'sofa-2', position: [4, 0, 3], scale: [1, 1, 1] });
    expect(e.execute(addItem({ levelId: L(e), assetId: 'nope', position: [0, 0, 0] }))).toBe(false);
  });

  it('moves, nudges, rotates and wraps angles; locked items stay put', () => {
    const e = room();
    e.execute(addItem({ levelId: L(e), assetId: 'sofa-2', position: [4, 0, 3] }));
    const id = items(e)[0]!.id;
    e.execute(setItemTransform(id, { position: [5, 0, 2], rotationY: 7 }));
    expect(items(e)[0]!.position).toEqual([5, 0, 2]);
    expect(items(e)[0]!.rotationY).toBeCloseTo(wrapAngle(7));
    e.execute(translateItems([id], 0.25, -0.25));
    expect(items(e)[0]!.position).toEqual([5.25, 0, 1.75]);
    e.execute(setItemsProps([id], { locked: true }));
    expect(e.execute(translateItems([id], 1, 1))).toBe(false);
    e.execute(setItemsProps([id], { locked: false }));
    e.execute(rotateItems([id], Math.PI / 2));
    expect(items(e)[0]!.rotationY).toBeCloseTo(wrapAngle(7 + Math.PI / 2));
  });

  it('scale is uniform and clamped; variant can be set and reset', () => {
    const e = room();
    e.execute(addItem({ levelId: L(e), assetId: 'sofa-2', position: [4, 0, 3] }));
    const id = items(e)[0]!.id;
    e.execute(setItemsProps([id], { scale: 5 }));
    expect(items(e)[0]!.scale).toEqual([2, 2, 2]);
    e.execute(setItemsProps([id], { scale: 0.1 }));
    expect(items(e)[0]!.scale).toEqual([0.5, 0.5, 0.5]);
    e.execute(setItemsProps([id], { variant: '#4d6783' }));
    expect(items(e)[0]!.variant).toBe('#4d6783');
    e.execute(setItemsProps([id], { variant: null }));
    expect(items(e)[0]!.variant).toBeUndefined();
  });

  it('duplicates with an offset and fresh ids; delete + undo round-trip', () => {
    const e = room();
    e.execute(addItem({ levelId: L(e), assetId: 'armchair', position: [2, 0, 2] }));
    const id = items(e)[0]!.id;
    e.execute(duplicateItems([id]));
    expect(items(e)).toHaveLength(2);
    const copy = items(e).find((i) => i.id !== id)!;
    expect(copy.position).toEqual([2.4, 0, 2.4]);
    const before = scene(e);
    e.execute(removeItems([id, copy.id]));
    expect(items(e)).toHaveLength(0);
    e.undo();
    expect(scene(e)).toEqual(before);
  });

  it('ceiling lights follow the ceiling when the floor height changes; copied floors copy furniture', () => {
    const e = room();
    e.execute(addItem({ levelId: L(e), assetId: 'ceiling-light', position: [4, 3, 3] }));
    e.execute(addItem({ levelId: L(e), assetId: 'sofa-2', position: [2, 0, 2] }));
    e.execute(setLevelProps(L(e), { height: 3.6 }));
    expect(items(e).find((i) => i.assetId === 'ceiling-light')!.position[1]).toBeCloseTo(3.6);
    expect(items(e).find((i) => i.assetId === 'sofa-2')!.position[1]).toBe(0);
    e.execute(copyLevel(L(e)));
    const top = scene(e).levelOrder[1]!;
    expect(items(e).filter((i) => i.levelId === top)).toHaveLength(2);
    e.execute(addLevel());
  });

  it('items vanish with their floor', () => {
    const e = room();
    e.execute(addItem({ levelId: L(e), assetId: 'sofa-2', position: [2, 0, 2] }));
    e.execute(copyLevel(L(e)));
    expect(items(e)).toHaveLength(2);
  });
});

describe('item colliders (walkthrough)', () => {
  it('solid furniture blocks the walker; rugs and low tables do not', async () => {
    const { itemColliders } = await import('./index');
    const { moveWithCollision } = await import('@hd/geometry');
    const e = room();
    e.execute(addItem({ levelId: L(e), assetId: 'wardrobe', position: [4, 0, 3] })); // 1.2 × 0.6 m, solid
    e.execute(addItem({ levelId: L(e), assetId: 'rug', position: [2, 0, 3] }));
    e.execute(addItem({ levelId: L(e), assetId: 'coffee-table', position: [6, 0, 3] }));
    const cs = itemColliders(scene(e), L(e));
    expect(cs).toHaveLength(4); // only the wardrobe: 4 edges
    // walk east along z = 3 toward the wardrobe from x = 2: stops before it (half width 0.6 + radius 0.25)
    let p: Vec2 = [2, 3];
    for (let i = 0; i < 40; i++) p = moveWithCollision(p, [0.1, 0], cs);
    expect(p[0]).toBeLessThan(4 - 0.6 - 0.2);
    // walking through the rug position is free
    p = [1, 3];
    for (let i = 0; i < 20; i++) p = moveWithCollision(p, [0.1, 0], []);
    expect(p[0]).toBeGreaterThan(2.5);
  });

  it('items of other floors are ignored', async () => {
    const { itemColliders } = await import('./index');
    const e = room();
    e.execute(addItem({ levelId: L(e), assetId: 'wardrobe', position: [4, 0, 3] }));
    e.execute(addLevel());
    expect(itemColliders(scene(e), scene(e).levelOrder[1]!)).toHaveLength(0);
  });
});
