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
