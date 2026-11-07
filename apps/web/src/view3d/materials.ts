import * as THREE from 'three';
import { catalogMaterial } from './placeholderMaterials';
import { upgradeWithPhoto } from './photoTextures';
import { TIERS, type Tier } from './qualityLogic';
import {
  brickTexture,
  carpetTexture,
  panelTexture,
  plasterNormal,
  roofTileTexture,
  seamTexture,
  shingleTexture,
  stoneTexture,
  subwayTexture,
  terrazzoTexture,
  tileTexture,
  woodTexture,
} from './textures';

/** Surface material for a catalog material id at the given quality tier. Caller disposes it (textures are cached). */
export function makeSurface(id: string, tier: Tier): THREE.MeshStandardMaterial {
  const c = catalogMaterial(id);
  const cfg = TIERS[tier];
  const shiny = cfg.gloss && c.group === 'floor' && c.roughness <= 0.4;
  // Polished floors: a clear-coat layer (Medium / High) reflects the lights and windows of the room.
  const mat: THREE.MeshStandardMaterial = shiny
    ? new THREE.MeshPhysicalMaterial({
        color: c.color,
        roughness: Math.max(0.2, c.roughness - 0.08),
        metalness: c.metalness ?? 0,
        clearcoat: 0.4,
        clearcoatRoughness: 0.2,
        envMapIntensity: 1.6,
      })
    : new THREE.MeshStandardMaterial({ color: c.color, roughness: c.roughness, metalness: c.metalness ?? 0 });

  switch (c.pattern) {
    case 'wood':
      mat.map = woodTexture(cfg.textureSize); // colour tints the texture (white = natural oak)
      break;
    case 'tile':
      mat.map = tileTexture(cfg.textureSize, c.grout ?? '#888888');
      break;
    case 'subway':
      mat.map = subwayTexture(cfg.textureSize, c.grout ?? '#d0cdc5');
      break;
    case 'brick':
      mat.map = brickTexture(cfg.textureSize);
      break;
    case 'stone':
      mat.map = stoneTexture(cfg.textureSize);
      break;
    case 'panel':
      mat.map = panelTexture(cfg.textureSize);
      break;
    case 'terrazzo':
      mat.map = terrazzoTexture(cfg.textureSize);
      break;
    case 'rooftile':
      mat.map = roofTileTexture(cfg.textureSize);
      break;
    case 'shingle':
      mat.map = shingleTexture(cfg.textureSize);
      break;
    case 'seam':
      mat.map = seamTexture(cfg.textureSize);
      break;
    case 'carpet':
      mat.map = carpetTexture(Math.min(cfg.textureSize, 512));
      break;
    case 'paint':
      if (cfg.normalMaps) {
        mat.normalMap = plasterNormal(Math.min(cfg.textureSize, 512));
        mat.normalScale.set(0.25, 0.25);
      }
      break;
    default:
  }
  upgradeWithPhoto(mat, c, tier); // Medium / High: swap in the photo-scan set when it has loaded
  return mat;
}
