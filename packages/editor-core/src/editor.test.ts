import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createEmptyScene, type Scene } from '@hd/scene-schema';
import {
  addLevel,
  addWall,
  batch,
  createEditor,
  moveNode,
  removeWalls,
  setWallProps,
  type Command,
} from './index';

const fixed = () => createEmptyScene({ now: () => new Date('2026-01-01T00:00:00Z'), rng: () => 0.1 });
const mk = () => createEditor(fixed());
const lvl = (e: ReturnType<typeof mk>) => e.getState().activeLevelId;

describe('addWall', () => {
  it('creates two nodes and one wall with defaults', () => {
    const e = mk();
    e.execute(addWall({ levelId: lvl(e), from: [0, 0], to: [4, 0] }));
    const s = e.getState().scene;
    expect(Object.keys(s.walls)).toHaveLength(1);
    expect(Object.keys(s.nodes)).toHaveLength(2);
    const w = Object.values(s.walls)[0]!;
    expect(w.thickness).toBe(0.115);
    expect(w.height).toBe(3);
  });

  it('shares nodes at coincident points and closes a loop with 4 nodes', () => {
    const e = mk();
    const L = lvl(e);
    for (const [a, b] of [
      [[0, 0], [4, 0]],
      [[4, 0], [4, 3]],
      [[4, 3], [0, 3]],
      [[0, 3], [0, 0]],
    ] as const) {
      e.execute(addWall({ levelId: L, from: [...a], to: [...b] }));
    }
    const s = e.getState().scene;
    expect(Object.keys(s.walls)).toHaveLength(4);
    expect(Object.keys(s.nodes)).toHaveLength(4);
  });

  it('ignores zero-length and duplicate walls (no history entry)', () => {
    const e = mk();
    const L = lvl(e);
    e.execute(addWall({ levelId: L, from: [0, 0], to: [4, 0] }));
    expect(e.execute(addWall({ levelId: L, from: [0, 0], to: [0, 0] }))).toBe(false);
    expect(e.execute(addWall({ levelId: L, from: [4, 0], to: [0, 0] }))).toBe(false);
    expect(Object.keys(e.getState().scene.walls)).toHaveLength(1);
  });
});

describe('undo / redo', () => {
  it('undoes and redoes a command and updates flags', () => {
    const e = mk();
    const before = e.getState().scene;
    e.execute(addWall({ levelId: lvl(e), from: [0, 0], to: [4, 0] }));
    const after = e.getState().scene;
    expect(e.getState().canUndo).toBe(true);
    expect(e.undo()).toBe(true);
    expect(e.getState().scene).toEqual(before);
    expect(e.getState().canRedo).toBe(true);
    expect(e.redo()).toBe(true);
    expect(e.getState().scene).toEqual(after);
  });

  it('a new command clears the redo stack', () => {
    const e = mk();
    const L = lvl(e);
    e.execute(addWall({ levelId: L, from: [0, 0], to: [4, 0] }));
    e.undo();
    e.execute(addWall({ levelId: L, from: [0, 0], to: [0, 4] }));
    expect(e.getState().canRedo).toBe(false);
  });

  it('batch is one undo step', () => {
    const e = mk();
    const L = lvl(e);
    e.execute(
      batch('Rectangle', [
        addWall({ levelId: L, from: [0, 0], to: [2, 0] }),
        addWall({ levelId: L, from: [2, 0], to: [2, 2] }),
      ]),
    );
    expect(Object.keys(e.getState().scene.walls)).toHaveLength(2);
    e.undo();
    expect(Object.keys(e.getState().scene.walls)).toHaveLength(0);
    expect(e.getState().canUndo).toBe(false);
  });
});

describe('transactions (drag gestures)', () => {
  it('collapses many previews into one history entry', () => {
    const e = mk();
    e.execute(addWall({ levelId: lvl(e), from: [0, 0], to: [4, 0] }));
    const nodeId = Object.keys(e.getState().scene.nodes)[1]!;
    const before = e.getState().scene;
    e.beginTransaction('Move point');
    for (let x = 5; x <= 9; x++) e.preview(moveNode(nodeId, [x, 0]));
    expect(e.getState().scene.nodes[nodeId]?.p).toEqual([9, 0]);
    expect(e.commitTransaction()).toBe(true);
    e.undo();
    expect(e.getState().scene).toEqual(before);
  });

  it('cancel restores the scene and adds no history', () => {
    const e = mk();
    e.execute(addWall({ levelId: lvl(e), from: [0, 0], to: [4, 0] }));
    const nodeId = Object.keys(e.getState().scene.nodes)[0]!;
    const before = e.getState().scene;
    e.beginTransaction('Move point');
    e.preview(moveNode(nodeId, [-3, 2]));
    e.cancelTransaction();
    expect(e.getState().scene).toEqual(before);
    e.undo(); // undoes the addWall, not the cancelled drag
    expect(Object.keys(e.getState().scene.walls)).toHaveLength(0);
  });

  it('forbids execute() inside a transaction', () => {
    const e = mk();
    e.beginTransaction('x');
    expect(() => e.execute(addLevel())).toThrow();
  });
});

describe('postProcess invariants', () => {
  it('removing a wall drops orphan nodes and its openings', () => {
    const e = mk();
    const L = lvl(e);
    e.execute(addWall({ levelId: L, from: [0, 0], to: [4, 0] }));
    const wallId = Object.keys(e.getState().scene.walls)[0]!;
    const cmd: Command = {
      type: 'T',
      label: 't',
      apply(d) {
        d.openings.o1 = {
          id: 'o1', wallId, type: 'door', assetId: 'door-basic',
          offset: 2, width: 0.9, height: 2.1, sill: 0, flip: { swing: false, side: false },
        };
      },
    };
    e.execute(cmd);
    expect(e.getState().scene.openings.o1).toBeDefined();
    e.execute(removeWalls([wallId]));
    const s = e.getState().scene;
    expect(Object.keys(s.nodes)).toHaveLength(0);
    expect(Object.keys(s.openings)).toHaveLength(0);
  });

  it('clamps an opening back onto the wall when the wall shrinks; drops it if too short', () => {
    const e = mk();
    e.execute(addWall({ levelId: lvl(e), from: [0, 0], to: [4, 0] }));
    const s0 = e.getState().scene;
    const wallId = Object.keys(s0.walls)[0]!;
    const [n0, n1] = Object.keys(s0.nodes) as [string, string];
    e.execute({
      type: 'T', label: 't',
      apply(d) {
        d.openings.o1 = {
          id: 'o1', wallId, type: 'window', assetId: 'win', offset: 3.5, width: 1, height: 1, sill: 1,
          flip: { swing: false, side: false },
        };
      },
    });
    const far = s0.nodes[n1]!.p[0] > s0.nodes[n0]!.p[0] ? n1 : n0;
    e.execute(moveNode(far, far === n1 ? [2, 0] : [-2, 0]));
    const o = e.getState().scene.openings.o1;
    expect(o).toBeDefined();
    expect(o!.offset).toBeLessThanOrEqual(2 - 0.5 - 0.15 + 1e-9);
    e.execute(moveNode(far, far === n1 ? [0.8, 0] : [-0.8, 0]));
    expect(e.getState().scene.openings.o1).toBeUndefined();
  });

  it('prunes selection of deleted entities', () => {
    const e = mk();
    e.execute(addWall({ levelId: lvl(e), from: [0, 0], to: [4, 0] }));
    const wallId = Object.keys(e.getState().scene.walls)[0]!;
    e.select([wallId]);
    expect(e.getState().selection).toEqual([wallId]);
    e.undo();
    expect(e.getState().selection).toEqual([]);
  });
});

describe('levels', () => {
  it('stacks a new level above the previous one', () => {
    const e = mk();
    e.execute(addLevel());
    const s = e.getState().scene;
    expect(s.levelOrder).toHaveLength(2);
    expect(s.levels[s.levelOrder[1]!]?.elevation).toBe(3);
  });
});

describe('property: undo-all restores, redo-all reproduces (R9)', () => {
  const op = fc.record({
    kind: fc.constantFrom('add', 'move', 'remove', 'props', 'level'),
    ax: fc.integer({ min: 0, max: 6 }),
    ay: fc.integer({ min: 0, max: 6 }),
    bx: fc.integer({ min: 0, max: 6 }),
    by: fc.integer({ min: 0, max: 6 }),
    pick: fc.nat(1000),
  });

  it('holds for random command sequences', () => {
    fc.assert(
      fc.property(fc.array(op, { maxLength: 40 }), (ops) => {
        const e = mk();
        const initial: Scene = e.getState().scene;
        let seed = 1;
        const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        for (const o of ops) {
          const s = e.getState().scene;
          const walls = Object.keys(s.walls);
          const nodes = Object.keys(s.nodes);
          switch (o.kind) {
            case 'add':
              e.execute(addWall({ levelId: lvl(e), from: [o.ax, o.ay], to: [o.bx, o.by] }, rng));
              break;
            case 'move':
              if (nodes.length) e.execute(moveNode(nodes[o.pick % nodes.length]!, [o.bx, o.by]));
              break;
            case 'remove':
              if (walls.length) e.execute(removeWalls([walls[o.pick % walls.length]!]));
              break;
            case 'props':
              if (walls.length) e.execute(setWallProps(walls[o.pick % walls.length]!, { thickness: 0.1 + (o.pick % 5) / 100 }));
              break;
            case 'level':
              e.execute(addLevel(undefined, undefined, rng));
              break;
          }
        }
        const final = e.getState().scene;
        while (e.undo()) {
          /* undo all */
        }
        expect(e.getState().scene).toEqual(initial);
        while (e.redo()) {
          /* redo all */
        }
        expect(e.getState().scene).toEqual(final);
      }),
      { numRuns: 200 },
    );
  });
});
