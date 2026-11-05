import { describe, expect, it } from 'vitest';
import { createEmptyScene } from '@hd/scene-schema';
import {
  addLevel,
  addOpening,
  addWall,
  batch,
  copyLevel,
  createEditor,
  removeLevel,
  setLevelProps,
  setRoomProps,
  type Editor,
} from './index';

const mk = () => createEditor(createEmptyScene());
const scene = (e: Editor) => e.getState().scene;
const ground = (e: Editor) => scene(e).levelOrder[0]!;

function houseWithDoor(e: Editor) {
  const L = ground(e);
  e.execute(
    batch('rect', [
      addWall({ levelId: L, from: [0, 0], to: [4, 0] }),
      addWall({ levelId: L, from: [4, 0], to: [4, 3] }),
      addWall({ levelId: L, from: [4, 3], to: [0, 3] }),
      addWall({ levelId: L, from: [0, 3], to: [0, 0] }),
    ]),
  );
  const wall = Object.values(scene(e).walls)[0]!;
  e.execute(addOpening({ wallId: wall.id, type: 'door', offset: 2 }));
  e.execute(setRoomProps(Object.values(scene(e).rooms)[0]!.id, { name: 'Kitchen', floorMaterial: { id: 'floor-tile-grey' } }));
}

describe('floors stack without gaps', () => {
  it('each new floor starts where the last ends', () => {
    const e = mk();
    e.execute(addLevel());
    e.execute(addLevel(undefined, 2.8));
    const s = scene(e);
    const [a, b, c] = s.levelOrder.map((id) => s.levels[id]!);
    expect([a!.elevation, b!.elevation, c!.elevation]).toEqual([0, 3, 6]);
    expect(c!.height).toBe(2.8);
  });

  it('changing a floor height moves the floors above and clamps silly values', () => {
    const e = mk();
    e.execute(addLevel());
    e.execute(addLevel());
    const [g, , top] = scene(e).levelOrder as [string, string, string];
    e.execute(setLevelProps(g, { height: 3.4 }));
    expect(scene(e).levels[top]!.elevation).toBeCloseTo(3.4 + 3);
    e.execute(setLevelProps(g, { height: 50 }));
    expect(scene(e).levels[g]!.height).toBe(6);
    e.execute(setLevelProps(g, { height: 0.1 }));
    expect(scene(e).levels[g]!.height).toBe(2);
  });

  it('walls that followed the old floor height follow the new one; custom walls do not', () => {
    const e = mk();
    const g = ground(e);
    e.execute(addWall({ levelId: g, from: [0, 0], to: [4, 0] }));
    e.execute(addWall({ levelId: g, from: [4, 0], to: [4, 3], height: 2.2 }));
    e.execute(setLevelProps(g, { height: 3.5 }));
    const heights = Object.values(scene(e).walls).map((w) => w.height);
    expect(heights).toEqual([3.5, 2.2]);
  });

  it('renames a floor (trimmed, never empty) and undo restores everything', () => {
    const e = mk();
    const g = ground(e);
    const before = scene(e);
    e.execute(setLevelProps(g, { name: '  Basement ' }));
    expect(scene(e).levels[g]!.name).toBe('Basement');
    expect(e.execute(setLevelProps(g, { name: '   ' }))).toBe(false);
    e.undo();
    expect(scene(e)).toEqual(before);
  });
});

describe('copy floor', () => {
  it('duplicates walls, openings and room names/materials on a new floor above', () => {
    const e = mk();
    houseWithDoor(e);
    e.execute(copyLevel(ground(e)));
    const s = scene(e);
    expect(s.levelOrder).toHaveLength(2);
    const top = s.levelOrder[1]!;
    expect(s.levels[top]!.elevation).toBe(3);
    const w1 = Object.values(s.walls).filter((w) => w.levelId === top);
    expect(w1).toHaveLength(4);
    expect(Object.values(s.nodes).filter((n) => n.levelId === top)).toHaveLength(4);
    const ops = Object.values(s.openings).filter((o) => w1.some((w) => w.id === o.wallId));
    expect(ops).toHaveLength(1);
    const rooms = Object.values(s.rooms).filter((r) => r.levelId === top);
    expect(rooms).toHaveLength(1);
    expect(rooms[0]).toMatchObject({ name: 'Kitchen', floorMaterial: { id: 'floor-tile-grey' } });
  });

  it('the copy is independent (editing it does not touch the original) and is one undo step', () => {
    const e = mk();
    houseWithDoor(e);
    const before = scene(e);
    e.execute(copyLevel(ground(e)));
    const top = scene(e).levelOrder[1]!;
    const copied = Object.values(scene(e).walls).find((w) => w.levelId === top)!;
    const original = Object.values(scene(e).walls).find((w) => w.levelId === ground(e))!;
    expect(copied.materialA).not.toBe(original.materialA);
    e.undo();
    expect(scene(e)).toEqual(before);
  });
});

describe('delete floor', () => {
  it('removes the floor and everything on it; floors above come down', () => {
    const e = mk();
    houseWithDoor(e);
    e.execute(copyLevel(ground(e)));
    e.execute(copyLevel(ground(e)));
    const [g, mid, top] = scene(e).levelOrder as [string, string, string];
    e.execute(removeLevel(mid));
    const s = scene(e);
    expect(s.levelOrder).toEqual([g, top]);
    expect(s.levels[top]!.elevation).toBe(3);
    expect(Object.values(s.walls).every((w) => w.levelId !== mid)).toBe(true);
    expect(Object.values(s.nodes).every((n) => n.levelId !== mid)).toBe(true);
    expect(Object.values(s.rooms).every((r) => r.levelId !== mid)).toBe(true);
    expect(Object.keys(s.openings).length).toBe(2);
  });

  it('refuses to delete the last floor; undo brings a deleted floor back', () => {
    const e = mk();
    houseWithDoor(e);
    expect(e.execute(removeLevel(ground(e)))).toBe(false);
    e.execute(copyLevel(ground(e)));
    const before = scene(e);
    e.execute(removeLevel(scene(e).levelOrder[1]!));
    e.undo();
    expect(scene(e)).toEqual(before);
  });

  it('the active floor falls back to a remaining floor and selection is cleared on switching', () => {
    const e = mk();
    houseWithDoor(e);
    e.execute(addLevel());
    const top = scene(e).levelOrder[1]!;
    e.setActiveLevel(top);
    e.execute(removeLevel(top));
    expect(e.getState().activeLevelId).toBe(ground(e));

    e.select(Object.keys(scene(e).walls).slice(0, 1));
    expect(e.getState().selection).toHaveLength(1);
    e.execute(addLevel());
    e.setActiveLevel(scene(e).levelOrder[1]!);
    expect(e.getState().selection).toEqual([]);
  });
});
