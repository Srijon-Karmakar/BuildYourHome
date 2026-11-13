import type { Scene } from '@hd/scene-schema';

/**
 * Gentle real relief for the land around the home. Everything that is placed (plot, house, garden areas, roads, items,
 * the ring of trees and the grass tufts round the house) stands on flat ground at height 0: the land only starts to rise and
 * fall a few metres past all of it, and it settles back to flat before the far scenery ring (88 m), so nothing floats or sinks.
 */

/** [x0, z0, x1, z1] of the flat area. */
export type FlatRect = [number, number, number, number];

/** Extra flat ground past everything placed (m). */
export const TERRAIN_MARGIN_M = 8;
/** Distance over which the relief eases in past the flat area (m). */
export const TERRAIN_RAMP_M = 18;
/** Largest rise (m). */
export const TERRAIN_AMPLITUDE_M = 1.2;
/** The relief fades back to flat between these distances from the centre (m). */
export const TERRAIN_FADE: [number, number] = [62, 82];
/** Size of the terrain square (m) and grid cells per side by tier. */
export const TERRAIN_SIZE_M = 300;

export function terrainFlatRect(scene: Scene): FlatRect {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  const add = (x: number, z: number, r = 0) => {
    x0 = Math.min(x0, x - r); z0 = Math.min(z0, z - r); x1 = Math.max(x1, x + r); z1 = Math.max(z1, z + r);
  };
  for (const p of scene.plot?.boundary ?? []) add(p[0], p[1], 4); // the ring of trees stands up to ~4 m outside the plot
  for (const w of Object.values(scene.walls)) {
    for (const id of [w.a, w.b]) {
      const n = scene.nodes[id];
      if (n) add(n.p[0], n.p[1], 10); // grass tufts and ring trees reach ~10 m past the house when there is no plot
    }
  }
  for (const z of Object.values(scene.zones)) for (const p of z.points) add(p[0], p[1], (z.width ?? 1) / 2 + 6); // roads + pavements
  for (const it of Object.values(scene.items)) add(it.position[0], it.position[2], 3 * Math.max(1, it.scale[0], it.scale[2]));
  for (const b of Object.values(scene.balconies)) for (const p of b.outline) add(p[0], p[1], 1);
  if (x0 === Infinity) [x0, z0, x1, z1] = [-12, -9, 12, 9];
  const m = TERRAIN_MARGIN_M;
  return [x0 - m, z0 - m, x1 + m, z1 + m];
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function hash(ix: number, iz: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise in [-1, 1]. */
function noise(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return (a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz) * 2 - 1;
}

/** Height of the land at (x, z). 0 on the flat area and far away; low mounds and dips in between. */
export function terrainHeight(x: number, z: number, flat: FlatRect): number {
  const dx = Math.max(flat[0] - x, 0, x - flat[2]);
  const dz = Math.max(flat[1] - z, 0, z - flat[3]);
  const out = Math.hypot(dx, dz);
  if (out <= 0) return 0;
  const r = Math.hypot(x, z);
  const k = smooth(0, TERRAIN_RAMP_M, out) * (1 - smooth(TERRAIN_FADE[0], TERRAIN_FADE[1], r));
  if (k <= 0) return 0;
  const n = noise(x / 19 + 11.3, z / 19 - 4.1) * 0.65 + noise(x / 7.5 - 2.7, z / 7.5 + 7.9) * 0.35;
  return TERRAIN_AMPLITUDE_M * k * (0.35 + 0.65 * n);
}

/** Grid of the terrain: positions (x, y, z) and indices for a square of `TERRAIN_SIZE_M` with `cells` cells per side. */
export function terrainGrid(flat: FlatRect, cells: number, y0: number): { positions: Float32Array; indices: Uint32Array } {
  const n = cells + 1;
  const positions = new Float32Array(n * n * 3);
  const half = TERRAIN_SIZE_M / 2;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = -half + (i / cells) * TERRAIN_SIZE_M;
      const z = -half + (j / cells) * TERRAIN_SIZE_M;
      const k = (j * n + i) * 3;
      positions[k] = x;
      positions[k + 1] = y0 + terrainHeight(x, z, flat);
      positions[k + 2] = z;
    }
  }
  const indices = new Uint32Array(cells * cells * 6);
  let t = 0;
  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      const a = j * n + i;
      const b = a + 1;
      const c = a + n;
      const d = c + 1;
      // counter-clockwise seen from above (+y up)
      indices[t++] = a; indices[t++] = c; indices[t++] = b;
      indices[t++] = b; indices[t++] = c; indices[t++] = d;
    }
  }
  return { positions, indices };
}
