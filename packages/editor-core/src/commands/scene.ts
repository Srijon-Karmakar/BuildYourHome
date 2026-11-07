import type { MaterialRef } from '@hd/scene-schema';
import type { Command } from '../types';

/** Rename the project. */
export function setSceneName(name: string): Command {
  return {
    type: 'SetSceneName',
    label: 'Rename home',
    apply(d) {
      const n = name.trim().slice(0, 60);
      if (n) d.meta.name = n;
    },
  };
}

/** Time of day for the 3D lighting (0–24 hours). */
export function setTimeOfDay(hours: number): Command {
  return {
    type: 'SetTimeOfDay',
    label: 'Change time of day',
    apply(d) {
      if (Number.isFinite(hours)) d.lighting.timeOfDay = Math.min(24, Math.max(0, hours));
    },
  };
}

export type Weather = 'clear' | 'cloudy' | 'fog' | 'rain';

/** Weather in the 3D view (clear, cloudy, fog, rain). */
export function setWeather(weather: Weather): Command {
  return {
    type: 'SetWeather',
    label: 'Change weather',
    apply(d) {
      if (weather === 'clear') delete d.lighting.weather;
      else d.lighting.weather = weather;
    },
  };
}

export type Horizon = 'none' | 'hills' | 'city';

/** What stands far away on the horizon in the 3D view (hills are the default). */
export function setHorizon(horizon: Horizon): Command {
  return {
    type: 'SetHorizon',
    label: 'Change horizon',
    apply(d) {
      if (horizon === 'hills') delete d.lighting.horizon;
      else d.lighting.horizon = horizon;
    },
  };
}

/** Surface around the house (grass, sand, paving…). */
export function setGround(material: MaterialRef): Command {
  return {
    type: 'SetGround',
    label: 'Change ground',
    apply(d) {
      d.terrain.groundMaterial = { ...material };
    },
  };
}

export interface SceneDefaultsInput {
  interiorThickness?: number;
  exteriorThickness?: number;
}

/** Thickness used for newly drawn walls (existing walls are untouched). */
export function setDefaults(input: SceneDefaultsInput): Command {
  return {
    type: 'SetDefaults',
    label: 'Change defaults',
    apply(d) {
      const clamp = (v: number) => Math.min(1, Math.max(0.05, v));
      const next = { ...(d.defaults ?? {}) };
      if (input.interiorThickness !== undefined) next.interiorThickness = clamp(input.interiorThickness);
      if (input.exteriorThickness !== undefined) next.exteriorThickness = clamp(input.exteriorThickness);
      d.defaults = next;
    },
  };
}

/** How lengths are shown (the scene always stores metres). */
export function setUnits(units: 'm' | 'ft'): Command {
  return {
    type: 'SetUnits',
    label: 'Change units',
    apply(d) {
      d.meta.units = units;
    },
  };
}
