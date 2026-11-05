import { describe, expect, it } from 'vitest';
import type { Vec2, Wall, WallNode } from '@hd/scene-schema';
import { buildColliders, moveWithCollision, PLAYER_RADIUS_M, type Collider } from '../index';

const wall = (a: Vec2, b: Vec2, t = 0.2): Collider => ({ a, b, halfThickness: t / 2 });
const R = PLAYER_RADIUS_M;

describe('moveWithCollision', () => {
  const north = [wall([-5, 0], [5, 0])];

  it('moves freely in open space', () => {
    const p = moveWithCollision([0, 2], [1, 0.5], []);
    expect(p[0]).toBeCloseTo(1, 9);
    expect(p[1]).toBeCloseTo(2.5, 9);
  });

  it('stops at radius + half thickness from a wall', () => {
    const p = moveWithCollision([0, 2], [0, -5], north);
    expect(p[0]).toBeCloseTo(0);
    expect(p[1]).toBeCloseTo(R + 0.1, 6);
  });

  it('slides along the wall: tangential motion is kept, normal motion removed', () => {
    const p = moveWithCollision([0, 2], [3, -5], north);
    expect(p[0]).toBeGreaterThan(2.5);
    expect(p[1]).toBeCloseTo(R + 0.1, 6);
  });

  it('cannot tunnel through a thin wall with a huge step', () => {
    const p = moveWithCollision([0, 2], [0, -50], north);
    expect(p[1]).toBeGreaterThanOrEqual(R + 0.1 - 1e-9);
  });

  it('works from the other side too', () => {
    const p = moveWithCollision([0, -2], [0, 5], north);
    expect(p[1]).toBeCloseTo(-(R + 0.1), 6);
  });

  it('cannot escape a closed room by walking into any corner', () => {
    const room = [wall([0, 0], [4, 0]), wall([4, 0], [4, 3]), wall([4, 3], [0, 3]), wall([0, 3], [0, 0])];
    for (const dir of [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [0, 1], [-1, 0], [0, -1]] as Vec2[]) {
      let p: Vec2 = [2, 1.5];
      for (let i = 0; i < 100; i++) p = moveWithCollision(p, [dir[0] * 0.2, dir[1] * 0.2], room);
      expect(p[0]).toBeGreaterThanOrEqual(R + 0.1 - 1e-6);
      expect(p[0]).toBeLessThanOrEqual(4 - R - 0.1 + 1e-6);
      expect(p[1]).toBeGreaterThanOrEqual(R + 0.1 - 1e-6);
      expect(p[1]).toBeLessThanOrEqual(3 - R - 0.1 + 1e-6);
    }
  });

  it('is blocked by a wall end cap (rounded) rather than clipping through the end', () => {
    const p = moveWithCollision([5.5, 0], [-3, 0], [wall([0, 0], [4, 0])]);
    expect(p[0]).toBeCloseTo(4 + R + 0.1, 6);
  });

  it('pushes the player out if they start inside a wall (e.g. wall drawn over them)', () => {
    const p = moveWithCollision([0, 0.02], [0, 0], north);
    expect(Math.abs(p[1])).toBeGreaterThanOrEqual(R + 0.1 - 1e-9);
    const onLine = moveWithCollision([1, 0], [0, 0], north);
    expect(Math.abs(onLine[1])).toBeGreaterThanOrEqual(R + 0.1 - 1e-9);
  });

  it('thicker walls keep the player farther away', () => {
    const p = moveWithCollision([0, 2], [0, -5], [wall([-5, 0], [5, 0], 0.5)]);
    expect(p[1]).toBeCloseTo(R + 0.25, 6);
  });
});

describe('buildColliders', () => {
  it('maps walls to thick segments and skips degenerate/missing ones', () => {
    const nodes: Record<string, WallNode> = {
      a: { id: 'a', levelId: 'L', p: [0, 0] },
      b: { id: 'b', levelId: 'L', p: [4, 0] },
      c: { id: 'c', levelId: 'L', p: [0, 0] },
    };
    const mk = (id: string, a: string, b: string, t: number): Wall => ({
      id, levelId: 'L', a, b, thickness: t, height: 3, kind: 'interior', materialA: { id: 'm' }, materialB: { id: 'm' },
    });
    const cs = buildColliders(nodes, [mk('w1', 'a', 'b', 0.23), mk('w2', 'a', 'c', 0.2), mk('w3', 'a', 'zz', 0.2)]);
    expect(cs).toHaveLength(1);
    expect(cs[0]!.halfThickness).toBeCloseTo(0.115);
  });
});
