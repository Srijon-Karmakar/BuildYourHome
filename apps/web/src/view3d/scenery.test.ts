import { describe, expect, it } from 'vitest';
import { resolveEnvironment, type CompassSide } from '@hd/editor-core';
import { createEmptyScene, type EnvironmentSettings } from '@hd/scene-schema';
import { cityAt, groundAt, isFlat, SIDE_ANGLE, sideWeights, wallAt } from './scenery';

const env = (e?: EnvironmentSettings) => {
  const scene = createEmptyScene();
  if (e) scene.lighting.environment = e;
  return resolveEnvironment(scene.lighting);
};
const N = SIDE_ANGLE.north;
const S = SIDE_ANGLE.south;

describe('scenery round the horizon', () => {
  it('the weights add up to 1 everywhere; a side holds its own scenery at its centre and shares it between sides', () => {
    for (let a = 0; a < 6.3; a += 0.17) expect(Object.values(sideWeights(a)).reduce((s, v) => s + v, 0)).toBeCloseTo(1, 6);
    expect(sideWeights(N).north).toBeCloseTo(1, 3);
    const between = sideWeights(N + Math.PI / 4); // halfway to the east
    expect(between.north).toBeCloseTo(between.east, 2);
    const near = sideWeights(N + 0.35); // 20° off centre
    expect(near.north).toBeGreaterThan(0.9);
  });

  it('open flat land has nothing on the horizon: no relief, no city', () => {
    const e = env();
    expect(isFlat(e)).toBe(true);
    for (let a = 0; a < 6.3; a += 0.3) {
      expect(wallAt(e, 'far', a).h).toBe(0);
      expect(wallAt(e, 'near', a).h).toBe(0);
      expect(cityAt(e, a).amount).toBe(0);
    }
  });

  it('mountains on the north side only stand to the north: tall there, nothing to the south', () => {
    const e = env({ sides: { north: { kind: 'mountains' } } });
    expect(isFlat(e)).toBe(false);
    let tallest = 0;
    for (let a = N - 0.4; a < N + 0.4; a += 0.02) tallest = Math.max(tallest, wallAt(e, 'far', a).h);
    expect(tallest).toBeGreaterThan(40);
    expect(wallAt(e, 'far', S).h).toBe(0);
    expect(wallAt(e, 'far', SIDE_ANGLE.east + 0.05).h).toBeLessThan(tallest * 0.3);
  });

  it('mountains are taller than hills; the height setting scales them; snow caps the top', () => {
    const peak = (e: ReturnType<typeof env>) => {
      let m = 0;
      for (let a = N - 0.4; a < N + 0.4; a += 0.01) m = Math.max(m, wallAt(e, 'far', a).h);
      return m;
    };
    const hills = peak(env({ sides: { north: { kind: 'hills' } } }));
    const mountains = peak(env({ sides: { north: { kind: 'mountains' } } }));
    const low = peak(env({ sides: { north: { kind: 'mountains', height: 0.5 } } }));
    expect(mountains).toBeGreaterThan(hills * 1.6);
    expect(low).toBeCloseTo(mountains * 0.5, 0);
    const bare = wallAt(env({ sides: { north: { kind: 'mountains' } } }), 'far', N).colors[3];
    const snowy = wallAt(env({ sides: { north: { kind: 'mountains', snow: true } } }), 'far', N).colors[3];
    expect(snowy[0]).toBeGreaterThan(bare[0] + 0.2); // white-ish instead of rock
    // the snow line is a fixed height: it sits higher on a taller range
    const line = (height: number) => wallAt(env({ sides: { north: { kind: 'mountains', snow: true, height } } }), 'far', N).snowAt;
    expect(line(1.6)).toBeGreaterThan(line(1) * 1.5);
  });

  it('tone changes the colour of hills', () => {
    const natural = wallAt(env({ sides: { north: { kind: 'hills' } } }), 'far', N).colors[3];
    const golden = wallAt(env({ sides: { north: { kind: 'hills', tone: 'golden' } } }), 'far', N).colors[3];
    expect(golden[0]).toBeGreaterThan(natural[0]);
    expect(golden[2]).toBeLessThan(natural[2]);
  });

  it('a city skyline is only where a side is a city, and the ground follows the scenery (water to the south)', () => {
    const e = env({ sides: { south: { kind: 'city' } } });
    expect(cityAt(e, S).amount).toBeCloseTo(1, 2);
    expect(cityAt(e, N).amount).toBe(0);
    const sea = env({ sides: { south: { kind: 'sea' } } });
    const base: [number, number, number] = [0.6, 0.7, 0.5];
    const water = groundAt(sea, S, base);
    expect(water[2]).toBeGreaterThan(water[0]); // blue
    expect(groundAt(sea, N, base)).toEqual(base);
  });

  it('every kind builds on every side without gaps (heights are finite and never negative)', () => {
    const kinds = ['plains', 'hills', 'mountains', 'forest', 'sea', 'desert', 'city'] as const;
    const sides: CompassSide[] = ['north', 'east', 'south', 'west'];
    for (const kind of kinds) {
      const e = env({ sides: Object.fromEntries(sides.map((s) => [s, { kind }])) as EnvironmentSettings['sides'] });
      for (let a = 0; a < 6.3; a += 0.05) for (const ring of ['far', 'near'] as const) {
        const h = wallAt(e, ring, a).h;
        expect(Number.isFinite(h) && h >= 0, `${kind} ${ring} ${a}`).toBe(true);
      }
    }
  });
});
