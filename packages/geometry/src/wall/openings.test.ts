import { describe, expect, it } from 'vitest';
import type { Opening, Vec2, Wall, WallNode } from '@hd/scene-schema';
import {
  buildColliders,
  buildWallMesh,
  computeFootprints,
  moveWithCollision,
  polygonArea,
  validCuts,
  wallPlanPieces,
  type MeshData,
  type OpeningCut,
} from '../index';

const mat = { id: 'm' };
const T = 0.2;
const H = 3;

function straight(len = 4) {
  const nodes: Record<string, WallNode> = {
    a: { id: 'a', levelId: 'L', p: [0, 0] },
    b: { id: 'b', levelId: 'L', p: [len, 0] },
  };
  const wall: Wall = { id: 'w', levelId: 'L', a: 'a', b: 'b', thickness: T, height: H, kind: 'interior', materialA: mat, materialB: mat };
  return { nodes, wall, fp: computeFootprints(nodes, [wall]).w! };
}

/** Total triangle area of one material group. */
function groupArea(m: MeshData, slot: string): number {
  const g = m.groups.find((x) => x.slot === slot)!;
  let sum = 0;
  for (let i = g.start; i < g.start + g.count; i += 3) {
    const [a, b, c] = [m.indices[i]!, m.indices[i + 1]!, m.indices[i + 2]!];
    const P = m.positions;
    const e1 = [0, 1, 2].map((k) => P[b * 3 + k]! - P[a * 3 + k]!);
    const e2 = [0, 1, 2].map((k) => P[c * 3 + k]! - P[a * 3 + k]!);
    const cr = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!];
    sum += Math.hypot(cr[0]!, cr[1]!, cr[2]!) / 2;
  }
  return sum;
}

const door: OpeningCut = { offset: 2, width: 0.9, height: 2.1, sill: 0 };
const win: OpeningCut = { offset: 2, width: 1.2, height: 1.2, sill: 0.9 };

describe('wall mesh with openings (ADR-007: boxes around the hole)', () => {
  it('a door removes exactly its area from both faces; reveals add jambs + head', () => {
    const { fp } = straight();
    const m = buildWallMesh(fp, 0, H, [door]);
    expect(groupArea(m, 'sideA')).toBeCloseTo(4 * H - 0.9 * 2.1, 6);
    expect(groupArea(m, 'sideB')).toBeCloseTo(4 * H - 0.9 * 2.1, 6);
    expect(groupArea(m, 'top')).toBeCloseTo(4 * T, 6); // lintel keeps the top continuous
    // jambs 2 × (2.1 × 0.2) + head 0.9 × 0.2 (no sill for a door)
    expect(groupArea(m, 'ends') - groupArea(buildWallMesh(fp, 0, H), 'ends')).toBeCloseTo(2 * 2.1 * T + 0.9 * T, 6);
  });

  it('a window leaves wall below and above it; reveals include a sill', () => {
    const { fp } = straight();
    const m = buildWallMesh(fp, 0, H, [win]);
    expect(groupArea(m, 'sideA')).toBeCloseTo(4 * H - 1.2 * 1.2, 6);
    const reveals = groupArea(m, 'ends') - groupArea(buildWallMesh(fp, 0, H), 'ends');
    expect(reveals).toBeCloseTo(2 * 1.2 * T + 1.2 * T + 1.2 * T, 6); // jambs + head + sill
  });

  it('several openings on one wall', () => {
    const { fp } = straight(8);
    const cuts: OpeningCut[] = [{ ...door, offset: 1.5 }, { ...win, offset: 4 }, { ...door, offset: 6.5 }];
    const m = buildWallMesh(fp, 0, H, cuts);
    expect(groupArea(m, 'sideA')).toBeCloseTo(8 * H - 2 * 0.9 * 2.1 - 1.44, 4); // Float32 vertices
  });

  it('every triangle (incl. reveals) winds counter-clockwise around its normal', () => {
    const { fp } = straight();
    const m = buildWallMesh(fp, 0, H, [door, { ...win, offset: 3.2, width: 0.6 }]);
    const P = m.positions, N = m.normals, I = m.indices;
    for (let t = 0; t < I.length; t += 3) {
      const [a, b, c] = [I[t]!, I[t + 1]!, I[t + 2]!];
      const e1 = [0, 1, 2].map((k) => P[b * 3 + k]! - P[a * 3 + k]!);
      const e2 = [0, 1, 2].map((k) => P[c * 3 + k]! - P[a * 3 + k]!);
      const cr = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!];
      expect(cr[0]! * N[a * 3]! + cr[1]! * N[a * 3 + 1]! + cr[2]! * N[a * 3 + 2]!).toBeGreaterThan(0);
    }
  });

  it('reveal normals point INTO the opening', () => {
    const { fp } = straight();
    const m = buildWallMesh(fp, 0, H, [door]);
    const g = m.groups.find((x) => x.slot === 'ends')!;
    const cx = 2, cy = 1.05; // opening centre (x along wall, y up); z = 0 is the wall centre line
    for (let i = g.start; i < g.start + g.count; i++) {
      const v = m.indices[i]!;
      const px = m.positions[v * 3]!, py = m.positions[v * 3 + 1]!;
      if (px < 1.5 || px > 2.5 || py > 2.2) continue; // only vertices of this opening's reveals
      const toCentre = (cx - px) * m.normals[v * 3]! + (cy - py) * m.normals[v * 3 + 1]!;
      expect(toCentre).toBeGreaterThanOrEqual(-1e-6);
    }
  });

  it('skips openings that do not fit (outside the wall, overlapping) instead of breaking the mesh', () => {
    const { fp } = straight();
    const plain = buildWallMesh(fp, 0, H);
    expect(groupArea(buildWallMesh(fp, 0, H, [{ ...door, offset: 3.9 }]), 'sideA')).toBeCloseTo(groupArea(plain, 'sideA'), 6);
    const overlap = buildWallMesh(fp, 0, H, [door, { ...door, offset: 2.3 }]);
    expect(groupArea(overlap, 'sideA')).toBeCloseTo(4 * H - 0.9 * 2.1, 6); // second one dropped
  });

  it('clamps opening height below the wall top so a lintel remains', () => {
    const { fp } = straight();
    const cuts = validCuts(fp, [{ ...door, height: 5 }], H);
    expect(cuts[0]!.sill + cuts[0]!.height).toBeLessThan(H);
  });

  it('works at a mitered corner and on elevated levels', () => {
    const nodes: Record<string, WallNode> = {
      o: { id: 'o', levelId: 'L', p: [0, 0] },
      x: { id: 'x', levelId: 'L', p: [5, 0] },
      z: { id: 'z', levelId: 'L', p: [0, 4] },
    };
    const mk = (id: string, a: string, b: string): Wall => ({ id, levelId: 'L', a, b, thickness: T, height: H, kind: 'interior', materialA: mat, materialB: mat });
    const walls = [mk('w1', 'o', 'x'), mk('w2', 'o', 'z')];
    const fps = computeFootprints(nodes, walls);
    const m = buildWallMesh(fps.w1!, 3, H, [{ ...door, offset: 0.4 }]); // close to the corner
    const ys = Array.from({ length: m.positions.length / 3 }, (_, i) => m.positions[i * 3 + 1]!);
    expect(Math.min(...ys)).toBeCloseTo(3);
    expect(Math.max(...ys)).toBeCloseTo(6);
    expect(groupArea(m, 'sideA') + groupArea(m, 'sideB')).toBeGreaterThan(0);
  });
});

describe('wallPlanPieces', () => {
  it('area of the solid pieces = wall footprint − the openings', () => {
    const { fp } = straight();
    const pieces = wallPlanPieces(fp, [door, { ...win, offset: 3.2, width: 0.6 }], H);
    expect(pieces).toHaveLength(3);
    const total = pieces.reduce((s, p) => s + polygonArea(p), 0);
    expect(total).toBeCloseTo(4 * T - (0.9 + 0.6) * T, 9);
  });

  it('without openings it is the whole wall', () => {
    const { fp } = straight();
    const pieces = wallPlanPieces(fp, [], H);
    expect(pieces).toHaveLength(1);
    expect(polygonArea(pieces[0]!)).toBeCloseTo(4 * T, 9);
  });
});

describe('doorways in collision', () => {
  const nodes: Record<string, WallNode> = {
    a: { id: 'a', levelId: 'L', p: [0, 0] },
    b: { id: 'b', levelId: 'L', p: [6, 0] },
  };
  const wall: Wall = { id: 'w', levelId: 'L', a: 'a', b: 'b', thickness: T, height: H, kind: 'interior', materialA: mat, materialB: mat };
  const op = (type: Opening['type'], offset: number, width: number): Opening => ({
    id: 'o', wallId: 'w', type, assetId: 'x', offset, width, height: 2.1, sill: type === 'window' ? 0.9 : 0, flip: { swing: false, side: false },
  });

  const walkNorthFrom = (x: number, colliders: ReturnType<typeof buildColliders>) => {
    let p: Vec2 = [x, 2];
    for (let i = 0; i < 60; i++) p = moveWithCollision(p, [0, -0.1], colliders);
    return p;
  };

  it('you can walk through a door but not through the solid wall beside it', () => {
    const cs = buildColliders(nodes, [wall], [op('door', 3, 0.9)]);
    expect(walkNorthFrom(3, cs)[1]).toBeLessThan(-1); // went through
    expect(walkNorthFrom(1, cs)[1]).toBeGreaterThan(0.3); // blocked
    expect(walkNorthFrom(5, cs)[1]).toBeGreaterThan(0.3);
  });

  it('windows stay solid', () => {
    const cs = buildColliders(nodes, [wall], [op('window', 3, 1.2)]);
    expect(walkNorthFrom(3, cs)[1]).toBeGreaterThan(0.3);
  });

  it('an arch is a doorway too; several doorways on one wall', () => {
    const cs = buildColliders(nodes, [wall], [{ ...op('arch', 1.5, 1.0), id: 'o1' }, { ...op('door', 4.5, 0.9), id: 'o2' }]);
    expect(walkNorthFrom(1.5, cs)[1]).toBeLessThan(-1);
    expect(walkNorthFrom(4.5, cs)[1]).toBeLessThan(-1);
    expect(walkNorthFrom(3, cs)[1]).toBeGreaterThan(0.3);
  });

  it('a 0.9 m door is wide enough for the 0.5 m wide player, a 0.6 m gap is not', () => {
    expect(walkNorthFrom(3, buildColliders(nodes, [wall], [op('door', 3, 0.9)]))[1]).toBeLessThan(-1);
    expect(walkNorthFrom(3, buildColliders(nodes, [wall], [op('door', 3, 0.6)]))[1]).toBeGreaterThan(0); // never gets through
  });
});
