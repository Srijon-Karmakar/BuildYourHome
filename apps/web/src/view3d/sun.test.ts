import { describe, expect, it } from 'vitest';
import { hourLabel, moonDirection, sunAt } from './sun';

describe('sun', () => {
  it('rises in the east, is highest and southern at noon, sets in the west', () => {
    const noon = sunAt(12);
    expect(noon.elevationDeg).toBeCloseTo(62, 0);
    expect(noon.dir[2]).toBeGreaterThan(0.4); // south = +z
    expect(Math.abs(noon.dir[0])).toBeLessThan(0.01);
    expect(sunAt(8).dir[0]).toBeGreaterThan(0.2); // morning: east (+x)
    expect(sunAt(16).dir[0]).toBeLessThan(-0.2); // afternoon: west
  });

  it('is a unit vector and never below the horizon', () => {
    for (let h = 0; h <= 24; h += 0.5) {
      const s = sunAt(h);
      expect(Math.hypot(...s.dir)).toBeCloseTo(1, 6);
      expect(s.dir[1]).toBeGreaterThanOrEqual(0);
    }
  });

  it('light fades to nothing at night and is strongest at midday', () => {
    expect(sunAt(2).intensity).toBe(0);
    expect(sunAt(23).night).toBe(true);
    expect(sunAt(12).intensity).toBeGreaterThan(sunAt(7).intensity);
    expect(sunAt(12).env).toBeGreaterThan(sunAt(2).env);
    expect(sunAt(12).night).toBe(false);
  });

  it('low sun is warmer (more orange) than the midday sun', () => {
    const red = (c: string) => parseInt(c.slice(1, 3), 16);
    const blue = (c: string) => parseInt(c.slice(5, 7), 16);
    expect(blue(sunAt(6.8).color)).toBeLessThan(blue(sunAt(12).color));
    expect(red(sunAt(6.8).color)).toBeGreaterThan(200);
  });

  it('clamps out-of-range hours and formats labels', () => {
    expect(sunAt(-5).hour).toBe(0);
    expect(sunAt(99).hour).toBe(24);
    expect(hourLabel(14.5)).toBe('2:30 pm');
    expect(hourLabel(0)).toBe('12:00 am');
    expect(hourLabel(12)).toBe('12:00 pm');
    expect(hourLabel(9.999)).toBe('10:00 am');
  });

  it('darkness is 0 by day, 1 deep in the night and eases in around sunset and sunrise', () => {
    expect(sunAt(12).darkness).toBe(0);
    expect(sunAt(17.9).darkness).toBe(0);
    expect(sunAt(22).darkness).toBe(1);
    expect(sunAt(2).darkness).toBe(1);
    const dusk = sunAt(18.75).darkness;
    expect(dusk).toBeGreaterThan(0.2);
    expect(dusk).toBeLessThan(0.8);
    expect(sunAt(5.25).darkness).toBeCloseTo(dusk, 6); // dawn mirrors dusk
    // monotonic through the evening
    let prev = -1;
    for (let h = 18; h <= 20; h += 0.1) {
      const d = sunAt(h).darkness;
      expect(d).toBeGreaterThanOrEqual(prev);
      prev = d;
    }
  });

  it('the moon is up all night, crosses from east to west and never goes below the horizon', () => {
    for (let h = 18; h <= 30; h += 0.5) {
      const m = moonDirection(h % 24);
      expect(Math.hypot(...m)).toBeCloseTo(1, 6);
      expect(m[1]).toBeGreaterThan(0.05);
    }
    expect(moonDirection(19)[0]).toBeGreaterThan(0.3); // east in the evening
    expect(moonDirection(5)[0]).toBeLessThan(-0.3); // west before dawn
    expect(moonDirection(0)[1]).toBeGreaterThan(moonDirection(19)[1]); // highest around midnight
  });
});
