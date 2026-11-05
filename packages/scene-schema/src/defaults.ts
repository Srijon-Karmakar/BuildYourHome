import {
  DEFAULT_MATERIAL_GROUND,
  DEFAULT_TERRAIN_SIZE_M,
  LEVEL_HEIGHT_M,
} from './constants';
import { newId } from './ids';
import { SCHEMA_VERSION, type Scene } from './schema';

export interface CreateSceneOptions {
  name?: string;
  now?: () => Date;
  rng?: () => number;
}

/** A valid empty scene with one ground level ("Ground floor") at elevation 0. */
export function createEmptyScene(opts: CreateSceneOptions = {}): Scene {
  const now = (opts.now ?? (() => new Date()))().toISOString();
  const levelId = newId('level', opts.rng);
  return {
    schemaVersion: SCHEMA_VERSION,
    id: newId('scene', opts.rng),
    meta: { name: opts.name ?? 'Untitled home', createdAt: now, updatedAt: now, units: 'm' },
    levels: {
      [levelId]: { id: levelId, name: 'Ground floor', elevation: 0, height: LEVEL_HEIGHT_M },
    },
    levelOrder: [levelId],
    nodes: {},
    walls: {},
    openings: {},
    rooms: {},
    items: {},
    roofs: {},
    stairs: {},
    balconies: {},
    terrain: {
      size: [DEFAULT_TERRAIN_SIZE_M, DEFAULT_TERRAIN_SIZE_M],
      groundMaterial: { id: DEFAULT_MATERIAL_GROUND },
    },
    lighting: { timeOfDay: 12 },
    viewpoints: {},
  };
}
