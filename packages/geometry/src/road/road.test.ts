import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hd/scene-schema';
import { buildRoadMesh, lineLength, nearRoad, offsetLine, roadLayout, roadFootprint, roadsideSpots, samplePath, type RoadStyleInput } from '../index';

const style = (extra: Partial<RoadStyleInput> = {}): RoadStyleInput => ({ lanes: 2, centre: 'dashed', edges: true, kerb: 0.12, pavLeft: 1.8, pavRight: 1.8, parking: 'none', crossings: [], bumps: [], extras: [], ...extra });
const straight: Vec2[] = [[0, 0], [40, 0]];
const bend: Vec2[] = [[0, 0], [20, 0], [20, 20]];

describe('road geometry', () => {
  it('offsets the centre line to either side (left of travel is +)', () => {
    const l = offsetLine(straight, 3);
    expect(l[0]![1]).toBeCloseTo(3);
    expect(offsetLine(straight, -3)[0]![1]).toBeCloseTo(-3);
    expect(lineLength(bend)).toBeCloseTo(40);
    expect(samplePath(bend, 30).p[0]).toBeCloseTo(20);
    expect(samplePath(bend, 30).p[1]).toBeCloseTo(10);
  });

  it('a carriageway, two pavements and paint', () => {
    const lay = roadLayout(straight, 7, style());
    expect(lay.length).toBeCloseTo(40);
    expect(lay.left).not.toBeNull();
    expect(lay.right).not.toBeNull();
    const ys = lay.carriage.map((p) => p[1]);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(7);
    // dashed centre + two edge lines
    expect(lay.marks.filter((m) => m.color === 'white').length).toBeGreaterThan(40 / 1.5 * 2);
    expect(roadLayout(straight, 7, style({ pavLeft: 0, pavRight: 0 })).left).toBeNull();
  });

  it('centre line kinds: none, dashed, solid, double (yellow), one-way has none', () => {
    const count = (s: Partial<RoadStyleInput>, c: 'white' | 'yellow') => roadLayout(straight, 7, style({ edges: false, lanes: 2, ...s })).marks.filter((m) => m.color === c).length;
    expect(count({ centre: 'none' }, 'white')).toBe(0);
    expect(count({ centre: 'dashed' }, 'white')).toBeGreaterThan(0);
    expect(count({ centre: 'solid' }, 'white')).toBeGreaterThan(count({ centre: 'dashed' }, 'white'));
    expect(count({ centre: 'double' }, 'yellow')).toBeGreaterThan(0);
    expect(count({ centre: 'dashed', oneWay: true }, 'white')).toBeGreaterThan(0); // lane line instead of the centre
    expect(count({ centre: 'dashed', oneWay: true, lanes: 1 }, 'white')).toBe(0);
  });

  it('crossings, bumps and parking bays add paint', () => {
    const base = roadLayout(straight, 9, style()).marks.length;
    expect(roadLayout(straight, 9, style({ crossings: [0.5] })).marks.length).toBeGreaterThan(base + 6);
    expect(roadLayout(straight, 9, style({ bumps: [0.3] })).marks.some((m) => m.color === 'yellow')).toBe(true);
    expect(roadLayout(straight, 9, style({ parking: 'both' })).marks.length).toBeGreaterThan(base + 10);
  });

  it('paint and pavement are left out where another road crosses', () => {
    const covered = (p: Vec2) => p[0] > 15 && p[0] < 25;
    const free = roadLayout(straight, 7, style()).marks;
    const cut = roadLayout(straight, 7, style(), covered).marks;
    expect(cut.length).toBeLessThan(free.length);
    for (const m of cut) expect(m.pts[0][0] > 15 && m.pts[0][0] < 25 && m.pts[2][0] > 15 && m.pts[2][0] < 25).toBe(false);
    const full = buildRoadMesh(straight, 7, style())!;
    const part = buildRoadMesh(straight, 7, style(), covered)!;
    const pav = (m: typeof full) => m.groups.find((g) => g.slot === 'pavement')!.count;
    expect(pav(part)).toBeLessThan(pav(full));
  });

  it('the mesh has a surface that faces up, paint above it, and pavements with kerbs', () => {
    const m = buildRoadMesh(bend, 7, style({ crossings: [0.5] }))!;
    expect(m.groups.map((g) => g.slot)).toEqual(['asphalt', 'white', 'pavement', 'kerb']);
    const total = m.groups.reduce((n, g) => n + g.count, 0);
    expect(total).toBe(m.indices.length);
    // every surface / paint / pavement triangle faces up; the kerb faces sideways
    for (const g of m.groups) {
      for (let i = g.start; i < g.start + g.count; i++) {
        const ny = m.normals[i * 3 + 1]!;
        if (g.slot === 'kerb') expect(Math.abs(ny)).toBeLessThan(1e-6);
        else expect(ny).toBeCloseTo(1, 5);
      }
    }
    // the pavement is higher than the road by the kerb height
    const pg = m.groups.find((g) => g.slot === 'pavement')!;
    expect(m.positions[pg.start * 3 + 1]).toBeCloseTo(0.12, 6);
    expect(buildRoadMesh([[0, 0], [0, 0]], 7, style())).toBeNull();
  });

  it('a kerb height of 0 puts the pavement level with the road and drops the kerb face', () => {
    const m = buildRoadMesh(straight, 7, style({ kerb: 0 }))!;
    expect(m.groups.some((g) => g.slot === 'kerb')).toBe(false);
  });

  it('the kerb faces the road', () => {
    const m = buildRoadMesh(straight, 7, style())!;
    const kg = m.groups.find((g) => g.slot === 'kerb')!;
    for (let i = kg.start; i < kg.start + kg.count; i++) {
      const z = m.positions[i * 3 + 2]!;
      const nz = m.normals[i * 3 + 2]!;
      expect(z * nz).toBeLessThan(0); // on the +z kerb the face looks to -z (toward the centre), and vice versa
    }
  });

  it('roadside lights, trees and benches stand on the pavements at their spacing, facing the road', () => {
    const spots = roadsideSpots(straight, 7, style({ extras: [{ kind: 'light', side: 'both', spacing: 10 }, { kind: 'tree', side: 'alternate', spacing: 8, asset: 'tree-neem' }] }));
    const lights = spots.filter((s) => s.kind === 'light');
    expect(lights).toHaveLength(8); // 4 positions × 2 sides
    for (const s of lights) {
      expect(Math.abs(s.z)).toBeGreaterThan(3.5); // beyond the kerb
      expect(Math.abs(s.z)).toBeLessThan(3.5 + 1.8);
      // front (+z rotated by rot) points at the road: toward z = 0
      const fz = Math.cos(s.rot);
      expect(Math.sign(fz)).toBe(-Math.sign(s.z));
    }
    const trees = spots.filter((s) => s.kind === 'tree');
    expect(trees.length).toBe(5);
    expect(new Set(trees.map((t) => t.side)).size).toBe(2); // alternate
    // spots inside another road are skipped
    expect(roadsideSpots(straight, 7, style({ extras: [{ kind: 'light', side: 'both', spacing: 10 }] }), (p) => p[0] > 10 && p[0] < 30).length).toBeLessThan(8);
  });

  it('nearRoad and the footprint measure carriageway plus pavements', () => {
    expect(nearRoad(straight, 7, [10, 3.4])).toBe(true);
    expect(nearRoad(straight, 7, [10, 3.7])).toBe(false);
    expect(nearRoad(straight, 7, [10, 5], 2)).toBe(true);
    const f = roadFootprint(straight, 7, 2, 1);
    const ys = f.map((p) => p[1]);
    expect(Math.max(...ys)).toBeCloseTo(5.5);
    expect(Math.min(...ys)).toBeCloseTo(-4.5);
  });
});
