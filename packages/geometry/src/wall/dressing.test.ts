import { describe, expect, it } from 'vitest';
import type { Vec2, Wall, WallNode } from '@hd/scene-schema';
import { bandRuns, buildWallMesh, computeFootprints, faceSpan, rectMinusCuts, WALL_SLOTS, type FaceRect } from '../index';

const area = (rs: FaceRect[]) => rs.reduce((t, r) => t + (r.s1 - r.s0) * (r.y1 - r.y0), 0);
const overlaps = (a: FaceRect, b: FaceRect) => a.s0 < b.s1 - 1e-9 && b.s0 < a.s1 - 1e-9 && a.y0 < b.y1 - 1e-9 && b.y0 < a.y1 - 1e-9;

function oneWall(len = 4): ReturnType<typeof computeFootprints>[string] {
  const nodes: Record<string, WallNode> = { a: { id: 'a', levelId: 'L', p: [0, 0] as Vec2 }, b: { id: 'b', levelId: 'L', p: [len, 0] as Vec2 } };
  const walls: Wall[] = [{ id: 'w', levelId: 'L', a: 'a', b: 'b', thickness: 0.2, height: 3, kind: 'exterior', materialA: { id: 'm' }, materialB: { id: 'm' } }];
  return computeFootprints(nodes, walls).w!;
}

describe('rectMinusCuts', () => {
  it('returns the rectangle when no opening touches it', () => {
    expect(rectMinusCuts({ s0: 0, s1: 2, y0: 0, y1: 1 }, [{ offset: 3, width: 0.8, height: 1, sill: 0 }])).toEqual([{ s0: 0, s1: 2, y0: 0, y1: 1 }]);
  });

  it('cuts a window out of a panel: area drops by the hole, pieces never overlap or enter the hole', () => {
    const rect = { s0: 0, s1: 3, y0: 0, y1: 2.5 };
    const win = { offset: 1.5, width: 1, height: 1, sill: 0.9 };
    const out = rectMinusCuts(rect, [win]);
    expect(area(out)).toBeCloseTo(3 * 2.5 - 1 * 1, 9);
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) expect(overlaps(out[i]!, out[j]!)).toBe(false);
    const hole = { s0: 1, s1: 2, y0: 0.9, y1: 1.9 };
    for (const r of out) expect(overlaps(r, hole)).toBe(false);
  });

  it('a margin grows the hole; a door through the bottom edge splits a plinth band in two runs', () => {
    const out = rectMinusCuts({ s0: 0, s1: 3, y0: 0, y1: 2.5 }, [{ offset: 1.5, width: 1, height: 1, sill: 0.9 }], 0.1);
    expect(area(out)).toBeCloseTo(3 * 2.5 - 1.2 * 1.2, 9);
    const runs = bandRuns([0, 4], 0, 0.2, [{ offset: 2, width: 0.9, height: 2.1, sill: 0 }]);
    expect(runs).toHaveLength(2);
    expect(runs[0]!.s1).toBeCloseTo(1.55, 9);
    expect(runs[1]!.s0).toBeCloseTo(2.45, 9);
  });

  it('a band above every opening stays one piece', () => {
    expect(bandRuns([0, 4], 2.6, 2.7, [{ offset: 1, width: 0.9, height: 2.1, sill: 0 }, { offset: 3, width: 1, height: 1.2, sill: 0.9 }])).toHaveLength(1);
  });
});

describe('two-tone split in the wall mesh', () => {
  it('moves the face below the split into the lower slots and keeps the total face area', () => {
    const fp = oneWall();
    const cuts = [{ offset: 2, width: 1, height: 1.2, sill: 0.9 }];
    const groupTris = (m: ReturnType<typeof buildWallMesh>, slot: string) => m.groups.find((g) => g.slot === slot)!.count / 3;
    const plain = buildWallMesh(fp, 0, 3, cuts);
    expect(WALL_SLOTS.slice(0, 4)).toEqual(['sideA', 'sideB', 'top', 'ends']); // old indices stay put
    expect(groupTris(plain, 'lowerA')).toBe(0);
    const split = buildWallMesh(fp, 0, 3, cuts, { A: 1 });
    expect(groupTris(split, 'lowerA')).toBeGreaterThan(0);
    expect(groupTris(split, 'lowerB')).toBe(0);
    // Every vertex of the lower slot is at or below the split height.
    const g = split.groups.find((x) => x.slot === 'lowerA')!;
    for (let i = g.start; i < g.start + g.count; i++) expect(split.positions[split.indices[i]! * 3 + 1]!).toBeLessThanOrEqual(1 + 1e-6);
    // The face area is the same with or without the split (the split only re-labels it).
    const faceArea = (m: ReturnType<typeof buildWallMesh>, slots: string[]) => {
      let a = 0;
      for (const grp of m.groups.filter((x) => slots.includes(x.slot))) {
        for (let i = grp.start; i < grp.start + grp.count; i += 3) {
          const p = [0, 1, 2].map((k) => [0, 1, 2].map((c) => m.positions[m.indices[i + k]! * 3 + c]!));
          const e1 = p[1]!.map((v, c) => v - p[0]![c]!);
          const e2 = p[2]!.map((v, c) => v - p[0]![c]!);
          a += Math.hypot(e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!) / 2;
        }
      }
      return a;
    };
    expect(faceArea(split, ['sideA', 'lowerA'])).toBeCloseTo(faceArea(plain, ['sideA']), 6);
  });

  it('faceSpan gives each face its own extent', () => {
    const fp = oneWall(5);
    const [a0, a1] = faceSpan(fp, 1);
    expect(a1 - a0).toBeCloseTo(5, 6);
    const [b0, b1] = faceSpan(fp, -1);
    expect(b1 - b0).toBeCloseTo(5, 6);
  });
});
