import { describe, expect, it } from 'vitest';
import type { Vec2, Wall, WallNode } from '@hd/scene-schema';
import { buildWallMesh, computeFootprints, polygonArea, WALL_SLOTS } from '../index';

const mat = { id: 'm' };
function plan(points: Record<string, Vec2>, edges: [string, string, number?][]) {
  const nodes: Record<string, WallNode> = {};
  for (const [id, p] of Object.entries(points)) nodes[id] = { id, levelId: 'L', p };
  const walls: Wall[] = edges.map(([a, b, t], i) => ({
    id: `w${i}`, levelId: 'L', a, b, thickness: t ?? 0.2, height: 3, kind: 'interior', materialA: mat, materialB: mat,
  }));
  return { nodes, walls };
}
const near = (p: Vec2, x: number, z: number) => {
  expect(p[0]).toBeCloseTo(x, 6);
  expect(p[1]).toBeCloseTo(z, 6);
};

describe('computeFootprints', () => {
  it('single wall = rectangle of length × thickness, with both caps', () => {
    const { nodes, walls } = plan({ a: [0, 0], b: [4, 0] }, [['a', 'b']]);
    const f = computeFootprints(nodes, walls).w0!;
    expect(polygonArea(f.footprint)).toBeCloseTo(0.8, 9);
    expect(f.capA && f.capB).toBe(true);
  });

  it('L corner meets in a clean miter (inner and outer points) and needs no cap there', () => {
    const { nodes, walls } = plan({ o: [0, 0], x: [4, 0], z: [0, 3] }, [['o', 'x'], ['o', 'z']]);
    const f = computeFootprints(nodes, walls);
    const pts = f.w0!.footprint.map((p) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`);
    expect(pts).toContain('0.100,0.100'); // inner
    expect(pts).toContain('-0.100,-0.100'); // outer
    expect(f.w0!.capA).toBe(false);
    expect(f.w1!.capA).toBe(false);
  });

  it('collinear walls share their joint edge exactly', () => {
    const { nodes, walls } = plan({ a: [0, 0], m: [2, 0], b: [5, 0] }, [['a', 'm'], ['m', 'b']]);
    const f = computeFootprints(nodes, walls);
    const [, bL1, bR1] = f.w0!.footprint;
    const [aL2, , , aR2] = f.w1!.footprint;
    near(bL1, aL2[0], aL2[1]);
    near(bR1, aR2[0], aR2[1]);
    expect(f.w0!.capB).toBe(false);
  });

  it('closed rectangle: footprints tile the ring exactly (no gaps/overlaps)', () => {
    const { nodes, walls } = plan(
      { p: [0, 0], q: [4, 0], r: [4, 3], s: [0, 3] },
      [['p', 'q'], ['q', 'r'], ['r', 's'], ['s', 'p']],
    );
    const f = computeFootprints(nodes, walls);
    const total = Object.values(f).reduce((s, w) => s + polygonArea(w.footprint), 0);
    const expected = (4 + 0.2) * (3 + 0.2) - (4 - 0.2) * (3 - 0.2);
    expect(total).toBeCloseTo(expected, 9);
    expect(Object.values(f).every((w) => !w.capA && !w.capB)).toBe(true);
  });

  it('T junction: all walls valid, no NaN', () => {
    const { nodes, walls } = plan(
      { l: [-3, 0], r: [3, 0], c: [0, 0], d: [0, 4] },
      [['l', 'c'], ['c', 'r'], ['c', 'd']],
    );
    const f = computeFootprints(nodes, walls);
    for (const w of Object.values(f)) {
      expect(w.footprint.flat().every(Number.isFinite)).toBe(true);
      expect(polygonArea(w.footprint)).toBeGreaterThan(0.5);
    }
  });

  it('very acute angle falls back to a bevel with caps instead of a spike', () => {
    const a = (12 * Math.PI) / 180;
    const { nodes, walls } = plan({ o: [0, 0], x: [4, 0], y: [4 * Math.cos(a), 4 * Math.sin(a)] }, [['o', 'x'], ['o', 'y']]);
    const f = computeFootprints(nodes, walls);
    for (const w of Object.values(f)) {
      expect(w.footprint.flat().every(Number.isFinite)).toBe(true);
      expect(Math.max(...w.footprint.map((p) => Math.hypot(p[0], p[1])))).toBeLessThan(4.5);
    }
    expect(f.w0!.capA || f.w1!.capA).toBe(true);
  });

  it('skips zero-length walls and walls with missing nodes', () => {
    const { nodes, walls } = plan({ a: [1, 1], b: [1, 1] }, [['a', 'b']]);
    expect(computeFootprints(nodes, walls)).toEqual({});
    expect(computeFootprints({}, walls)).toEqual({});
  });
});

describe('buildWallMesh', () => {
  const { nodes, walls } = plan({ a: [0, 0], b: [4, 0] }, [['a', 'b']]);
  const fp = computeFootprints(nodes, walls).w0!;
  const mesh = buildWallMesh(fp, 0, 3);

  it('has groups for every slot that cover all indices contiguously', () => {
    expect(mesh.groups.map((g) => g.slot)).toEqual([...WALL_SLOTS]);
    let at = 0;
    for (const g of mesh.groups) {
      expect(g.start).toBe(at);
      at += g.count;
    }
    expect(at).toBe(mesh.indices.length);
    // sideA, sideB, top: 1 quad each = 6 indices; ends: 2 caps = 12.
    expect(mesh.groups.map((g) => g.count)).toEqual([6, 6, 6, 12]);
  });

  it('spans y = elevation .. elevation + height', () => {
    const m = buildWallMesh(fp, 2.5, 3);
    const ys = Array.from({ length: m.positions.length / 3 }, (_, i) => m.positions[i * 3 + 1]!);
    expect(Math.min(...ys)).toBeCloseTo(2.5);
    expect(Math.max(...ys)).toBeCloseTo(5.5);
  });

  it('every triangle winds counter-clockwise around its declared normal (faces point outward)', () => {
    const P = mesh.positions, N = mesh.normals, I = mesh.indices;
    for (let t = 0; t < I.length; t += 3) {
      const [a, b, c] = [I[t]!, I[t + 1]!, I[t + 2]!];
      const e1 = [0, 1, 2].map((k) => P[b * 3 + k]! - P[a * 3 + k]!);
      const e2 = [0, 1, 2].map((k) => P[c * 3 + k]! - P[a * 3 + k]!);
      const cr = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!];
      const dot = cr[0]! * N[a * 3]! + cr[1]! * N[a * 3 + 1]! + cr[2]! * N[a * 3 + 2]!;
      expect(dot).toBeGreaterThan(0);
    }
  });

  it('declared normals point away from the wall centre', () => {
    const P = mesh.positions, N = mesh.normals;
    const cx = 2, cz = 0;
    for (let i = 0; i < P.length / 3; i++) {
      const nx = N[i * 3]!, nz = N[i * 3 + 2]!;
      if (nx === 0 && nz === 0) continue; // top
      const out = (P[i * 3]! - cx) * nx + (P[i * 3 + 2]! - cz) * nz;
      expect(out).toBeGreaterThan(0);
    }
  });

  it('uses world-metre UVs along the wall', () => {
    expect(Math.max(...Array.from(mesh.uvs.slice(0, 8)))).toBeCloseTo(4);
  });
});
