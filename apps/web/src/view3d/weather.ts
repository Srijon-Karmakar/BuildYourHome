import type { Weather } from '@hd/editor-core';
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

/** Fog thickness: the weather's haze by day, the night haze (see Lighting) in the dark. */
export function fogDensity(sun: SunState, look: WeatherLook): number {
  return look.fog * (1 - sun.darkness) + 0.011 * sun.darkness;
}

/** Sunlight colour: weather washes the warmth out of it. */
export const lightColor = (sun: SunState, look: WeatherLook): string => mix(sun.color, '#dfe6ee', look.grey * 0.6);
