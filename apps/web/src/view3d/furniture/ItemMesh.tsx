import { useMemo } from 'react';
import type { Item } from '@hd/scene-schema';
import { buildFurniture } from './builders';

/**
 * One placed item. Models are cloned from a shared template, so geometry and materials are shared between all
 * copies of the same asset/colour (cheap to place many; instancing is a later optimisation if profiling asks).
 * `item.position[1]` is measured from the floor of the item's level.
 */
export function ItemMesh({ item, elevation }: { item: Item; elevation: number }) {
  const object = useMemo(() => buildFurniture(item.assetId, item.variant), [item.assetId, item.variant]);
  if (!object) return null;
  return (
    <primitive
      object={object}
      position={[item.position[0], elevation + item.position[1], item.position[2]]}
      rotation={[0, item.rotationY, 0]}
      scale={item.scale}
    />
  );
}
