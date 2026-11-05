import { getAsset, itemFootprint } from '@hd/assets';
import type { Collider } from '@hd/geometry';
import type { Id, Scene } from '@hd/scene-schema';

/** Thin edge colliders around large, tall furniture so the walkthrough can't pass through it. */
const EDGE_HALF_THICKNESS_M = 0.02;

/**
 * Colliders for the solid items of one floor: each footprint edge becomes a thin segment
 * (the walker is a circle, so an outline is enough). Rugs, lights, wall decor and small low items are skipped.
 */
export function itemColliders(scene: Scene, levelId: Id): Collider[] {
  const out: Collider[] = [];
  for (const it of Object.values(scene.items)) {
    if (it.levelId !== levelId) continue;
    const asset = getAsset(it.assetId);
    if (!asset || !asset.solid || asset.mount !== 'floor') continue;
    const poly = itemFootprint(asset, [it.position[0], it.position[2]], it.rotationY, it.scale);
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!;
      const b = poly[(i + 1) % poly.length]!;
      out.push({ a, b, halfThickness: EDGE_HALF_THICKNESS_M });
    }
  }
  return out;
}
