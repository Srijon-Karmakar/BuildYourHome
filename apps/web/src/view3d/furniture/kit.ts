import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Asset } from '@hd/assets';

/** Shared building blocks for the procedural furniture models (see builders.ts / builders2.ts). */
export type V3 = [number, number, number];

const matCache = new Map<string, THREE.MeshStandardMaterial>();
/** Materials that glow (lamp shades, bulbs, tail lights): their brightness follows how "on" the lamps are. */
const glowing = new Set<THREE.MeshStandardMaterial>();

/** 0 = lamps off (a faint tint only), 1 = fully lit. Cheap: only touches the shared glow materials. */
export function setLampGlow(level: number): void {
  for (const m of glowing) m.emissiveIntensity = (m.userData.baseGlow as number) * (0.06 + 0.94 * level);
}
export function mat(color: string, roughness = 0.6, metalness = 0, extra?: Partial<THREE.MeshStandardMaterialParameters>): THREE.MeshStandardMaterial {
  const key = `${color}|${roughness}|${metalness}|${JSON.stringify(extra ?? {})}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
    if (extra && 'emissive' in extra) {
      m.userData.baseGlow = m.emissiveIntensity;
      glowing.add(m);
    }
    matCache.set(key, m);
  }
  return m;
}

export const GLASS = () => mat('#bcd4e6', 0.03, 0, { transparent: true, opacity: 0.3, depthWrite: false, envMapIntensity: 1.5 });
export const WHITE = () => mat('#f2f1ed', 0.35);
export const CHROME = () => mat('#c9cbcd', 0.2, 0.9);
export const BLACK = () => mat('#262626', 0.5);
export const GLOW = () => mat('#fff1d2', 0.5, 0, { emissive: new THREE.Color('#ffd9a0'), emissiveIntensity: 0.9 });

export function shade(hex: string, amount: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.min(1, Math.max(0, hsl.l + amount)));
  return `#${c.getHexString()}`;
}

/** Box with its bottom face at y0, centred at (x, z). */
export function box(g: THREE.Group, [w, h, d]: V3, [x, y0, z]: V3, m: THREE.Material, rotY = 0): THREE.Mesh {
  // Real objects have softened edges: a small bevel catches the light and reads as "made", not "modelled".
  const r = Math.min(0.012, Math.min(w, h, d) * 0.3);
  const mesh = new THREE.Mesh(r >= 0.002 ? new RoundedBoxGeometry(w, h, d, 1, r) : new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y0 + h / 2, z);
  mesh.rotation.y = rotY;
  mesh.castShadow = mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}

/** (Tapered) cylinder with its bottom at y0. */
export function cyl(g: THREE.Group, rTop: number, rBottom: number, h: number, [x, y0, z]: V3, m: THREE.Material, seg = 24): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), m);
  mesh.position.set(x, y0 + h / 2, z);
  mesh.castShadow = mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}

export function ball(g: THREE.Group, [rx, ry, rz]: V3, [x, y, z]: V3, m: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), m);
  mesh.scale.set(rx, ry, rz);
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}

/** Four corner legs under a rectangle. */
export function legs(g: THREE.Group, w: number, d: number, h: number, t: number, m: THREE.Material, inset = 0.04): void {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, [t, h, t], [sx * (w / 2 - inset - t / 2), 0, sz * (d / 2 - inset - t / 2)], m);
}

export interface Ctx {
  a: Asset;
  c: string; // main colour
  w: number;
  d: number;
  h: number;
}

export type Builder = (x: Ctx) => THREE.Group;
