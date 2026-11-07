import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hd/scene-schema';
import { planGroundDetail } from './GroundDetail';

const plot: Vec2[] = [[-10, -8], [10, -8], [10, 8], [-10, 8]];
const house = { min: [-4, -3] as Vec2, max: [4, 3] as Vec2 };
const budget = { tufts: 300, pebbles: 40 };

describe('ground detail', () => {
  it('puts grass on a lawn, only inside the plot and never on the house', () => {
    const p = planGroundDetail('ground-grass', plot, [], house, [], budget, false);
    expect(p.tufts.length).toBeGreaterThan(100);
    for (const [x, z] of p.tufts) {
      expect(x).toBeGreaterThanOrEqual(-10);
      expect(x).toBeLessThanOrEqual(10);
      expect(z).toBeGreaterThanOrEqual(-8);
      expect(z).toBeLessThanOrEqual(8);
      expect(x > -4.4 && x < 4.4 && z > -3.4 && z < 3.4, 'on the house').toBe(false);
    }
    expect(p.puddles).toHaveLength(0); // dry
  });

  it('is the same every time (seeded) and keeps off paths, roads and paving', () => {
    const path = { shape: 'path', points: [[-10, 6], [10, 6]] as Vec2[], width: 2, materialId: 'ground-paving' };
    const a = planGroundDetail('ground-grass', plot, [path], house, [], budget, false);
    const b = planGroundDetail('ground-grass', plot, [path], house, [], budget, false);
    expect(a).toEqual(b);
    expect(a.tufts.some(([, z]) => z > 5.1 && z < 6.9)).toBe(false);
  });

  it('bare ground gets pebbles instead of grass; leaves fall under trees (autumn colour kept); rain makes puddles on ground and roads', () => {
    const bare = planGroundDetail('ground-soil', plot, [], house, [], budget, false);
    expect(bare.tufts).toHaveLength(0);
    expect(bare.pebbles.length).toBeGreaterThan(10);
    const road = { shape: 'road', points: [[-30, 14], [30, 14]] as Vec2[], width: 6, materialId: 'ground-asphalt', pavLeft: 1.5, pavRight: 1.5 };
    const wet = planGroundDetail('ground-grass', plot, [road], house, [{ x: 7, z: 5, color: '#c98a2b' }, { x: -7, z: 5 }], budget, true);
    expect(wet.puddles.length).toBeGreaterThan(4);
    expect(wet.puddles.some(([, z]) => Math.abs(z - 14) < 3)).toBe(true); // on the road
    expect(wet.leaves.some((l) => l.color === '#c98a2b')).toBe(true);
    expect(wet.leaves.length).toBeGreaterThan(8);
  });
});
