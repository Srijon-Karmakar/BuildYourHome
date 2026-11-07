import { describe, expect, it } from 'vitest';
import { sunAt } from './sun';
import { airColor, fogDensity, lightColor, SKY_LOOKS, WEATHERS, weatherLook } from './weather';

describe('weather look', () => {
  it('every weather has a look; unset means clear', () => {
    for (const w of WEATHERS) expect(weatherLook(w.id)).toBeTruthy();
    expect(weatherLook(undefined)).toBe(weatherLook('clear'));
  });

  it('bad weather dims the sun and thickens the air; only rain falls', () => {
    const clear = weatherLook('clear');
    for (const id of ['cloudy', 'fog', 'rain'] as const) {
      expect(weatherLook(id).sun, id).toBeLessThan(clear.sun);
      expect(weatherLook(id).fog, id).toBeGreaterThan(clear.fog);
    }
    expect(WEATHERS.filter((w) => weatherLook(w.id).rain).map((w) => w.id)).toEqual(['rain']);
    expect(weatherLook('fog').fog).toBeGreaterThan(weatherLook('rain').fog);
  });

  it('by day the sky goes grey, but the night stays the night', () => {
    const noon = sunAt(12);
    const night = sunAt(23);
    expect(airColor(noon, weatherLook('rain'))).not.toBe(airColor(noon, weatherLook('clear')));
    expect(airColor(night, weatherLook('rain'))).toBe(night.background);
    expect(fogDensity(night, weatherLook('clear'))).toBeCloseTo(0.011, 5);
    expect(fogDensity(noon, weatherLook('fog'))).toBeCloseTo(0.016, 5);
    expect(lightColor(noon, weatherLook('clear'))).toBe(noon.color);
  });

  it('the haze setting thins or thickens the air on a clear day; fog and rain never get clearer than their own', () => {
    const noon = sunAt(12);
    const clear = weatherLook('clear');
    expect(fogDensity(noon, clear, 'none')).toBe(0);
    expect(fogDensity(noon, clear, 'misty')).toBeGreaterThan(fogDensity(noon, clear, 'light') * 3);
    expect(fogDensity(noon, weatherLook('fog'), 'none')).toBeCloseTo(fogDensity(noon, weatherLook('fog'), 'light'), 6);
  });

  it('every sky look has shader settings, and deep blue is bluer (more scattering) than pale', () => {
    expect(Object.keys(SKY_LOOKS).sort()).toEqual(['deep', 'dusty', 'natural', 'pale']);
    expect(SKY_LOOKS.deep.rayleigh).toBeGreaterThan(SKY_LOOKS.pale.rayleigh);
  });
});
