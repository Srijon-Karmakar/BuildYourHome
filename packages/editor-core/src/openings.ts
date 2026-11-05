import { OPENING_END_MARGIN_M } from '@hd/geometry';
import {
  DEFAULT_DOOR_HEIGHT_M,
  DEFAULT_DOOR_WIDTH_M,
  DEFAULT_WINDOW_HEIGHT_M,
  DEFAULT_WINDOW_SILL_M,
  DEFAULT_WINDOW_WIDTH_M,
  type Id,
  type Opening,
  type Scene,
  type Vec2,
  type Wall,
} from '@hd/scene-schema';

/** Clear space kept between two openings on the same wall (metres). */
export const OPENING_GAP_M = 0.05;
/** A lintel at least this thick must remain above every opening. */
export const OPENING_HEAD_CLEARANCE_M = 0.1;

export interface OpeningSize {
  width: number;
  height: number;
  sill: number;
  assetId: string;
}

/** Sensible sizes (metres) per type; clamped to the wall height by `defaultSize`. */
export const OPENING_DEFAULTS: Record<Opening['type'], OpeningSize> = {
  door: { width: DEFAULT_DOOR_WIDTH_M, height: DEFAULT_DOOR_HEIGHT_M, sill: 0, assetId: 'door-basic' },
  window: { width: DEFAULT_WINDOW_WIDTH_M, height: DEFAULT_WINDOW_HEIGHT_M, sill: DEFAULT_WINDOW_SILL_M, assetId: 'window-basic' },
  arch: { width: 1.2, height: 2.2, sill: 0, assetId: 'arch-basic' },
};

export function defaultSize(type: Opening['type'], wall: Wall): OpeningSize {
  const d = OPENING_DEFAULTS[type];
  const room = wall.height - OPENING_HEAD_CLEARANCE_M;
  const sill = Math.min(d.sill, Math.max(0, room - 0.3));
  return { ...d, sill, height: Math.max(0.3, Math.min(d.height, room - sill)) };
}

export function wallLength(scene: Scene, wall: Wall): number | null {
  const a = scene.nodes[wall.a];
  const b = scene.nodes[wall.b];
  if (!a || !b) return null;
  return Math.hypot(b.p[0] - a.p[0], b.p[1] - a.p[1]);
}

/**
 * Nearest valid centre position (distance from node a) for an opening of `width` on a wall, as close as
 * possible to `desired`. Keeps clear of the wall ends (miter-safe margin) and of other openings.
 * Returns null when it cannot fit anywhere. `excludeId` ignores the opening being moved/resized.
 */
export function freeOffset(
  scene: Scene,
  wallId: Id,
  desired: number,
  width: number,
  excludeId?: Id,
): number | null {
  const wall = scene.walls[wallId];
  if (!wall) return null;
  const len = wallLength(scene, wall);
  if (len === null) return null;

  const half = width / 2;
  const lo = OPENING_END_MARGIN_M + half;
  const hi = len - OPENING_END_MARGIN_M - half;
  if (hi < lo - 1e-9) return null;

  // Centres forbidden by neighbours: strictly inside (o.centre ± (o.half + gap + half)).
  const forbidden = Object.values(scene.openings)
    .filter((o) => o.wallId === wallId && o.id !== excludeId)
    .map((o) => [o.offset - o.width / 2 - OPENING_GAP_M - half, o.offset + o.width / 2 + OPENING_GAP_M + half] as const);

  const inside = (c: number) => forbidden.some(([a, b]) => c > a + 1e-9 && c < b - 1e-9);
  const clamp = (c: number) => Math.min(hi, Math.max(lo, c));

  const first = clamp(desired);
  if (!inside(first)) return first;

  let best: number | null = null;
  for (const [a, b] of forbidden) {
    for (const c of [a, b]) {
      if (c < lo - 1e-9 || c > hi + 1e-9 || inside(c)) continue;
      if (best === null || Math.abs(c - desired) < Math.abs(best - desired)) best = c;
    }
  }
  return best;
}

export interface WallHit {
  wallId: Id;
  /** Distance from node a to the closest point, along the wall. */
  offset: number;
  /** +1 if the point lies on the wall's L side (left of a → b), −1 on the R side. */
  side: 1 | -1;
  /** Distance from the point to the wall centre line (metres). */
  dist: number;
}

/** Closest wall centre line to `p` on a level, within `maxDist` metres. */
export function nearestWallPoint(scene: Scene, levelId: Id, p: Vec2, maxDist: number): WallHit | null {
  let best: WallHit | null = null;
  for (const w of Object.values(scene.walls)) {
    if (w.levelId !== levelId) continue;
    const a = scene.nodes[w.a];
    const b = scene.nodes[w.b];
    if (!a || !b) continue;
    const abx = b.p[0] - a.p[0];
    const abz = b.p[1] - a.p[1];
    const len = Math.hypot(abx, abz);
    if (len < 1e-6) continue;
    const ux = abx / len;
    const uz = abz / len;
    const s = Math.max(0, Math.min(len, (p[0] - a.p[0]) * ux + (p[1] - a.p[1]) * uz));
    const dx = p[0] - (a.p[0] + ux * s);
    const dz = p[1] - (a.p[1] + uz * s);
    const dist = Math.hypot(dx, dz);
    if (dist > maxDist || (best && dist >= best.dist)) continue;
    // Left normal = (−uz, ux).
    best = { wallId: w.id, offset: s, side: dx * -uz + dz * ux >= 0 ? 1 : -1, dist };
  }
  return best;
}
