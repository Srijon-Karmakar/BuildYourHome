import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hd/scene-schema';
import { buildRoofMesh, buildRoofPart, orientedBox, type RoofParams } from '../index';

const rect = (w: number, d: number, ox = 0, oz = 0, rot = 0): Vec2[] =>
  ([[0, 0], [w, 0], [w, d], [0, d]] as Vec2[]).map(([x, z]) => {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    return [ox + x * c - z * s, oz + x * s + z * c] as Vec2;
  });
const T = 0.12; // default edge thickness: the roof rests on the wall tops, its eaves sit one thickness higher
const params = (style: RoofParams['style'], extra: Partial<RoofParams> = {}): RoofParams => ({ style, pitchDeg: 30, overhang: 0.4, ridgeCap: false, ...extra });
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
    expect(hi[1]).toBeCloseTo(3 + T + (3 + ext) * Math.tan(Math.PI / 6), 4);
    expect(lo[1]).toBeCloseTo(3);
    expect(hi[0]! - lo[0]!).toBeCloseTo(8 + 2 * ext, 4);
    expect(hi[2]! - lo[2]!).toBeCloseTo(6 + 2 * ext, 4);
  });

  it('every triangle winds counter-clockwise around its normal; slopes face up, the base faces down', () => {
    for (const style of ['gable', 'hip', 'flat', 'shed', 'butterfly', 'mansard', 'barrel'] as const) {
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
        if (N[a * 3 + 1]! < -0.5) down++;
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
    expect(bounds(buildRoofMesh(pts, 0, params('shed'))!).hi[1]).toBeCloseTo(T + 2 * (3 + ext) * Math.tan(Math.PI / 6), 4);
  });

  it('pitch is clamped, steeper is taller, swap turns the ridge 90 degrees', () => {
    const low = bounds(buildRoofMesh(pts, 0, params('gable', { pitchDeg: 1 }))!).hi[1]!;
    const ref = bounds(buildRoofMesh(pts, 0, params('gable', { pitchDeg: 5 }))!).hi[1]!;
    expect(low).toBeCloseTo(ref);
    expect(bounds(buildRoofMesh(pts, 0, params('gable', { pitchDeg: 45 }))!).hi[1]!).toBeGreaterThan(ref);
    const normal = bounds(buildRoofMesh(pts, 0, params('gable'))!).hi[1]!;
    const swapped = bounds(buildRoofMesh(pts, 0, params('gable', { swap: true }))!).hi[1]!;
    expect(swapped).toBeCloseTo(T + (4 + ext) * Math.tan(Math.PI / 6), 4);
    expect(swapped).toBeGreaterThan(normal);
  });

  it('follows a rotated house and returns null for degenerate plans', () => {
    const m = buildRoofMesh(rect(8, 6, 2, 2, 0.5), 3, params('gable'))!;
    expect(m.indices.length % 3).toBe(0);
    expect(bounds(m).hi[1]).toBeCloseTo(3 + T + (3 + ext) * Math.tan(Math.PI / 6), 4);
    expect(buildRoofMesh([[0, 0], [1, 0]], 3, params('gable'))).toBeNull();
  });
});

describe('more roof styles', () => {
  const pts = rect(8, 6);
  const ext = 0.115 + 0.4;

  it('butterfly: two slopes rise to the long edges and meet low in the middle', () => {
    const m = buildRoofMesh(pts, 3, params('butterfly'))!;
    const { lo, hi } = bounds(m);
    expect(hi[1]!).toBeGreaterThan(3.5);
    expect(lo[1]).toBeCloseTo(3, 6);
    // the middle line (v = 0) is lower than the edges: no vertex above the gutter sits at the very top in the middle
    let midMax = -Infinity;
    for (let i = 0; i < m.positions.length; i += 3) if (Math.abs(m.positions[i + 2]! - 3) < 1e-6) midMax = Math.max(midMax, m.positions[i + 1]!);
    expect(midMax).toBeLessThan(hi[1]! - 0.3);
    expect(hi[0]! - lo[0]!).toBeCloseTo(8 + 2 * ext, 4);
  });

  it('mansard: a flat top lower than a gable of the same pitch, and wider than a point', () => {
    const m = buildRoofMesh(pts, 3, params('mansard'))!;
    const g = buildRoofMesh(pts, 3, params('gable'))!;
    expect(bounds(m).hi[1]!).toBeLessThan(bounds(g).hi[1]!);
    expect(apexCount(m)).toBe(4); // a flat rectangular top
  });

  it('barrel: a curved vault peaking along the middle', () => {
    const m = buildRoofMesh(pts, 3, params('barrel'))!;
    const { lo, hi } = bounds(m);
    expect(lo[1]).toBeCloseTo(3, 6);
    expect(hi[1]!).toBeGreaterThan(3.8);
    expect(apexCount(m)).toBeGreaterThanOrEqual(2); // a ridge line, not a single point
  });

  it('all new styles also work on a rotated plan and a short wide plan (swap)', () => {
    for (const style of ['butterfly', 'mansard', 'barrel'] as const) {
      expect(buildRoofMesh(rect(8, 6, 3, -2, 0.7), 0, params(style))).not.toBeNull();
      const s = buildRoofMesh(pts, 0, params(style, { swap: true }))!;
      expect(s.indices.length % 3).toBe(0);
      expect(bounds(s).lo[1]).toBeGreaterThanOrEqual(-1e-9);
    }
  });
});

describe('roof detail', () => {
  const pts = rect(8, 6);
  const slots = (m: NonNullable<ReturnType<typeof buildRoofMesh>>) => m.groups.map((g) => g.slot);
  const total = (m: NonNullable<ReturnType<typeof buildRoofMesh>>) => m.groups.reduce((n, g) => n + g.count, 0);

  it('a gable roof has a recessed wall-colour gable and painted fascia, and no stray groups', () => {
    const m = buildRoofMesh(pts, 3, params('gable'))!;
    expect(slots(m)).toEqual(['roof', 'gable', 'trim']);
    expect(total(m)).toBe(m.indices.length);
    // groups are contiguous and in order
    let at = 0;
    for (const g of m.groups) {
      expect(g.start).toBe(at);
      at += g.count;
    }
  });

  it('ridge cap, gutters and chimney are extra geometry that can be switched on and off', () => {
    const base = total(buildRoofMesh(pts, 3, params('gable'))!);
    expect(total(buildRoofMesh(pts, 3, params('gable', { ridgeCap: true }))!)).toBeGreaterThan(base);
    const g = buildRoofMesh(pts, 3, params('gable', { gutter: true }))!;
    expect(slots(g)).toContain('gutter');
    const ch = buildRoofMesh(pts, 3, params('gable', { chimney: true }))!;
    expect(slots(ch)).toContain('chimney');
    // the chimney stands above the ridge
    expect(bounds(ch).hi[1]!).toBeGreaterThan(bounds(buildRoofMesh(pts, 3, params('gable'))!).hi[1]! + 0.5);
  });

  it('thickness is clamped and changes the edge', () => {
    const thin = bounds(buildRoofMesh(pts, 0, params('flat', { thickness: 0.01 }))!);
    expect(thin.hi[1]! - thin.lo[1]!).toBeCloseTo(0.05, 5);
    const thick = bounds(buildRoofMesh(pts, 0, params('flat', { thickness: 2 }))!);
    expect(thick.hi[1]! - thick.lo[1]!).toBeCloseTo(0.4, 5);
  });

  it('a flat roof can have a parapet round the edge', () => {
    const plain = bounds(buildRoofMesh(pts, 0, params('flat'))!);
    const m = buildRoofMesh(pts, 0, params('flat', { parapet: 0.5 }))!;
    expect(bounds(m).hi[1]!).toBeGreaterThan(plain.hi[1]! + 0.45);
    expect(slots(m)).toContain('gable');
  });

  it('rake and overhang are separate: the gable ends can stick out less than the eaves', () => {
    const wide = bounds(buildRoofMesh(pts, 0, params('gable', { overhang: 0.6, rake: 0.1 }))!);
    expect(wide.hi[0]! - wide.lo[0]!).toBeCloseTo(8 + 2 * (0.115 + 0.1), 4); // along the ridge
    expect(wide.hi[2]! - wide.lo[2]!).toBeCloseTo(6 + 2 * (0.115 + 0.6), 4); // across it
  });

  it('texture coordinates follow the face (a slope is not stretched)', () => {
    const m = buildRoofMesh(pts, 0, params('gable', { pitchDeg: 45 }))!;
    // find the first top-slope triangle and compare its uv edge lengths with its 3D edge lengths
    const P = m.positions;
    const U = m.uvs;
    const g = m.groups[0]!;
    const i = g.start;
    const d3 = Math.hypot(P[(i + 1) * 3]! - P[i * 3]!, P[(i + 1) * 3 + 1]! - P[i * 3 + 1]!, P[(i + 1) * 3 + 2]! - P[i * 3 + 2]!);
    const d2 = Math.hypot(U[(i + 1) * 2]! - U[i * 2]!, U[(i + 1) * 2 + 1]! - U[i * 2 + 1]!);
    expect(d2).toBeCloseTo(d3, 4);
  });

  it('builds over an explicit rectangle (a roof part) and follows its rotation', () => {
    const m = buildRoofPart({ cx: 10, cz: 5, angle: 0, length: 4, width: 3 }, 2.8, params('hip'))!;
    const b = bounds(m);
    expect((b.lo[0]! + b.hi[0]!) / 2).toBeCloseTo(10, 4);
    expect((b.lo[2]! + b.hi[2]!) / 2).toBeCloseTo(5, 4);
  });

  it('dormers add a window, a wall-colour front and two small slopes, and stay under the ridge', () => {
    const plain = buildRoofMesh(pts, 0, params('gable'))!;
    const m = buildRoofMesh(pts, 0, params('gable', { dormers: [{ pos: 0, side: 1, width: 1.2 }, { pos: 0.5, side: -1, width: 1.6 }] }))!;
    expect(slots(m)).toContain('glass');
    expect(total(m)).toBeGreaterThan(total(plain));
    // lower than the ridge so it never pokes out of the top
    expect(bounds(m).hi[1]!).toBeCloseTo(bounds(plain).hi[1]!, 4);
    // the glass sits on the chosen slope
    const g = m.groups.find((x) => x.slot === 'glass')!;
    const zs = new Set<number>();
    for (let i = g.start; i < g.start + g.count; i++) zs.add(Math.sign(m.positions[i * 3 + 2]! - 3));
    expect(zs.size).toBe(2); // one pane on each slope
    // a roof too flat for a dormer, or too narrow for the ridge, quietly skips it
    expect(slots(buildRoofMesh(pts, 0, params('gable', { pitchDeg: 5, dormers: [{ pos: 0, side: 1, width: 1.2 }] }))!)).not.toContain('glass');
    expect(slots(buildRoofMesh(rect(1.5, 6), 0, params('gable', { dormers: [{ pos: 0, side: 1, width: 3 }] }))!)).not.toContain('glass');
    // flat roofs have none
    expect(slots(buildRoofMesh(pts, 0, params('flat', { dormers: [{ pos: 0, side: 1, width: 1.2 }] }))!)).not.toContain('glass');
  });
});

describe('flat roof openings', () => {
  const box = { cx: 0, cz: 0, angle: 0, length: 8, width: 6 };
  const area = (m: { positions: Float32Array; indices: Uint32Array }, y: number) => {
    let s = 0;
    for (let i = 0; i < m.indices.length; i += 3) {
      const [a, b, c] = [m.indices[i]!, m.indices[i + 1]!, m.indices[i + 2]!].map((k) => [m.positions[k * 3]!, m.positions[k * 3 + 1]!, m.positions[k * 3 + 2]!]);
      if (![a, b, c].every((p) => Math.abs(p![1]! - y) < 1e-4)) continue;
      s += Math.abs((b![0]! - a![0]!) * (c![2]! - a![2]!) - (c![0]! - a![0]!) * (b![2]! - a![2]!)) / 2;
    }
    return s;
  };
  it('cuts a stair opening out of the top and the underside, with faces round it', () => {
    const p = { style: 'flat' as const, pitchDeg: 0, overhang: 0, thickness: 0.2 };
    const plain = buildRoofPart(box, 3, p, 0);
    const holed = buildRoofPart(box, 3, { ...p, holes: [[[0, 0], [1, 0], [1, 2], [0, 2]]] }, 0);
    expect(area(plain, 3.2) - area(holed, 3.2)).toBeCloseTo(2, 3);
    expect(area(plain, 3) - area(holed, 3)).toBeCloseTo(2, 3);
    // an opening reaching past the edge is cut to the roof; one outside it changes nothing
    const edge = buildRoofPart(box, 3, { ...p, holes: [[[3, 0], [6, 0], [6, 1], [3, 1]]] }, 0);
    expect(area(plain, 3.2) - area(edge, 3.2)).toBeCloseTo(0.98, 2);
    const outside = buildRoofPart(box, 3, { ...p, holes: [[[10, 10], [11, 10], [11, 11]]] }, 0);
    expect(area(outside, 3.2)).toBeCloseTo(area(plain, 3.2), 4);
  });
});
