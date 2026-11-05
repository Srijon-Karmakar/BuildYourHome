import { describe, expect, it } from 'vitest';
import { createEmptyScene, loadScene, type Vec2 } from '@hd/scene-schema';
import {
  addLevel,
  addStair,
  addWall,
  batch,
  createEditor,
  levelAbove,
  removeLevel,
  removeStairs,
  rotateStairs,
  setLevelProps,
  stairNeedsRoom,
  stairOpenings,
  stairOutline,
  stairRise,
  translateStairs,
  updateStairs,
  type Editor,
} from './index';
import { levelRoomsOf } from './testRooms';

const mk = () => createEditor(createEmptyScene());
const scene = (e: Editor) => e.getState().scene;
const ground = (e: Editor) => scene(e).levelOrder[0]!;
const stairs = (e: Editor) => Object.values(scene(e).stairs);

const room = (e: Editor, levelId: string, x0: number, z0: number, x1: number, z1: number) =>
  e.execute(
    batch('room', [
      addWall({ levelId, from: [x0, z0], to: [x1, z0] }),
      addWall({ levelId, from: [x1, z0], to: [x1, z1] }),
      addWall({ levelId, from: [x1, z1], to: [x0, z1] }),
      addWall({ levelId, from: [x0, z1], to: [x0, z0] }),
    ]),
  );

describe('stairs: commands', () => {
  it('needs a floor above: nothing happens without one, then it connects the two floors', () => {
    const e = mk();
    e.execute(addStair({ fromLevel: ground(e), origin: [1, 1] }));
    expect(stairs(e)).toHaveLength(0);
    e.execute(addLevel());
    e.execute(addStair({ fromLevel: ground(e), origin: [1, 1], kind: 'L', width: 1.1 }));
    const s = stairs(e)[0]!;
    expect(s.fromLevel).toBe(ground(e));
    expect(s.toLevel).toBe(levelAbove(scene(e), ground(e)));
    expect(s.kind).toBe('L');
    expect(s.origin).toEqual([1, 0, 1]);
    expect(stairRise(scene(e), s)).toBeCloseTo(3, 9);
    expect(loadScene(JSON.parse(JSON.stringify(scene(e)))).ok).toBe(true);
  });

  it('"add floor + stairs" is ONE undo step (stairs added to the floor created in the same batch)', () => {
    const e = mk();
    e.execute(batch('Add stairs', [addLevel(), addStair({ fromLevel: ground(e), origin: [0, 0] })]));
    expect(scene(e).levelOrder).toHaveLength(2);
    expect(stairs(e)).toHaveLength(1);
    e.undo();
    expect(scene(e).levelOrder).toHaveLength(1);
    expect(stairs(e)).toHaveLength(0);
  });

  it('edits: kind, width (clamped), turn, mirror, material, position', () => {
    const e = mk();
    e.execute(addLevel());
    e.execute(addStair({ fromLevel: ground(e), origin: [0, 0] }));
    const id = stairs(e)[0]!.id;
    e.execute(updateStairs([id], { kind: 'U', width: 9, mirror: true, material: { id: 'floor-tile-grey' }, origin: [3, 4] }));
    let s = stairs(e)[0]!;
    expect([s.kind, s.width, s.mirror, s.material?.id, s.origin]).toEqual(['U', 3, true, 'floor-tile-grey', [3, 0, 4]]);
    e.execute(updateStairs([id], { mirror: false, width: 0.1 }));
    s = stairs(e)[0]!;
    expect(s.mirror).toBeUndefined();
    expect(s.width).toBe(0.6);
    e.execute(rotateStairs([id], Math.PI / 2));
    e.execute(translateStairs([id], 1, -1));
    s = stairs(e)[0]!;
    expect(s.rotationY).toBeCloseTo(Math.PI / 2, 9);
    expect([s.origin[0], s.origin[2]]).toEqual([4, 3]);
    e.execute(removeStairs([id]));
    expect(stairs(e)).toHaveLength(0);
  });

  it('the rise follows the floor height (never stored), and stairs go with either of their floors', () => {
    const e = mk();
    e.execute(addLevel());
    e.execute(addStair({ fromLevel: ground(e), origin: [0, 0] }));
    e.execute(setLevelProps(ground(e), { height: 3.4 }));
    expect(stairRise(scene(e), stairs(e)[0]!)).toBeCloseTo(3.4, 9);
    e.execute(removeLevel(scene(e).levelOrder[1]!));
    expect(stairs(e)).toHaveLength(0);

    const f = mk();
    f.execute(addLevel());
    f.execute(addLevel());
    f.execute(addStair({ fromLevel: ground(f), origin: [0, 0] }));
    f.execute(removeLevel(ground(f)));
    expect(stairs(f)).toHaveLength(0);
  });

  it('copying a floor does not duplicate or break existing stairs', () => {
    const e = mk();
    e.execute(addLevel());
    e.execute(addStair({ fromLevel: ground(e), origin: [0, 0] }));
    e.execute(addLevel());
    expect(stairs(e)).toHaveLength(1);
  });
});

describe('stairs: stairwell openings', () => {
  const setup = () => {
    const e = mk();
    e.execute(addLevel());
    const [g, up] = scene(e).levelOrder as [string, string];
    room(e, g, 0, 0, 6, 8);
    room(e, up, 0, 0, 6, 8);
    return { e, g, up };
  };
  const polysOf = (e: Editor, id: string): Vec2[][] => levelRoomsOf(scene(e), id);

  it('the floor above and the ceiling below get a hole when the stair is inside the room', () => {
    const { e, g, up } = setup();
    e.execute(addStair({ fromLevel: g, origin: [3, 6], width: 1 })); // 3 m rise = 4.5 m run toward −z, ends inside the room
    const rooms = polysOf(e, up);
    expect(stairOpenings(scene(e), up, 'floor', rooms[0]!)).toHaveLength(1);
    expect(stairOpenings(scene(e), g, 'ceiling', polysOf(e, g)[0]!)).toHaveLength(1);
    expect(stairOpenings(scene(e), g, 'floor', polysOf(e, g)[0]!)).toHaveLength(0); // nothing arrives on the ground floor
    expect(stairNeedsRoom(scene(e), stairs(e)[0]!, (l) => polysOf(e, l))).toBeNull();
  });

  it('a stair that pokes out of the room leaves the floor closed and is reported', () => {
    const { e, g, up } = setup();
    e.execute(addStair({ fromLevel: g, origin: [3, 1], width: 1 })); // runs out through the north wall
    expect(stairOpenings(scene(e), up, 'floor', polysOf(e, up)[0]!)).toHaveLength(0);
    expect(stairNeedsRoom(scene(e), stairs(e)[0]!, (l) => polysOf(e, l))).toBe(up);
  });

  it('outline moves with the stair and turns with it', () => {
    const { e, g } = setup();
    e.execute(addStair({ fromLevel: g, origin: [3, 6], width: 1 }));
    const id = stairs(e)[0]!.id;
    const a = stairOutline(scene(e), stairs(e)[0]!)!;
    expect(Math.min(...a.map((p) => p[0]))).toBeCloseTo(2.5, 9);
    e.execute(rotateStairs([id], Math.PI / 2));
    const b = stairOutline(scene(e), stairs(e)[0]!)!;
    // turned a quarter: the run now extends along x instead of z
    expect(Math.max(...b.map((p) => p[0])) - Math.min(...b.map((p) => p[0]))).toBeGreaterThan(3);
  });
});
