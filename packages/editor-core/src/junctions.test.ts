import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createEmptyScene, type Scene, type Vec2 } from '@hd/scene-schema';
import { addWall, batch, createEditor, createWallTool, DEFAULT_SNAP, snapPoint, type Editor } from './index';

const mk = () => createEditor(createEmptyScene());
const L = (e: Editor) => e.getState().activeLevelId;
const add = (e: Editor, from: Vec2, to: Vec2) => e.execute(addWall({ levelId: L(e), from, to }));
const walls = (e: Editor) => Object.values(e.getState().scene.walls);
const nodes = (e: Editor) => Object.values(e.getState().scene.nodes);
const rooms = (e: Editor) => Object.values(e.getState().scene.rooms);

function rect(e: Editor, x0: number, z0: number, x1: number, z1: number) {
  e.execute(
    batch('rect', [
      addWall({ levelId: L(e), from: [x0, z0], to: [x1, z0] }),
      addWall({ levelId: L(e), from: [x1, z0], to: [x1, z1] }),
      addWall({ levelId: L(e), from: [x1, z1], to: [x0, z1] }),
      addWall({ levelId: L(e), from: [x0, z1], to: [x0, z0] }),
    ]),
  );
}

describe('T junction', () => {
  it('ending a new wall on the body of another splits it and joins them', () => {
    const e = mk();
    add(e, [0, 0], [8, 0]);
    add(e, [4, 3], [4, 0]);
    expect(walls(e)).toHaveLength(3);
    expect(nodes(e)).toHaveLength(4);
    const joint = nodes(e).find((n) => n.p[0] === 4 && n.p[1] === 0)!;
    expect(walls(e).filter((w) => w.a === joint.id || w.b === joint.id)).toHaveLength(3);
  });

  it('starting a new wall on the body of another splits it too', () => {
    const e = mk();
    add(e, [0, 0], [8, 0]);
    add(e, [4, 0], [4, 3]);
    expect(walls(e)).toHaveLength(3);
  });

  it('is a single undo step', () => {
    const e = mk();
    add(e, [0, 0], [8, 0]);
    const before = e.getState().scene;
    add(e, [4, 3], [4, 0]);
    e.undo();
    expect(e.getState().scene).toEqual(before);
  });

  it('split halves keep thickness/height/materials and the original wall id stays on the first half', () => {
    const e = mk();
    e.execute(addWall({ levelId: L(e), from: [0, 0], to: [8, 0], kind: 'exterior' }));
    const original = walls(e)[0]!;
    add(e, [4, 3], [4, 0]);
    const halves = walls(e).filter((w) => w.kind === 'exterior');
    expect(halves).toHaveLength(2);
    expect(halves.every((w) => w.thickness === 0.23 && w.height === 3)).toBe(true);
    expect(e.getState().scene.walls[original.id]).toBeDefined();
  });

  it('moves openings beyond the split onto the second half with a corrected offset', () => {
    const e = mk();
    add(e, [0, 0], [8, 0]);
    const wid = walls(e)[0]!.id;
    e.execute({
      type: 'T', label: 't',
      apply(d) {
        d.openings.o_near = { id: 'o_near', wallId: wid, type: 'door', assetId: 'd', offset: 1.5, width: 0.9, height: 2.1, sill: 0, flip: { swing: false, side: false } };
        d.openings.o_far = { id: 'o_far', wallId: wid, type: 'window', assetId: 'w', offset: 6, width: 1.2, height: 1.2, sill: 0.9, flip: { swing: false, side: false } };
      },
    });
    add(e, [4, 3], [4, 0]);
    const s = e.getState().scene;
    expect(s.openings.o_near!.wallId).toBe(wid);
    expect(s.openings.o_near!.offset).toBeCloseTo(1.5);
    expect(s.openings.o_far!.wallId).not.toBe(wid);
    expect(s.openings.o_far!.offset).toBeCloseTo(2);
  });
});

describe('X crossing and overlaps', () => {
  it('a wall crossing another splits both (4 walls, 5 nodes)', () => {
    const e = mk();
    add(e, [0, 0], [8, 0]);
    add(e, [4, -2], [4, 2]);
    expect(walls(e)).toHaveLength(4);
    expect(nodes(e)).toHaveLength(5);
  });

  it('a wall passing through an existing node is cut there', () => {
    const e = mk();
    add(e, [4, 0], [4, 3]);
    add(e, [0, 0], [8, 0]);
    expect(walls(e)).toHaveLength(3);
  });

  it('drawing over an existing wall does not duplicate it', () => {
    const e = mk();
    add(e, [0, 0], [4, 0]);
    add(e, [0, 0], [8, 0]);
    expect(walls(e)).toHaveLength(2);
    expect(nodes(e)).toHaveLength(3);
  });
});

describe('dividers create rooms', () => {
  it('a divider from wall body to wall body splits one room into two and keeps the old name on one', () => {
    const e = mk();
    rect(e, 0, 0, 8, 3);
    expect(rooms(e)).toHaveLength(1);
    const original = rooms(e)[0]!;
    e.execute({ type: 'T', label: 't', apply(d) { d.rooms[original.id]!.name = 'Hall'; } });
    add(e, [4, 0], [4, 3]);
    expect(rooms(e)).toHaveLength(2);
    expect(rooms(e).map((r) => r.name).sort()).toEqual(['Hall', 'Room 1']);
    e.undo();
    expect(rooms(e)).toHaveLength(1);
    expect(rooms(e)[0]!.name).toBe('Hall');
  });

  it('the wall tool finishes the chain when landing on a wall body', () => {
    const e = mk();
    rect(e, 0, 0, 8, 3);
    const t = createWallTool(e);
    t.click([4, 0], 'wall');
    expect(t.click([4, 3], 'wall')).toBe('closed');
    expect(t.last).toBeNull();
    expect(rooms(e)).toHaveLength(2);
  });
});

describe('wall snapping', () => {
  const setup = () => {
    const e = mk();
    add(e, [0, 0], [8, 0]);
    return e;
  };
  const opts = (o = {}) => ({ settings: DEFAULT_SNAP, gridStep: 0.5, thresholdM: 0.2, ...o });

  it('snaps to the nearest point on a wall body', () => {
    const e = setup();
    const r = snapPoint([3.1, 0.12], e.getState().scene, L(e), opts({ settings: { ...DEFAULT_SNAP, grid: false } }));
    expect(r.kind).toBe('wall');
    expect(r.point[0]).toBeCloseTo(3.1);
    expect(r.point[1]).toBeCloseTo(0);
    expect(r.wallId).toBeDefined();
  });

  it('a perpendicular angle ray lands exactly where it crosses the wall', () => {
    const e = setup();
    const r = snapPoint([4.05, 0.1], e.getState().scene, L(e), opts({ from: [4, 3] }));
    expect(r.kind).toBe('wall');
    expect(r.point[0]).toBeCloseTo(4);
    expect(r.point[1]).toBeCloseTo(0);
  });

  it('ignores walls that already contain the start point (building along them)', () => {
    const e = setup();
    const r = snapPoint([5.1, 0.1], e.getState().scene, L(e), opts({ from: [2, 0] }));
    expect(r.kind).not.toBe('wall');
  });

  it('can be switched off', () => {
    const e = setup();
    const r = snapPoint([3.1, 0.12], e.getState().scene, L(e), opts({ settings: { ...DEFAULT_SNAP, walls: false } }));
    expect(r.kind).toBe('grid');
  });

  it('does not offer walls adjacent to a node being dragged', () => {
    const e = setup();
    const id = nodes(e)[0]!.id;
    const r = snapPoint([3, 0.1], e.getState().scene, L(e), opts({ excludeNodeIds: [id] }));
    expect(r.kind).not.toBe('wall');
  });
});

describe('property: building walls never leaves unjoined crossings', () => {
  const cross = (a: Vec2, b: Vec2, c: Vec2, d: Vec2) => {
    const rx = b[0] - a[0], rz = b[1] - a[1], sx = d[0] - c[0], sz = d[1] - c[1];
    const den = rx * sz - rz * sx;
    if (Math.abs(den) < 1e-12) return false;
    const t = ((c[0] - a[0]) * sz - (c[1] - a[1]) * sx) / den;
    const u = ((c[0] - a[0]) * rz - (c[1] - a[1]) * rx) / den;
    const eps = 1e-6;
    return t > eps && t < 1 - eps && u > eps && u < 1 - eps; // interiors cross
  };

  function assertClean(s: Scene) {
    const ws = Object.values(s.walls);
    for (let i = 0; i < ws.length; i++) {
      for (let j = i + 1; j < ws.length; j++) {
        const a = ws[i]!, b = ws[j]!;
        expect(cross(s.nodes[a.a]!.p, s.nodes[a.b]!.p, s.nodes[b.a]!.p, s.nodes[b.b]!.p)).toBe(false);
      }
      // No node sits inside a wall's body without being its endpoint.
      for (const n of Object.values(s.nodes)) {
        if (n.id === ws[i]!.a || n.id === ws[i]!.b) continue;
        const A = s.nodes[ws[i]!.a]!.p, B = s.nodes[ws[i]!.b]!.p;
        const abx = B[0] - A[0], abz = B[1] - A[1];
        const t = ((n.p[0] - A[0]) * abx + (n.p[1] - A[1]) * abz) / (abx * abx + abz * abz);
        const dist = Math.hypot(n.p[0] - (A[0] + abx * t), n.p[1] - (A[1] + abz * t));
        expect(t > 1e-6 && t < 1 - 1e-6 && dist < 1e-3).toBe(false);
      }
    }
  }

  it('holds for random wall sequences, and undo-all/redo-all still round-trips', () => {
    const pt = fc.tuple(fc.integer({ min: 0, max: 6 }), fc.integer({ min: 0, max: 6 })).map(([x, z]) => [x, z] as Vec2);
    fc.assert(
      fc.property(fc.array(fc.tuple(pt, pt), { maxLength: 25 }), (segs) => {
        const e = mk();
        const initial = e.getState().scene;
        let seed = 7;
        const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        for (const [a, b] of segs) e.execute(addWall({ levelId: L(e), from: a, to: b }, rng));
        const final = e.getState().scene;
        assertClean(final);
        while (e.undo()) { /* undo all */ }
        expect(e.getState().scene).toEqual(initial);
        while (e.redo()) { /* redo all */ }
        expect(e.getState().scene).toEqual(final);
      }),
      { numRuns: 150 },
    );
  });
});
