import { describe, expect, it } from 'vitest';
import { createEmptyScene, loadScene } from '@hd/scene-schema';
import { pointInPolygon, stairLayout } from '@hd/geometry';
import {
  addBalcony,
  addLevel,
  addStair,
  addStairAssembly,
  addWall,
  batch,
  continueStairUp,
  createEditor,
  layoutOf,
  setRoof,
  stairHole,
  stairOpenings,
  stairOutline,
  stairProblems,
  stairPushOut,
  stairRailSkip,
  updateBalconies,
  updateRoofs,
  updateStairs,
  wallsInStairWay,
  type Editor,
} from './index';
import { levelRoomsOf } from './testRooms';

const mk = () => createEditor(createEmptyScene());
const scene = (e: Editor) => e.getState().scene;
const L = (e: Editor, i = 0) => scene(e).levelOrder[i]!;

const box = (e: Editor, levelId: string, x0: number, z0: number, x1: number, z1: number) =>
  e.execute(
    batch('room', [
      addWall({ levelId, from: [x0, z0], to: [x1, z0] }),
      addWall({ levelId, from: [x1, z0], to: [x1, z1] }),
      addWall({ levelId, from: [x1, z1], to: [x0, z1] }),
      addWall({ levelId, from: [x0, z1], to: [x0, z0] }),
    ]),
  );

describe('the opening above a stair', () => {
  it('is smaller than the footprint, lies inside it, and is what the floor and ceiling cut out', () => {
    const e = mk();
    e.execute(addLevel());
    box(e, L(e, 1), 0, 0, 8, 8);
    e.execute(addStair({ fromLevel: L(e), origin: [2, 7], width: 1 }));
    const s = Object.values(scene(e).stairs)[0]!;
    const outline = stairOutline(scene(e), s)!;
    const hole = stairHole(scene(e), s)!;
    const len = (p: [number, number][]) => Math.max(...p.map((q) => q[1])) - Math.min(...p.map((q) => q[1]));
    expect(len(hole)).toBeLessThan(len(outline) - 1);
    for (const p of hole) expect(pointInPolygon(p, outline, 1e-6)).toBe(true);
    const room = levelRoomsOf(scene(e), L(e, 1))[0]!;
    const cut = stairOpenings(scene(e), L(e, 1), 'floor', room);
    expect(cut).toHaveLength(1);
    expect(len(cut[0]!)).toBeCloseTo(len(hole), 6);
  });

  it('a stair stacked on another starts on floor, not over the opening below', () => {
    const e = mk();
    e.execute(addLevel());
    e.execute(addLevel());
    box(e, L(e, 1), 0, 0, 8, 8);
    e.execute(addStair({ fromLevel: L(e), origin: [2, 7], width: 1, kind: 'U' }));
    const lower = Object.values(scene(e).stairs)[0]!;
    e.execute(continueStairUp(lower.id));
    const upper = Object.values(scene(e).stairs).find((s) => s.fromLevel === L(e, 1))!;
    const hole = stairHole(scene(e), lower)!;
    // the centre of the first step of the flight above is not in the opening of the flight below
    const l2 = layoutOf(scene(e), upper)!;
    const first = l2.treads[0]!;
    const c: [number, number] = [(first.rect[0] + first.rect[2]) / 2, (first.rect[1] + first.rect[3]) / 2];
    const world: [number, number] = [upper.origin[0] + c[0], upper.origin[2] + c[1]];
    expect(pointInPolygon(world, hole, 0)).toBe(false);
  });
});

describe('stairs and walls', () => {
  const setup = () => {
    const e = mk();
    box(e, L(e), 0, 0, 6, 6);
    e.execute(addLevel());
    return e;
  };

  it('finds the walls a stair crosses and pushes the stair clear of them', () => {
    const e = setup();
    const layout = stairLayout({ kind: 'straight', width: 1, rise: 3 });
    // a stair whose right side overlaps the east wall (x = 6) by 0.2 m
    const origin: [number, number] = [5.7, 5.5];
    expect(wallsInStairWay(scene(e), L(e), layout, origin, 0).length).toBeGreaterThan(0);
    const off = stairPushOut(scene(e), L(e), layout, origin, 0);
    expect(off[0]).toBeLessThan(-0.1);
    expect(wallsInStairWay(scene(e), L(e), layout, [origin[0] + off[0], origin[1] + off[1]], 0)).toHaveLength(0);
    // a stair in the open is left alone
    expect(stairPushOut(scene(e), L(e), layout, [3, 5.5], 0)).toEqual([0, 0]);
  });

  it('reports a wall in the way, and leaves the rail out where a side stands flush against a wall', () => {
    const e = setup();
    e.execute(addStair({ fromLevel: L(e), origin: [3, 5.7], width: 1 }));
    const s = Object.values(scene(e).stairs)[0]!;
    expect(stairProblems(scene(e), s)).toEqual([]);
    // flush against the east wall: its inner face is at x = 6 - 0.06
    e.execute(updateStairs([s.id], { origin: [6 - 0.06 - 0.5, 5.7] }));
    const flush = Object.values(scene(e).stairs)[0]!;
    const skip = stairRailSkip(scene(e), flush);
    expect(skip([0.5, 0], [0.5, -3])).toBe(true); // the right side is against the wall
    expect(skip([-0.5, 0], [-0.5, -3])).toBe(false);
    e.execute(updateStairs([s.id], { origin: [5.9, 5.7] }));
    expect(stairProblems(scene(e), Object.values(scene(e).stairs)[0]!).join(' ')).toMatch(/wall/i);
  });
});

describe('stair builds and halls', () => {
  it('stores build, steps and stringer options; unset or "solid" leaves the stair as it was', () => {
    const e = mk();
    e.execute(addLevel());
    e.execute(addStair({ fromLevel: L(e), origin: [1, 5], width: 1 }));
    const id = Object.values(scene(e).stairs)[0]!.id;
    e.execute(updateStairs([id], { build: 'stringer', steps: { thickness: 0.06, risers: true }, stringer: { color: '#222222', width: 0.08 } }));
    let s = scene(e).stairs[id]!;
    expect(s.build).toBe('stringer');
    expect(s.steps).toEqual({ thickness: 0.06, risers: true });
    expect(s.stringer).toEqual({ color: '#222222', width: 0.08 });
    e.execute(updateStairs([id], { steps: { nosing: 0.02 } }));
    expect(scene(e).stairs[id]!.steps).toEqual({ thickness: 0.06, risers: true, nosing: 0.02 });
    expect(loadScene(JSON.parse(JSON.stringify(scene(e)))).ok).toBe(true);
    e.execute(updateStairs([id], { build: 'solid', steps: null, stringer: null }));
    s = scene(e).stairs[id]!;
    expect(s.build).toBeUndefined();
    expect(s.steps).toBeUndefined();
    expect(s.stringer).toBeUndefined();
  });

  it('a straight stair gets a walkway beside it on the floor above', () => {
    const e = mk();
    e.execute(addStairAssembly({ fromLevel: L(e), origin: [3, 6], kind: 'straight' }));
    const room = levelRoomsOf(scene(e), L(e, 1))[0]!;
    const xs = room.map((p) => p[0]);
    // 1 m flight + a margin on each side + a 0.9 m walkway on the right (the room is measured inside the walls)
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(2.2);
  });

  it('a spiral that continues upward starts where the last one arrived', () => {
    const e = mk();
    e.execute(addStairAssembly({ fromLevel: L(e), origin: [3, 3], kind: 'spiral', rotationY: 0, toTop: true, hall: false }));
    e.execute(addLevel());
    const st = Object.values(scene(e).stairs);
    expect(st.length).toBeGreaterThanOrEqual(1);
    const first = st[0]!;
    e.execute(continueStairUp(first.id));
    const all = Object.values(scene(e).stairs);
    const next = all.find((s) => s.fromLevel === first.toLevel);
    if (next) expect(Math.abs(next.rotationY - first.rotationY)).toBeGreaterThan(1);
  });
});

describe('balcony and roof railing options', () => {
  it('merges balcony railing, slab, supports and canopy options and resets them', () => {
    const e = mk();
    e.execute(addBalcony({ levelId: L(e), outline: [[0, 0], [3, 0], [3, 1.5], [0, 1.5]] }));
    const id = Object.values(scene(e).balconies)[0]!.id;
    e.execute(updateBalconies([id], { railing: 'wood', railingOpts: { infill: 'cables', color: '#2b2b2b' }, slab: { thickness: 0.25 }, supports: { kind: 'columns' }, canopy: { kind: 'pergola', height: 2.6 } }));
    e.execute(updateBalconies([id], { railingOpts: { height: 1.1 } }));
    const b = scene(e).balconies[id]!;
    expect(b.railing).toBe('wood');
    expect(b.railingOpts).toEqual({ infill: 'cables', color: '#2b2b2b', height: 1.1 });
    expect(b.slab).toEqual({ thickness: 0.25 });
    expect(b.supports?.kind).toBe('columns');
    expect(b.canopy).toEqual({ kind: 'pergola', height: 2.6 });
    expect(loadScene(JSON.parse(JSON.stringify(scene(e)))).ok).toBe(true);
    e.execute(updateBalconies([id], { railingOpts: null, slab: null, supports: null, canopy: null }));
    const r = scene(e).balconies[id]!;
    expect(r.railingOpts).toBeUndefined();
    expect(r.slab).toBeUndefined();
    expect(r.supports).toBeUndefined();
    expect(r.canopy).toBeUndefined();
  });

  it('stores a roof railing with its options; choosing none removes both', () => {
    const e = mk();
    box(e, L(e), 0, 0, 6, 5);
    e.execute(setRoof(L(e), { style: 'flat' }));
    const id = Object.values(scene(e).roofs)[0]!.id;
    e.execute(updateRoofs([id], { railing: 'glass', railingOpts: { height: 1.1, inset: 0.2, skip: [2] } }));
    let r = scene(e).roofs[id]!;
    expect(r.railing).toBe('glass');
    expect(r.railingOpts).toEqual({ height: 1.1, inset: 0.2, skip: [2] });
    expect(loadScene(JSON.parse(JSON.stringify(scene(e)))).ok).toBe(true);
    e.execute(updateRoofs([id], { railing: 'none' }));
    r = scene(e).roofs[id]!;
    expect(r.railing).toBeUndefined();
    expect(r.railingOpts).toBeUndefined();
  });
});
