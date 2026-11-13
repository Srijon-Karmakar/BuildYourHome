import * as THREE from 'three';
import type { Asset } from '@hd/assets';
import type { Item } from '@hd/scene-schema';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { curveShape, MIN_CURVE_DEG } from './screenArt';

/**
 * Geometry of wall features (extra / curved / box / extended walls). Every shape is one mesh with UVs in metres, so a
 * brick or plaster finish has the same pattern size as on a real wall whatever the size of the feature.
 * Local frame: x along the wall, y up from the floor, z toward the front; the back face is on z = -depth/2 for
 * straight slabs. A curved slab has its two tips on z = 0 and bulges toward +z (or -z for a negative bend).
 */

/** UV scale of one BoxGeometry face pair: [+x,-x] use (depth, h), [+y,-y] (w, depth), [+z,-z] (w, h). */
function metreUVs(g: THREE.BoxGeometry, w: number, h: number, d: number): void {
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const dims: Array<[number, number]> = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let i = 0; i < uv.count; i++) {
    const [su, sv] = dims[Math.floor(i / 4)]!;
    uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  }
}

/** A straight slab standing on y = 0, centred on x = 0 and z = 0. */
export function slabGeometry(w: number, h: number, d: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  metreUVs(g, w, h, d);
  g.translate(0, h / 2, 0);
  return g;
}

/** The cap (coping) along the top of a straight slab. */
export function capGeometry(w: number, h: number, d: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w + 0.1, 0.05, d + 0.1);
  metreUVs(g, w + 0.1, 0.05, d + 0.1);
  g.translate(0, h + 0.025, 0);
  return g;
}

/**
 * A curved slab: `w` is the straight distance between the two tips, `deg` how far it bends (sign = direction),
 * `d` its thickness. Falls back to a straight slab for a bend under MIN_CURVE_DEG.
 */
export function curvedSlabGeometry(w: number, h: number, d: number, deg: number): THREE.BufferGeometry {
  if (Math.abs(deg) < MIN_CURVE_DEG) return slabGeometry(w, h, d);
  const { radius: R, arc } = curveShape(w, deg);
  const theta = arc / R;
  const rOut = R;
  const rIn = Math.max(0.02, R - d);
  const seg = Math.max(8, Math.min(96, Math.round((theta * 180) / Math.PI / 2.5)));
  const cz = -R * Math.cos(theta / 2); // circle centre: the tips end up on z = 0
  const parts: THREE.BufferGeometry[] = [];
  const wall = (r: number) => {
    const c = new THREE.CylinderGeometry(r, r, h, seg, 1, true, -theta / 2, theta);
    const uv = c.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * r * theta, uv.getY(i) * h); // metres along the arc and up
    return c;
  };
  parts.push(wall(rOut), wall(rIn));
  // top and bottom (a flat ring spanning the arc), end faces
  for (const y of [h / 2, -h / 2]) {
    const ring = new THREE.RingGeometry(rIn, rOut, seg, 1, Math.PI / 2 - theta / 2, theta);
    ring.rotateX(Math.PI / 2);
    ring.translate(0, y, 0);
    parts.push(ring);
  }
  for (const s of [-1, 1]) {
    const phi = (s * theta) / 2;
    const end = new THREE.PlaneGeometry(rOut - rIn, h);
    const uv = end.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (rOut - rIn), uv.getY(i) * h);
    end.rotateY(phi - Math.PI / 2);
    end.translate(((rIn + rOut) / 2) * Math.sin(phi), 0, ((rIn + rOut) / 2) * Math.cos(phi));
    parts.push(end);
  }
  // All parts need the same attributes to merge (the rings carry none we use: keep position / normal / uv).
  const flat = parts.map((p) => {
    const q = p.index ? p.toNonIndexed() : p;
    for (const name of Object.keys(q.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') q.deleteAttribute(name);
    return q;
  });
  const merged = mergeGeometries(flat)!;
  merged.translate(0, h / 2, cz);
  if (deg < 0) merged.scale(1, 1, -1); // bending the other way is the mirror image (the material is double sided)
  parts.forEach((p) => p.dispose());
  return merged;
}

/** What a wall feature looks like with every default filled in. */
export function featureLook(item: Pick<Item, 'feature'>, asset: Pick<Asset, 'feature'>) {
  const f = asset.feature!;
  const o = item.feature ?? {};
  return {
    shape: f.shape,
    material: o.material ?? f.material,
    curve: f.shape === 'curved' ? (o.curve ?? f.curve ?? 0) : 0,
    cap: f.shape !== 'curved' && !!o.cap,
  };
}

/** How far the middle of a curved slab sticks out past its tips (m); 0 for a straight one. */
export const featureBulge = (w: number, deg: number): number => curveShape(w, deg).bulge;
