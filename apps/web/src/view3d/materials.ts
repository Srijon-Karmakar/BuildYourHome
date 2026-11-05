import * as THREE from 'three';
import { placeholderMaterial } from './placeholderMaterials';
import { TIERS, type Tier } from './qualityLogic';
import { plasterNormal, woodTexture } from './textures';

/** Surface material for a catalog material id at the given quality tier. Caller disposes it. */
export function makeSurface(id: string, tier: Tier): THREE.MeshStandardMaterial {
  const p = placeholderMaterial(id);
  const cfg = TIERS[tier];
  const mat = new THREE.MeshStandardMaterial({ color: p.color, roughness: p.roughness, metalness: p.metalness ?? 0 });

  if (id === 'floor-wood-oak') {
    mat.color.set('#ffffff'); // albedo comes from the texture
    mat.map = woodTexture(cfg.textureSize);
    mat.roughness = 0.52;
  } else if (id === 'paint-white' && cfg.normalMaps) {
    mat.normalMap = plasterNormal(Math.min(cfg.textureSize, 512));
    mat.normalScale.set(0.25, 0.25);
  }
  return mat;
}
