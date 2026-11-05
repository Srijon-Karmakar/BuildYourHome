import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hd/scene-schema';
import { buildRoofMesh, orientedBox, type RoofParams } from '../index';

const rect = (w: number, d: number, ox = 0, oz = 0, rot = 0): Vec2[] =>
  ([[0, 0], [w, 0], [w, d], [0, d]] as Vec2[]).map(([x, z]) => {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    return [ox + x * c - z * s, oz + x * s + z * c] as Vec2;
  });
const params = (style: RoofParams['style'], extra: Partial<RoofParams> = {}): RoofParams => ({ style, pitchDeg: 30, overhang: 0.4, ...extra });
const bounds = (m: NonNullable<ReturnType<typeof buildRoofMesh>>) => {
  const P = m.positions;
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k]!, P[i + k]!);
      hi[k] = Math.max(hi[k]!, P[i + k]!);
    }
  }
  return { lo, hi };
};
const apexCount = (m: NonNullable<ReturnType<typeof buildRoofMesh>>) => {
  const top = bounds(m).hi[1]!;
  const set = new Set<string>();
  for (let i = 0; i < m.positions.length; i += 3) {
    if (Math.abs(m.positions[i + 1]! - top) < 1e-6) set.add(`${m.positions[i]!.toFixed(4)},${m.positions[i + 2]!.toFixed(4)}`);
  }
  return set.size;
};

describe('orientedBox', () => {
  it('measures an axis-aligned rectangle with the long side as length', () => {
    const b = orientedBox(rect(8, 6, 1, 2))!;
    expect(b.length).toBeCloseTo(8);
    expect(b.width).toBeCloseTo(6);
    expect(b.cx).toBeCloseTo(5);
    expect(b.cz).toBeCloseTo(5);
    const tall = orientedBox(rect(4, 9))!;
    expect(tall.length).toBeCloseTo(9);
    expect(Math.abs(Math.sin(tall.angle))).toBeCloseTo(1);
  });

  it('recovers size and angle of a rotated rectangle', () => {
    const b = orientedBox(rect(6, 4, 3, -1, Math.PI / 6))!;
    expect(b.length).toBeCloseTo(6);
    expect(b.width).toBeCloseTo(4);
    expect(Math.abs(Math.cos(b.angle - Math.PI / 6))).toBeCloseTo(1);
  });

  it('bounds an L shape by its rectangle and rejects degenerate input', () => {
    const l: Vec2[] = [[0, 0], [6, 0], [6, 2], [2, 2], [2, 5], [0, 5]];
    const b = orientedBox(l)!;
    expect(b.length * b.width).toBeCloseTo(30);
    expect(orientedBox([[0, 0], [1, 1]])).toBeNull();
    expect(orientedBox([[0, 0], [5, 0], [10, 0]])).toBeNull();
  });
});

describe('buildRoofMesh', () => {
  const pts = rect(8, 6);
  const ext = 0.115 + 0.4;

  it('gable: ridge rises b*tan(pitch) above the walls, footprint includes the overhang', () => {
    const m = buildRoofMesh(pts, 3, params('gable'))!;
    const { lo, hi } = bounds(m);
    expect(hi[1]).toBeCloseTo(3 + (3 + ext) * Math.tan(Math.PI / 6), 4);
    expect(lo[1]).toBeCloseTo(3);
    expect(hi[0]! - lo[0]!).toBeCloseTo(8 + 2 * ext, 4);
    expect(hi[2]! - lo[2]!).toBeCloseTo(6 + 2 * ext, 4);
  });

  it('every triangle winds counter-clockwise around its normal; slopes face up, the base faces down', () => {
    for (const style of ['gable', 'hip', 'flat', 'shed'] as const) {
      const m = buildRoofMesh(pts, 0, params(style))!;
      const P = m.positions;
      const N = m.normals;
      let up = 0;
      let down = 0;
      for (let t = 0; t < m.indices.length; t += 3) {
        const [a, b, c] = [m.indices[t]!, m.indices[t + 1]!, m.indices[t + 2]!];
        const e1 = [0, 1, 2].map((k) => P[b * 3 + k]! - P[a * 3 + k]!);
        const e2 = [0, 1, 2].map((k) => P[c * 3 + k]! - P[a * 3 + k]!);
        const cr = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!];
        expect(cr[0]! * N[a * 3]! + cr[1]! * N[a * 3 + 1]! + cr[2]! * N[a * 3 + 2]!, style).toBeGreaterThan(0);
        if (N[a * 3 + 1]! > 0.2) up++;
        if (N[a * 3 + 1]! < -0.99) down++;
      }
      expect(up, style).toBeGreaterThan(0);
      expect(down, style).toBeGreaterThan(0);
    }
  });

  it('hip: a two-point ridge; a square plan gives a pyramid with a single apex', () => {
    expect(apexCount(buildRoofMesh(pts, 0, params('hip'))!)).toBe(2);
    expect(apexCount(buildRoofMesh(rect(5, 5), 0, params('hip'))!)).toBe(1);
  });

  it('flat is a slab; shed is high on one side only', () => {
    const f = bounds(buildRoofMesh(pts, 2, params('flat'))!);
    expect(f.hi[1]! - f.lo[1]!).toBeCloseTo(0.18);
    expect(bounds(buildRoofMesh(pts, 0, params('shed'))!).hi[1]).toBeCloseTo(2 * (3 + ext) * Math.tan(Math.PI / 6), 4);
  });

  it('pitch is clamped, steeper is taller, swap turns the ridge 90 degrees', () => {
    const low = bounds(buildRoofMesh(pts, 0, params('gable', { pitchDeg: 1 }))!).hi[1]!;
    const ref = bounds(buildRoofMesh(pts, 0, params('gable', { pitchDeg: 5 }))!).hi[1]!;
    expect(low).toBeCloseTo(ref);
    expect(bounds(buildRoofMesh(pts, 0, params('gable', { pitchDeg: 45 }))!).hi[1]!).toBeGreaterThan(ref);
    const normal = bounds(buildRoofMesh(pts, 0, params('gable'))!).hi[1]!;
    const swapped = bounds(buildRoofMesh(pts, 0, params('gable', { swap: true }))!).hi[1]!;
    expect(swapped).toBeCloseTo((4 + ext) * Math.tan(Math.PI / 6), 4);
    expect(swapped).toBeGreaterThan(normal);
  });

  it('follows a rotated house and returns null for degenerate plans', () => {
    const m = buildRoofMesh(rect(8, 6, 2, 2, 0.5), 3, params('gable'))!;
    expect(m.indices.length % 3).toBe(0);
    expect(bounds(m).hi[1]).toBeCloseTo(3 + (3 + ext) * Math.tan(Math.PI / 6), 4);
    expect(buildRoofMesh([[0, 0], [1, 0]], 3, params('gable'))).toBeNull();
  });
});
