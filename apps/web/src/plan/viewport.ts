/** screen = world * scale + offset. World is metres (x east, z south); screen is CSS pixels. */
export interface View {
  scale: number;
  ox: number;
  oy: number;
}

export const MIN_SCALE = 8;
export const MAX_SCALE = 500;

export const toScreen = (v: View, x: number, z: number): [number, number] => [
  x * v.scale + v.ox,
  z * v.scale + v.oy,
];

export const toWorld = (v: View, sx: number, sy: number): [number, number] => [
  (sx - v.ox) / v.scale,
  (sy - v.oy) / v.scale,
];

/** Zoom so that the world point under screen (sx, sy) stays put. */
export function zoomAt(v: View, sx: number, sy: number, newScale: number): void {
  const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));
  const [wx, wz] = toWorld(v, sx, sy);
  v.scale = s;
  v.ox = sx - wx * s;
  v.oy = sy - wz * s;
}
