import type { Haze, SkyLook, Weather } from '@hd/editor-core';
import { mix, type SunState } from './sun';

/** What each kind of weather does to the light and the air (pure, so it can be unit tested). */
export interface WeatherLook {
  /** Multiplies the sun's strength. */
  sun: number;
  /** Multiplies the ambient (sky) light. */
  env: number;
  /** 0..1: how far the sky, haze and light drift to grey. */
  grey: number;
  /** FogExp2 density by day (a little haze even when clear). */
  fog: number;
  /** Number of cloud clusters. */
  clouds: number;
  /** Sunlight still makes shadows. */
  shadows: boolean;
  rain: boolean;
  /** Cloud colour at its brightest. */
  cloudColor: string;
}

export const WEATHER_LOOK: Record<Weather, WeatherLook> = {
  clear: { sun: 1, env: 1, grey: 0, fog: 0.0009, clouds: 9, shadows: true, rain: false, cloudColor: '#ffffff' },
  cloudy: { sun: 0.5, env: 1.05, grey: 0.45, fog: 0.0026, clouds: 44, shadows: true, rain: false, cloudColor: '#d9dde2' },
  fog: { sun: 0.35, env: 1, grey: 0.85, fog: 0.016, clouds: 0, shadows: false, rain: false, cloudColor: '#d3d7db' },
  rain: { sun: 0.25, env: 0.9, grey: 0.85, fog: 0.008, clouds: 0, shadows: false, rain: true, cloudColor: '#9aa1a8' },
};

export const WEATHERS: ReadonlyArray<{ id: Weather; label: string }> = [
  { id: 'clear', label: 'Clear' },
  { id: 'cloudy', label: 'Cloudy' },
  { id: 'fog', label: 'Fog' },
  { id: 'rain', label: 'Rain' },
];

export const weatherLook = (w: Weather | undefined): WeatherLook => WEATHER_LOOK[w ?? 'clear'];

const OVERCAST = '#b7bec5';

/** The sky/haze colour for the weather: the plain sky colour drifts toward grey by day and not at all at night. */
export function airColor(sun: SunState, look: WeatherLook): string {
  return mix(sun.background, OVERCAST, look.grey * (1 - sun.darkness));
}

/** How much the haze setting scales the weather's own haze (misty mornings, or crystal-clear air). */
const HAZE_SCALE: Record<Haze, number> = { none: 0, light: 1, misty: 4 };

/**
 * Fog thickness: the weather's haze by day (scaled by the haze setting on clear days; fog and rain keep at least their own),
 * and the night haze (see Lighting) in the dark.
 */
export function fogDensity(sun: SunState, look: WeatherLook, haze: Haze = 'light'): number {
  const k = look.grey === 0 ? HAZE_SCALE[haze] : Math.max(1, HAZE_SCALE[haze]);
  return look.fog * k * (1 - sun.darkness) + 0.011 * sun.darkness;
}

/** The sky shader's settings for each sky look (a clear day only; clouds and rain have their own grey sky). */
export const SKY_LOOKS: Record<SkyLook, { turbidity: number; rayleigh: number; mie: number }> = {
  natural: { turbidity: 6, rayleigh: 1.6, mie: 0.004 },
  deep: { turbidity: 2.5, rayleigh: 3.2, mie: 0.003 },
  pale: { turbidity: 10, rayleigh: 0.9, mie: 0.006 },
  dusty: { turbidity: 18, rayleigh: 1.2, mie: 0.012 },
};

/** Sunlight colour: weather washes the warmth out of it. */
export const lightColor = (sun: SunState, look: WeatherLook): string => mix(sun.color, '#dfe6ee', look.grey * 0.6);
