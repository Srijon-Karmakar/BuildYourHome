import type { Asset } from './catalog';

export type V2 = [number, number];

/**
 * Item local (x, z) → world plan coordinates. Matches Three.js `rotation.y = θ`:
 * local +x → (cos θ, −sin θ), local +z (front) → (sin θ, cos θ).
 */
export function localToPlan(pos: V2, rotationY: number, lx: number, lz: number): V2 {
  const c = Math.cos(rotationY);
  const s = Math.sin(rotationY);
  return [pos[0] + lx * c + lz * s, pos[1] - lx * s + lz * c];
}

/** Unit vector (plan) the item faces. */
export const frontOf = (rotationY: number): V2 => [Math.sin(rotationY), Math.cos(rotationY)];

/** Rotation that makes an item face along plan direction (nx, nz). */
export const rotationFacing = (nx: number, nz: number): number => Math.atan2(nx, nz);

/** Size of the item on the plan after user scaling: [width, depth]. */
export function scaledSize(asset: Asset, scale: readonly [number, number, number]): V2 {
  return [asset.size[0] * scale[0], asset.size[1] * scale[2]];
}

/**
 * Footprint polygon in plan coordinates (4 corners for rect, 12-gon for round).
 * `scale` is [sx, sy, sz] of the item; x scales width, z scales depth.
 */
export function itemFootprint(asset: Asset, pos: V2, rotationY: number, scale: readonly [number, number, number] = [1, 1, 1]): V2[] {
  const hw = (asset.size[0] * scale[0]) / 2;
  const hd = (asset.size[1] * scale[2]) / 2;
  if (asset.shape === 'round') {
    const out: V2[] = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      out.push(localToPlan(pos, rotationY, Math.cos(a) * hw, Math.sin(a) * hd));
    }
    return out;
  }
  return [
    localToPlan(pos, rotationY, -hw, -hd),
    localToPlan(pos, rotationY, hw, -hd),
    localToPlan(pos, rotationY, hw, hd),
    localToPlan(pos, rotationY, -hw, hd),
  ];
}

/** Is a plan point inside the item's (rotated) footprint? Used for picking. */
export function pointInItem(
  asset: Asset,
  pos: V2,
  rotationY: number,
  scale: readonly [number, number, number],
  p: V2,
  margin = 0,
): boolean {
  const dx = p[0] - pos[0];
  const dz = p[1] - pos[1];
  const c = Math.cos(rotationY);
  const s = Math.sin(rotationY);
  // Inverse of localToPlan.
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  const hw = (asset.size[0] * scale[0]) / 2 + margin;
  const hd = (asset.size[1] * scale[2]) / 2 + margin;
  if (asset.shape === 'round') return (lx / hw) ** 2 + (lz / hd) ** 2 <= 1;
  return Math.abs(lx) <= hw && Math.abs(lz) <= hd;
}
