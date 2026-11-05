import { describe, expect, it } from 'vitest';
import type { Vec2, Wall, WallNode } from '@hd/scene-schema';
import { buildFloorMesh, detectRooms, loopSignature } from '../index';

const mat = { id: 'm' };
function plan(points: Record<string, Vec2>, edges: [string, string][], t = 0.2) {
  const nodes: Record<string, WallNode> = {};
  for (const [id, p] of Object.entries(points)) nodes[id] = { id, levelId: 'L', p };
  const walls: Wall[] = edges.map(([a, b], i) => ({
    id: `w${i}`, levelId: 'L', a, b, thickness: t, height: 3, kind: 'interior', materialA: mat, materialB: mat,
  }));
  return { nodes, walls };
}

const rect = () =>
  plan({ p: [0, 0], q: [4, 0], r: [4, 3], s: [0, 3] }, [['p', 'q'], ['q', 'r'], ['r', 's'], ['s', 'p']]);

const twoRooms = () =>
  plan(
    { p0: [0, 0], p1: [4, 0], p2: [8, 0], p3: [8, 3], p4: [4, 3], p5: [0, 3] },
    [['p0', 'p1'], ['p1', 'p2'], ['p2', 'p3'], ['p3', 'p4'], ['p4', 'p5'], ['p5', 'p0'], ['p1', 'p4']],
  );

describe('detectRooms', () => {
  it('finds one room in a closed rectangle; area is the inner floor (inside wall thickness)', () => {
    const { nodes, walls } = rect();
    const r = detectRooms(nodes, walls);
    expect(r).toHaveLength(1);
    expect(r[0]!.area).toBeCloseTo((4 - 0.2) * (3 - 0.2), 9);
    expect(r[0]!.wallLoop).toHaveLength(4);
    expect(r[0]!.centroid[0]).toBeCloseTo(2, 9);
    expect(r[0]!.centroid[1]).toBeCloseTo(1.5, 9);
  });

  it('works regardless of wall direction and drawing order', () => {
    const a = rect();
    const flipped = {
      nodes: a.nodes,
      walls: a.walls.map((w) => ({ ...w, a: w.b, b: w.a })).reverse(),
    };
    const r = detectRooms(flipped.nodes, flipped.walls);
    expect(r).toHaveLength(1);
    expect(r[0]!.area).toBeCloseTo(10.64, 9);
  });

  it('finds two rooms when a divider wall is added; outer face is ignored', () => {
    const { nodes, walls } = twoRooms();
    const r = detectRooms(nodes, walls);
    expect(r).toHaveLength(2);
    for (const room of r) expect(room.area).toBeCloseTo((4 - 0.2) * (3 - 0.2), 9);
    // The divider belongs to both rooms.
    const shared = r[0]!.wallLoop.filter((id) => r[1]!.wallLoop.includes(id));
    expect(shared).toEqual(['w6']);
  });

  it('returns nothing for an open shape (U) or a lone wall', () => {
    const u = plan({ a: [0, 0], b: [4, 0], c: [4, 3], d: [0, 3] }, [['a', 'b'], ['b', 'c'], ['c', 'd']]);
    expect(detectRooms(u.nodes, u.walls)).toEqual([]);
    const lone = plan({ a: [0, 0], b: [1, 0] }, [['a', 'b']]);
    expect(detectRooms(lone.nodes, lone.walls)).toEqual([]);
  });

  it('ignores dangling walls inside or outside a room', () => {
    const base = rect();
    const extra = plan(
      { ...Object.fromEntries(Object.entries(base.nodes).map(([k, n]) => [k, n.p])), x: [2, 0], y: [2, 1.5], z: [6, 0], zz: [8, 0] } as Record<string, Vec2>,
      [['p', 'q'], ['q', 'r'], ['r', 's'], ['s', 'p'], ['x', 'y'], ['q', 'z'], ['z', 'zz']],
    );
    const r = detectRooms(extra.nodes, extra.walls);
    expect(r).toHaveLength(1);
    expect(r[0]!.wallLoop).toEqual(['w0', 'w1', 'w2', 'w3'].sort());
  });

  it('a wall ending mid-wall (not connected) does not create rooms', () => {
    const { nodes, walls } = plan(
      { p: [0, 0], q: [4, 0], r: [4, 3], s: [0, 3], m: [2, 0], n: [2, 3] },
      [['p', 'q'], ['q', 'r'], ['r', 's'], ['s', 'p'], ['m', 'n']],
    );
    // Divider is not topologically joined (needs T-junction splitting): still exactly one room.
    expect(detectRooms(nodes, walls)).toHaveLength(1);
  });

  it('L-shaped room', () => {
    const { nodes, walls } = plan(
      { a: [0, 0], b: [6, 0], c: [6, 2], d: [2, 2], e: [2, 5], f: [0, 5] },
      [['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'e'], ['e', 'f'], ['f', 'a']],
    );
    const r = detectRooms(nodes, walls);
    expect(r).toHaveLength(1);
    // Centre-line area = 6*2 + 2*3 = 18; inner area is a bit smaller.
    expect(r[0]!.area).toBeLessThan(18);
    expect(r[0]!.area).toBeGreaterThan(15);
  });

  it('is deterministic: canonical loop starts at the smallest wall id', () => {
    const { nodes, walls } = twoRooms();
    const r1 = detectRooms(nodes, walls);
    const r2 = detectRooms(nodes, [...walls].reverse());
    expect(r1.map((r) => r.signature)).toEqual(r2.map((r) => r.signature));
    for (const r of r1) expect(r.wallLoop[0]).toBe([...r.wallLoop].sort()[0]);
  });

  it('loopSignature ignores order', () => {
    expect(loopSignature(['b', 'a', 'c'])).toBe(loopSignature(['c', 'b', 'a']));
  });
});

describe('buildFloorMesh', () => {
  const poly: Vec2[] = [[0, 0], [4, 0], [4, 3], [0, 3]];

  it('triangulates a rectangle into 2 triangles whose normals point up', () => {
    const m = buildFloorMesh(poly, 0.5);
    expect(m.indices.length).toBe(6);
    for (let t = 0; t < 6; t += 3) {
      const [a, b, c] = [m.indices[t]!, m.indices[t + 1]!, m.indices[t + 2]!];
      const P = m.positions;
      const e1 = [P[b * 3]! - P[a * 3]!, P[b * 3 + 2]! - P[a * 3 + 2]!];
      const e2 = [P[c * 3]! - P[a * 3]!, P[c * 3 + 2]! - P[a * 3 + 2]!];
      // y-component of e1 × e2 (using x,z): e1z*e2x - e1x*e2z
      expect(e1[1]! * e2[0]! - e1[0]! * e2[1]!).toBeGreaterThan(0);
    }
    expect(m.positions[1]).toBeCloseTo(0.5);
  });

  it('handles concave polygons and clockwise input; ceiling faces down', () => {
    const concave: Vec2[] = [[0, 0], [6, 0], [6, 2], [2, 2], [2, 5], [0, 5]].reverse() as Vec2[];
    const up = buildFloorMesh(concave, 0);
    expect(up.indices.length).toBe((concave.length - 2) * 3);
    const down = buildFloorMesh(poly, 3, 'down');
    expect(down.normals[1]).toBe(-1);
  });
});

describe('buildFloorMesh with holes', () => {
  it('cuts a hole: total area = outer − hole, nothing inside the hole', () => {
    const outer: [number, number][] = [[0, 0], [6, 0], [6, 4], [0, 4]];
    const hole: [number, number][] = [[2, 1], [3, 1], [3, 3], [2, 3]];
    const m = buildFloorMesh(outer, 0, 'up', [hole]);
    let area = 0;
    for (let t = 0; t < m.indices.length; t += 3) {
      const p = [0, 1, 2].map((k) => [m.positions[m.indices[t + k]! * 3]!, m.positions[m.indices[t + k]! * 3 + 2]!] as const);
      const a = ((p[1]![0] - p[0]![0]) * (p[2]![1] - p[0]![1]) - (p[2]![0] - p[0]![0]) * (p[1]![1] - p[0]![1])) / 2;
      expect(a).toBeLessThan(0); // all facing up (cross product in the x–z plane is negative for +y normals)
      area -= a;
      const cx = (p[0]![0] + p[1]![0] + p[2]![0]) / 3;
      const cz = (p[0]![1] + p[1]![1] + p[2]![1]) / 3;
      expect(cx > 2 && cx < 3 && cz > 1 && cz < 3).toBe(false);
    }
    expect(area).toBeCloseTo(24 - 2, 6);
    expect(m.normals.length).toBe(m.positions.length);
  });
});
