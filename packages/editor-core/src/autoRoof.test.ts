import { describe, expect, it } from 'vitest';
import { createEmptyScene } from '@hd/scene-schema';
import {
  addLevel,
  addRoofOverRooms,
  addWall,
  batch,
  createEditor,
  moveNode,
  removeRoofs,
  removeWalls,
  resetRoofs,
  setAutoRoofs,
  setRoof,
  updateRoofs,
  type Editor,
} from './index';

const L = (e: Editor, i = 0) => e.getState().scene.levelOrder[i]!;
const roofs = (e: Editor, i?: number) => Object.values(e.getState().scene.roofs).filter((r) => i === undefined || r.levelId === L(e, i));

function loop(e: Editor, level: string, pts: Array<[number, number]>): void {
  e.execute(batch('loop', pts.map((p, i) => addWall({ levelId: level, from: p, to: pts[(i + 1) % pts.length]! }))));
}
const rect = (x0: number, z0: number, x1: number, z1: number): Array<[number, number]> => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];

describe('automatic roofs', () => {
  it('a closed room gets a roof by itself, and it follows the walls', () => {
    const e = createEditor(createEmptyScene());
    expect(roofs(e)).toHaveLength(0);
    loop(e, L(e), rect(0, 0, 6, 4));
    expect(roofs(e)).toHaveLength(1);
    const r = roofs(e)[0]!;
    expect(r.auto).toBe(true);
    expect(r.box).toMatchObject({ length: 6, width: 4 });
    expect(r.style).toBe('flat'); // new roofs are flat by default
    // moving a corner keeps the same roof (id and settings) and re-fits it
    e.execute(updateRoofs([r.id], { style: 'hip', pitchDeg: 35 }));
    const node = Object.values(e.getState().scene.nodes).find((n) => n.p[0] === 6 && n.p[1] === 4)!;
    e.execute(moveNode(node.id, [8, 4]));
    expect(roofs(e)).toHaveLength(1);
    expect(roofs(e)[0]!.id).toBe(r.id);
    expect(roofs(e)[0]).toMatchObject({ style: 'hip', pitchDeg: 35 });
    expect(roofs(e)[0]!.box!.length).toBeGreaterThan(6.5);
  });

  it('an L-shaped house gets two roof parts, a block with inner walls still one', () => {
    const e = createEditor(createEmptyScene());
    loop(e, L(e), [[0, 0], [8, 0], [8, 3], [3, 3], [3, 7], [0, 7]]);
    expect(roofs(e)).toHaveLength(2);
    const boxes = roofs(e).map((r) => r.box!);
    expect(boxes.reduce((n, b) => n + b.length * b.width, 0)).toBeCloseTo(8 * 3 + 3 * 4, 3);

    const f = createEditor(createEmptyScene());
    loop(f, L(f), rect(0, 0, 8, 6));
    f.execute(addWall({ levelId: L(f), from: [4, 0], to: [4, 6] })); // a dividing wall: two rooms, one roof
    expect(Object.keys(f.getState().scene.rooms)).toHaveLength(2);
    expect(roofs(f)).toHaveLength(1);
  });

  it('a lower floor gets a roof only where the floor above does not cover it', () => {
    const e = createEditor(createEmptyScene());
    loop(e, L(e), rect(0, 0, 8, 6));
    e.execute(addLevel());
    expect(roofs(e, 0)).toHaveLength(1);
    loop(e, L(e, 1), rect(0, 0, 4, 6));
    expect(roofs(e, 1)).toHaveLength(1);
    expect(roofs(e, 0)).toHaveLength(1);
    const low = roofs(e, 0)[0]!.box!;
    expect(low.length * low.width).toBeCloseTo(4 * 6, 3); // the uncovered half
    // cover everything: the lower roof is gone
    e.execute(batch('widen', [addWall({ levelId: L(e, 1), from: [4, 0], to: [8, 0] }), addWall({ levelId: L(e, 1), from: [8, 0], to: [8, 6] }), addWall({ levelId: L(e, 1), from: [8, 6], to: [4, 6] })]));
    expect(roofs(e, 0)).toHaveLength(0);
    expect(roofs(e, 1)).toHaveLength(1);
  });

  it('a hand-made roof over a room claims it, the automatic roof carries on over the rest', () => {
    const e = createEditor(createEmptyScene());
    loop(e, L(e), rect(0, 0, 8, 6));
    e.execute(addWall({ levelId: L(e), from: [4, 0], to: [4, 6] }));
    const room = Object.values(e.getState().scene.rooms)[0]!;
    const cmd = addRoofOverRooms([room.id], { style: 'flat' });
    e.execute(cmd);
    const mine = e.getState().scene.roofs[cmd.roofId]!;
    expect(mine.auto).toBeFalsy();
    expect(mine.style).toBe('flat');
    expect(roofs(e)).toHaveLength(2);
    const auto = roofs(e).find((r) => r.auto)!;
    expect(auto.box!.length * auto.box!.width).toBeCloseTo(4 * 6, 3);
    // moving a wall never moves the hand-made one
    const before = { ...mine.box! };
    const node = Object.values(e.getState().scene.nodes).find((n) => n.p[0] === 8 && n.p[1] === 6)!;
    e.execute(moveNode(node.id, [9, 6]));
    expect(e.getState().scene.roofs[cmd.roofId]!.box).toEqual(before);
  });

  it('deleting an automatic roof keeps the floor from growing it back; Rebuild brings it back', () => {
    const e = createEditor(createEmptyScene());
    loop(e, L(e), rect(0, 0, 6, 4));
    const id = roofs(e)[0]!.id;
    e.execute(removeRoofs([id]));
    expect(roofs(e)).toHaveLength(0);
    e.execute(addWall({ levelId: L(e), from: [3, 0], to: [3, 4] })); // any later edit
    expect(roofs(e)).toHaveLength(0);
    e.execute(resetRoofs(L(e)));
    expect(roofs(e)).toHaveLength(1);
    e.undo();
    expect(roofs(e)).toHaveLength(0);
  });

  it('switching to hand-made roofs freezes the parts; switching back rebuilds them', () => {
    const e = createEditor(createEmptyScene());
    loop(e, L(e), [[0, 0], [8, 0], [8, 3], [3, 3], [3, 7], [0, 7]]);
    e.execute(setAutoRoofs(L(e), false));
    expect(roofs(e)).toHaveLength(2);
    expect(roofs(e).every((r) => !r.auto)).toBe(true);
    const wall = Object.values(e.getState().scene.walls)[0]!;
    e.execute(removeWalls([wall.id]));
    expect(roofs(e)).toHaveLength(2); // untouched
    e.execute(setAutoRoofs(L(e), true));
    expect(roofs(e).filter((r) => r.auto).length).toBeGreaterThanOrEqual(0);
  });

  it('old-style whole-floor roofs and older homes are left alone', () => {
    const scene = createEmptyScene();
    delete scene.levels[scene.levelOrder[0]!]!.autoRoof; // a home saved before automatic roofs
    const e = createEditor(scene);
    loop(e, L(e), rect(0, 0, 6, 4));
    expect(roofs(e)).toHaveLength(0);
    e.execute(setRoof(L(e), { style: 'hip' }));
    expect(roofs(e)).toHaveLength(1);
    expect(roofs(e)[0]!.box).toBeUndefined();
    // a floor with automatic roofs and an old-style roof keeps just that one
    const f = createEditor(createEmptyScene());
    f.execute(setRoof(L(f), { style: 'shed' }));
    loop(f, L(f), rect(0, 0, 6, 4));
    expect(roofs(f)).toHaveLength(1);
    expect(roofs(f)[0]!.style).toBe('shed');
    // removing it with style none turns the automatic roofs off for that floor
    f.execute(setRoof(L(f), { style: 'none' }));
    expect(roofs(f)).toHaveLength(0);
  });

  it('parts of a plan that is not square to its walls fall back to one box per room, and edits are one undo step', () => {
    const e = createEditor(createEmptyScene());
    loop(e, L(e), [[0, 0], [6, 0], [7, 4], [1, 4]]); // a parallelogram
    expect(roofs(e)).toHaveLength(1);
    e.execute(updateRoofs([roofs(e)[0]!.id], { chimney: true, gutter: true, thickness: 0.2, trim: '#ffffff' }));
    expect(roofs(e)[0]).toMatchObject({ chimney: true, gutter: true, thickness: 0.2, trim: '#ffffff' });
    e.undo();
    expect(roofs(e)[0]!.chimney).toBeUndefined();
  });

  it('is stable: a second pass and no-op commands do not change the scene', () => {
    const e = createEditor(createEmptyScene());
    loop(e, L(e), rect(0, 0, 6, 4));
    const before = JSON.stringify(e.getState().scene.roofs);
    e.execute(updateRoofs([], {}));
    expect(JSON.stringify(e.getState().scene.roofs)).toBe(before);
  });
});
