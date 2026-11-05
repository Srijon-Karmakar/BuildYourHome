export const WALL_THICKNESS_INTERIOR_M = 0.115;
export const WALL_THICKNESS_EXTERIOR_M = 0.23;
export const LEVEL_HEIGHT_M = 3.0;
export const DEFAULT_DOOR_WIDTH_M = 0.9;
export const DEFAULT_DOOR_HEIGHT_M = 2.1;
export const DEFAULT_WINDOW_WIDTH_M = 1.2;
export const DEFAULT_WINDOW_HEIGHT_M = 1.2;
export const DEFAULT_WINDOW_SILL_M = 0.9;
export const DEFAULT_ROOF_PITCH_DEG = 25;
export const DEFAULT_ROOF_OVERHANG_M = 0.4;
export const DEFAULT_TERRAIN_SIZE_M = 60;
export const DEFAULT_MATERIAL_WALL = 'paint-white';
export const DEFAULT_MATERIAL_FLOOR = 'floor-wood-oak';
export const DEFAULT_MATERIAL_GROUND = 'ground-grass';
export const DEFAULT_MATERIAL_ROOF = 'roof-tile-terracotta';

export const DEFAULT_MATERIAL_CEILING = 'paint-white';

export const DOOR_STYLES = ['flush', 'panel', 'glass', 'double'] as const;
export const WINDOW_STYLES = ['single', 'double', 'sliding'] as const;
export type DoorStyle = (typeof DOOR_STYLES)[number];
export type WindowStyle = (typeof WINDOW_STYLES)[number];

/** Frame colour presets (hex). First entry is the default. */
export const FRAME_COLORS = [
  { id: '#f1efea', name: 'White' },
  { id: '#2b2a28', name: 'Black' },
  { id: '#b98a5b', name: 'Oak' },
  { id: '#8a8a86', name: 'Grey' },
] as const;

/** Door leaf colour presets (hex). First entry is the default. */
export const LEAF_COLORS = [
  { id: '#c9a47a', name: 'Oak' },
  { id: '#f1efea', name: 'White' },
  { id: '#7a5238', name: 'Walnut' },
  { id: '#2b2a28', name: 'Black' },
  { id: '#8f9f86', name: 'Sage' },
  { id: '#7a4236', name: 'Brick' },
] as const;
