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
  paint('paint-blush', 'Blush', '#e3c7bd'),
  paint('paint-mustard', 'Mustard', '#d9b860'),
  paint('paint-teal', 'Teal', '#6f9a9a'),
  paint('paint-rust', 'Rust', '#c0735b'),
  paint('paint-lavender', 'Lavender', '#c4bfd6'),
  paint('paint-olive', 'Olive', '#8a8d63'),
  paint('paint-ivory', 'Ivory', '#f4efe0'),
  paint('paint-cream', 'Cream', '#ebdfc4'),
  paint('paint-peach', 'Peach', '#efc9ae'),
  paint('paint-coral', 'Coral', '#e0866e'),
  paint('paint-terracotta', 'Terracotta', '#b9694c'),
  paint('paint-saffron', 'Saffron', '#e3a23a'),
  paint('paint-mint', 'Mint', '#bcd9c6'),
  paint('paint-aqua', 'Aqua', '#9ccfcf'),
  paint('paint-powder', 'Powder blue', '#c6d6e6'),
  paint('paint-navy', 'Navy', '#35465f'),
  paint('paint-plum', 'Plum', '#6d4a63'),
  paint('paint-maroon', 'Maroon', '#7d3a3c'),
  paint('paint-slate', 'Slate grey', '#6c7378'),
  paint('paint-taupe', 'Taupe', '#a8998a'),
  // Wall finishes
  { id: 'wall-brick-red', name: 'Red brick', group: 'wall', color: '#b5604a', roughness: 0.85, pattern: 'brick' },
  { id: 'wall-brick-white', name: 'White brick', group: 'wall', color: '#ece7dc', roughness: 0.8, pattern: 'brick' },
  { id: 'wall-stone', name: 'Stone', group: 'wall', color: '#b9b2a4', roughness: 0.9, pattern: 'stone' },
  { id: 'wall-wood-panel', name: 'Wood slats', group: 'wall', color: '#c49a6c', roughness: 0.55, pattern: 'panel' },
  { id: 'wall-tile-white', name: 'White tile', group: 'wall', color: '#f2f1ed', roughness: 0.25, pattern: 'subway', grout: '#cfccc4' },
  { id: 'wall-tile-green', name: 'Green tile', group: 'wall', color: '#9db5a0', roughness: 0.25, pattern: 'subway', grout: '#d8d6cf' },
  { id: 'wall-brick-grey', name: 'Grey brick', group: 'wall', color: '#8f8d89', roughness: 0.85, pattern: 'brick' },
  { id: 'wall-wood-dark', name: 'Dark wood slats', group: 'wall', color: '#6b4a30', roughness: 0.55, pattern: 'panel' },
  { id: 'wall-tile-black', name: 'Black tile', group: 'wall', color: '#35353a', roughness: 0.25, pattern: 'subway', grout: '#59595e' },
  { id: 'wall-tile-rust', name: 'Rust tile', group: 'wall', color: '#b96a50', roughness: 0.25, pattern: 'subway', grout: '#d8d6cf' },
  { id: 'wall-concrete', name: 'Concrete', group: 'wall', color: '#a8a6a1', roughness: 0.9, pattern: 'plain' },
  { id: 'wall-brick-sand', name: 'Sand brick', group: 'wall', color: '#d2b68f', roughness: 0.85, pattern: 'brick' },
  { id: 'wall-brick-brown', name: 'Brown brick', group: 'wall', color: '#8a5a43', roughness: 0.85, pattern: 'brick' },
  { id: 'wall-stone-dark', name: 'Slate stone', group: 'wall', color: '#6f7479', roughness: 0.9, pattern: 'stone' },
  { id: 'wall-stone-warm', name: 'Sandstone', group: 'wall', color: '#cfa77b', roughness: 0.9, pattern: 'stone' },
  { id: 'wall-wood-white', name: 'White slats', group: 'wall', color: '#ece7dc', roughness: 0.55, pattern: 'panel' },
  { id: 'wall-wood-light', name: 'Light wood slats', group: 'wall', color: '#dcc09a', roughness: 0.55, pattern: 'panel' },
  { id: 'wall-tile-cream', name: 'Cream tile', group: 'wall', color: '#eadfc6', roughness: 0.25, pattern: 'subway', grout: '#cfc7b4' },
  { id: 'wall-tile-sky', name: 'Sky tile', group: 'wall', color: '#a9c6dc', roughness: 0.25, pattern: 'subway', grout: '#d8d6cf' },
  { id: 'wall-tile-yellow', name: 'Yellow tile', group: 'wall', color: '#e6c866', roughness: 0.25, pattern: 'subway', grout: '#d8d6cf' },
  { id: 'wall-concrete-dark', name: 'Dark concrete', group: 'wall', color: '#6e6c68', roughness: 0.9, pattern: 'plain' },
  { id: 'wall-tile-navy', name: 'Navy tile', group: 'wall', color: '#4d6783', roughness: 0.25, pattern: 'subway', grout: '#d8d6cf' },
  // Floors
  { id: 'floor-wood-oak', name: 'Oak', group: 'floor', color: '#e6b57f', roughness: 0.52, pattern: 'wood' },
  { id: 'floor-wood-ash', name: 'Ash', group: 'floor', color: '#e3d3b8', roughness: 0.52, pattern: 'wood' },
  { id: 'floor-wood-walnut', name: 'Walnut', group: 'floor', color: '#a98467', roughness: 0.5, pattern: 'wood' },
  { id: 'floor-tile-white', name: 'White tile', group: 'floor', color: '#efeeea', roughness: 0.3, pattern: 'tile', grout: '#b9b6ae' },
  { id: 'floor-tile-grey', name: 'Grey tile', group: 'floor', color: '#a9a7a2', roughness: 0.35, pattern: 'tile', grout: '#7d7b76' },
  { id: 'floor-terrazzo', name: 'Terrazzo', group: 'floor', color: '#ffffff', roughness: 0.4, pattern: 'terrazzo' },
  { id: 'floor-carpet-grey', name: 'Grey carpet', group: 'floor', color: '#a3a19c', roughness: 1, pattern: 'carpet' },
  { id: 'floor-carpet-sand', name: 'Sand carpet', group: 'floor', color: '#cdbd9f', roughness: 1, pattern: 'carpet' },
  { id: 'floor-concrete', name: 'Concrete', group: 'floor', color: '#9c9a95', roughness: 0.85, pattern: 'plain' },
  { id: 'floor-wood-teak', name: 'Teak', group: 'floor', color: '#d79a5e', roughness: 0.5, pattern: 'wood' },
  { id: 'floor-wood-grey', name: 'Grey wood', group: 'floor', color: '#b9b6af', roughness: 0.55, pattern: 'wood' },
  { id: 'floor-tile-black', name: 'Black tile', group: 'floor', color: '#3b3a38', roughness: 0.3, pattern: 'tile', grout: '#2b2a28' },
  { id: 'floor-tile-beige', name: 'Beige tile', group: 'floor', color: '#d8c8aa', roughness: 0.35, pattern: 'tile', grout: '#b3a78f' },
  { id: 'floor-tile-rust', name: 'Rust tile', group: 'floor', color: '#c0735b', roughness: 0.4, pattern: 'tile', grout: '#9d5a47' },
  { id: 'floor-tile-blue', name: 'Blue tile', group: 'floor', color: '#7f9fb5', roughness: 0.3, pattern: 'tile', grout: '#d8d6cf' },
  { id: 'floor-carpet-blue', name: 'Blue carpet', group: 'floor', color: '#6c84a0', roughness: 1, pattern: 'carpet' },
  { id: 'floor-slab-dark', name: 'Dark slab', group: 'floor', color: '#6e6a64', roughness: 0.8, pattern: 'plain' },
  { id: 'floor-wood-cherry', name: 'Cherry', group: 'floor', color: '#b9714f', roughness: 0.5, pattern: 'wood' },
  { id: 'floor-wood-bamboo', name: 'Bamboo', group: 'floor', color: '#e4cc8e', roughness: 0.5, pattern: 'wood' },
  { id: 'floor-wood-white', name: 'Whitewash', group: 'floor', color: '#ece6da', roughness: 0.55, pattern: 'wood' },
  { id: 'floor-wood-ebony', name: 'Ebony', group: 'floor', color: '#4a3a30', roughness: 0.45, pattern: 'wood' },
  { id: 'floor-tile-sand', name: 'Sand tile', group: 'floor', color: '#d9c7a1', roughness: 0.35, pattern: 'tile', grout: '#b6a889' },
  { id: 'floor-tile-green', name: 'Green tile', group: 'floor', color: '#8fae95', roughness: 0.3, pattern: 'tile', grout: '#d8d6cf' },
  { id: 'floor-tile-cream', name: 'Cream tile', group: 'floor', color: '#efe4cc', roughness: 0.3, pattern: 'tile', grout: '#cbbf9f' },
  { id: 'floor-tile-terracotta', name: 'Terracotta tile', group: 'floor', color: '#bd6a47', roughness: 0.55, pattern: 'tile', grout: '#8f5338' },
  { id: 'floor-marble-black', name: 'Black marble', group: 'floor', color: '#3a3a3e', roughness: 0.2, pattern: 'plain' },
  { id: 'floor-marble-beige', name: 'Beige marble', group: 'floor', color: '#e0d2b8', roughness: 0.22, pattern: 'plain' },
  { id: 'floor-carpet-charcoal', name: 'Charcoal carpet', group: 'floor', color: '#55575a', roughness: 1, pattern: 'carpet' },
  { id: 'floor-carpet-red', name: 'Red carpet', group: 'floor', color: '#a64d4a', roughness: 1, pattern: 'carpet' },
  { id: 'floor-marble', name: 'Marble', group: 'floor', color: '#e8e6e0', roughness: 0.22, pattern: 'plain' },
  // Ground around the house
  { id: 'ground-grass', name: 'Grass', group: 'ground', color: '#9aa88a', roughness: 1, pattern: 'plain' },
  { id: 'ground-sand', name: 'Sand', group: 'ground', color: '#d9c9a3', roughness: 1, pattern: 'plain' },
  { id: 'ground-paving', name: 'Paving', group: 'ground', color: '#b8b4ab', roughness: 0.9, pattern: 'plain' },
  { id: 'ground-soil', name: 'Soil', group: 'ground', color: '#8a7560', roughness: 1, pattern: 'plain' },
  { id: 'ground-gravel', name: 'Gravel', group: 'ground', color: '#a39d93', roughness: 1, pattern: 'plain' },
  { id: 'ground-brick-paving', name: 'Brick paving', group: 'ground', color: '#a8654f', roughness: 0.9, pattern: 'plain' },
  { id: 'ground-lawn-dark', name: 'Dark lawn', group: 'ground', color: '#7f9370', roughness: 1, pattern: 'plain' },
  { id: 'ground-deck', name: 'Wood deck', group: 'ground', color: '#a5835b', roughness: 0.8, pattern: 'plain' },
  { id: 'ground-red-earth', name: 'Red earth', group: 'ground', color: '#a9684b', roughness: 1, pattern: 'plain' },
  { id: 'ground-lawn-light', name: 'Spring lawn', group: 'ground', color: '#a9bd86', roughness: 1, pattern: 'plain' },
  { id: 'ground-pebbles', name: 'Pebbles', group: 'ground', color: '#b4aea3', roughness: 1, pattern: 'plain' },
  { id: 'ground-cobble', name: 'Cobblestone', group: 'ground', color: '#9a968e', roughness: 0.95, pattern: 'plain' },
  { id: 'ground-concrete', name: 'Concrete slab', group: 'ground', color: '#b1afaa', roughness: 0.9, pattern: 'plain' },
  { id: 'ground-sand-red', name: 'Red sand', group: 'ground', color: '#c98f68', roughness: 1, pattern: 'plain' },
  { id: 'ground-mulch', name: 'Mulch', group: 'ground', color: '#6b4d38', roughness: 1, pattern: 'plain' },
  { id: 'ground-garden-tiles', name: 'Garden tiles', group: 'ground', color: '#bfae92', roughness: 0.85, pattern: 'plain' },
  { id: 'ground-play', name: 'Play surface', group: 'ground', color: '#a65a4f', roughness: 0.9, pattern: 'plain' },
  { id: 'ground-stone', name: 'Light stone', group: 'ground', color: '#d6d2c8', roughness: 1, pattern: 'plain' },
  // Roofs
  { id: 'roof-tile-terracotta', name: 'Terracotta', group: 'roof', color: '#b5593a', roughness: 0.8, pattern: 'plain' },
  { id: 'roof-tile-grey', name: 'Grey tile', group: 'roof', color: '#7d7f84', roughness: 0.75, pattern: 'plain' },
  { id: 'roof-slate', name: 'Slate', group: 'roof', color: '#3f4348', roughness: 0.7, pattern: 'plain' },
  { id: 'roof-metal', name: 'Metal sheet', group: 'roof', color: '#9aa3a8', roughness: 0.35, metalness: 0.5, pattern: 'plain' },
  { id: 'roof-sand', name: 'Sand tile', group: 'roof', color: '#c9a77e', roughness: 0.8, pattern: 'plain' },
  { id: 'roof-tile-brown', name: 'Brown tile', group: 'roof', color: '#7a4a35', roughness: 0.8, pattern: 'plain' },
  { id: 'roof-tile-black', name: 'Black tile', group: 'roof', color: '#2b2b2d', roughness: 0.7, pattern: 'plain' },
  { id: 'roof-thatch', name: 'Thatch', group: 'roof', color: '#b79b60', roughness: 1, pattern: 'plain' },
  { id: 'roof-concrete', name: 'Concrete slab', group: 'roof', color: '#9b9993', roughness: 0.9, pattern: 'plain' },
  { id: 'roof-seam', name: 'Standing seam', group: 'roof', color: '#5b6168', roughness: 0.35, metalness: 0.6, pattern: 'plain' },
  { id: 'roof-copper', name: 'Copper', group: 'roof', color: '#6aa08c', roughness: 0.4, metalness: 0.5, pattern: 'plain' },
  { id: 'roof-tile-red', name: 'Red clay tile', group: 'roof', color: '#a8442f', roughness: 0.8, pattern: 'plain' },
  { id: 'roof-tile-green', name: 'Green tile', group: 'roof', color: '#4f7a5b', roughness: 0.7, pattern: 'plain' },
  { id: 'roof-shingle-grey', name: 'Grey shingle', group: 'roof', color: '#6d7074', roughness: 0.85, pattern: 'plain' },
  { id: 'roof-shingle-brown', name: 'Brown shingle', group: 'roof', color: '#6b5444', roughness: 0.85, pattern: 'plain' },
  { id: 'roof-zinc', name: 'Zinc', group: 'roof', color: '#8d949a', roughness: 0.4, metalness: 0.6, pattern: 'plain' },
  { id: 'roof-asphalt', name: 'Flat asphalt', group: 'roof', color: '#4a4a4c', roughness: 0.95, pattern: 'plain' },
  { id: 'roof-white', name: 'White membrane', group: 'roof', color: '#e6e4de', roughness: 0.7, pattern: 'plain' },
  { id: 'roof-turf', name: 'Green roof', group: 'roof', color: '#7f9a62', roughness: 1, pattern: 'plain' },
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
