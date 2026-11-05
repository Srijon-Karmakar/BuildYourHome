import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createEmptyScene, type Id, type Scene, type Vec2 } from '@hd/scene-schema';
import { OPENING_END_MARGIN_M } from '@hd/geometry';
import {
  addOpening,
  addWall,
  createEditor,
  freeOffset,
  moveNode,
  moveOpening,
  nearestWallPoint,
  OPENING_GAP_M,
  removeOpenings,
  removeWalls,
  setOpeningProps,
  type Editor,
} from './index';

const mk = () => createEditor(createEmptyScene());
const L = (e: Editor) => e.getState().activeLevelId;
const scene = (e: Editor) => e.getState().scene;
const openings = (e: Editor) => Object.values(scene(e).openings);

/** Editor with one 8 m wall along x and its id. */
function withWall(len = 8) {
  const e = mk();
  e.execute(addWall({ levelId: L(e), from: [0, 0], to: [len, 0] }));
  const wallId = Object.keys(scene(e).walls)[0]!;
  return { e, wallId };
}

describe('addOpening', () => {
  it('adds a door with sensible defaults at the requested spot', () => {
    const { e, wallId } = withWall();
    e.execute(addOpening({ wallId, type: 'door', offset: 3 }));
    const o = openings(e)[0]!;
    expect(o).toMatchObject({ type: 'door', width: 0.9, height: 2.1, sill: 0, offset: 3, assetId: 'door-basic' });
    expect(o.flip).toEqual({ swing: false, side: false });
  });

  it('a window has a sill and a lintel stays above it', () => {
    const { e, wallId } = withWall();
    e.execute(addOpening({ wallId, type: 'window', offset: 4 }));
    const o = openings(e)[0]!;
    expect(o.sill).toBeCloseTo(0.9);
    expect(o.sill + o.height).toBeLessThan(3 - 0.1 + 1e-9);
  });

  it('keeps clear of the wall ends (clamps)', () => {
    const { e, wallId } = withWall();
    e.execute(addOpening({ wallId, type: 'door', offset: 0 }));
    expect(openings(e)[0]!.offset).toBeCloseTo(OPENING_END_MARGIN_M + 0.45);
    e.execute(addOpening({ wallId, type: 'door', offset: 99 }));
    expect(Math.max(...openings(e).map((o) => o.offset))).toBeCloseTo(8 - OPENING_END_MARGIN_M - 0.45);
  });

  it('never overlaps: lands in the nearest free spot instead', () => {
    const { e, wallId } = withWall();
    e.execute(addOpening({ wallId, type: 'door', offset: 4 }));
    e.execute(addOpening({ wallId, type: 'door', offset: 4.2 }));
    const [a, b] = openings(e).sort((p, q) => p.offset - q.offset);
    expect(b!.offset - a!.offset).toBeGreaterThanOrEqual(0.9 + OPENING_GAP_M - 1e-9);
    expect(openings(e)).toHaveLength(2);
  });

  it('does nothing when the wall is too short (no history entry)', () => {
    const { e, wallId } = withWall(1.0);
    expect(e.execute(addOpening({ wallId, type: 'door', offset: 0.5 }))).toBe(false);
    expect(openings(e)).toHaveLength(0);
  });

  it('does nothing when the wall is full', () => {
    const { e, wallId } = withWall(2.2);
    e.execute(addOpening({ wallId, type: 'door', offset: 1.1 }));
    expect(e.execute(addOpening({ wallId, type: 'door', offset: 1.1 }))).toBe(false);
  });

  it('is one undo step', () => {
    const { e, wallId } = withWall();
    const before = scene(e);
    e.execute(addOpening({ wallId, type: 'door', offset: 3 }));
    e.undo();
    expect(scene(e)).toEqual(before);
  });

  it('records swing / hinge flips', () => {
    const { e, wallId } = withWall();
    e.execute(addOpening({ wallId, type: 'door', offset: 3, swing: true, hinge: true }));
    expect(openings(e)[0]!.flip).toEqual({ swing: true, side: true });
  });
});

describe('moveOpening', () => {
  it('slides along the wall, snapping to a free spot', () => {
    const { e, wallId } = withWall();
    e.execute(addOpening({ wallId, type: 'door', offset: 2 }));
    e.execute(addOpening({ wallId, type: 'door', offset: 6 }));
    const first = openings(e).find((o) => o.offset < 4)!;
    e.execute(moveOpening(first.id, wallId, 5.9)); // would collide with the other door
    const moved = scene(e).openings[first.id]!;
    expect(Math.abs(moved.offset - 6)).toBeGreaterThanOrEqual(0.9 + OPENING_GAP_M - 1e-9);
  });

  it('can move onto another wall', () => {
    const e = mk();
    e.execute(addWall({ levelId: L(e), from: [0, 0], to: [6, 0] }));
    e.execute(addWall({ levelId: L(e), from: [0, 4], to: [6, 4] }));
    const [w1, w2] = Object.keys(scene(e).walls) as [Id, Id];
    e.execute(addOpening({ wallId: w1, type: 'door', offset: 3 }));
    const id = openings(e)[0]!.id;
    e.execute(moveOpening(id, w2, 2));
    expect(scene(e).openings[id]).toMatchObject({ wallId: w2, offset: 2 });
  });

  it('a drag is a single undo step', () => {
    const { e, wallId } = withWall();
    e.execute(addOpening({ wallId, type: 'door', offset: 2 }));
    const id = openings(e)[0]!.id;
    const before = scene(e);
    e.beginTransaction('Move opening');
    for (const x of [2.5, 3, 3.5, 4]) e.preview(moveOpening(id, wallId, x));
    e.commitTransaction();
    expect(scene(e).openings[id]!.offset).toBeCloseTo(4);
    e.undo();
    expect(scene(e)).toEqual(before);
  });
});

describe('setOpeningProps', () => {
  it('widens a door when there is room, and flips swing/hinge', () => {
    const { e, wallId } = withWall();
    e.execute(addOpening({ wallId, type: 'door', offset: 4 }));
    const id = openings(e)[0]!.id;
    e.execute(setOpeningProps(id, { width: 1.2, flip: { swing: true } }));
    expect(scene(e).openings[id]).toMatchObject({ width: 1.2, flip: { swing: true, side: false } });
  });

  it('refuses a width that would collide or run past the wall end', () => {
    const { e, wallId } = withWall();
    e.execute(addOpening({ wallId, type: 'door', offset: 2 }));
    e.execute(addOpening({ wallId, type: 'door', offset: 3.0 }));
    const id = openings(e).sort((a, b) => a.offset - b.offset)[0]!.id;
    expect(e.execute(setOpeningProps(id, { width: 4 }))).toBe(false);
  });

  it('keeps a lintel above a tall opening', () => {
    const { e, wallId } = withWall();
    e.execute(addOpening({ wallId, type: 'door', offset: 4 }));
    const id = openings(e)[0]!.id;
    e.execute(setOpeningProps(id, { height: 9 }));
    const o = scene(e).openings[id]!;
    expect(o.sill + o.height).toBeLessThanOrEqual(3 - 0.1 + 1e-9);
  });
});

describe('openings follow wall edits (postProcess)', () => {
  it('deleting a wall deletes its openings; deleting an opening leaves the wall', () => {
    const { e, wallId } = withWall();
    e.execute(addOpening({ wallId, type: 'door', offset: 3 }));
    e.execute(removeOpenings([openings(e)[0]!.id]));
    expect(openings(e)).toHaveLength(0);
    expect(Object.keys(scene(e).walls)).toHaveLength(1);
    e.execute(addOpening({ wallId, type: 'window', offset: 3 }));
    e.execute(removeWalls([wallId]));
    expect(openings(e)).toHaveLength(0);
  });

  it('shortening a wall pushes openings along without overlap, and drops those that no longer fit', () => {
    const { e, wallId } = withWall();
    e.execute(addOpening({ wallId, type: 'door', offset: 2 }));
    e.execute(addOpening({ wallId, type: 'window', offset: 5 }));
    const far = Object.values(scene(e).nodes).find((n) => n.p[0] === 8)!;
    e.execute(moveNode(far.id, [3.2, 0])); // wall now 3.2 m: door fits at 2, window (1.2) gets pushed/dropped
    const list = openings(e).sort((a, b) => a.offset - b.offset);
    for (let i = 1; i < list.length; i++) {
      const gap = list[i]!.offset - list[i]!.width / 2 - (list[i - 1]!.offset + list[i - 1]!.width / 2);
      expect(gap).toBeGreaterThanOrEqual(OPENING_GAP_M - 1e-9);
    }
    for (const o of list) expect(o.offset + o.width / 2).toBeLessThanOrEqual(3.2 - OPENING_END_MARGIN_M + 1e-9);
    e.undo();
    expect(openings(e)).toHaveLength(2);
  });

  it('splitting a wall (T junction) keeps every opening valid on whichever half it lands', () => {
    const { e, wallId } = withWall();
    e.execute(addOpening({ wallId, type: 'door', offset: 3.9 })); // close to where the new wall will touch
    e.execute(addWall({ levelId: L(e), from: [4, 3], to: [4, 0] }));
    expect(openings(e).length).toBeLessThanOrEqual(1);
    for (const o of openings(e)) {
      const w = scene(e).walls[o.wallId]!;
      const a = scene(e).nodes[w.a]!.p, b = scene(e).nodes[w.b]!.p;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      expect(o.offset - o.width / 2).toBeGreaterThanOrEqual(OPENING_END_MARGIN_M - 1e-9);
      expect(o.offset + o.width / 2).toBeLessThanOrEqual(len - OPENING_END_MARGIN_M + 1e-9);
    }
  });
});

describe('helpers', () => {
  it('nearestWallPoint reports offset, side and distance', () => {
    const { e, wallId } = withWall();
    const hit = nearestWallPoint(scene(e), L(e), [3, 0.4], 1)!;
    expect(hit.wallId).toBe(wallId);
    expect(hit.offset).toBeCloseTo(3);
    expect(hit.dist).toBeCloseTo(0.4);
    expect(hit.side).toBe(1); // +z is the left of a → b = +x
    expect(nearestWallPoint(scene(e), L(e), [3, -0.4], 1)!.side).toBe(-1);
    expect(nearestWallPoint(scene(e), L(e), [3, 5], 1)).toBeNull();
  });

  it('freeOffset prefers the closest free centre', () => {
    const { e, wallId } = withWall();
    e.execute(addOpening({ wallId, type: 'door', offset: 4 }));
    const s = scene(e);
    const left = freeOffset(s, wallId, 3.9, 0.9)!;
    const right = freeOffset(s, wallId, 4.1, 0.9)!;
    expect(left).toBeLessThan(4);
    expect(right).toBeGreaterThan(4);
  });
});

describe('property: openings stay valid under random edits; undo/redo round-trips', () => {
  const pt = fc.tuple(fc.integer({ min: 0, max: 8 }), fc.integer({ min: 0, max: 8 })).map(([x, z]) => [x, z] as Vec2);
  const op = fc.oneof(
    fc.record({ k: fc.constant('wall' as const), a: pt, b: pt }),
    fc.record({ k: fc.constant('open' as const), type: fc.constantFrom('door', 'window', 'arch'), pick: fc.nat(50), at: fc.double({ min: -1, max: 10, noNaN: true }) }),
    fc.record({ k: fc.constant('move' as const), pick: fc.nat(50), wallPick: fc.nat(50), at: fc.double({ min: -1, max: 10, noNaN: true }) }),
    fc.record({ k: fc.constant('size' as const), pick: fc.nat(50), w: fc.double({ min: 0.4, max: 3, noNaN: true }) }),
    fc.record({ k: fc.constant('node' as const), pick: fc.nat(50), p: pt }),
    fc.record({ k: fc.constant('del' as const), pick: fc.nat(50) }),
  );

  function assertValid(s: Scene) {
    const byWall = new Map<Id, typeof s.openings[string][]>();
    for (const o of Object.values(s.openings)) {
      const w = s.walls[o.wallId];
      expect(w).toBeDefined();
      const a = s.nodes[w!.a]!.p, b = s.nodes[w!.b]!.p;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      expect(o.offset - o.width / 2).toBeGreaterThanOrEqual(OPENING_END_MARGIN_M - 1e-6);
      expect(o.offset + o.width / 2).toBeLessThanOrEqual(len - OPENING_END_MARGIN_M + 1e-6);
      expect(o.sill + o.height).toBeLessThanOrEqual(w!.height - 0.1 + 1e-6);
      byWall.set(o.wallId, [...(byWall.get(o.wallId) ?? []), o]);
    }
    for (const list of byWall.values()) {
      list.sort((p, q) => p.offset - q.offset);
      for (let i = 1; i < list.length; i++) {
        const gap = list[i]!.offset - list[i]!.width / 2 - (list[i - 1]!.offset + list[i - 1]!.width / 2);
        expect(gap).toBeGreaterThanOrEqual(OPENING_GAP_M - 1e-6);
      }
    }
  }

  it('holds for random sequences', () => {
    fc.assert(
      fc.property(fc.array(op, { maxLength: 40 }), (ops) => {
        const e = mk();
        const initial = scene(e);
        let seed = 3;
        const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        for (const o of ops) {
          const s = scene(e);
          const walls = Object.keys(s.walls);
          const nodes = Object.keys(s.nodes);
          const ops2 = Object.keys(s.openings);
          switch (o.k) {
            case 'wall':
              e.execute(addWall({ levelId: L(e), from: o.a, to: o.b }, rng));
              break;
            case 'open':
              if (walls.length) e.execute(addOpening({ wallId: walls[o.pick % walls.length]!, type: o.type, offset: o.at }, rng));
              break;
            case 'move':
              if (ops2.length && walls.length) e.execute(moveOpening(ops2[o.pick % ops2.length]!, walls[o.wallPick % walls.length]!, o.at));
              break;
            case 'size':
              if (ops2.length) e.execute(setOpeningProps(ops2[o.pick % ops2.length]!, { width: o.w }));
              break;
            case 'node':
              if (nodes.length) e.execute(moveNode(nodes[o.pick % nodes.length]!, o.p));
              break;
            case 'del':
              if (ops2.length) e.execute(removeOpenings([ops2[o.pick % ops2.length]!]));
              break;
          }
          assertValid(scene(e));
        }
        const final = scene(e);
        while (e.undo()) {
          /* undo all */
        }
        expect(scene(e)).toEqual(initial);
        while (e.redo()) {
          /* redo all */
        }
        expect(scene(e)).toEqual(final);
      }),
      { numRuns: 120 },
    );
  });
});
