/**
 * Furniture & decor catalog (data only — no rendering, no Three.js).
 * Placeholder assets (ADR-013): each entry's 3D model is built in code by the web app from `id`; real
 * GLB models replace them later without touching scenes (ids are stable).
 *
 * Local frame of every item: origin at the centre of its floor footprint (ceiling items: at the ceiling,
 * wall items: at the back face centre at `mountHeight`), +x = width, +z = FRONT, +y up. Sizes in metres.
 */
export type AssetCategory = 'living' | 'bedroom' | 'dining' | 'bathroom' | 'office' | 'decor' | 'lighting' | 'plants' | 'outdoor' | 'appliances' | 'kids' | 'nature' | 'scenery';
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
  { id: 'kids', name: 'Kids' },
  { id: 'appliances', name: 'Appliances' },
  { id: 'outdoor', name: 'Outdoor & garden' },
  { id: 'nature', name: 'Trees & nature' },
  { id: 'scenery', name: 'Scenery' },
];

const FABRICS: AssetColor[] = [
  { id: '#9a9690', name: 'Stone grey' },
  { id: '#c9b79c', name: 'Sand' },
  { id: '#8f9f86', name: 'Sage' },
  { id: '#4d6783', name: 'Navy' },
  { id: '#b5604a', name: 'Terracotta' },
  { id: '#3b3a38', name: 'Charcoal' },
];
/** Foliage looks for trees: the first is the tree's own colour, the rest tint it (see view3d/furniture/trees.ts). */
export const TREE_SEASONS: AssetColor[] = [
  { id: '#3f7a3a', name: 'Natural' },
  { id: '#6aa63c', name: 'Spring green' },
  { id: '#2f6a3a', name: 'Deep green' },
  { id: '#c98a2b', name: 'Autumn gold' },
  { id: '#b5502c', name: 'Autumn red' },
  { id: '#f0b4c8', name: 'Blossom pink' },
  { id: '#b9c8bf', name: 'Winter frost' },
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

/** Wall colours for neighbouring buildings. The first keeps each model's own colour (builders test for it). */
export const BUILDING_COLORS: AssetColor[] = [
  { id: '#e7dfcf', name: 'As designed' },
  { id: '#f1efea', name: 'White' },
  { id: '#efe3c4', name: 'Cream' },
  { id: '#e6c86a', name: 'Yellow' },
  { id: '#d9a58a', name: 'Peach' },
  { id: '#c4604a', name: 'Brick red' },
  { id: '#b7cbd9', name: 'Sky blue' },
  { id: '#b4c2a4', name: 'Sage green' },
  { id: '#b9bcbf', name: 'Grey' },
];
const CLOTHES: AssetColor[] = [
  { id: '#3f5f86', name: 'Blue' },
  { id: '#b23a34', name: 'Red' },
  { id: '#e0b81a', name: 'Yellow' },
  { id: '#4a7a52', name: 'Green' },
  { id: '#f1efea', name: 'White' },
  { id: '#7a4a86', name: 'Purple' },
];
const TAXI_PAINTS: AssetColor[] = [
  { id: '#e0b81a', name: 'Yellow' },
  { id: '#2f7a4a', name: 'Green' },
  { id: '#2b2a28', name: 'Black' },
  { id: '#3f5f86', name: 'Blue' },
];
const BUS_PAINTS: AssetColor[] = [
  { id: '#c0392b', name: 'Red' },
  { id: '#2f6f8f', name: 'Blue' },
  { id: '#e0a43a', name: 'Orange' },
  { id: '#4a7a52', name: 'Green' },
  { id: '#e8e8e6', name: 'White' },
];
const SIGN_COLORS: AssetColor[] = [
  { id: '#2f6f8f', name: 'Blue' },
  { id: '#c0392b', name: 'Red' },
  { id: '#2f7a4a', name: 'Green' },
  { id: '#e0a43a', name: 'Amber' },
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
  a({ id: 'tree-round', name: 'Shade tree', category: 'outdoor', size: [3.0, 3.0, 4.5], shape: 'round', solid: false, tags: ['tree', 'green', 'garden'], colors: TREE_SEASONS }),
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

  // ---- Batch 3 · living
  a({ id: 'diwan', name: 'Diwan', category: 'living', size: [1.9, 0.9, 0.75], colors: FABRICS, tags: ['daybed', 'divan', 'settee', 'seat'] }),
  a({ id: 'recliner', name: 'Recliner', category: 'living', size: [0.9, 0.95, 1.0], colors: FABRICS, tier: 'premium', tags: ['seat', 'chair', 'armchair'] }),
  a({ id: 'chaise', name: 'Chaise longue', category: 'living', size: [0.8, 1.7, 0.8], colors: FABRICS, tags: ['seat', 'lounge'] }),
  a({ id: 'glass-table', name: 'Glass coffee table', category: 'living', size: [1.2, 0.65, 0.42], solid: false, tags: ['table', 'centre table'] }),
  a({ id: 'sideboard', name: 'Sideboard', category: 'living', size: [1.8, 0.45, 0.8], colors: WOODS, tags: ['storage', 'buffet', 'credenza'] }),
  a({ id: 'room-divider', name: 'Room divider', category: 'living', size: [1.6, 0.06, 1.8], colors: WOODS, tags: ['screen', 'partition', 'jaali'] }),
  a({ id: 'bar-cabinet', name: 'Bar cabinet', category: 'living', size: [1.0, 0.45, 1.5], colors: WOODS, tier: 'rewarded', tags: ['storage', 'drinks', 'liquor'] }),
  a({ id: 'piano', name: 'Upright piano', category: 'living', size: [1.5, 0.65, 1.25], tier: 'premium', tags: ['music', 'keyboard'] }),
  a({ id: 'floor-cushion', name: 'Floor cushion', category: 'living', size: [0.6, 0.6, 0.15], colors: FABRICS, solid: false, tags: ['seat', 'pillow', 'gaddi'] }),
  // ---- Batch 3 · bedroom
  a({ id: 'wardrobe-sliding', name: 'Sliding wardrobe', category: 'bedroom', size: [2.0, 0.62, 2.2], colors: PAINTED, tags: ['storage', 'closet', 'almirah'] }),
  a({ id: 'kids-bed', name: 'Kids bed', category: 'bedroom', size: [0.95, 1.9, 0.75], colors: WOODS, tags: ['sleep', 'children'] }),
  a({ id: 'toy-box', name: 'Toy box', category: 'bedroom', size: [0.8, 0.45, 0.45], colors: WOODS, solid: false, tags: ['storage', 'kids'] }),
  a({ id: 'rocking-chair', name: 'Rocking chair', category: 'bedroom', size: [0.65, 0.9, 1.0], colors: WOODS, solid: false, tags: ['seat', 'chair'] }),
  // ---- Batch 3 · kitchen & dining
  a({ id: 'dining-bench', name: 'Dining bench', category: 'dining', size: [1.4, 0.35, 0.46], colors: WOODS, solid: false, tags: ['seat'] }),
  a({ id: 'bar-counter', name: 'Bar counter', category: 'dining', size: [1.8, 0.55, 1.1], colors: PAINTED, tier: 'premium', tags: ['breakfast', 'counter'] }),
  a({ id: 'crockery-unit', name: 'Crockery unit', category: 'dining', size: [1.2, 0.4, 1.9], colors: WOODS, tags: ['storage', 'display', 'cabinet'] }),
  a({ id: 'wine-rack', name: 'Wine rack', category: 'dining', size: [0.6, 0.3, 1.0], colors: WOODS, tags: ['storage', 'bottles'] }),
  a({ id: 'kitchen-shelf', name: 'Open kitchen shelf', category: 'dining', size: [1.0, 0.25, 0.5], mount: 'wall', mountHeight: 1.5, solid: false, colors: WOODS, tags: ['storage', 'spice rack'] }),
  // ---- Batch 3 · bathroom
  a({ id: 'bathtub-free', name: 'Freestanding bathtub', category: 'bathroom', size: [1.6, 0.8, 0.62], tier: 'premium', tags: ['bath', 'tub'] }),
  a({ id: 'shower-glass', name: 'Glass shower cabin', category: 'bathroom', size: [1.0, 1.0, 2.1], tags: ['bath', 'wash', 'enclosure'] }),
  a({ id: 'bidet', name: 'Bidet', category: 'bathroom', size: [0.38, 0.6, 0.4], tags: ['wc', 'health faucet'] }),
  a({ id: 'pedestal-basin', name: 'Pedestal basin', category: 'bathroom', size: [0.55, 0.45, 0.85], tags: ['sink', 'wash'] }),
  a({ id: 'bath-shelf', name: 'Bathroom shelf', category: 'bathroom', size: [0.6, 0.15, 0.4], mount: 'wall', mountHeight: 1.3, solid: false, tags: ['storage', 'towel'] }),
  // ---- Batch 3 · office
  a({ id: 'meeting-table', name: 'Meeting table', category: 'office', size: [2.4, 1.1, 0.75], colors: WOODS, tags: ['table', 'conference'] }),
  a({ id: 'reception-desk', name: 'Reception desk', category: 'office', size: [2.0, 0.8, 1.1], colors: PAINTED, tier: 'premium', tags: ['counter', 'front desk'] }),
  a({ id: 'office-sofa', name: 'Office sofa', category: 'office', size: [1.7, 0.8, 0.8], colors: FABRICS, tags: ['seat', 'couch', 'lounge'] }),
  a({ id: 'lockers', name: 'Lockers', category: 'office', size: [0.9, 0.45, 1.8], colors: PAINTED, tags: ['storage', 'cabinet'] }),
  // ---- Batch 3 · decor
  a({ id: 'round-mirror', name: 'Round mirror', category: 'decor', size: [0.7, 0.04, 0.7], mount: 'wall', mountHeight: 1.5, solid: false, tags: ['glass'] }),
  a({ id: 'floor-mirror', name: 'Standing mirror', category: 'decor', size: [0.6, 0.35, 1.7], solid: false, colors: WOODS, tags: ['glass', 'cheval'] }),
  a({ id: 'grandfather-clock', name: 'Grandfather clock', category: 'decor', size: [0.5, 0.3, 2.0], tags: ['time', 'pendulum'] }),
  a({ id: 'rangoli', name: 'Rangoli', category: 'decor', size: [1.0, 1.0, 0.012], shape: 'round', solid: false, tags: ['kolam', 'floor art', 'diwali'] }),
  a({ id: 'door-mat', name: 'Door mat', category: 'decor', size: [0.7, 0.45, 0.02], solid: false, tags: ['entry', 'doormat'] }),
  a({ id: 'art-triptych', name: 'Art triptych', category: 'decor', size: [1.5, 0.04, 0.6], mount: 'wall', mountHeight: 1.6, solid: false, tags: ['picture', 'frame', 'wall art'] }),
  a({ id: 'sculpture', name: 'Sculpture', category: 'decor', size: [0.4, 0.4, 1.0], shape: 'round', tier: 'rewarded', tags: ['statue', 'art'] }),
  a({ id: 'book-stack', name: 'Stack of books', category: 'decor', size: [0.3, 0.22, 0.18], solid: false, tags: ['books'] }),
  // ---- Batch 3 · lighting
  a({ id: 'lantern', name: 'Floor lantern', category: 'lighting', size: [0.32, 0.32, 0.55], shape: 'round', solid: false, tags: ['light', 'diya', 'lamp'] }),
  a({ id: 'track-light', name: 'Track light', category: 'lighting', size: [1.2, 0.12, 0.15], mount: 'ceiling', solid: false, tags: ['light', 'spot'] }),
  a({ id: 'uplight', name: 'Floor uplighter', category: 'lighting', size: [0.3, 0.3, 1.7], shape: 'round', solid: false, tags: ['light', 'lamp'] }),
  // ---- Lighting fittings (realistic lights: each one really lights the room)
  a({ id: 'downlight', name: 'Recessed downlight', category: 'lighting', size: [0.14, 0.14, 0.04], shape: 'round', mount: 'ceiling', solid: false, tags: ['light', 'spot', 'led', 'recessed'] }),
  a({ id: 'led-panel', name: 'LED panel', category: 'lighting', size: [0.6, 0.6, 0.04], mount: 'ceiling', solid: false, tags: ['light', 'office', 'led', 'flat'] }),
  a({ id: 'pendant-cluster', name: 'Pendant cluster', category: 'lighting', size: [0.7, 0.7, 1.0], shape: 'round', mount: 'ceiling', tier: 'premium', solid: false, tags: ['light', 'lamp', 'hanging'] }),
  a({ id: 'pendant-linear', name: 'Linear pendant', category: 'lighting', size: [1.4, 0.16, 0.9], mount: 'ceiling', tier: 'premium', solid: false, tags: ['light', 'dining', 'hanging', 'bar'] }),
  a({ id: 'pendant-globe', name: 'Globe pendant', category: 'lighting', size: [0.35, 0.35, 0.8], shape: 'round', mount: 'ceiling', tier: 'rewarded', solid: false, tags: ['light', 'lamp', 'hanging', 'opal'] }),
  a({ id: 'cove-light', name: 'Cove light strip', category: 'lighting', size: [2.0, 0.12, 0.1], mount: 'wall', mountHeight: 2.6, tier: 'premium', solid: false, tags: ['light', 'led', 'indirect', 'false ceiling'] }),
  a({ id: 'strip-light', name: 'Under-cabinet light', category: 'lighting', size: [1.0, 0.04, 0.04], mount: 'wall', mountHeight: 1.45, solid: false, tags: ['light', 'led', 'kitchen'] }),
  a({ id: 'picture-light', name: 'Picture light', category: 'lighting', size: [0.5, 0.14, 0.12], mount: 'wall', mountHeight: 2.0, tier: 'rewarded', solid: false, tags: ['light', 'art', 'brass'] }),
  a({ id: 'desk-lamp', name: 'Desk lamp', category: 'lighting', size: [0.3, 0.3, 0.45], shape: 'round', solid: false, tags: ['light', 'lamp', 'study', 'office'] }),
  a({ id: 'bollard-light', name: 'Garden bollard light', category: 'lighting', size: [0.2, 0.2, 0.7], shape: 'round', solid: false, tags: ['light', 'garden', 'outdoor', 'path'] }),
  // ---- Batch 3 · plants
  a({ id: 'snake-plant', name: 'Snake plant', category: 'plants', size: [0.4, 0.4, 0.8], shape: 'round', solid: false, tags: ['green', 'mother in law tongue'] }),
  a({ id: 'monstera', name: 'Monstera', category: 'plants', size: [0.8, 0.8, 1.1], shape: 'round', solid: false, tags: ['green', 'leaf'] }),
  a({ id: 'banana-plant', name: 'Banana plant', category: 'plants', size: [1.2, 1.2, 2.2], shape: 'round', solid: false, tags: ['green', 'tropical', 'kela'] }),
  a({ id: 'bamboo', name: 'Bamboo in pot', category: 'plants', size: [0.5, 0.5, 1.6], shape: 'round', solid: false, tags: ['green', 'lucky'] }),
  a({ id: 'money-plant', name: 'Money plant', category: 'plants', size: [0.35, 0.35, 0.55], shape: 'round', solid: false, tags: ['green', 'vine', 'pothos'] }),
  // ---- Batch 3 · appliances
  a({ id: 'split-ac', name: 'Split air conditioner', category: 'appliances', size: [0.95, 0.25, 0.3], mount: 'wall', mountHeight: 2.2, solid: false, tags: ['ac', 'cooling', 'air conditioning'] }),
  a({ id: 'cassette-ac', name: 'Ceiling AC cassette', category: 'appliances', size: [0.9, 0.9, 0.25], mount: 'ceiling', tier: 'premium', solid: false, tags: ['ac', 'cooling'] }),
  a({ id: 'geyser', name: 'Water heater', category: 'appliances', size: [0.4, 0.4, 0.55], mount: 'wall', mountHeight: 2.0, solid: false, tags: ['geyser', 'hot water'] }),
  a({ id: 'water-purifier', name: 'Water purifier', category: 'appliances', size: [0.4, 0.2, 0.55], mount: 'wall', mountHeight: 1.2, solid: false, tags: ['ro', 'filter', 'aquaguard'] }),
  a({ id: 'fridge-sbs', name: 'Side-by-side fridge', category: 'appliances', size: [0.92, 0.75, 1.8], tier: 'premium', tags: ['refrigerator', 'double door'] }),
  a({ id: 'washer-top', name: 'Top-load washer', category: 'appliances', size: [0.58, 0.6, 0.95], tags: ['washing machine', 'laundry'] }),
  a({ id: 'inverter', name: 'Inverter and battery', category: 'appliances', size: [0.5, 0.4, 0.6], solid: false, tags: ['ups', 'power backup', 'battery'] }),
  a({ id: 'air-cooler', name: 'Air cooler', category: 'appliances', size: [0.5, 0.45, 0.9], solid: false, tags: ['desert cooler', 'cooling'] }),
  a({ id: 'exhaust-fan', name: 'Exhaust fan', category: 'appliances', size: [0.3, 0.12, 0.3], mount: 'wall', mountHeight: 2.1, solid: false, tags: ['fan', 'ventilation'] }),
  a({ id: 'tv-wall', name: 'Wall-mounted TV', category: 'appliances', size: [1.2, 0.06, 0.7], mount: 'wall', mountHeight: 1.3, solid: false, tags: ['television', 'led', 'screen'] }),
  // ---- Batch 3 · outdoor & garden
  a({ id: 'gazebo', name: 'Gazebo', category: 'outdoor', size: [3.0, 3.0, 2.8], tier: 'premium', solid: false, tags: ['pavilion', 'shade', 'garden'] }),
  a({ id: 'pergola', name: 'Pergola', category: 'outdoor', size: [3.0, 3.0, 2.5], colors: WOODS, solid: false, tags: ['shade', 'garden', 'trellis'] }),
  a({ id: 'garden-shed', name: 'Garden shed', category: 'outdoor', size: [2.0, 1.6, 2.2], tags: ['storage', 'tools'] }),
  a({ id: 'dog-house', name: 'Dog house', category: 'outdoor', size: [0.7, 0.9, 0.75], solid: false, tags: ['pet', 'kennel'] }),
  a({ id: 'mailbox', name: 'Letter box', category: 'outdoor', size: [0.3, 0.2, 1.2], solid: false, tags: ['post', 'entrance'] }),
  a({ id: 'boulder', name: 'Boulder', category: 'outdoor', size: [1.0, 0.8, 0.7], solid: false, tags: ['rock', 'stone', 'garden'] }),
  a({ id: 'motorbike', name: 'Motorbike', category: 'outdoor', size: [0.8, 2.0, 1.1], colors: CAR_PAINTS, tier: 'rewarded', tags: ['vehicle', 'parking', 'two wheeler', 'scooter'] }),
  a({ id: 'swing-set', name: 'Children swing set', category: 'outdoor', size: [2.4, 1.6, 2.2], tier: 'premium', solid: false, tags: ['play', 'kids', 'garden'] }),
  a({ id: 'solar-panel', name: 'Solar panel', category: 'outdoor', size: [1.7, 1.0, 0.9], solid: false, tags: ['solar', 'roof', 'energy'] }),
  a({ id: 'carport', name: 'Carport', category: 'outdoor', size: [3.2, 5.5, 2.6], tier: 'premium', solid: false, tags: ['garage', 'parking', 'shade'] }),
  a({ id: 'outdoor-sofa', name: 'Outdoor sofa', category: 'outdoor', size: [2.0, 0.85, 0.8], colors: FABRICS, tags: ['seat', 'patio', 'terrace'] }),
  a({ id: 'fire-pit', name: 'Fire pit', category: 'outdoor', size: [0.9, 0.9, 0.45], shape: 'round', solid: false, tags: ['bonfire', 'garden'] }),

  // ---- Batch 4 · living
  a({ id: 'loveseat', name: 'Loveseat', category: 'living', size: [1.4, 0.85, 0.82], colors: FABRICS, tags: ['sofa', 'couch', 'seat'] }),
  a({ id: 'wingback', name: 'Wingback chair', category: 'living', size: [0.8, 0.85, 1.05], colors: FABRICS, tier: 'premium', tags: ['armchair', 'seat'] }),
  a({ id: 'tv-console', name: 'Low TV console', category: 'living', size: [1.8, 0.4, 0.45], colors: WOODS, tags: ['tv', 'storage', 'media'] }),
  a({ id: 'coat-stand', name: 'Coat stand', category: 'living', size: [0.45, 0.45, 1.75], shape: 'round', solid: false, tags: ['hall', 'entry', 'hooks'] }),
  a({ id: 'shoe-bench', name: 'Shoe bench', category: 'living', size: [1.0, 0.35, 0.5], colors: WOODS, solid: false, tags: ['entry', 'storage', 'seat'] }),
  a({ id: 'nesting-tables', name: 'Nesting tables', category: 'living', size: [0.7, 0.5, 0.5], colors: WOODS, solid: false, tags: ['table', 'side table'] }),
  // ---- Batch 4 · bedroom
  a({ id: 'storage-bed', name: 'Storage bed', category: 'bedroom', size: [1.65, 2.15, 0.95], colors: FABRICS, tags: ['sleep', 'box bed'] }),
  a({ id: 'chest-drawers', name: 'Chest of drawers', category: 'bedroom', size: [0.9, 0.5, 1.2], colors: WOODS, tags: ['storage', 'dresser'] }),
  a({ id: 'canopy-bed', name: 'Canopy bed', category: 'bedroom', size: [1.7, 2.2, 2.2], colors: WOODS, tier: 'premium', tags: ['sleep', 'four poster'] }),
  a({ id: 'vanity-stool', name: 'Vanity stool', category: 'bedroom', size: [0.4, 0.4, 0.45], shape: 'round', colors: FABRICS, solid: false, tags: ['seat', 'pouf'] }),
  // ---- Batch 4 · kids
  a({ id: 'kids-desk', name: 'Kids desk', category: 'kids', size: [1.0, 0.55, 0.62], colors: WOODS, tags: ['study', 'table', 'children'] }),
  a({ id: 'kids-chair', name: 'Kids chair', category: 'kids', size: [0.3, 0.3, 0.6], colors: WOODS, solid: false, tags: ['seat', 'children'] }),
  a({ id: 'play-tent', name: 'Play tent', category: 'kids', size: [1.1, 1.1, 1.1], solid: false, tags: ['toy', 'children', 'teepee'] }),
  a({ id: 'toy-kitchen', name: 'Toy kitchen', category: 'kids', size: [0.9, 0.4, 0.85], tier: 'rewarded', tags: ['toy', 'children', 'play'] }),
  // ---- Batch 4 · kitchen & dining
  a({ id: 'kitchen-trolley', name: 'Kitchen trolley', category: 'dining', size: [0.5, 0.4, 0.85], colors: PAINTED, solid: false, tags: ['cart', 'storage'] }),
  a({ id: 'sink-double', name: 'Double sink unit', category: 'dining', size: [1.8, 0.6, 0.9], colors: PAINTED, tags: ['counter', 'water'] }),
  a({ id: 'water-dispenser', name: 'Water dispenser', category: 'dining', size: [0.33, 0.35, 1.0], solid: false, tags: ['cooler', 'drinking water'] }),
  a({ id: 'pantry-unit', name: 'Pantry unit', category: 'dining', size: [0.9, 0.6, 2.1], colors: PAINTED, tags: ['storage', 'cupboard'] }),
  a({ id: 'kitchen-corner', name: 'Corner kitchen unit', category: 'dining', size: [0.9, 0.9, 0.9], colors: PAINTED, tags: ['counter', 'l-shaped'] }),
  // ---- Batch 4 · bathroom
  a({ id: 'toilet-wall', name: 'Wall-hung toilet', category: 'bathroom', size: [0.38, 0.55, 0.4], tags: ['wc', 'commode'] }),
  a({ id: 'double-vanity', name: 'Double vanity', category: 'bathroom', size: [1.6, 0.5, 0.85], colors: PAINTED, tier: 'premium', tags: ['sink', 'basin', 'cabinet'] }),
  a({ id: 'bath-stool', name: 'Bath stool', category: 'bathroom', size: [0.35, 0.3, 0.4], solid: false, tags: ['seat'] }),
  // ---- Batch 4 · office
  a({ id: 'standing-desk', name: 'Standing desk', category: 'office', size: [1.4, 0.7, 1.05], colors: WOODS, tags: ['table', 'work', 'adjustable'] }),
  a({ id: 'conference-chair', name: 'Conference chair', category: 'office', size: [0.6, 0.6, 0.95], colors: FABRICS, solid: false, tags: ['seat', 'work', 'meeting'] }),
  a({ id: 'cubicle', name: 'Work cubicle', category: 'office', size: [1.8, 1.6, 1.3], colors: PAINTED, tags: ['desk', 'partition', 'work'] }),
  // ---- Batch 4 · decor
  a({ id: 'tall-vase', name: 'Tall floor vase', category: 'decor', size: [0.35, 0.35, 0.9], shape: 'round', solid: false, tags: ['pot', 'decor'] }),
  a({ id: 'aquarium', name: 'Aquarium', category: 'decor', size: [1.0, 0.4, 1.2], tier: 'premium', tags: ['fish', 'tank', 'water'] }),
  a({ id: 'urli', name: 'Brass urli', category: 'decor', size: [0.7, 0.7, 0.16], shape: 'round', solid: false, tags: ['bowl', 'flowers', 'diwali', 'floating'] }),
  a({ id: 'wall-mandala', name: 'Wall mandala', category: 'decor', size: [0.8, 0.04, 0.8], mount: 'wall', mountHeight: 1.6, solid: false, tags: ['art', 'hanging', 'round'] }),
  a({ id: 'globe', name: 'World globe', category: 'decor', size: [0.4, 0.4, 0.55], shape: 'round', solid: false, tags: ['map', 'study'] }),
  // ---- Batch 4 · outdoor
  a({ id: 'hammock', name: 'Hammock', category: 'outdoor', size: [3.2, 1.0, 1.4], solid: false, tags: ['rest', 'garden', 'swing'] }),
  a({ id: 'bird-bath', name: 'Bird bath', category: 'outdoor', size: [0.6, 0.6, 0.8], shape: 'round', solid: false, tags: ['garden', 'water', 'birds'] }),
  a({ id: 'well', name: 'Garden well', category: 'outdoor', size: [1.2, 1.2, 1.6], shape: 'round', tags: ['water', 'kuan', 'garden'] }),
  a({ id: 'greenhouse', name: 'Greenhouse', category: 'outdoor', size: [3.0, 2.4, 2.4], tier: 'premium', solid: false, tags: ['garden', 'plants', 'glass'] }),
  a({ id: 'raised-bed', name: 'Raised vegetable bed', category: 'outdoor', size: [1.8, 0.9, 0.4], solid: false, tags: ['garden', 'vegetables', 'kitchen garden'] }),
  a({ id: 'garden-arch', name: 'Garden arch', category: 'outdoor', size: [1.6, 0.6, 2.4], solid: false, tags: ['trellis', 'garden', 'entrance'] }),
  a({ id: 'ev-charger', name: 'EV charging point', category: 'outdoor', size: [0.3, 0.2, 1.3], solid: false, tags: ['car', 'electric', 'charger'] }),
  a({ id: 'bike-rack', name: 'Bicycle rack', category: 'outdoor', size: [1.8, 0.5, 0.8], solid: false, tags: ['cycle', 'parking'] }),
  a({ id: 'slide', name: 'Playground slide', category: 'outdoor', size: [0.9, 2.6, 1.6], tier: 'rewarded', solid: false, tags: ['play', 'kids'] }),
  a({ id: 'sandbox', name: 'Sandbox', category: 'outdoor', size: [1.5, 1.5, 0.25], solid: false, tags: ['play', 'kids', 'sand'] }),

  // ---- Batch 5 · trees & nature
  a({ id: 'tree-mango', name: 'Mango tree', category: 'nature', size: [3.4, 3.4, 5.0], shape: 'round', solid: false, tags: ['tree', 'fruit', 'aam', 'garden'], colors: TREE_SEASONS }),
  a({ id: 'tree-neem', name: 'Neem tree', category: 'nature', size: [3.6, 3.6, 5.5], shape: 'round', solid: false, tags: ['tree', 'shade', 'garden'], colors: TREE_SEASONS }),
  a({ id: 'tree-banyan', name: 'Banyan tree', category: 'nature', size: [5.5, 5.5, 6.0], shape: 'round', solid: false, tier: 'premium', tags: ['tree', 'shade', 'big'], colors: TREE_SEASONS }),
  a({ id: 'tree-gulmohar', name: 'Gulmohar tree', category: 'nature', size: [3.8, 3.8, 5.0], shape: 'round', solid: false, tags: ['tree', 'flowers', 'red', 'garden'], colors: TREE_SEASONS }),
  a({ id: 'tree-cherry', name: 'Cherry blossom', category: 'nature', size: [3.0, 3.0, 4.0], shape: 'round', solid: false, tier: 'premium', tags: ['tree', 'flowers', 'pink', 'sakura'], colors: TREE_SEASONS }),
  a({ id: 'tree-oak', name: 'Oak tree', category: 'nature', size: [4.2, 4.2, 6.0], shape: 'round', solid: false, tags: ['tree', 'shade', 'big'], colors: TREE_SEASONS }),
  a({ id: 'tree-birch', name: 'Birch tree', category: 'nature', size: [2.0, 2.0, 5.5], shape: 'round', solid: false, tags: ['tree', 'white'], colors: TREE_SEASONS }),
  a({ id: 'tree-cypress', name: 'Cypress', category: 'nature', size: [1.0, 1.0, 4.5], shape: 'round', solid: false, tags: ['tree', 'tall', 'narrow'], colors: TREE_SEASONS }),
  a({ id: 'tree-willow', name: 'Weeping willow', category: 'nature', size: [4.2, 4.2, 5.0], shape: 'round', solid: false, tier: 'rewarded', tags: ['tree', 'pond', 'drooping'], colors: TREE_SEASONS }),
  a({ id: 'tree-fruit', name: 'Fruit tree', category: 'nature', size: [2.4, 2.4, 3.0], shape: 'round', solid: false, tags: ['tree', 'apple', 'orchard'], colors: TREE_SEASONS }),
  a({ id: 'tree-olive', name: 'Potted olive tree', category: 'nature', size: [1.2, 1.2, 1.9], shape: 'round', solid: false, tags: ['tree', 'pot', 'terrace'] }),
  a({ id: 'bush-flower', name: 'Flowering bush', category: 'nature', size: [1.1, 1.1, 0.9], shape: 'round', solid: false, tags: ['shrub', 'flowers', 'garden'] }),
  a({ id: 'hibiscus', name: 'Hibiscus', category: 'nature', size: [1.0, 1.0, 1.4], shape: 'round', solid: false, tags: ['shrub', 'flowers', 'red', 'gudhal'] }),
  a({ id: 'topiary-ball', name: 'Topiary ball', category: 'nature', size: [0.7, 0.7, 1.0], shape: 'round', solid: false, tags: ['shrub', 'trimmed'] }),
  a({ id: 'topiary-spiral', name: 'Topiary spiral', category: 'nature', size: [0.7, 0.7, 1.7], shape: 'round', solid: false, tags: ['shrub', 'trimmed'] }),
  a({ id: 'rose-bed', name: 'Rose bed', category: 'nature', size: [1.4, 0.6, 0.55], solid: false, tags: ['flowers', 'gulab', 'garden'] }),
  a({ id: 'marigold-patch', name: 'Marigold patch', category: 'nature', size: [1.2, 1.2, 0.35], shape: 'round', solid: false, tags: ['flowers', 'genda', 'yellow'] }),
  a({ id: 'sunflowers', name: 'Sunflowers', category: 'nature', size: [1.2, 0.5, 1.7], solid: false, tags: ['flowers', 'yellow', 'tall'] }),
  a({ id: 'lavender-row', name: 'Lavender row', category: 'nature', size: [1.6, 0.4, 0.55], solid: false, tags: ['flowers', 'purple'] }),
  a({ id: 'tall-grass', name: 'Tall grass', category: 'nature', size: [0.9, 0.9, 1.0], shape: 'round', solid: false, tags: ['grass', 'pampas'] }),
  a({ id: 'fern', name: 'Fern', category: 'nature', size: [0.9, 0.9, 0.7], shape: 'round', solid: false, tags: ['green', 'shade'] }),
  a({ id: 'rock-cluster', name: 'Rock cluster', category: 'nature', size: [1.5, 1.2, 0.7], solid: false, tags: ['stone', 'boulder', 'garden'] }),
  a({ id: 'log', name: 'Fallen log', category: 'nature', size: [1.7, 0.45, 0.45], solid: false, tags: ['wood', 'tree trunk'] }),
  a({ id: 'lotus', name: 'Lotus', category: 'nature', size: [1.0, 1.0, 0.35], shape: 'round', solid: false, tags: ['pond', 'flower', 'water lily', 'kamal'] }),
  a({ id: 'garden-gnome', name: 'Garden gnome', category: 'nature', size: [0.3, 0.3, 0.6], shape: 'round', solid: false, tags: ['decor', 'statue', 'fun'] }),
  a({ id: 'sundial', name: 'Sundial', category: 'nature', size: [0.5, 0.5, 0.95], shape: 'round', solid: false, tags: ['decor', 'garden', 'time'] }),
  a({ id: 'stone-lantern', name: 'Stone lantern', category: 'nature', size: [0.5, 0.5, 1.2], shape: 'round', solid: false, tags: ['decor', 'light', 'japanese'] }),
  a({ id: 'garden-statue', name: 'Garden statue', category: 'nature', size: [0.6, 0.6, 1.6], shape: 'round', solid: false, tier: 'rewarded', tags: ['decor', 'sculpture', 'art'] }),
  a({ id: 'urn-planter', name: 'Urn planter', category: 'nature', size: [0.6, 0.6, 1.0], shape: 'round', solid: false, tags: ['decor', 'pot', 'flowers'] }),
  a({ id: 'wheelbarrow', name: 'Wheelbarrow', category: 'nature', size: [0.6, 1.5, 0.7], solid: false, tags: ['decor', 'garden', 'tool'] }),
  a({ id: 'watering-can', name: 'Watering can', category: 'nature', size: [0.45, 0.25, 0.4], solid: false, tags: ['decor', 'garden', 'tool'] }),
  a({ id: 'stake-light', name: 'Garden stake light', category: 'nature', size: [0.2, 0.2, 0.5], shape: 'round', solid: false, tags: ['light', 'path', 'solar'] }),
  // ---- Batch 5 · scenery
  a({ id: 'neighbour-modern', name: 'Neighbour: modern house', category: 'scenery', size: [9.0, 8.0, 6.5], colors: BUILDING_COLORS, tags: ['house', 'building', 'neighbour', 'flat roof'] }),
  a({ id: 'neighbour-villa', name: 'Neighbour: villa', category: 'scenery', size: [10.0, 8.5, 7.5], colors: BUILDING_COLORS, tags: ['house', 'building', 'neighbour', 'bungalow'] }),
  a({ id: 'neighbour-row', name: 'Neighbour: row house', category: 'scenery', size: [10.0, 6.5, 7.5], colors: BUILDING_COLORS, tags: ['house', 'building', 'neighbour', 'terrace'] }),
  a({ id: 'neighbour-hut', name: 'Neighbour: village house', category: 'scenery', size: [5.0, 4.5, 3.6], colors: BUILDING_COLORS, tags: ['house', 'building', 'neighbour', 'village', 'tiled'] }),
  a({ id: 'apartment-block', name: 'Apartment block', category: 'scenery', size: [14.0, 10.0, 16.0], tier: 'premium', colors: BUILDING_COLORS, tags: ['building', 'flats', 'tower', 'city'] }),
  a({ id: 'pond-small', name: 'Garden pond', category: 'scenery', size: [3.0, 2.4, 0.2], solid: false, tags: ['water', 'lake', 'fish'] }),
  a({ id: 'pond-large', name: 'Large pond', category: 'scenery', size: [6.5, 4.5, 0.2], solid: false, tier: 'premium', tags: ['water', 'lake'] }),
  a({ id: 'pond-round', name: 'Round pond', category: 'scenery', size: [4.0, 4.0, 0.2], shape: 'round', solid: false, tags: ['water', 'lake'] }),
  a({ id: 'hill', name: 'Hill', category: 'scenery', size: [12.0, 10.0, 3.0], solid: false, tags: ['terrain', 'mound', 'slope', 'mountain'] }),
  a({ id: 'mound', name: 'Grassy mound', category: 'scenery', size: [5.0, 4.0, 1.2], solid: false, tags: ['terrain', 'slope', 'garden'] }),
  a({ id: 'road-straight', name: 'Road (straight)', category: 'scenery', size: [6.0, 14.0, 0.05], solid: false, tags: ['street', 'asphalt', 'lane'] }),
  a({ id: 'road-corner', name: 'Road (corner)', category: 'scenery', size: [6.0, 6.0, 0.05], solid: false, tags: ['street', 'asphalt', 'turn'] }),
  a({ id: 'pavement', name: 'Pavement', category: 'scenery', size: [2.0, 14.0, 0.12], solid: false, tags: ['sidewalk', 'footpath'] }),
  a({ id: 'street-light', name: 'Street light', category: 'scenery', size: [1.0, 0.4, 6.5], solid: false, tags: ['light', 'pole', 'road'] }),
  a({ id: 'compound-wall', name: 'Long compound wall', category: 'scenery', size: [10.0, 0.25, 1.9], tags: ['boundary', 'fence', 'gate'] }),
  // ---- Batch 9 · more neighbours, street furniture and street life
  a({ id: 'neighbour-bungalow', name: 'Neighbour: bungalow', category: 'scenery', size: [11.0, 9.0, 5.2], colors: BUILDING_COLORS, tags: ['house', 'building', 'neighbour', 'bungalow', 'tiled'] }),
  a({ id: 'neighbour-shops', name: 'Neighbour: shop row', category: 'scenery', size: [12.0, 8.0, 7.5], colors: BUILDING_COLORS, tags: ['shop', 'market', 'building', 'neighbour', 'bazaar'] }),
  a({ id: 'neighbour-temple', name: 'Neighbour: temple', category: 'scenery', size: [9.0, 9.0, 11.0], colors: BUILDING_COLORS, tags: ['temple', 'mandir', 'building', 'neighbour', 'worship'] }),
  a({ id: 'neighbour-school', name: 'Neighbour: school', category: 'scenery', size: [22.0, 10.0, 8.0], tier: 'premium', colors: BUILDING_COLORS, tags: ['school', 'building', 'neighbour', 'college'] }),
  a({ id: 'neighbour-tower', name: 'Neighbour: office tower', category: 'scenery', size: [14.0, 14.0, 42.0], tier: 'premium', colors: BUILDING_COLORS, tags: ['office', 'skyscraper', 'building', 'city', 'neighbour'] }),
  a({ id: 'neighbour-farm', name: 'Neighbour: farmhouse and barn', category: 'scenery', size: [16.0, 10.0, 6.2], colors: BUILDING_COLORS, tags: ['farm', 'barn', 'village', 'building', 'neighbour'] }),
  a({ id: 'neighbour-warehouse', name: 'Neighbour: warehouse', category: 'scenery', size: [20.0, 14.0, 8.0], colors: BUILDING_COLORS, tags: ['godown', 'factory', 'building', 'neighbour', 'industrial'] }),
  a({ id: 'bus-shelter', name: 'Bus shelter', category: 'scenery', size: [3.4, 1.6, 2.6], solid: false, tags: ['bus stop', 'street', 'road'] }),
  a({ id: 'signboard', name: 'Road sign', category: 'scenery', size: [0.9, 0.1, 2.6], solid: false, colors: SIGN_COLORS, tags: ['sign', 'board', 'street', 'road'] }),
  a({ id: 'traffic-light', name: 'Traffic light', category: 'scenery', size: [0.5, 0.5, 4.6], solid: false, tags: ['signal', 'street', 'road', 'light'] }),
  a({ id: 'billboard', name: 'Billboard', category: 'scenery', size: [6.0, 0.5, 8.0], solid: false, colors: SIGN_COLORS, tags: ['advert', 'hoarding', 'street', 'sign'] }),
  a({ id: 'person-standing', name: 'Person, standing', category: 'scenery', size: [0.5, 0.35, 1.7], solid: false, colors: CLOTHES, tags: ['people', 'human', 'life', 'street'] }),
  a({ id: 'person-walking', name: 'Person, walking', category: 'scenery', size: [0.5, 0.5, 1.7], solid: false, colors: CLOTHES, tags: ['people', 'human', 'life', 'street', 'pedestrian'] }),
  a({ id: 'dog', name: 'Street dog', category: 'scenery', size: [0.35, 0.8, 0.55], solid: false, tags: ['animal', 'pet', 'life', 'street'] }),
  a({ id: 'cow', name: 'Cow', category: 'scenery', size: [0.7, 1.9, 1.4], solid: false, tags: ['animal', 'cattle', 'life', 'village', 'street'] }),
  a({ id: 'auto-rickshaw', name: 'Auto-rickshaw', category: 'scenery', size: [1.4, 2.7, 1.7], solid: false, colors: TAXI_PAINTS, tags: ['vehicle', 'taxi', 'tuk tuk', 'life', 'street'] }),
  a({ id: 'bus', name: 'Bus', category: 'scenery', size: [2.5, 10.5, 3.2], solid: false, tier: 'premium', colors: BUS_PAINTS, tags: ['vehicle', 'transport', 'life', 'street'] }),
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
