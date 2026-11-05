import { rotationFacing, type Asset } from '@hd/assets';
import type { Id, Scene, Vec2, Vec3 } from '@hd/scene-schema';
import { nearestWallPoint } from './openings';

/** How far (m) from its back to a wall face a floor item still snaps flush against the wall. */
export const WALL_SNAP_REACH_M = 0.3;
/** Wall-mounted items look for a wall this close to the pointer. */
export const WALL_MOUNT_REACH_M = 0.8;
const SKIN_M = 0.005;

export interface PlacementOptions {
  /** Used when the item is not snapped to a wall (radians). */
  rotationY?: number;
  scale?: Vec3;
  /** Grid step for the item's position (m). 0 disables. */
  grid?: number;
  /** Snap floor items back-to-wall and require a wall for wall-mounted items. */
  snapWalls?: boolean;
}

export interface Placement {
  /** [x, y, z] with y measured from the floor of the level. */
  position: Vec3;
  rotationY: number;
  wallId?: Id;
}

const snap = (v: number, step: number) => (step > 0 ? Math.round(v / step) * step : v);

/** Normalize an angle to (−π, π]. */
export function wrapAngle(a: number): number {
  let r = a % (2 * Math.PI);
  if (r > Math.PI) r -= 2 * Math.PI;
  if (r <= -Math.PI) r += 2 * Math.PI;
  return r;
}

/**
 * Where an item ends up when the pointer is at `pointer` (plan metres).
 *  - Floor items: grid-snapped; near a wall they slide flush against the wall face and turn their back to it.
 *  - Wall items (art, mirrors): hang on the nearest wall face at their mount height; null when no wall is near.
 *  - Ceiling items: hang from the ceiling of the level.
 */
export function solvePlacement(
  scene: Scene,
  levelId: Id,
  asset: Asset,
  pointer: Vec2,
  opts: PlacementOptions = {},
): Placement | null {
  const level = scene.levels[levelId];
  if (!level) return null;
  const scale = opts.scale ?? [1, 1, 1];
  const grid = opts.grid ?? 0.05;
  const rot = opts.rotationY ?? 0;
  const snapWalls = opts.snapWalls ?? true;
  const width = asset.size[0] * scale[0];
  const depth = asset.size[1] * scale[2];
  const halfD = asset.shape === 'round' ? width / 2 : depth / 2;

  const toWall = (reach: number, itemHalfDepth: number): Placement | null => {
    const hit = nearestWallPoint(scene, levelId, pointer, reach + 0.5);
    const wall = hit && scene.walls[hit.wallId];
    const a = wall && scene.nodes[wall.a]?.p;
    const b = wall && scene.nodes[wall.b]?.p;
    if (!hit || !wall || !a || !b) return null;
    const faceDist = hit.dist - wall.thickness / 2;
    if (faceDist > reach) return null;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ux = (b[0] - a[0]) / len;
    const uz = (b[1] - a[1]) / len;
    const nx = -uz * hit.side; // from the wall toward the pointer side
    const nz = ux * hit.side;
    const along = Math.min(len, Math.max(0, snap(hit.offset, grid)));
    const off = wall.thickness / 2 + itemHalfDepth + SKIN_M;
    return {
      position: [a[0] + ux * along + nx * off, 0, a[1] + uz * along + nz * off],
      rotationY: wrapAngle(rotationFacing(nx, nz)),
      wallId: wall.id,
    };
  };

  if (asset.mount === 'wall') {
    if (!snapWalls) return { position: [snap(pointer[0], grid), asset.mountHeight ?? 1.5, snap(pointer[1], grid)], rotationY: wrapAngle(rot) };
    const p = toWall(WALL_MOUNT_REACH_M, depth / 2);
    return p && { ...p, position: [p.position[0], asset.mountHeight ?? 1.5, p.position[2]] };
  }

  if (asset.mount === 'ceiling') {
    return { position: [snap(pointer[0], grid), level.height, snap(pointer[1], grid)], rotationY: wrapAngle(rot) };
  }

  if (snapWalls) {
    const p = toWall(halfD + WALL_SNAP_REACH_M, halfD);
    if (p) return asset.shape === 'round' ? { ...p, rotationY: wrapAngle(rot) } : p;
  }
  return { position: [snap(pointer[0], grid), 0, snap(pointer[1], grid)], rotationY: wrapAngle(rot) };
}
