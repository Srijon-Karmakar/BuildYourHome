/**
 * Furniture & decor catalog (data only — no rendering, no Three.js).
 * Placeholder assets (ADR-013): each entry's 3D model is built in code by the web app from `id`; real
 * GLB models replace them later without touching scenes (ids are stable).
 *
 * Local frame of every item: origin at the centre of its floor footprint (ceiling items: at the ceiling,
 * wall items: at the back face centre at `mountHeight`), +x = width, +z = FRONT, +y up. Sizes in metres.
 */
export type AssetCategory = 'living' | 'bedroom' | 'dining' | 'bathroom' | 'office' | 'decor' | 'lighting' | 'plants';
export type AssetTier = 'free' | 'premium' | 'rewarded';
export type MountKind = 'floor' | 'wall' | 'ceiling';

export interface AssetColor {
  /** Hex colour used for the item's main material. */
  id: string;
  name: string;
}

export interface Asset {
  id: string;
  name: string;
  category: AssetCategory;
  tags: string[];
  /** [width (x), depth (z), height (y)] in metres. */
  size: [number, number, number];
  shape: 'rect' | 'round';
  mount: MountKind;
  /** Height of the item's origin above the floor for wall-mounted items. */
  mountHeight?: number;
  /** Blocks walking (large, tall furniture). Rugs, lights and wall decor do not. */
  solid: boolean;
  tier: AssetTier;
  /** Offered colours for the main material (first = default). */
  colors?: AssetColor[];
  placeholder: boolean;
}

export const CATEGORIES: Array<{ id: AssetCategory; name: string }> = [
  { id: 'living', name: 'Living' },
  { id: 'bedroom', name: 'Bedroom' },
  { id: 'dining', name: 'Kitchen & dining' },
  { id: 'bathroom', name: 'Bathroom' },
  { id: 'office', name: 'Office' },
  { id: 'decor', name: 'Decor' },
  { id: 'lighting', name: 'Lighting' },
  { id: 'plants', name: 'Plants' },
];

const FABRICS: AssetColor[] = [
  { id: '#9a9690', name: 'Stone grey' },
  { id: '#c9b79c', name: 'Sand' },
  { id: '#8f9f86', name: 'Sage' },
  { id: '#4d6783', name: 'Navy' },
  { id: '#b5604a', name: 'Terracotta' },
  { id: '#3b3a38', name: 'Charcoal' },
];
const WOODS: AssetColor[] = [
  { id: '#b98a5b', name: 'Oak' },
  { id: '#7a5238', name: 'Walnut' },
  { id: '#e3d3b8', name: 'Ash' },
  { id: '#2b2a28', name: 'Black' },
  { id: '#f1efea', name: 'White' },
];
const PAINTED: AssetColor[] = [
  { id: '#f1efea', name: 'White' },
  { id: '#c9c4b9', name: 'Stone' },
  { id: '#2b2a28', name: 'Black' },
  { id: '#8f9f86', name: 'Sage' },
];

type Spec = Omit<Asset, 'placeholder' | 'tier' | 'tags' | 'solid' | 'mount' | 'shape'> &
  Partial<Pick<Asset, 'tier' | 'tags' | 'solid' | 'mount' | 'shape'>>;

const a = (s: Spec): Asset => ({
  tier: 'free',
  tags: [],
  solid: true,
  mount: 'floor',
  shape: 'rect',
  placeholder: true,
  ...s,
});

export const CATALOG: readonly Asset[] = [
  // Living
  a({ id: 'sofa-2', name: 'Sofa, 2-seat', category: 'living', size: [1.6, 0.9, 0.82], colors: FABRICS, tags: ['couch', 'seat'] }),
  a({ id: 'sofa-3', name: 'Sofa, 3-seat', category: 'living', size: [2.2, 0.95, 0.82], colors: FABRICS, tags: ['couch', 'seat'] }),
  a({ id: 'armchair', name: 'Armchair', category: 'living', size: [0.85, 0.85, 0.85], colors: FABRICS, tier: 'rewarded', tags: ['seat', 'chair'] }),
  a({ id: 'coffee-table', name: 'Coffee table', category: 'living', size: [1.1, 0.6, 0.4], colors: WOODS, solid: false, tags: ['table'] }),
  a({ id: 'coffee-table-round', name: 'Round coffee table', category: 'living', size: [0.9, 0.9, 0.4], shape: 'round', colors: WOODS, solid: false, tags: ['table'] }),
  a({ id: 'tv-unit', name: 'TV unit', category: 'living', size: [1.6, 0.42, 1.0], colors: WOODS, tags: ['tv', 'storage', 'television'] }),
  a({ id: 'bookshelf', name: 'Bookshelf', category: 'living', size: [0.9, 0.35, 1.9], colors: WOODS, tags: ['storage', 'books', 'shelf'] }),
  a({ id: 'side-table', name: 'Side table', category: 'living', size: [0.45, 0.45, 0.5], shape: 'round', colors: WOODS, solid: false, tags: ['table'] }),
  a({ id: 'rug', name: 'Rug', category: 'living', size: [2.2, 1.5, 0.015], colors: FABRICS, solid: false, tags: ['carpet'] }),
  // Bedroom
  a({ id: 'bed-double', name: 'Double bed', category: 'bedroom', size: [1.65, 2.15, 1.0], colors: FABRICS, tier: 'premium', tags: ['sleep'] }),
  a({ id: 'bed-single', name: 'Single bed', category: 'bedroom', size: [0.98, 2.05, 0.85], colors: FABRICS, tags: ['sleep'] }),
  a({ id: 'wardrobe', name: 'Wardrobe', category: 'bedroom', size: [1.2, 0.6, 2.1], colors: PAINTED, tags: ['storage', 'closet'] }),
  a({ id: 'nightstand', name: 'Bedside table', category: 'bedroom', size: [0.45, 0.4, 0.5], colors: WOODS, tags: ['table'] }),
  a({ id: 'dresser', name: 'Dresser', category: 'bedroom', size: [1.1, 0.5, 0.85], colors: WOODS, tags: ['storage', 'drawers'] }),
  // Kitchen & dining
  a({ id: 'dining-table', name: 'Dining table', category: 'dining', size: [1.6, 0.9, 0.75], colors: WOODS, tags: ['table', 'eat'] }),
  a({ id: 'dining-chair', name: 'Dining chair', category: 'dining', size: [0.45, 0.5, 0.9], colors: WOODS, solid: false, tags: ['seat', 'chair'] }),
  a({ id: 'bar-stool', name: 'Bar stool', category: 'dining', size: [0.4, 0.4, 0.75], shape: 'round', colors: WOODS, solid: false, tags: ['seat'] }),
  a({ id: 'kitchen-base', name: 'Kitchen cabinet', category: 'dining', size: [0.6, 0.6, 0.9], colors: PAINTED, tags: ['counter', 'storage'] }),
  a({ id: 'kitchen-sink', name: 'Kitchen sink unit', category: 'dining', size: [1.2, 0.6, 0.9], colors: PAINTED, tags: ['counter', 'water'] }),
  a({ id: 'stove', name: 'Stove', category: 'dining', size: [0.6, 0.6, 0.9], tags: ['cooker', 'oven', 'hob'] }),
  a({ id: 'fridge', name: 'Fridge', category: 'dining', size: [0.7, 0.7, 1.8], tags: ['refrigerator'] }),
  // Bathroom
  a({ id: 'toilet', name: 'Toilet', category: 'bathroom', size: [0.4, 0.7, 0.8], tags: ['wc'] }),
  a({ id: 'washbasin', name: 'Washbasin', category: 'bathroom', size: [0.6, 0.45, 0.85], tags: ['sink'] }),
  a({ id: 'bathtub', name: 'Bathtub', category: 'bathroom', size: [1.7, 0.75, 0.55], tier: 'premium', tags: ['bath'] }),
  a({ id: 'shower', name: 'Shower', category: 'bathroom', size: [0.9, 0.9, 2.0], tags: ['bath', 'wash'] }),
  // Office
  a({ id: 'desk', name: 'Desk', category: 'office', size: [1.4, 0.7, 0.75], colors: WOODS, tags: ['table', 'work'] }),
  a({ id: 'office-chair', name: 'Office chair', category: 'office', size: [0.6, 0.6, 1.0], shape: 'round', colors: FABRICS, solid: false, tags: ['seat', 'work'] }),
  // Decor
  a({ id: 'wall-art', name: 'Wall art', category: 'decor', size: [0.8, 0.04, 0.6], mount: 'wall', mountHeight: 1.6, solid: false, tags: ['picture', 'frame'] }),
  a({ id: 'mirror', name: 'Mirror', category: 'decor', size: [0.6, 0.04, 1.2], mount: 'wall', mountHeight: 1.1, solid: false, tags: ['glass'] }),
  // Lighting
  a({ id: 'floor-lamp', name: 'Floor lamp', category: 'lighting', size: [0.35, 0.35, 1.6], shape: 'round', tier: 'rewarded', solid: false, tags: ['light'] }),
  a({ id: 'ceiling-light', name: 'Ceiling light', category: 'lighting', size: [0.5, 0.5, 0.1], shape: 'round', mount: 'ceiling', solid: false, tags: ['light'] }),
  a({ id: 'pendant', name: 'Pendant light', category: 'lighting', size: [0.4, 0.4, 0.8], shape: 'round', mount: 'ceiling', tier: 'premium', solid: false, tags: ['light', 'lamp'] }),
  // Plants
  a({ id: 'plant-small', name: 'Potted plant', category: 'plants', size: [0.3, 0.3, 0.5], shape: 'round', solid: false, tags: ['green'] }),
  a({ id: 'plant-tall', name: 'Tall plant', category: 'plants', size: [0.5, 0.5, 1.4], shape: 'round', tier: 'premium', solid: false, tags: ['green', 'tree'] }),
];

const BY_ID = new Map(CATALOG.map((x) => [x.id, x]));

export const getAsset = (id: string): Asset | undefined => BY_ID.get(id);

/** Case-insensitive search over name, tags and category name; optionally limited to one category. */
export function searchCatalog(query: string, category?: AssetCategory | 'all'): Asset[] {
  const q = query.trim().toLowerCase();
  const catName = new Map(CATEGORIES.map((c) => [c.id, c.name.toLowerCase()]));
  return CATALOG.filter((x) => {
    if (category && category !== 'all' && x.category !== category) return false;
    if (!q) return true;
    return [x.name, ...x.tags, catName.get(x.category) ?? ''].some((t) => t.toLowerCase().includes(q));
  });
}
