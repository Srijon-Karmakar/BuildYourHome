import * as THREE from 'three';
import type { CatalogMaterial } from './placeholderMaterials';
import { TIERS, type Tier } from './qualityLogic';

/**
 * CC0 photo-scan PBR sets (ambientCG, see docs/ASSET_LICENSES.md), shrunk to 512 px and neutralised so a material's own
 * colour still tints them. Loaded lazily and only on Medium / High: the procedural look appears instantly and is
 * upgraded when the files arrive (Low keeps the procedural look and downloads nothing).
 */
interface PhotoSet {
  /** File prefix in /textures. */
  name: string;
  /** World size of one tile (metres). */
  tileM: number;
  /** Use the photo's colour map (false = only its normal / roughness detail, e.g. painted walls). */
  albedo: boolean;
  /** Normal-map strength. */
  normal: number;
}

const SETS: Record<string, PhotoSet> = {
  planks: { name: 'planks', tileM: 1.2, albedo: true, normal: 0.8 },
  siding: { name: 'siding', tileM: 0.9, albedo: true, normal: 0.9 },
  bricks: { name: 'bricks', tileM: 1.8, albedo: true, normal: 1.0 },
  stonewall: { name: 'stonewall', tileM: 1.6, albedo: true, normal: 1.0 },
  tiles: { name: 'tiles', tileM: 2.4, albedo: true, normal: 0.5 },
  terrazzo: { name: 'terrazzo', tileM: 1.2, albedo: true, normal: 0.4 },
  carpet: { name: 'carpet', tileM: 0.8, albedo: true, normal: 0.8 },
  plaster: { name: 'plaster', tileM: 1.5, albedo: false, normal: 0.35 },
  marble: { name: 'marble', tileM: 1.6, albedo: true, normal: 0.25 },
  concrete: { name: 'concrete', tileM: 2.0, albedo: true, normal: 0.6 },
  grass: { name: 'grass', tileM: 1.6, albedo: true, normal: 0.7 },
  sand: { name: 'sand', tileM: 2.0, albedo: true, normal: 0.5 },
  soil: { name: 'soil', tileM: 1.5, albedo: true, normal: 0.8 },
  paving: { name: 'paving', tileM: 1.2, albedo: true, normal: 0.9 },
  gravel: { name: 'gravel', tileM: 1.0, albedo: true, normal: 0.8 },
  roofing: { name: 'roofing', tileM: 1.6, albedo: true, normal: 0.9 },
  metal: { name: 'metal', tileM: 2.0, albedo: true, normal: 0.3 },
};

const BY_ID: Record<string, string> = {
  'floor-marble': 'marble',
  'floor-concrete': 'concrete',
  'floor-slab-dark': 'concrete',
  'wall-concrete': 'concrete',
  'roof-concrete': 'concrete',
  'roof-metal': 'metal',
  'roof-seam': 'metal',
  'roof-copper': 'metal',
  'roof-green': 'metal',
  'roof-tile-terracotta': 'roofing',
  'roof-tile-grey': 'roofing',
  'roof-tile-brown': 'roofing',
  'roof-tile-black': 'roofing',
  'roof-slate': 'roofing',
  'roof-sand': 'roofing',
  'ground-grass': 'grass',
  'ground-lawn-dark': 'grass',
  'ground-sand': 'sand',
  'ground-soil': 'soil',
  'ground-red-earth': 'soil',
  'ground-paving': 'paving',
  'ground-stone': 'paving',
  'ground-brick-paving': 'paving',
  'ground-gravel': 'gravel',
  'ground-deck': 'planks',
};

const BY_PATTERN: Record<string, string> = {
  wood: 'planks',
  tile: 'tiles',
  brick: 'bricks',
  stone: 'stonewall',
  panel: 'siding',
  terrazzo: 'terrazzo',
  carpet: 'carpet',
  paint: 'plaster',
};

/** The photo set that belongs to a catalog material (none = keep the procedural look). */
export function photoSetFor(c: CatalogMaterial): string | null {
  return BY_ID[c.id] ?? BY_PATTERN[c.pattern] ?? null;
}

interface Loaded {
  map: THREE.Texture | null;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
}

const loader = new THREE.TextureLoader();
const cache = new Map<string, Promise<Loaded>>();
let redraw: () => void = () => {};

/** The 3D canvas renders on demand: tell it to draw again when a texture arrives. */
export function setTextureRedraw(fn: () => void): void {
  redraw = fn;
}

function tex(url: string, srgb: boolean, tileM: number, aniso: number): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (t) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(1 / tileM, 1 / tileM);
        t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.anisotropy = aniso;
        t.needsUpdate = true;
        resolve(t);
      },
      undefined,
      reject,
    );
  });
}

function load(set: PhotoSet, aniso: number): Promise<Loaded> {
  const key = `${set.name}:${aniso}`;
  let hit = cache.get(key);
  if (!hit) {
    const base = `${import.meta.env.BASE_URL}textures/${set.name}`;
    hit = Promise.all([set.albedo ? tex(`${base}-c.jpg`, true, set.tileM, aniso) : Promise.resolve(null), tex(`${base}-n.jpg`, false, set.tileM, aniso), tex(`${base}-r.jpg`, false, set.tileM, aniso)]).then(
      ([map, normalMap, roughnessMap]) => ({ map, normalMap, roughnessMap }),
    );
    hit.catch(() => cache.delete(key)); // offline / missing file: keep the procedural look, retry next time
    cache.set(key, hit);
  }
  return hit;
}

/**
 * Upgrade a procedural surface material with the photo set that matches it (Medium / High only).
 * Safe to call and forget: if the files cannot be loaded the material simply keeps its procedural look.
 */
export function upgradeWithPhoto(mat: THREE.MeshStandardMaterial, c: CatalogMaterial, tier: Tier): void {
  if (!TIERS[tier].photoTextures) return;
  const id = photoSetFor(c);
  const set = id ? SETS[id] : undefined;
  if (!set) return;
  void load(set, tier === 'high' ? 8 : 4)
    .then((t) => {
      if (set.albedo && t.map) mat.map = t.map;
      mat.normalMap = t.normalMap;
      mat.normalScale.set(set.normal, set.normal);
      mat.roughnessMap = t.roughnessMap;
      mat.needsUpdate = true;
      redraw();
    })
    .catch(() => {
      /* keep the procedural look */
    });
}
