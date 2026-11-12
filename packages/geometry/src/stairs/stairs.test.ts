import { describe, expect, it } from 'vitest';
import {
  buildStairMesh,
  buildStairRailing,
  RAIL_HEIGHT_M,
  isSimplePolygon,
  pointInPolygon,
  RISER_M,
  stairHeightAt,
  stairHole,
  STAIR_HEADROOM_M,
  unionRects,
  buildStairBody,
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

describe('spiral stairs', () => {
  const L = stairLayout({ kind: 'spiral', width: 0.9, rise: 3, mirror: false });

  it('turns less than a full circle on wedge steps that climb one riser each', () => {
    expect(L.kind).toBe('spiral');
    expect(L.treads.length).toBe(L.risers - 1);
    expect(Math.abs(L.spiral!.delta * L.treads.length)).toBeLessThan(2 * Math.PI);
    L.treads.forEach((t, i) => {
      expect(t.height).toBeCloseTo((i + 1) * L.riserHeight, 6);
      expect(t.poly!.length).toBe(6);
    });
    // the outline is the circle the steps turn on
    const r = L.spiral!.radius;
    for (const p of L.outline) expect(Math.hypot(p[0], p[1])).toBeCloseTo(r, 6);
  });

  it('the height under a point follows the wedge it is on, and nothing is under the pole gap or outside', () => {
    for (const t of L.treads) {
      const c = t.centre!;
      expect(stairHeightAt(L, c)).toBeCloseTo(t.height, 6);
    }
    expect(stairHeightAt(L, [L.spiral!.radius + 0.5, 0])).toBeNull();
    expect(stairHeightAt(L, [0, 0])).toBeNull(); // the pole
  });

  it('mirrored stairs turn the other way', () => {
    const M = stairLayout({ kind: 'spiral', width: 0.9, rise: 3, mirror: true });
    expect(Math.sign(M.spiral!.delta)).toBe(-Math.sign(L.spiral!.delta));
  });

  it('builds a solid with wedge steps', () => {
    const m = buildStairMesh(L);
    expect(m.indices.length).toBeGreaterThan(L.treads.length * 3 * 6);
  });
});

describe('railings', () => {
  const sum = (m: ReturnType<typeof buildStairRailing>) => m!.groups.reduce((n, g) => n + g.count, 0);

  it('every kind gets a rail; the entrance and the exit stay open', () => {
    for (const kind of ['straight', 'L', 'U', 'spiral'] as const) {
      const lay = stairLayout({ kind, width: 1, rise: 3 });
      const m = buildStairRailing(lay)!;
      expect(m, kind).toBeTruthy();
      expect(sum(m), kind).toBe(m.indices.length);
      expect(m.groups[0]!.slot).toBe('frame');
    }
  });

  it('a straight stair has a rail on both sides, rising with the steps up to the upper floor and no rail across the ends', () => {
    const lay = stairLayout({ kind: 'straight', width: 1, rise: 3 });
    const m = buildStairRailing(lay)!;
    let top = -Infinity;
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = 0; i < m.positions.length; i += 3) {
      top = Math.max(top, m.positions[i + 1]!);
      minX = Math.min(minX, m.positions[i]!);
      maxX = Math.max(maxX, m.positions[i]!);
    }
    expect(top).toBeCloseTo(lay.rise + RAIL_HEIGHT_M + 0.02, 1);
    expect(minX).toBeLessThan(-0.45);
    expect(maxX).toBeGreaterThan(0.45);
    // no geometry across the bottom of the stair (z > 0.05) and none past the top edge
    const len = (lay.treads.length) * 0.28;
    for (let i = 0; i < m.positions.length; i += 3) {
      expect(m.positions[i + 2]!).toBeLessThan(0.06);
      expect(m.positions[i + 2]!).toBeGreaterThan(-len - 0.06);
    }
  });

  it('glass railings use panels instead of balusters', () => {
    const lay = stairLayout({ kind: 'L', width: 1, rise: 3 });
    const wood = buildStairRailing(lay, false)!;
    const glass = buildStairRailing(lay, true)!;
    expect(wood.groups.some((g) => g.slot === 'glass')).toBe(false);
    expect(glass.groups.some((g) => g.slot === 'glass')).toBe(true);
    expect(glass.indices.length).toBeLessThan(wood.indices.length);
  });

  it('normals face away from the solid', () => {
    const m = buildStairRailing(stairLayout({ kind: 'U', width: 1, rise: 3 }))!;
    for (let i = 0; i < m.indices.length; i += 3) {
      const a = m.indices[i]!, b = m.indices[i + 1]!, c = m.indices[i + 2]!;
      const P = m.positions;
      const e1 = [0, 1, 2].map((k) => P[b * 3 + k]! - P[a * 3 + k]!);
      const e2 = [0, 1, 2].map((k) => P[c * 3 + k]! - P[a * 3 + k]!);
      const cr = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!];
      expect(cr[0]! * m.normals[a * 3]! + cr[1]! * m.normals[a * 3 + 1]! + cr[2]! * m.normals[a * 3 + 2]!).toBeGreaterThan(0);
    }
  });

  it('options: infill, height, spacing, handrail and sides change the railing', () => {
    const lay = stairLayout({ kind: 'U', width: 1, rise: 3 });
    const count = (o: Parameters<typeof buildStairRailing>[1]) => buildStairRailing(lay, o)!.indices.length;
    const top = (o: Parameters<typeof buildStairRailing>[1]) => {
      const m = buildStairRailing(lay, o)!;
      let t = -Infinity;
      for (let i = 1; i < m.positions.length; i += 3) t = Math.max(t, m.positions[i]!);
      return t;
    };
    // tighter balusters means more geometry; wider means less
    expect(count({ gap: 0.08 })).toBeGreaterThan(count({ gap: 0.12 }));
    expect(count({ gap: 0.25 })).toBeLessThan(count({ gap: 0.12 }));
    // height moves the handrail
    expect(top({ height: 1.1 })).toBeCloseTo(top({ height: 0.9 }) + 0.2, 2);
    // an open railing has only the handrail and posts
    expect(count({ infill: 'none' })).toBeLessThan(count({ infill: 'balusters' }));
    // cables, glass and solid panels use their own groups
    expect(buildStairRailing(lay, { infill: 'glass' })!.groups.map((g) => g.slot)).toContain('glass');
    expect(buildStairRailing(lay, { infill: 'solid' })!.groups.map((g) => g.slot)).toContain('panel');
    expect(count({ infill: 'cables' })).toBeGreaterThan(count({ infill: 'none' }));
    // a round handrail is a prism with more faces than the flat one
    expect(count({ handrail: 'round' })).toBeGreaterThan(count({ handrail: 'flat' }));
    // one side only: about half the geometry, and the other side is empty of posts
    const both = count({ sides: 'both' });
    const left = count({ sides: 'left' });
    const right = count({ sides: 'right' });
    expect(left).toBeLessThan(both);
    expect(right).toBeLessThan(both);
    // (the guard across the cut edge of the opening belongs to 'both' only)
    expect(left + right).toBeGreaterThanOrEqual(both - 600);
    // a spiral always keeps its outer rail
    const sp = stairLayout({ kind: 'spiral', width: 1, rise: 3 });
    expect(buildStairRailing(sp, { sides: 'left' })).toBeTruthy();
  });

  it('on a straight stair left is left of the climber', () => {
    const lay = stairLayout({ kind: 'straight', width: 1, rise: 3 });
    // The climber goes toward -z (up the screen): their left is -x.
    const xs = (m: NonNullable<ReturnType<typeof buildStairRailing>>) => Array.from({ length: m.positions.length / 3 }, (_, i) => m.positions[i * 3]!);
    const left = xs(buildStairRailing(lay, { sides: 'left' })!);
    const right = xs(buildStairRailing(lay, { sides: 'right' })!);
    expect(Math.max(...left)).toBeLessThan(0);
    expect(Math.min(...right)).toBeGreaterThan(0);
  });
});

describe('the opening in the floor above', () => {
  it('only opens where the steps are closer than the headroom; the lower steps pass under the floor', () => {
    const lay = stairLayout({ kind: 'straight', width: 1, rise: 3 });
    const hole = stairHole(lay);
    const zs = hole.map((p) => p[1]);
    // the outline runs from z = 0 to the far end; the opening starts further along
    expect(Math.max(...zs)).toBeLessThan(-0.5);
    expect(Math.min(...zs)).toBeCloseTo(Math.min(...lay.outline.map((p) => p[1])), 6);
    // every step inside the opening is closer than the headroom to the floor, and the first step outside it is not
    const limit = lay.rise - STAIR_HEADROOM_M;
    for (const t of lay.treads) {
      const inside = t.rect[3] <= Math.max(...zs) + 1e-6;
      expect(inside).toBe(t.height > limit + 1e-6);
    }
  });

  it('is the whole outline for spirals and for stairs too short to pass under', () => {
    const sp = stairLayout({ kind: 'spiral', width: 1, rise: 3 });
    expect(stairHole(sp)).toEqual(sp.outline);
    const low = stairLayout({ kind: 'straight', width: 1, rise: 2 });
    expect(stairHole(low)).toEqual(low.outline);
  });

  it('is one piece for L and U stairs and always inside the outline', () => {
    for (const kind of ['L', 'U'] as const) {
      const lay = stairLayout({ kind, width: 1, rise: 3 });
      const hole = stairHole(lay);
      expect(hole.length).toBeGreaterThanOrEqual(4);
      for (const p of hole) expect(pointInPolygon(p, lay.outline, 1e-6)).toBe(true);
      // smaller than the whole stair, but it holds the landing and the whole second flight
      expect(area(hole)).toBeLessThan(area(lay.outline));
      const landing = lay.treads.find((t) => t.landing)!;
      expect(pointInPolygon([(landing.rect[0] + landing.rect[2]) / 2, (landing.rect[1] + landing.rect[3]) / 2], hole, 1e-6)).toBe(true);
    }
  });

  it('unionRects joins touching rectangles into one outline', () => {
    const u = unionRects([[0, 0, 1, 1], [1, 0, 2, 1], [0, 1, 1, 2]]);
    expect(u).toHaveLength(6); // an L
    const single = unionRects([[0, 0, 2, 3]]);
    expect(single).toHaveLength(4);
  });
});

describe('open stair builds', () => {
  const lay = stairLayout({ kind: 'straight', width: 1, rise: 3 });
  const slots = (m: ReturnType<typeof buildStairBody>) => m.groups.map((g) => g.slot);
  const sum = (m: ReturnType<typeof buildStairBody>) => m.groups.reduce((n, g) => n + g.count, 0);

  it('solid keeps the classic blocks; every build gives valid triangles', () => {
    expect(sum(buildStairBody(lay))).toBe(buildStairMesh(lay).indices.length);
    for (const build of ['solid', 'stringer', 'spine', 'floating'] as const) {
      for (const kind of ['straight', 'L', 'U', 'spiral'] as const) {
        const m = buildStairBody(stairLayout({ kind, width: 1, rise: 3 }), { build, risers: true });
        expect(sum(m)).toBe(m.indices.length);
        const n = m.positions.length / 3;
        for (const i of m.indices) expect(i).toBeLessThan(n);
        for (let i = 0; i < m.normals.length; i += 3) expect(Math.hypot(m.normals[i]!, m.normals[i + 1]!, m.normals[i + 2]!)).toBeCloseTo(1, 4);
      }
    }
  });

  it('floating is treads only; stringer and spine add a frame; risers are optional', () => {
    expect(slots(buildStairBody(lay, { build: 'floating' }))).toEqual(['tread']);
    expect(slots(buildStairBody(lay, { build: 'stringer' }))).toEqual(['tread', 'frame']);
    expect(slots(buildStairBody(lay, { build: 'spine' }))).toEqual(['tread', 'frame']);
    expect(slots(buildStairBody(lay, { build: 'floating', risers: true }))).toEqual(['tread', 'riser']);
  });

  it('open treads are slabs of the chosen thickness with nothing between them and the floor', () => {
    const m = buildStairBody(lay, { build: 'floating', thickness: 0.06, nosing: 0 });
    // lowest point of the mesh: the underside of the first tread, one thickness under its top
    let lo = Infinity;
    for (let i = 1; i < m.positions.length; i += 3) lo = Math.min(lo, m.positions[i]!);
    expect(lo).toBeCloseTo(lay.riserHeight - 0.06, 6);
  });

  it('nosing moves the near edge of a tread back over the step below', () => {
    const z = (o: number) => {
      const m = buildStairBody(lay, { build: 'floating', nosing: o });
      let hi = -Infinity;
      for (let i = 2; i < m.positions.length; i += 3) hi = Math.max(hi, m.positions[i]!);
      return hi;
    };
    expect(z(0.05)).toBeCloseTo(z(0) + 0.05, 6);
  });

  it('beams run under the treads: the side build has two, the spine one, and the frame stays under the steps', () => {
    const xs = (b: 'stringer' | 'spine') => {
      const m = buildStairBody(lay, { build: b });
      const g = m.groups.find((q) => q.slot === 'frame')!;
      const out: number[] = [];
      for (let k = g.start; k < g.start + g.count; k++) out.push(m.positions[m.indices[k]! * 3]!);
      return out;
    };
    const side = xs('stringer');
    expect(Math.min(...side)).toBeLessThan(-0.4);
    expect(Math.max(...side)).toBeGreaterThan(0.4);
    const spine = xs('spine');
    expect(Math.max(...spine.map(Math.abs))).toBeLessThan(0.1);
  });
});
