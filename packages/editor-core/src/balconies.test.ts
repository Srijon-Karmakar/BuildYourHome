import { describe, expect, it } from 'vitest';
import { createEmptyScene, loadScene, type Vec2 } from '@hd/scene-schema';
import {
  addBalcony,
  addLevel,
  addWall,
  balconyColliders,
  balconyProblem,
  balconyRailings,
  batch,
  createEditor,
  removeBalconies,
  removeLevel,
  translateBalconies,
  updateBalconies,
  type Editor,
} from './index';

const mk = () => createEditor(createEmptyScene());
const scene = (e: Editor) => e.getState().scene;
const L = (e: Editor) => scene(e).levelOrder[0]!;
const list = (e: Editor) => Object.values(scene(e).balconies);
const slab: Vec2[] = [[2, -2], [6, -2], [6, 0], [2, 0]];

function house(e: Editor) {
  e.execute(
    batch('house', [
      addWall({ levelId: L(e), from: [0, 0], to: [8, 0], kind: 'exterior' }),
      addWall({ levelId: L(e), from: [8, 0], to: [8, 5], kind: 'exterior' }),
      addWall({ levelId: L(e), from: [8, 5], to: [0, 5], kind: 'exterior' }),
      addWall({ levelId: L(e), from: [0, 5], to: [0, 0], kind: 'exterior' }),
    ]),
  );
}

describe('balconies', () => {
  it('adds, edits, moves and removes (each one undo step); the scene stays valid', () => {
    const e = mk();
    e.execute(addBalcony({ levelId: L(e), outline: slab }));
    const b = list(e)[0]!;
    expect([b.railing, b.floorMaterial.id]).toEqual(['glass', 'floor-tile-beige']);
    e.execute(updateBalconies([b.id], { railing: 'metal', floorMaterial: { id: 'floor-wood-teak' } }));
    expect([list(e)[0]!.railing, list(e)[0]!.floorMaterial.id]).toEqual(['metal', 'floor-wood-teak']);
    e.execute(translateBalconies([b.id], 1, 2));
    expect(list(e)[0]!.outline[0]).toEqual([3, 0]);
    e.undo();
    expect(list(e)[0]!.outline[0]).toEqual([2, -2]);
    expect(loadScene(JSON.parse(JSON.stringify(scene(e)))).ok).toBe(true);
    e.execute(removeBalconies([b.id]));
    expect(list(e)).toHaveLength(0);
  });

  it('refuses bad outlines (crossing, tiny, too few corners) and unknown floors', () => {
    const e = mk();
    e.execute(addBalcony({ levelId: L(e), outline: [[0, 0], [2, 2], [2, 0], [0, 2]] }));
    e.execute(addBalcony({ levelId: L(e), outline: [[0, 0], [0.5, 0], [0.5, 0.5]] }));
    e.execute(addBalcony({ levelId: L(e), outline: [[0, 0], [3, 0]] }));
    e.execute(addBalcony({ levelId: 'nope', outline: slab }));
    expect(list(e)).toHaveLength(0);
    expect(balconyProblem(slab)).toBeNull();
    expect(balconyProblem([[0, 0], [3, 0]])).toMatch(/3 corners/);
  });

  it('the railing leaves the house-wall side open; colliders follow the railings', () => {
    const e = mk();
    house(e);
    e.execute(addBalcony({ levelId: L(e), outline: slab }));
    const id = list(e)[0]!.id;
    expect(balconyRailings(scene(e), id)).toHaveLength(3);
    expect(balconyColliders(scene(e), L(e))).toHaveLength(3);
    e.execute(updateBalconies([id], { railing: 'none' }));
    expect(balconyRailings(scene(e), id)).toHaveLength(0);
    expect(balconyColliders(scene(e), L(e))).toHaveLength(0);
  });

  it('goes away with its floor', () => {
    const e = mk();
    e.execute(addLevel());
    const up = scene(e).levelOrder[1]!;
    e.execute(addBalcony({ levelId: up, outline: slab }));
    expect(list(e)).toHaveLength(1);
    e.execute(removeLevel(up));
    expect(list(e)).toHaveLength(0);
  });
});
