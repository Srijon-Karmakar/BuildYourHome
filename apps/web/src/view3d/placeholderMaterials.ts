/** Placeholder look-up (ADR-013). Real PBR materials arrive with the catalog (P1-04 / P1-12). */
export interface PlaceholderMaterial {
  color: string;
  roughness: number;
  metalness?: number;
}

const TABLE: Record<string, PlaceholderMaterial> = {
  'paint-white': { color: '#f2efe8', roughness: 0.9 },
  'floor-wood-oak': { color: '#b98a5b', roughness: 0.6 },
  'ground-grass': { color: '#9aa88a', roughness: 1 },
  'roof-tile-terracotta': { color: '#b5593a', roughness: 0.8 },
};

const FALLBACK: PlaceholderMaterial = { color: '#cccccc', roughness: 0.8 };

export function placeholderMaterial(id: string): PlaceholderMaterial {
  return TABLE[id] ?? FALLBACK;
}
