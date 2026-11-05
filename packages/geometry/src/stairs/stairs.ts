import type { Vec2 } from '@hd/scene-schema';
import type { MeshData } from '../wall/mesh';

/** Comfortable proportions (≈ 17.5 cm rise, 28 cm tread — the 2R + T ≈ 63 cm rule of thumb). */
export const RISER_M = 0.175;
export const TREAD_M = 0.28;
/** Gap between the two flights of a U stair. */
export const STAIR_GAP_M = 0.1;
export const MIN_STAIR_WIDTH_M = 0.6;
export const MAX_STAIR_WIDTH_M = 3;

export type StairKind = 'straight' | 'L' | 'U';

export interface StairParams {
  kind: StairKind;
  width: number;
  /** Floor-to-floor height to climb (metres). */
  rise: number;
  /** L / U stairs turn left by default; mirrored they turn right. */
  mirror?: boolean;
}

/**
 * One step. Coordinates are LOCAL: x across the stair, z along it; the origin is the centre of the first step's
 * bottom edge and the run climbs toward −z. `height` is the top of the step above the lower floor.
 */
export interface Tread {
  /** [xMin, zMin, xMax, zMax] */
  rect: [number, number, number, number];
  height: number;
  landing: boolean;
  /** Direction of travel while climbing this step (local). */
  dir: Vec2;
}

export interface StairLayout {
  kind: StairKind;
  width: number;
  rise: number;
  /** Number of risers (the last one is the step up onto the upper floor). */
  risers: number;
  riserHeight: number;
  treads: Tread[];
  /** Outline of all treads (local), i.e. the opening the stair needs in the floor above. */
  outline: Vec2[];
}

export const stairRiserCount = (rise: number): number => Math.max(2, Math.round(rise / RISER_M));

const flip = (r: [number, number, number, number]): [number, number, number, number] => [-r[2], r[1], -r[0], r[3]];

/** Work out every step of a stair. Pure; the same input always gives the same stair. */
export function stairLayout(p: StairParams): StairLayout {
  const w = Math.min(MAX_STAIR_WIDTH_M, Math.max(MIN_STAIR_WIDTH_M, p.width));
  const risers = stairRiserCount(p.rise);
  const rh = p.rise / risers;
  const count = risers - 1; // treads; the last riser lands on the upper floor
  const t = TREAD_M;
  const g = STAIR_GAP_M;
  const treads: Tread[] = [];
  let outline: Vec2[];

  // L and U stairs need a step before the landing and one after it.
  const kind: StairKind = p.kind !== 'straight' && count < 3 ? 'straight' : p.kind;

  if (kind === 'straight') {
    for (let i = 1; i <= count; i++) {
      treads.push({ rect: [-w / 2, -i * t, w / 2, -(i - 1) * t], height: i * rh, landing: false, dir: [0, -1] });
    }
    const len = count * t;
    outline = [[-w / 2, 0], [w / 2, 0], [w / 2, -len], [-w / 2, -len]];
  } else {
    // Index of the landing. With an even number of steps the first flight gets the extra one, so the second
    // flight never runs past the start of the first.
    const m = Math.floor(count / 2) + 1;
    const f2 = count - m; // steps after the landing
    const zL1 = -(m - 1) * t; // landing, near edge
    const zL0 = zL1 - w; // landing, far edge
    for (let i = 1; i <= m - 1; i++) {
      treads.push({ rect: [-w / 2, -i * t, w / 2, -(i - 1) * t], height: i * rh, landing: false, dir: [0, -1] });
    }
    if (kind === 'L') {
      treads.push({ rect: [-w / 2, zL0, w / 2, zL1], height: m * rh, landing: true, dir: [-1, 0] });
      for (let j = 1; j <= f2; j++) {
        treads.push({ rect: [-w / 2 - j * t, zL0, -w / 2 - (j - 1) * t, zL1], height: (m + j) * rh, landing: false, dir: [-1, 0] });
      }
      const x2 = -w / 2 - f2 * t;
      outline = [[-w / 2, 0], [w / 2, 0], [w / 2, zL0], [x2, zL0], [x2, zL1], [-w / 2, zL1]];
    } else {
      const xl = -w / 2 - g - w;
      treads.push({ rect: [xl, zL0, w / 2, zL1], height: m * rh, landing: true, dir: [-1, 0] });
      for (let j = 1; j <= f2; j++) {
        treads.push({ rect: [xl, zL1 + (j - 1) * t, -w / 2 - g, zL1 + j * t], height: (m + j) * rh, landing: false, dir: [0, 1] });
      }
      const top = zL1 + f2 * t;
      outline = [[-w / 2, 0], [w / 2, 0], [w / 2, zL0], [xl, zL0], [xl, top], [-w / 2 - g, top], [-w / 2 - g, zL1], [-w / 2, zL1]];
    }
  }

  if (p.mirror && kind !== 'straight') {
    for (const tr of treads) {
      tr.rect = flip(tr.rect);
      tr.dir = [-tr.dir[0], tr.dir[1]];
    }
    outline = outline.map((q): Vec2 => [-q[0], q[1]]).reverse();
  }
  return { kind, width: w, rise: p.rise, risers, riserHeight: rh, treads, outline };
}

/** Local → world (x, z) for a stair placed at `origin` and turned by `rotationY` (same convention as Three.js). */
export function stairToWorld(origin: Vec2, rotationY: number, p: Vec2): Vec2 {
  const c = Math.cos(rotationY);
  const s = Math.sin(rotationY);
  return [origin[0] + p[0] * c + p[1] * s, origin[1] - p[0] * s + p[1] * c];
}

/** World → local (inverse of `stairToWorld`). */
export function stairToLocal(origin: Vec2, rotationY: number, p: Vec2): Vec2 {
  const c = Math.cos(rotationY);
  const s = Math.sin(rotationY);
  const dx = p[0] - origin[0];
  const dz = p[1] - origin[1];
  return [dx * c - dz * s, dx * s + dz * c];
}

/** The stair's outline in world coordinates. */
export function stairOutlineWorld(layout: StairLayout, origin: Vec2, rotationY: number): Vec2[] {
  return layout.outline.map((q) => stairToWorld(origin, rotationY, q));
}

/** Height of the step under a LOCAL point (above the lower floor), or null when the point is not on the stair. */
export function stairHeightAt(layout: StairLayout, local: Vec2, eps = 1e-6): number | null {
  let best: number | null = null;
  for (const tr of layout.treads) {
    const [x0, z0, x1, z1] = tr.rect;
    if (local[0] >= x0 - eps && local[0] <= x1 + eps && local[1] >= z0 - eps && local[1] <= z1 + eps) {
      if (best === null || tr.height > best) best = tr.height;
    }
  }
  return best;
}

/**
 * Solid steps as one mesh in LOCAL coordinates (wrap it in a group placed at the stair's origin, rotated by rotationY).
 * Every step is a block from the lower floor up to its top; the underside is left out.
 */
export function buildStairMesh(layout: StairLayout): MeshData {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const quad = (a: number[], b: number[], c: number[], d: number[], n: number[], uv: (p: number[]) => [number, number]) => {
    const base = positions.length / 3;
    for (const p of [a, b, c, d]) {
      positions.push(p[0]!, p[1]!, p[2]!);
      normals.push(n[0]!, n[1]!, n[2]!);
      uvs.push(...uv(p));
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };

  for (const tr of layout.treads) {
    const [x0, z0, x1, z1] = tr.rect;
    const h = tr.height;
    // Counter-clockwise seen from outside.
    quad([x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0], [0, 1, 0], (p) => [p[0]!, p[2]!]); // top
    quad([x0, 0, z1], [x1, 0, z1], [x1, h, z1], [x0, h, z1], [0, 0, 1], (p) => [p[0]!, p[1]!]); // +z
    quad([x1, 0, z0], [x0, 0, z0], [x0, h, z0], [x1, h, z0], [0, 0, -1], (p) => [p[0]!, p[1]!]); // −z
    quad([x1, 0, z1], [x1, 0, z0], [x1, h, z0], [x1, h, z1], [1, 0, 0], (p) => [p[2]!, p[1]!]); // +x
    quad([x0, 0, z0], [x0, 0, z1], [x0, h, z1], [x0, h, z0], [-1, 0, 0], (p) => [p[2]!, p[1]!]); // −x
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices),
    groups: [{ slot: 'top', start: 0, count: indices.length }],
  };
}
