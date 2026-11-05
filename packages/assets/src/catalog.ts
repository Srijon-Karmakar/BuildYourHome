/**
 * Furniture & decor catalog (data only — no rendering, no Three.js).
 * Placeholder assets (ADR-013): each entry's 3D model is built in code by the web app from `id`; real
 * GLB models replace them later without touching scenes (ids are stable).
 *
 * Local frame of every item: origin at the centre of its floor footprint (ceiling items: at the ceiling,
 * wall items: at the back face centre at `mountHeight`), +x = width, +z = FRONT, +y up. Sizes in metres.
 */
export type AssetCategory = 'living' | 'bedroom' | 'dining' | 'bathroom' | 'office' | 'decor' | 'lighting' | 'plants' | 'outdoor';
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
  { id: 'outdoor', name: 'Outdoor & garden' },
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

const CAR_PAINTS: AssetColor[] = [
  { id: '#e8e8e6', name: 'White' },
  { id: '#b23a34', name: 'Red' },
  { id: '#3f5f86', name: 'Blue' },
  { id: '#2b2a28', name: 'Black' },
  { id: '#a9acb0', name: 'Silver' },
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

  // ---- More living
  a({ id: 'sofa-l', name: 'Corner sofa', category: 'living', size: [2.6, 1.7, 0.82], colors: FABRICS, tier: 'premium', tags: ['couch', 'seat', 'sectional', 'l-shaped'] }),
  a({ id: 'ottoman', name: 'Ottoman', category: 'living', size: [0.6, 0.6, 0.4], shape: 'round', colors: FABRICS, solid: false, tags: ['pouf', 'footstool', 'seat'] }),
  a({ id: 'console-table', name: 'Console table', category: 'living', size: [1.2, 0.35, 0.8], colors: WOODS, tags: ['table', 'hall', 'entry'] }),
  a({ id: 'display-cabinet', name: 'Display cabinet', category: 'living', size: [1.0, 0.4, 1.9], colors: WOODS, tags: ['storage', 'glass', 'crockery'] }),
  a({ id: 'bean-bag', name: 'Bean bag', category: 'living', size: [0.9, 0.9, 0.7], shape: 'round', colors: FABRICS, tier: 'rewarded', solid: false, tags: ['seat', 'chair'] }),
  a({ id: 'shoe-rack', name: 'Shoe rack', category: 'living', size: [0.8, 0.3, 0.55], colors: WOODS, tags: ['storage', 'entry', 'footwear'] }),
  a({ id: 'pooja-mandir', name: 'Pooja unit (mandir)', category: 'living', size: [0.9, 0.4, 1.7], colors: WOODS, tags: ['temple', 'mandir', 'puja', 'prayer', 'altar'] }),
  a({ id: 'swing-jhula', name: 'Swing seat (jhula)', category: 'living', size: [1.6, 0.8, 1.9], colors: WOODS, tier: 'premium', tags: ['jhula', 'swing', 'seat'] }),
  // ---- More bedroom
  a({ id: 'bed-king', name: 'King bed', category: 'bedroom', size: [1.9, 2.15, 1.05], colors: FABRICS, tier: 'premium', tags: ['sleep'] }),
  a({ id: 'bunk-bed', name: 'Bunk bed', category: 'bedroom', size: [1.0, 2.1, 1.7], colors: WOODS, tags: ['sleep', 'kids'] }),
  a({ id: 'crib', name: 'Baby crib', category: 'bedroom', size: [0.7, 1.25, 0.95], colors: WOODS, tier: 'rewarded', tags: ['baby', 'kids', 'cot'] }),
  a({ id: 'vanity', name: 'Dressing table', category: 'bedroom', size: [1.1, 0.45, 1.5], colors: WOODS, tags: ['mirror', 'table', 'makeup'] }),
  a({ id: 'bed-bench', name: 'Bed bench', category: 'bedroom', size: [1.2, 0.4, 0.45], colors: FABRICS, solid: false, tags: ['seat', 'ottoman'] }),
  // ---- More kitchen & dining
  a({ id: 'kitchen-tall', name: 'Tall cabinet', category: 'dining', size: [0.6, 0.6, 2.1], colors: PAINTED, tags: ['storage', 'pantry'] }),
  a({ id: 'kitchen-wall', name: 'Wall cabinet', category: 'dining', size: [0.6, 0.35, 0.7], mount: 'wall', mountHeight: 1.6, solid: false, colors: PAINTED, tags: ['storage', 'upper'] }),
  a({ id: 'kitchen-island', name: 'Kitchen island', category: 'dining', size: [1.6, 0.8, 0.92], colors: PAINTED, tier: 'premium', tags: ['counter', 'breakfast'] }),
  a({ id: 'cooker-hood', name: 'Cooker hood', category: 'dining', size: [0.6, 0.5, 0.8], mount: 'wall', mountHeight: 2.0, solid: false, tags: ['chimney', 'extractor'] }),
  a({ id: 'dishwasher', name: 'Dishwasher', category: 'dining', size: [0.6, 0.6, 0.85], tags: ['appliance'] }),
  a({ id: 'washing-machine', name: 'Washing machine', category: 'dining', size: [0.6, 0.6, 0.85], tags: ['appliance', 'laundry'] }),
  a({ id: 'dining-table-round', name: 'Round dining table', category: 'dining', size: [1.2, 1.2, 0.75], shape: 'round', colors: WOODS, tags: ['table', 'eat'] }),
  // ---- More bathroom
  a({ id: 'vanity-unit', name: 'Vanity unit', category: 'bathroom', size: [1.0, 0.5, 0.85], colors: PAINTED, tags: ['sink', 'basin', 'cabinet'] }),
  a({ id: 'towel-rail', name: 'Towel rail', category: 'bathroom', size: [0.5, 0.1, 0.8], mount: 'wall', mountHeight: 1.1, solid: false, tags: ['towel'] }),
  a({ id: 'mirror-cabinet', name: 'Mirror cabinet', category: 'bathroom', size: [0.6, 0.15, 0.7], mount: 'wall', mountHeight: 1.5, solid: false, tags: ['storage', 'mirror'] }),
  a({ id: 'laundry-basket', name: 'Laundry basket', category: 'bathroom', size: [0.4, 0.4, 0.6], shape: 'round', solid: false, tags: ['hamper'] }),
  // ---- More office
  a({ id: 'filing-cabinet', name: 'Filing cabinet', category: 'office', size: [0.45, 0.6, 0.7], colors: PAINTED, tags: ['storage', 'drawers'] }),
  a({ id: 'desk-l', name: 'Corner desk', category: 'office', size: [1.6, 1.5, 0.75], colors: WOODS, tier: 'premium', tags: ['table', 'work', 'l-shaped'] }),
  a({ id: 'whiteboard', name: 'Whiteboard', category: 'office', size: [1.2, 0.03, 0.9], mount: 'wall', mountHeight: 1.5, solid: false, tags: ['board', 'work'] }),
  a({ id: 'bookcase-low', name: 'Low bookcase', category: 'office', size: [1.2, 0.3, 0.8], colors: WOODS, tags: ['storage', 'books', 'shelf'] }),
  // ---- More decor
  a({ id: 'curtain', name: 'Curtain', category: 'decor', size: [1.6, 0.15, 2.3], mount: 'wall', mountHeight: 1.2, solid: false, colors: FABRICS, tags: ['drape', 'window'] }),
  a({ id: 'wall-clock', name: 'Wall clock', category: 'decor', size: [0.35, 0.05, 0.35], mount: 'wall', mountHeight: 2.0, solid: false, tags: ['time'] }),
  a({ id: 'wall-shelf', name: 'Wall shelf', category: 'decor', size: [0.9, 0.22, 0.05], mount: 'wall', mountHeight: 1.5, solid: false, colors: WOODS, tags: ['storage'] }),
  a({ id: 'vase', name: 'Vase with flowers', category: 'decor', size: [0.2, 0.2, 0.4], shape: 'round', solid: false, tags: ['flowers'] }),
  a({ id: 'rug-round', name: 'Round rug', category: 'decor', size: [1.6, 1.6, 0.015], shape: 'round', colors: FABRICS, solid: false, tags: ['carpet'] }),
  a({ id: 'painting-large', name: 'Large painting', category: 'decor', size: [1.2, 0.04, 0.9], mount: 'wall', mountHeight: 1.6, solid: false, tags: ['picture', 'frame', 'art'] }),
  a({ id: 'fireplace', name: 'Fireplace', category: 'decor', size: [1.4, 0.4, 1.1], tier: 'premium', tags: ['hearth', 'mantel'] }),
  // ---- More lighting
  a({ id: 'table-lamp', name: 'Table lamp', category: 'lighting', size: [0.3, 0.3, 0.5], shape: 'round', solid: false, tags: ['light', 'lamp'] }),
  a({ id: 'chandelier', name: 'Chandelier', category: 'lighting', size: [0.8, 0.8, 0.7], shape: 'round', mount: 'ceiling', tier: 'premium', solid: false, tags: ['light'] }),
  a({ id: 'wall-sconce', name: 'Wall light', category: 'lighting', size: [0.15, 0.15, 0.3], mount: 'wall', mountHeight: 1.7, solid: false, tags: ['light', 'sconce'] }),
  a({ id: 'ceiling-fan', name: 'Ceiling fan', category: 'lighting', size: [1.1, 1.1, 0.35], shape: 'round', mount: 'ceiling', solid: false, tags: ['fan', 'cooling'] }),
  a({ id: 'arc-lamp', name: 'Arc floor lamp', category: 'lighting', size: [1.0, 0.4, 2.0], tier: 'rewarded', solid: false, tags: ['light', 'lamp'] }),
  // ---- More plants
  a({ id: 'succulent', name: 'Succulent', category: 'plants', size: [0.2, 0.2, 0.2], shape: 'round', solid: false, tags: ['green', 'desk'] }),
  a({ id: 'palm-indoor', name: 'Palm in pot', category: 'plants', size: [0.9, 0.9, 1.8], shape: 'round', tier: 'premium', solid: false, tags: ['green', 'tree'] }),
  a({ id: 'bonsai', name: 'Bonsai', category: 'plants', size: [0.4, 0.4, 0.45], shape: 'round', solid: false, tags: ['green', 'tree'] }),
  a({ id: 'cactus', name: 'Cactus', category: 'plants', size: [0.3, 0.3, 0.7], shape: 'round', solid: false, tags: ['green', 'desert'] }),
  a({ id: 'tulsi', name: 'Tulsi planter', category: 'plants', size: [0.5, 0.5, 0.95], shape: 'round', solid: false, tags: ['holy basil', 'vrindavan', 'green'] }),
  // ---- Outdoor & garden
  a({ id: 'tree-round', name: 'Shade tree', category: 'outdoor', size: [3.0, 3.0, 4.5], shape: 'round', solid: false, tags: ['tree', 'green', 'garden'] }),
  a({ id: 'tree-pine', name: 'Pine tree', category: 'outdoor', size: [2.0, 2.0, 5.0], shape: 'round', solid: false, tags: ['tree', 'green', 'conifer'] }),
  a({ id: 'tree-palm', name: 'Coconut palm', category: 'outdoor', size: [2.6, 2.6, 5.5], shape: 'round', solid: false, tier: 'premium', tags: ['tree', 'green', 'tropical'] }),
  a({ id: 'bush', name: 'Bush', category: 'outdoor', size: [1.0, 1.0, 0.8], shape: 'round', solid: false, tags: ['shrub', 'green', 'garden'] }),
  a({ id: 'hedge', name: 'Hedge', category: 'outdoor', size: [2.0, 0.6, 1.2], solid: false, tags: ['green', 'garden', 'boundary'] }),
  a({ id: 'flower-bed', name: 'Flower bed', category: 'outdoor', size: [1.5, 0.6, 0.35], solid: false, tags: ['flowers', 'garden'] }),
  a({ id: 'garden-bench', name: 'Garden bench', category: 'outdoor', size: [1.5, 0.55, 0.85], colors: WOODS, tags: ['seat'] }),
  a({ id: 'patio-table', name: 'Patio table', category: 'outdoor', size: [1.0, 1.0, 0.75], shape: 'round', colors: WOODS, solid: false, tags: ['table', 'terrace'] }),
  a({ id: 'patio-chair', name: 'Patio chair', category: 'outdoor', size: [0.55, 0.6, 0.85], colors: WOODS, solid: false, tags: ['seat', 'terrace'] }),
  a({ id: 'patio-umbrella', name: 'Patio umbrella', category: 'outdoor', size: [2.4, 2.4, 2.4], shape: 'round', colors: FABRICS, solid: false, tier: 'rewarded', tags: ['shade', 'terrace'] }),
  a({ id: 'sun-lounger', name: 'Sun lounger', category: 'outdoor', size: [0.7, 2.0, 0.6], colors: WOODS, tier: 'premium', solid: false, tags: ['seat', 'pool'] }),
  a({ id: 'bbq-grill', name: 'Barbecue grill', category: 'outdoor', size: [0.9, 0.55, 1.05], tags: ['cooking', 'tandoor'] }),
  a({ id: 'pool', name: 'Swimming pool', category: 'outdoor', size: [3.0, 6.0, 0.12], tier: 'premium', solid: false, tags: ['water', 'swim'] }),
  a({ id: 'fountain', name: 'Fountain', category: 'outdoor', size: [1.2, 1.2, 1.1], shape: 'round', tier: 'premium', tags: ['water', 'garden'] }),
  a({ id: 'car', name: 'Car', category: 'outdoor', size: [1.8, 4.2, 1.5], colors: CAR_PAINTS, tier: 'rewarded', tags: ['vehicle', 'parking', 'garage'] }),
  a({ id: 'bicycle', name: 'Bicycle', category: 'outdoor', size: [0.6, 1.7, 1.0], solid: false, tags: ['cycle', 'vehicle'] }),
  a({ id: 'lamp-post', name: 'Garden lamp post', category: 'outdoor', size: [0.3, 0.3, 3.0], shape: 'round', solid: false, tags: ['light', 'street'] }),
  a({ id: 'garden-gate', name: 'Garden gate', category: 'outdoor', size: [1.2, 0.1, 1.2], solid: false, tags: ['entrance', 'fence'] }),
  a({ id: 'fence-section', name: 'Fence section', category: 'outdoor', size: [2.0, 0.08, 1.2], colors: WOODS, tags: ['boundary', 'garden'] }),
  a({ id: 'planter-box', name: 'Planter box', category: 'outdoor', size: [1.0, 0.4, 0.5], solid: false, tags: ['flowers', 'garden'] }),
  a({ id: 'water-tank', name: 'Water tank', category: 'outdoor', size: [1.2, 1.2, 1.4], shape: 'round', tags: ['sintex', 'storage', 'terrace'] }),
  a({ id: 'stepping-stones', name: 'Stepping stones', category: 'outdoor', size: [0.5, 2.0, 0.05], solid: false, tags: ['path', 'garden'] }),
  a({ id: 'dustbin', name: 'Dustbin', category: 'outdoor', size: [0.4, 0.4, 0.8], shape: 'round', solid: false, tags: ['trash', 'waste'] }),
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
