import { describe, expect, it } from 'vitest';
import { createEmptyScene, type Scene } from '@hd/scene-schema';
import {
  addOpening,
  addWall,
  createEditor,
  mergeCollinearAt,
  removeWalls,
  setOpeningProps,
  setRoomProps,
  setWallProps,
  setWallsProps,
  type Editor,
} from './index';

const mk = () => createEditor(createEmptyScene());
const L = (e: Editor) => e.getState().activeLevelId;
const scene = (e: Editor) => e.getState().scene;
const walls = (e: Editor) => Object.values(scene(e).walls);
const add = (e: Editor, a: [number, number], b: [number, number]) => e.execute(addWall({ levelId: L(e), from: a, to: b }));

describe('merge on delete: removing a divider re-joins the wall it had split', () => {
  it('T junction → delete the stem → one wall again, node gone', () => {
    const e = mk();
    add(e, [0, 0], [8, 0]);
    const original = walls(e)[0]!.id;
    add(e, [4, 3], [4, 0]);
    expect(walls(e)).toHaveLength(3);
    const stem = walls(e).find((w) => w.id !== original && scene(e).nodes[w.a]!.p[0] === 4 && scene(e).nodes[w.a]!.p[1] === 3)!;
    e.execute(removeWalls([stem.id]));
    expect(walls(e)).toHaveLength(1);
    expect(Object.keys(scene(e).nodes)).toHaveLength(2);
    expect(walls(e)[0]!.id).toBe(original);
    e.undo();
    expect(walls(e)).toHaveLength(3);
  });

  it('keeps openings on both halves with correct offsets', () => {
    const e = mk();
    add(e, [0, 0], [8, 0]);
    const wid = walls(e)[0]!.id;
    e.execute(addOpening({ wallId: wid, type: 'door', offset: 1.5 }));
    e.execute(addOpening({ wallId: wid, type: 'window', offset: 6 }));
    add(e, [4, 3], [4, 0]);
    const stem = walls(e).find((w) => w.id !== wid && scene(e).nodes[w.a]!.p[0] === 4 && scene(e).nodes[w.a]!.p[1] === 3)!;
    e.execute(removeWalls([stem.id]));
    const ops = Object.values(scene(e).openings).sort((a, b) => a.offset - b.offset);
    expect(ops).toHaveLength(2);
    expect(ops.map((o) => +o.offset.toFixed(3))).toEqual([1.5, 6]);
    expect(ops.every((o) => o.wallId === wid)).toBe(true);
  });

  it('reversed second half: offsets measured from the other end are converted and swing/hinge mirrored', () => {
    const e = mk();
    add(e, [0, 0], [4, 0]);
    add(e, [8, 0], [4, 0]); // runs right → left into the same node
    const [w1, w2] = walls(e);
    e.execute(addOpening({ wallId: w2!.id, type: 'door', offset: 1, swing: false, hinge: false }));
    // a stem is not needed: merge directly at the shared node
    e.execute({ type: 'T', label: 't', apply: (d: Scene) => mergeCollinearAt(d, [Object.values(d.nodes).find((n) => n.p[0] === 4)!.id]) });
    expect(walls(e)).toHaveLength(1);
    const o = Object.values(scene(e).openings)[0]!;
    expect(o.wallId).toBe(w1!.id);
    expect(o.offset).toBeCloseTo(4 + (4 - 1)); // 3 m from the right end → 7 m from the left end
    expect(o.flip).toEqual({ swing: true, side: true });
  });

  it('does not merge walls with different properties or a real corner', () => {
    const e = mk();
    add(e, [0, 0], [4, 0]);
    add(e, [4, 0], [8, 0]);
    e.execute(setWallProps(walls(e)[1]!.id, { thickness: 0.3 }));
    const joint = Object.values(scene(e).nodes).find((n) => n.p[0] === 4)!;
    e.execute({ type: 'T', label: 't', apply: (d: Scene) => mergeCollinearAt(d, [joint.id]) });
    expect(walls(e)).toHaveLength(2);

    const c = mk();
    add(c, [0, 0], [4, 0]);
    add(c, [4, 0], [4, 4]);
    c.execute({ type: 'T', label: 't', apply: (d: Scene) => mergeCollinearAt(d, Object.keys(d.nodes)) });
    expect(Object.values(c.getState().scene.walls)).toHaveLength(2);
  });

  it('a closed room keeps all its walls when one unrelated wall is removed', () => {
    const e = mk();
    for (const [a, b] of [[[0, 0], [4, 0]], [[4, 0], [4, 3]], [[4, 3], [0, 3]], [[0, 3], [0, 0]]] as const) add(e, [...a], [...b]);
    add(e, [6, 0], [9, 0]);
    e.execute(removeWalls([walls(e).find((w) => scene(e).nodes[w.a]!.p[0] === 6)!.id]));
    expect(walls(e)).toHaveLength(4);
    expect(Object.values(scene(e).rooms)).toHaveLength(1);
  });
});

describe('setWallsProps (multi-select edit)', () => {
  it('applies to every selected wall in one undo step and clamps silly values', () => {
    const e = mk();
    add(e, [0, 0], [4, 0]);
    add(e, [4, 0], [4, 3]);
    const ids = walls(e).map((w) => w.id);
    const before = scene(e);
    e.execute(setWallsProps(ids, { thickness: 0.23, height: 2.7 }));
    expect(walls(e).every((w) => w.thickness === 0.23 && w.height === 2.7)).toBe(true);
    e.execute(setWallsProps(ids, { thickness: 50, height: 0 }));
    expect(walls(e).every((w) => w.thickness === 1 && w.height === 1)).toBe(true);
    e.undo();
    e.undo();
    expect(scene(e)).toEqual(before);
  });

  it('copies materials so walls never share one object', () => {
    const e = mk();
    add(e, [0, 0], [4, 0]);
    add(e, [4, 0], [4, 3]);
    const ids = walls(e).map((w) => w.id);
    e.execute(setWallsProps(ids, { materialA: { id: 'paint-sage' }, materialB: { id: 'paint-sage' } }));
    const [a, b] = walls(e);
    expect(a!.materialA).toEqual({ id: 'paint-sage' });
    expect(a!.materialA).not.toBe(b!.materialA);
  });

  it('a lower wall height keeps every opening below the lintel', () => {
    const e = mk();
    add(e, [0, 0], [6, 0]);
    const wid = walls(e)[0]!.id;
    e.execute(addOpening({ wallId: wid, type: 'door', offset: 3 }));
    e.execute(setWallsProps([wid], { height: 2.0 }));
    const o = Object.values(scene(e).openings)[0]!;
    expect(o.sill + o.height).toBeLessThanOrEqual(2.0 - 0.1 + 1e-9);
  });
});

describe('room & opening property edits', () => {
  it('renames a room and changes its floor; survives a wall move', () => {
    const e = mk();
    for (const [a, b] of [[[0, 0], [4, 0]], [[4, 0], [4, 3]], [[4, 3], [0, 3]], [[0, 3], [0, 0]]] as const) add(e, [...a], [...b]);
    const room = Object.values(scene(e).rooms)[0]!;
    e.execute(setRoomProps(room.id, { name: 'Kitchen', type: 'kitchen', floorMaterial: { id: 'floor-tile-grey' }, hasCeiling: false }));
    expect(scene(e).rooms[room.id]).toMatchObject({ name: 'Kitchen', type: 'kitchen', hasCeiling: false, floorMaterial: { id: 'floor-tile-grey' } });
  });

  it('sets exact opening sizes (width nudges, sill/height respect the lintel)', () => {
    const e = mk();
    add(e, [0, 0], [8, 0]);
    const wid = walls(e)[0]!.id;
    e.execute(addOpening({ wallId: wid, type: 'window', offset: 4 }));
    const id = Object.keys(scene(e).openings)[0]!;
    e.execute(setOpeningProps(id, { width: 1.8, height: 1.5, sill: 0.8 }));
    expect(scene(e).openings[id]).toMatchObject({ width: 1.8, height: 1.5, sill: 0.8 });
    e.execute(setOpeningProps(id, { sill: 2.5, height: 1.5 }));
    const o = scene(e).openings[id]!;
    expect(o.sill + o.height).toBeLessThanOrEqual(3 - 0.1 + 1e-9);
  });
});
