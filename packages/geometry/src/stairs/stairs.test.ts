import { describe, expect, it } from 'vitest';
import {
  buildStairMesh,
  isSimplePolygon,
  RISER_M,
  stairHeightAt,
  stairLayout,
  stairOutlineWorld,
  stairRiserCount,
  stairToLocal,
  stairToWorld,
  TREAD_M,
} from '../index';

const area = (p: readonly (readonly [number, number])[]) => {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[i]!;
    const r = p[(i + 1) % p.length]!;
    a += q[0] * r[1] - r[0] * q[1];
  }
  return Math.abs(a) / 2;
};

describe('stairs: layout', () => {
  it('splits the rise into ≈ 17.5 cm risers; the last riser is the floor above', () => {
    expect(stairRiserCount(3)).toBe(17);
    const l = stairLayout({ kind: 'straight', width: 1, rise: 3 });
    expect(l.risers).toBe(17);
    expect(l.treads).toHaveLength(16);
    expect(l.riserHeight).toBeCloseTo(3 / 17, 9);
    expect(l.riserHeight).toBeGreaterThan(RISER_M - 0.01);
    expect(l.treads[0]!.height).toBeCloseTo(l.riserHeight, 9);
    expect(l.treads.at(-1)!.height).toBeCloseTo(3 - l.riserHeight, 9); // one riser below the upper floor
  });

  it('a straight stair is a width × (treads × 28 cm) rectangle climbing toward −z', () => {
    const l = stairLayout({ kind: 'straight', width: 1.2, rise: 2.8 });
    expect(area(l.outline)).toBeCloseTo(1.2 * l.treads.length * TREAD_M, 6);
    expect(l.treads[0]!.rect[3]).toBeCloseTo(0, 9);
    expect(l.treads.at(-1)!.rect[1]).toBeCloseTo(-l.treads.length * TREAD_M, 9);
  });

  it('L and U stairs have a landing in the middle and simple outlines', () => {
    for (const kind of ['L', 'U'] as const) {
      for (const mirror of [false, true]) {
        const l = stairLayout({ kind, width: 1, rise: 2.8, mirror });
        expect(l.kind).toBe(kind);
        expect(l.treads.filter((t) => t.landing)).toHaveLength(1);
        expect(isSimplePolygon(l.outline)).toBe(true);
        const heights = l.treads.map((t) => t.height);
        expect([...heights].sort((a, b) => a - b)).toEqual(heights); // always going up
        // the treads never overlap each other's top areas
        for (let i = 0; i < l.treads.length; i++) {
          for (let j = i + 1; j < l.treads.length; j++) {
            const a = l.treads[i]!.rect;
            const b = l.treads[j]!.rect;
            const overlap = Math.min(a[2], b[2]) - Math.max(a[0], b[0]) > 1e-9 && Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > 1e-9;
            expect(overlap).toBe(false);
          }
        }
      }
    }
  });

  it('the outline is the union of the treads (areas match)', () => {
    for (const kind of ['straight', 'L', 'U'] as const) {
      const l = stairLayout({ kind, width: 1, rise: 2.8 });
      const sum = l.treads.reduce((s, t) => s + (t.rect[2] - t.rect[0]) * (t.rect[3] - t.rect[1]), 0);
      // U stairs have the gap strip between the flights inside the landing's width; allow only that difference.
      const expected = kind === 'U' ? sum : sum;
      expect(area(l.outline)).toBeCloseTo(expected, 6);
    }
  });

  it('mirroring flips L stairs to the other side', () => {
    const a = stairLayout({ kind: 'L', width: 1, rise: 2.8 });
    const b = stairLayout({ kind: 'L', width: 1, rise: 2.8, mirror: true });
    const minX = (l: typeof a) => Math.min(...l.outline.map((p) => p[0]));
    const maxX = (l: typeof a) => Math.max(...l.outline.map((p) => p[0]));
    expect(minX(a)).toBeLessThan(-0.5);
    expect(maxX(b)).toBeGreaterThan(0.5);
    expect(maxX(a)).toBeCloseTo(0.5, 9);
  });

  it('very short rises fall back to a straight stair; width is clamped', () => {
    const l = stairLayout({ kind: 'U', width: 10, rise: 0.4 });
    expect(l.kind).toBe('straight');
    expect(l.width).toBe(3);
    expect(l.treads.length).toBeGreaterThanOrEqual(1);
  });
});

describe('stairs: placement maths', () => {
  it('world ↔ local round trip, and rotation follows the Three.js convention', () => {
    const o: [number, number] = [4, -2];
    for (const rot of [0, 0.7, Math.PI / 2, -2.2]) {
      const w = stairToWorld(o, rot, [0.3, -1.1]);
      const back = stairToLocal(o, rot, w);
      expect(back[0]).toBeCloseTo(0.3, 9);
      expect(back[1]).toBeCloseTo(-1.1, 9);
    }
    // Quarter turn: the climbing direction (−z) points toward −x… as a Three.js group rotated by +90° about Y.
    const w = stairToWorld([0, 0], Math.PI / 2, [0, -1]);
    expect(w[0]).toBeCloseTo(-1, 9);
    expect(w[1]).toBeCloseTo(0, 9);
  });

  it('heightAt gives the step top under a point and null off the stair', () => {
    const l = stairLayout({ kind: 'straight', width: 1, rise: 2.8 });
    expect(stairHeightAt(l, [0, -0.1])).toBeCloseTo(l.riserHeight, 9);
    expect(stairHeightAt(l, [0, -0.1 - TREAD_M])).toBeCloseTo(2 * l.riserHeight, 9);
    expect(stairHeightAt(l, [0, 0.5])).toBeNull();
    expect(stairHeightAt(l, [2, -1])).toBeNull();
    const len = l.treads.length * TREAD_M;
    expect(stairHeightAt(l, [0, -len + 0.01])).toBeCloseTo(l.treads.at(-1)!.height, 9);
  });

  it('the world outline moves with the stair', () => {
    const l = stairLayout({ kind: 'straight', width: 1, rise: 2.8 });
    const o = stairOutlineWorld(l, [10, 5], 0);
    expect(o[0]).toEqual([9.5, 5]);
    expect(o[1]).toEqual([10.5, 5]);
  });
});

describe('stairs: mesh', () => {
  it('has 5 faces per step with normals of unit length and valid indices', () => {
    const l = stairLayout({ kind: 'L', width: 1, rise: 2.8 });
    const m = buildStairMesh(l);
    expect(m.indices.length).toBe(l.treads.length * 5 * 6);
    expect(m.positions.length / 3).toBe(l.treads.length * 5 * 4);
    expect(Math.max(...m.indices)).toBeLessThan(m.positions.length / 3);
    for (let i = 0; i < m.normals.length; i += 3) {
      expect(Math.hypot(m.normals[i]!, m.normals[i + 1]!, m.normals[i + 2]!)).toBeCloseTo(1, 6);
    }
    // the highest point is the top step
    let maxY = 0;
    for (let i = 1; i < m.positions.length; i += 3) maxY = Math.max(maxY, m.positions[i]!);
    expect(maxY).toBeCloseTo(l.treads.at(-1)!.height, 5);
  });

  it('triangles face outward (right-handed, counter-clockwise from outside)', () => {
    const m = buildStairMesh(stairLayout({ kind: 'straight', width: 1, rise: 2.8 }));
    for (let t = 0; t < m.indices.length; t += 3) {
      const [a, b, c] = [m.indices[t]!, m.indices[t + 1]!, m.indices[t + 2]!];
      const p = (i: number) => [m.positions[i * 3]!, m.positions[i * 3 + 1]!, m.positions[i * 3 + 2]!];
      const [pa, pb, pc] = [p(a), p(b), p(c)];
      const u = [pb[0]! - pa[0]!, pb[1]! - pa[1]!, pb[2]! - pa[2]!];
      const v = [pc[0]! - pa[0]!, pc[1]! - pa[1]!, pc[2]! - pa[2]!];
      const n = [u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!];
      const dot = n[0]! * m.normals[a * 3]! + n[1]! * m.normals[a * 3 + 1]! + n[2]! * m.normals[a * 3 + 2]!;
      expect(dot).toBeGreaterThan(0);
    }
  });
});
