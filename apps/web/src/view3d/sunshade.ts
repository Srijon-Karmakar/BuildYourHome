import * as THREE from 'three';
import type { OpeningShade } from '@hd/scene-schema';
import { mat, mergeByMaterial } from './furniture/kit';

export type ShadeStyle = OpeningShade['style'];

export const SHADE_STYLES: { id: ShadeStyle; label: string; hint: string; depth: number }[] = [
  { id: 'slab', label: 'Chajja', hint: 'A concrete sunshade slab above the opening', depth: 0.45 },
  { id: 'awning', label: 'Awning', hint: 'A striped fabric awning on arms', depth: 0.75 },
  { id: 'louvre', label: 'Louvre', hint: 'Angled fins that cut the sun and let air through', depth: 0.55 },
  { id: 'canopy', label: 'Canopy', hint: 'A deeper slab on two slim columns (best over a door)', depth: 1.2 },
];

export const SHADE_COLORS: { id: string; name: string }[] = [
  { id: '#e8e3d8', name: 'Plaster' },
  { id: '#b9b4aa', name: 'Concrete' },
  { id: '#c0392b', name: 'Red' },
  { id: '#2f6f8f', name: 'Blue' },
  { id: '#3f7d4e', name: 'Green' },
  { id: '#e0a43a', name: 'Saffron' },
  { id: '#3b3a38', name: 'Charcoal' },
  { id: '#8a5a3c', name: 'Wood' },
];

export const defaultShadeDepth = (style: ShadeStyle): number => SHADE_STYLES.find((s) => s.id === style)?.depth ?? 0.5;

const cache = new Map<string, THREE.Group>();

function boxAt(g: THREE.Group, size: [number, number, number], pos: [number, number, number], m: THREE.Material, rot: [number, number, number] = [0, 0, 0]): void {
  const b = new THREE.Mesh(new THREE.BoxGeometry(...size), m);
  b.position.set(...pos);
  b.rotation.set(...rot);
  b.castShadow = b.receiveShadow = true;
  g.add(b);
}

/**
 * A sunshade as one small model in the opening's frame: x along the wall (centred on the opening), y up from the TOP of
 * the opening, z outward from the wall face (the caller flips it for the other side). `colHeight` is how far a canopy's
 * columns have to reach down to the ground. Built once per look and shared; merged to one mesh per material.
 */
export function buildSunshade(style: ShadeStyle, width: number, depth: number, color: string, colHeight: number): THREE.Group {
  const key = `${style}|${width.toFixed(3)}|${depth.toFixed(3)}|${color}|${colHeight.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit) return hit.clone(true);
  const g = new THREE.Group();
  const body = mat(color, style === 'slab' || style === 'canopy' ? 0.9 : 0.8);
  const dark = mat('#3b3a38', 0.5, 0.4);
  const w = width + (style === 'awning' ? 0.2 : 0.3);

  if (style === 'slab' || style === 'canopy') {
    boxAt(g, [w, 0.08, depth], [0, 0.06, depth / 2], body, [0.05, 0, 0]); // slab with a slight fall away from the wall
    boxAt(g, [w, 0.07, 0.05], [0, 0.0, depth], body); // drip lip
    if (style === 'canopy') {
      for (const sx of [-1, 1]) boxAt(g, [0.07, colHeight, 0.07], [sx * (w / 2 - 0.1), -colHeight / 2, depth - 0.1], body);
    }
  } else if (style === 'awning') {
    const strips = Math.max(4, Math.round(w / 0.12));
    const sw = w / strips;
    const fall = 0.4;
    const len = Math.hypot(depth, fall);
    const tilt = Math.atan2(fall, depth);
    const stripe = mat('#f4f1ea', 0.85);
    for (let i = 0; i < strips; i++) {
      boxAt(g, [sw, 0.012, len], [-w / 2 + sw * (i + 0.5), 0.08 - fall / 2, depth / 2], i % 2 ? stripe : body, [tilt, 0, 0]);
      boxAt(g, [sw, 0.13, 0.012], [-w / 2 + sw * (i + 0.5), 0.08 - fall - 0.065, depth], i % 2 ? stripe : body);
    }
    for (const sx of [-1, 1]) boxAt(g, [0.015, 0.015, len], [sx * (w / 2 - 0.03), 0.04 - fall / 2, depth / 2], dark, [tilt, 0, 0]);
  } else {
    const fins = Math.max(3, Math.round(depth / 0.11));
    for (let i = 0; i < fins; i++) {
      const z = 0.04 + (i * (depth - 0.06)) / Math.max(1, fins - 1);
      boxAt(g, [w, 0.012, 0.12], [0, 0.05 - (i * 0.04) / fins, z], body, [-0.55, 0, 0]);
    }
    for (const sx of [-1, 1]) boxAt(g, [0.03, 0.1, depth], [sx * (w / 2 - 0.015), 0.02, depth / 2], dark);
  }
  const merged = mergeByMaterial(g);
  cache.set(key, merged);
  return merged.clone(true);
}
