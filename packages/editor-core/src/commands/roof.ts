import { DEFAULT_MATERIAL_ROOF, DEFAULT_ROOF_OVERHANG_M, DEFAULT_ROOF_PITCH_DEG, type Id, type Roof } from '@hd/scene-schema';
import type { Command } from '../types';

export const ROOF_MIN_PITCH_DEG = 5;
export const ROOF_MAX_PITCH_DEG = 60;
export const ROOF_MAX_OVERHANG_M = 1.5;

export interface RoofInput {
  /** 'none' removes the roof. */
  style?: Roof['style'] | 'none';
  pitchDeg?: number;
  overhang?: number;
  materialId?: string;
  /** Ridge along the short side. */
  swap?: boolean;
}

/** Id of the (single) roof of a floor. */
export const roofIdFor = (levelId: Id): string => `roof_${levelId}`;

/**
 * Create, change or remove the roof on top of a floor (one roof per floor). Unspecified fields keep their value
 * (or the defaults for a new roof); the first style given when none exists creates a gable roof by default.
 */
export function setRoof(levelId: Id, input: RoofInput): Command {
  return {
    type: 'SetRoof',
    label: input.style === 'none' ? 'Remove roof' : 'Edit roof',
    apply(d) {
      if (!d.levels[levelId]) return;
      const id = roofIdFor(levelId);
      if (input.style === 'none') {
        delete d.roofs[id];
        return;
      }
      const cur = d.roofs[id];
      const roof: Roof = cur
        ? { ...cur }
        : {
            id,
            levelId,
            style: 'gable',
            pitchDeg: DEFAULT_ROOF_PITCH_DEG,
            overhang: DEFAULT_ROOF_OVERHANG_M,
            material: { id: DEFAULT_MATERIAL_ROOF },
          };
      if (input.style) roof.style = input.style;
      if (input.pitchDeg !== undefined) roof.pitchDeg = Math.min(ROOF_MAX_PITCH_DEG, Math.max(ROOF_MIN_PITCH_DEG, input.pitchDeg));
      if (input.overhang !== undefined) roof.overhang = Math.min(ROOF_MAX_OVERHANG_M, Math.max(0, input.overhang));
      if (input.materialId) roof.material = { id: input.materialId };
      if (input.swap !== undefined) {
        if (input.swap) roof.ridgeAngle = Math.PI / 2;
        else delete roof.ridgeAngle;
      }
      d.roofs[id] = roof;
    },
  };
}
