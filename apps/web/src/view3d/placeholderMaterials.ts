/**
 * Placeholder material catalog (ADR-013). Real scanned PBR sets arrive with the asset pipeline;
 * ids stay stable so scenes keep working when they are swapped in.
 */
export type MaterialGroup = 'wall' | 'floor' | 'ground' | 'roof';
export type MaterialPattern =
  | 'paint'
  | 'plain'
  | 'wood'
  | 'tile'
  | 'brick'
  | 'stone'
  | 'panel'
  | 'subway'
  | 'terrazzo'
  | 'carpet';

export interface CatalogMaterial {
  id: string;
  name: string;
  group: MaterialGroup;
  /** Base colour; for textured patterns it tints the texture. */
  color: string;
  roughness: number;
  metalness?: number;
  pattern: MaterialPattern;
  /** Grout colour for tile patterns. */
  grout?: string;
}

const paint = (id: string, name: string, color: string): CatalogMaterial => ({ id, name, group: 'wall', color, roughness: 0.9, pattern: 'paint' });

export const MATERIAL_CATALOG: readonly CatalogMaterial[] = [
  // Wall paints
  paint('paint-white', 'White', '#f2efe8'),
  paint('paint-sand', 'Sand', '#dccfb4'),
  paint('paint-warm-grey', 'Warm grey', '#cfc9bf'),
  paint('paint-clay', 'Clay', '#c9a08a'),
  paint('paint-sage', 'Sage', '#aab59a'),
  paint('paint-sky', 'Sky', '#b9c8d3'),
  paint('paint-charcoal', 'Charcoal', '#55524d'),
  // Wall finishes
  { id: 'wall-brick-red', name: 'Red brick', group: 'wall', color: '#b5604a', roughness: 0.85, pattern: 'brick' },
  { id: 'wall-brick-white', name: 'White brick', group: 'wall', color: '#ece7dc', roughness: 0.8, pattern: 'brick' },
  { id: 'wall-stone', name: 'Stone', group: 'wall', color: '#b9b2a4', roughness: 0.9, pattern: 'stone' },
  { id: 'wall-wood-panel', name: 'Wood slats', group: 'wall', color: '#c49a6c', roughness: 0.55, pattern: 'panel' },
  { id: 'wall-tile-white', name: 'White tile', group: 'wall', color: '#f2f1ed', roughness: 0.25, pattern: 'subway', grout: '#cfccc4' },
  { id: 'wall-tile-green', name: 'Green tile', group: 'wall', color: '#9db5a0', roughness: 0.25, pattern: 'subway', grout: '#d8d6cf' },
  { id: 'wall-tile-navy', name: 'Navy tile', group: 'wall', color: '#4d6783', roughness: 0.25, pattern: 'subway', grout: '#d8d6cf' },
  // Floors
  { id: 'floor-wood-oak', name: 'Oak', group: 'floor', color: '#ffffff', roughness: 0.52, pattern: 'wood' },
  { id: 'floor-wood-ash', name: 'Ash', group: 'floor', color: '#e3d3b8', roughness: 0.52, pattern: 'wood' },
  { id: 'floor-wood-walnut', name: 'Walnut', group: 'floor', color: '#a98467', roughness: 0.5, pattern: 'wood' },
  { id: 'floor-tile-white', name: 'White tile', group: 'floor', color: '#efeeea', roughness: 0.3, pattern: 'tile', grout: '#b9b6ae' },
  { id: 'floor-tile-grey', name: 'Grey tile', group: 'floor', color: '#a9a7a2', roughness: 0.35, pattern: 'tile', grout: '#7d7b76' },
  { id: 'floor-terrazzo', name: 'Terrazzo', group: 'floor', color: '#ffffff', roughness: 0.4, pattern: 'terrazzo' },
  { id: 'floor-carpet-grey', name: 'Grey carpet', group: 'floor', color: '#a3a19c', roughness: 1, pattern: 'carpet' },
  { id: 'floor-carpet-sand', name: 'Sand carpet', group: 'floor', color: '#cdbd9f', roughness: 1, pattern: 'carpet' },
  { id: 'floor-concrete', name: 'Concrete', group: 'floor', color: '#9c9a95', roughness: 0.85, pattern: 'plain' },
  { id: 'floor-marble', name: 'Marble', group: 'floor', color: '#e8e6e0', roughness: 0.22, pattern: 'plain' },
  // Ground around the house
  { id: 'ground-grass', name: 'Grass', group: 'ground', color: '#9aa88a', roughness: 1, pattern: 'plain' },
  { id: 'ground-sand', name: 'Sand', group: 'ground', color: '#d9c9a3', roughness: 1, pattern: 'plain' },
  { id: 'ground-paving', name: 'Paving', group: 'ground', color: '#b8b4ab', roughness: 0.9, pattern: 'plain' },
  { id: 'ground-soil', name: 'Soil', group: 'ground', color: '#8a7560', roughness: 1, pattern: 'plain' },
  { id: 'ground-stone', name: 'Light stone', group: 'ground', color: '#d6d2c8', roughness: 1, pattern: 'plain' },
  // Roofs
  { id: 'roof-tile-terracotta', name: 'Terracotta', group: 'roof', color: '#b5593a', roughness: 0.8, pattern: 'plain' },
  { id: 'roof-tile-grey', name: 'Grey tile', group: 'roof', color: '#7d7f84', roughness: 0.75, pattern: 'plain' },
  { id: 'roof-slate', name: 'Slate', group: 'roof', color: '#3f4348', roughness: 0.7, pattern: 'plain' },
  { id: 'roof-metal', name: 'Metal sheet', group: 'roof', color: '#9aa3a8', roughness: 0.35, metalness: 0.5, pattern: 'plain' },
  { id: 'roof-sand', name: 'Sand tile', group: 'roof', color: '#c9a77e', roughness: 0.8, pattern: 'plain' },
  { id: 'roof-green', name: 'Green sheet', group: 'roof', color: '#5d7a5a', roughness: 0.5, metalness: 0.3, pattern: 'plain' },
];

const BY_ID = new Map(MATERIAL_CATALOG.map((m) => [m.id, m]));

const FALLBACK: CatalogMaterial = { id: '', name: 'Plain', group: 'wall', color: '#cccccc', roughness: 0.8, pattern: 'plain' };

export const catalogMaterial = (id: string): CatalogMaterial => BY_ID.get(id) ?? FALLBACK;

/** What the user can pick for a surface type. */
export const materialsFor = (group: MaterialGroup): CatalogMaterial[] =>
  MATERIAL_CATALOG.filter((m) => m.group === group);

/** Plain painted walls / ceilings (no relief), as opposed to finishes like brick or tile. */
export const paintMaterials = (): CatalogMaterial[] => MATERIAL_CATALOG.filter((m) => m.pattern === 'paint');
export const finishMaterials = (): CatalogMaterial[] => MATERIAL_CATALOG.filter((m) => m.group === 'wall' && m.pattern !== 'paint');
