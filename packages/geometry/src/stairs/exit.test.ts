import { describe, expect, it } from 'vitest';
import { stairHole, stairLayout } from './stairs';
import { buildStairExit, stairExitPlan, stairExitWalls, STAIR_EXIT_KINDS } from './exit';

const bbox = (pts: readonly (readonly number[])[]) => [Math.min(...pts.map((p) => p[0]!)), Math.min(...pts.map((p) => p[1]!)), Math.max(...pts.map((p) => p[0]!)), Math.max(...pts.map((p) => p[1]!))];

describe('stair exits (roof room, glass box, hatch)', () => {
  it('a room wraps the opening with a landing in front of the top step and a door on that side', () => {
    const l = stairLayout({ kind: 'straight', width: 1, rise: 3 });
    const p = stairExitPlan(l, 'room');
    const [hx0, hz0, hx1, hz1] = bbox(stairHole(l));
    const [x0, z0, x1, z1] = p.rect;
    expect(x0).toBeLessThan(hx0!);
    expect(x1).toBeGreaterThan(hx1!);
    expect(z1).toBeGreaterThan(hz1!);
    expect(p.side).toBe(0); // a straight flight climbs toward -z
    expect(z0).toBeLessThan(hz0! - 0.99); // the landing
    expect(p.door[1] - p.door[0]).toBeCloseTo(0.9);
    // three full sides + the door side split in two around the door
    const walls = stairExitWalls(p);
    expect(walls).toHaveLength(5);
  });

  it('a hatch is tight round the opening and leaves its open side without a kerb', () => {
    const l = stairLayout({ kind: 'U', width: 1, rise: 3 });
    const p = stairExitPlan(l, 'hatch');
    expect(stairExitWalls(p)).toHaveLength(3);
    const room = stairExitPlan(l, 'room');
    expect(room.rect[2] - room.rect[0] + room.rect[3] - room.rect[1]).toBeGreaterThan(p.rect[2] - p.rect[0] + p.rect[3] - p.rect[1]);
  });

  it('every kind and stair shape builds a closed mesh with its slots', () => {
    for (const kind of STAIR_EXIT_KINDS)
      for (const shape of ['straight', 'L', 'U', 'spiral'] as const)
        for (const mirror of [false, true]) {
          const m = buildStairExit(stairLayout({ kind: shape, width: 1, rise: 3, mirror }), kind);
          expect(m.positions.length, `${kind} ${shape}`).toBeGreaterThan(0);
          expect(m.positions.every(Number.isFinite)).toBe(true);
          const slots = m.groups.map((g) => g.slot);
          if (kind === 'room') expect(slots).toEqual(['wall', 'roof', 'frame']);
          if (kind === 'glass') expect(slots).toEqual(['frame', 'glass']);
          if (kind === 'hatch') expect(slots).toEqual(['wall', 'frame', 'glass']);
        }
  });

  it('the room is as tall as asked, with its roof slab on top', () => {
    const l = stairLayout({ kind: 'straight', width: 1, rise: 3 });
    const m = buildStairExit(l, 'room', 2.8);
    let top = -Infinity;
    for (let i = 1; i < m.positions.length; i += 3) top = Math.max(top, m.positions[i]!);
    expect(top).toBeCloseTo(2.8 + 0.12, 3);
  });
});
