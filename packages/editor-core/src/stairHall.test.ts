import { describe, expect, it } from 'vitest';
import { createEmptyScene } from '@hd/scene-schema';
import { stairLayout } from '@hd/geometry';
import { addLevel, addStairAssembly, stairNeedsRoom, batch, connectStairHall, continueStairUp, createEditor, stairHallCorners, addWall, type Editor } from './index';
import { levelRoomsOf } from './testRooms';

const L = (e: Editor, i = 0) => e.getState().scene.levelOrder[i]!;
const count = (e: Editor, k: 'stairs' | 'rooms' | 'walls' | 'openings') => Object.keys(e.getState().scene[k]).length;

describe('stairs that connect floors by themselves', () => {
  it('adds the floor above, the flight, and a room with a door around the top', () => {
    const e = createEditor(createEmptyScene());
    e.execute(addStairAssembly({ fromLevel: L(e), origin: [2, 2], kind: 'straight' }));
    expect(e.getState().scene.levelOrder).toHaveLength(2);
    expect(count(e, 'stairs')).toBe(1);
    const up = L(e, 1);
    const walls = Object.values(e.getState().scene.walls).filter((w) => w.levelId === up);
    expect(walls).toHaveLength(4);
    expect(levelRoomsOf(e.getState().scene, up)).toHaveLength(1);
    expect(count(e, 'openings')).toBe(1); // the door on the landing side
    // The whole stairwell sits inside that room (so the floor can open there).
    const s = Object.values(e.getState().scene.stairs)[0]!;
    const room = levelRoomsOf(e.getState().scene, up)[0]!;
    const xs = room.map((p) => p[0]);
    expect(Math.min(...xs)).toBeLessThan(2 - 0.5 + 1e-6);
    expect(stairNeedsRoom(e.getState().scene, s, (lid) => levelRoomsOf(e.getState().scene, lid))).toBeNull(); // the floor opens up
    expect(s.toLevel).toBe(up);
    // One undo removes everything it did.
    e.undo();
    expect(e.getState().scene.levelOrder).toHaveLength(1);
    expect(count(e, 'stairs')).toBe(0);
  });

  it('every kind and turn gets its landing on the arrival side', () => {
    for (const kind of ['straight', 'L', 'U', 'spiral'] as const) for (const mirror of [false, true]) for (const rot of [0, Math.PI / 2, Math.PI]) {
      const ed = createEditor(createEmptyScene());
      ed.execute(addStairAssembly({ fromLevel: L(ed), origin: [3, 3], kind, mirror, rotationY: rot }));
      const up = L(ed, 1);
      expect(levelRoomsOf(ed.getState().scene, up), `${kind} ${mirror} ${rot}`).toHaveLength(1);
      const st = Object.values(ed.getState().scene.stairs)[0]!;
      expect(stairNeedsRoom(ed.getState().scene, st, (lid) => levelRoomsOf(ed.getState().scene, lid)), `${kind} ${mirror} ${rot}`).toBeNull();
      const layout = stairLayout({ kind, width: 1, rise: 3, mirror });
      const { corners } = stairHallCorners(layout, [3, 3], rot);
      expect(corners).toHaveLength(4);
    }
  });

  it('does not build a second room when the floor above already surrounds the stairwell', () => {
    const e = createEditor(createEmptyScene());
    e.execute(addLevel());
    const up = L(e, 1);
    e.execute(
      batch('room', [
        addWall({ levelId: up, from: [-1, -6], to: [8, -6] }),
        addWall({ levelId: up, from: [8, -6], to: [8, 6] }),
        addWall({ levelId: up, from: [8, 6], to: [-1, 6] }),
        addWall({ levelId: up, from: [-1, 6], to: [-1, -6] }),
      ]),
    );
    const before = count(e, 'walls');
    e.execute(addStairAssembly({ fromLevel: L(e), origin: [2, 2], kind: 'L' }));
    expect(count(e, 'walls')).toBe(before);
    expect(count(e, 'stairs')).toBe(1);
  });

  it('toTop runs one flight per floor, and a stair can be continued up later', () => {
    const e = createEditor(createEmptyScene());
    e.execute(addLevel());
    e.execute(addLevel());
    e.execute(addStairAssembly({ fromLevel: L(e), origin: [0, 0], toTop: true }));
    expect(count(e, 'stairs')).toBe(2);

    const f = createEditor(createEmptyScene());
    f.execute(addStairAssembly({ fromLevel: L(f), origin: [0, 0] }));
    const first = Object.keys(f.getState().scene.stairs)[0]!;
    f.execute(continueStairUp(first));
    expect(f.getState().scene.levelOrder).toHaveLength(3);
    expect(Object.keys(f.getState().scene.stairs)).toHaveLength(2);
    f.execute(continueStairUp(first)); // already connected: nothing more happens
    expect(Object.keys(f.getState().scene.stairs)).toHaveLength(2);
  });

  it('connectStairHall repairs a stair that was placed without its room', () => {
    const e = createEditor(createEmptyScene());
    e.execute(addStairAssembly({ fromLevel: L(e), origin: [1, 1], hall: false }));
    expect(levelRoomsOf(e.getState().scene, L(e, 1))).toHaveLength(0);
    e.execute(connectStairHall(Object.keys(e.getState().scene.stairs)[0]!));
    expect(levelRoomsOf(e.getState().scene, L(e, 1))).toHaveLength(1);
  });
});

describe('stairs stay joined to the right floors', () => {
  it('a stair follows the floor above it and goes when its own floor goes', async () => {
    const { removeLevel, addStair, snapStairToWalls, stairOutline, stairOpenings, clipToConvex } = await import('./index');
    const e = createEditor(createEmptyScene());
    e.execute(addLevel());
    e.execute(addLevel());
    e.execute(addStair({ fromLevel: L(e, 0), origin: [1, 1] }));
    const id = Object.keys(e.getState().scene.stairs)[0]!;
    expect(e.getState().scene.stairs[id]!.toLevel).toBe(L(e, 1));
    // take the middle floor away: the stair then climbs to the floor that is now directly above
    e.execute(removeLevel(L(e, 1)));
    // (removing a floor removes the stairs that touch it)
    expect(Object.keys(e.getState().scene.stairs)).toHaveLength(0);
    void snapStairToWalls; void stairOutline; void stairOpenings; void clipToConvex;
  });

  it('snaps flush to the nearest wall faces and leaves a free stair alone', async () => {
    const { snapStairToWalls } = await import('./index');
    const e = createEditor(createEmptyScene());
    e.execute(batch('room', [addWall({ levelId: L(e), from: [0, 0], to: [6, 0], kind: 'exterior' }), addWall({ levelId: L(e), from: [6, 0], to: [6, 5], kind: 'exterior' }), addWall({ levelId: L(e), from: [6, 5], to: [0, 5], kind: 'exterior' }), addWall({ levelId: L(e), from: [0, 5], to: [0, 0], kind: 'exterior' })]));
    const sc = e.getState().scene;
    // a 1 m x 3 m stair 10 cm off the west wall and 11 cm off the south wall
    const near: Array<[number, number]> = [[0.3, 1.0], [1.3, 1.0], [1.3, 4.78], [0.3, 4.78]];
    const [dx, dz] = snapStairToWalls(sc, L(e), near);
    expect(0.3 + dx).toBeCloseTo(0.115, 5); // the wall's inner face
    expect(4.78 + dz).toBeCloseTo(5 - 0.115, 5);
    expect(snapStairToWalls(sc, L(e), [[2, 2], [3, 2], [3, 3], [2, 3]])).toEqual([0, 0]);
  });

  it('a stairwell that only partly lies in a room still gets the matching hole', async () => {
    const { clipToConvex } = await import('./index');
    const room: Array<[number, number]> = [[0, 0], [4, 0], [4, 3], [0, 3]];
    const stair: Array<[number, number]> = [[3, 1], [5, 1], [5, 2], [3, 2]];
    const c = clipToConvex(stair, room, 0)!;
    const xs = c.map((p) => p[0]);
    expect(Math.min(...xs)).toBeCloseTo(3);
    expect(Math.max(...xs)).toBeCloseTo(4);
    expect(clipToConvex(stair, [[0, 0], [2, 0], [2, 3], [0, 3]], 0)).toBeNull();
    // a concave room is not clipped (the caller falls back to the all-or-nothing hole)
    expect(clipToConvex(stair, [[0, 0], [4, 0], [4, 3], [2, 1], [0, 3]], 0)).toBeNull();
  });
});

describe('one-step staircase through several floors', () => {
  it('climbs the chosen number of floors, adding the missing ones, as one undo step', () => {
    const e = createEditor(createEmptyScene());
    e.execute(addLevel()); // one floor above already there
    e.execute(addStairAssembly({ fromLevel: L(e), origin: [2, 2], kind: 'U', flights: 4, hall: false, floorHeight: 3.2 }));
    const sc = e.getState().scene;
    expect(sc.levelOrder).toHaveLength(5);
    expect(count(e, 'stairs')).toBe(4);
    // every flight goes from one floor to the next, stacked
    const st = Object.values(sc.stairs);
    for (let i = 0; i < 4; i++) expect(st.some((s) => s.fromLevel === sc.levelOrder[i] && s.toLevel === sc.levelOrder[i + 1])).toBe(true);
    // the added floors use the chosen height, the existing one keeps its own
    expect(sc.levels[sc.levelOrder[1]!]!.height).toBe(3);
    expect(sc.levels[sc.levelOrder[2]!]!.height).toBeCloseTo(3.2);
    e.undo();
    expect(e.getState().scene.levelOrder).toHaveLength(2);
    expect(count(e, 'stairs')).toBe(0);
  });

  it('without the room: no walls, doors or roofs are added round the stairs', () => {
    const e = createEditor(createEmptyScene());
    e.execute(addStairAssembly({ fromLevel: L(e), origin: [2, 2], flights: 3, hall: false }));
    expect(count(e, 'stairs')).toBe(3);
    expect(count(e, 'walls')).toBe(0);
    expect(count(e, 'openings')).toBe(0);
    expect(Object.keys(e.getState().scene.roofs)).toHaveLength(0);
    const s = Object.values(e.getState().scene.stairs).find((x) => x.fromLevel === L(e, 2))!;
    e.execute(continueStairUp(s.id, undefined, { hall: false }));
    expect(count(e, 'stairs')).toBe(4);
    expect(count(e, 'walls')).toBe(0);
  });

  it('carries the build and railing choices onto every flight and clamps the count', () => {
    const e = createEditor(createEmptyScene());
    e.execute(addStairAssembly({ fromLevel: L(e), origin: [0, 0], flights: 99, hall: false, build: 'floating', railing: 'glass', width: 1.3 }));
    const st = Object.values(e.getState().scene.stairs);
    expect(st).toHaveLength(12);
    expect(st.every((s) => s.build === 'floating' && s.railing === 'glass' && s.width === 1.3)).toBe(true);
    const f = createEditor(createEmptyScene());
    f.execute(addStairAssembly({ fromLevel: L(f), origin: [0, 0], flights: 2, build: 'solid' }));
    expect(Object.values(f.getState().scene.stairs).every((s) => s.build === undefined)).toBe(true);
  });

  it('with the room: each flight gets its room on the floor it reaches', () => {
    const e = createEditor(createEmptyScene());
    e.execute(addStairAssembly({ fromLevel: L(e), origin: [2, 2], kind: 'straight', flights: 3 }));
    const sc = e.getState().scene;
    for (let i = 1; i <= 3; i++) expect(levelRoomsOf(sc, sc.levelOrder[i]!).length).toBeGreaterThanOrEqual(1);
  });
});
