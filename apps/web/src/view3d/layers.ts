import { getAsset } from '@hd/assets';

/** What can be hidden in the 3D view to look at one thing at a time. */
export type LayerId = 'walls' | 'openings' | 'floors' | 'furniture' | 'outdoor' | 'garden' | 'stairs' | 'balconies' | 'roofs';

export const LAYERS: readonly { id: LayerId; label: string }[] = [
  { id: 'walls', label: 'Walls' },
  { id: 'openings', label: 'Doors & windows' },
  { id: 'floors', label: 'Floors' },
  { id: 'furniture', label: 'Furniture' },
  { id: 'outdoor', label: 'Trees & scenery' },
  { id: 'garden', label: 'Lawn & paths' },
  { id: 'stairs', label: 'Stairs' },
  { id: 'balconies', label: 'Balconies' },
  { id: 'roofs', label: 'Roofs' },
];

export type HiddenLayers = Partial<Record<LayerId, boolean>>;

/** Trees, ponds, neighbours and other outdoor pieces form their own layer; everything else is furniture. */
export function itemLayer(assetId: string, tag?: string): LayerId {
  if (tag === 'env' || tag?.startsWith('street:')) return 'outdoor';
  const c = getAsset(assetId)?.category;
  return c === 'nature' || c === 'scenery' || c === 'outdoor' ? 'outdoor' : 'furniture';
}

export const anyHidden = (h: HiddenLayers): boolean => LAYERS.some((l) => h[l.id]);
