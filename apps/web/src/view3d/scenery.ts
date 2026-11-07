import type { CompassSide, ResolvedEnvironment } from '@hd/editor-core';
import type { SceneryKind, ScenerySide } from '@hd/scene-schema';

/**
 * The scenery on the horizon, as maths only (no Three.js), so it can be tested. The horizon is a ring seen from the
 * middle of the scene; the angle `a` runs round it with x = cos a and z = sin a, so east is 0, south is π/2, west is π
 * and north (−z, the top of the plan) is 3π/2. Each side's scenery blends into its neighbours over about 40°.
 */

export type Rgb = [number, number, number];
export type Ring = 'far' | 'near';

/** Where the sides stand round the ring. */
export const SIDE_ANGLE: Record<CompassSide, number> = { east: 0, south: Math.PI / 2, west: Math.PI, north: Math.PI * 1.5 };
const SIDES = Object.keys(SIDE_ANGLE) as CompassSide[];
const TAU = Math.PI * 2;

/** How much of the scenery at angle `a` belongs to each side (they add up to 1; a side holds its own scenery within about 25°). */
export function sideWeights(a: number): Record<CompassSide, number> {
  const w = {} as Record<CompassSide, number>;
  let sum = 0;
  for (const s of SIDES) {
    let d = (((a - SIDE_ANGLE[s]) % TAU) + TAU) % TAU;
    if (d > Math.PI) d -= TAU;
    const c = Math.max(0, Math.cos(d));
    w[s] = c ** 6;
    sum += w[s];
  }
  for (const s of SIDES) w[s] /= sum || 1;
  return w;
}

const hex = (h: string): Rgb => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const lerp = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// Slow bumps round the ring, with a fixed phase per ring so the same home always looks the same.
const PHASE = { far: [1.3, 4.1, 2.2, 5.5], near: [3.7, 0.4, 5.9, 2.8] } as const;
function bumps(ring: Ring, a: number): number {
  const p = PHASE[ring];
  return 0.55 * Math.sin(3 * a + p[0]) + 0.3 * Math.sin(7 * a + p[1]) + 0.15 * Math.sin(17 * a + p[2]);
}
/** 0..1 with sharp peaks. */
function ridges(ring: Ring, a: number): number {
  const p = PHASE[ring];
  const v = Math.abs(0.6 * Math.sin(2.3 * a + p[1]) + 0.4 * Math.sin(5.1 * a + p[3]) + 0.12 * Math.sin(13 * a + p[0]));
  const big = Math.min(1, Math.max(0, 1 - v)) ** 1.5;
  // a second, finer set of ridges on top gives the jagged summits
  const fine = 1 - Math.abs(Math.sin(19 * a + p[2]) * 0.6 + Math.sin(31 * a + p[0]) * 0.4);
  return Math.min(1, big * (0.78 + 0.22 * fine));
}

/** Small, quick unevenness: a tree line. */
function treeline(ring: Ring, a: number): number {
  const p = PHASE[ring];
  return 0.5 + 0.35 * Math.sin(61 * a + p[2]) + 0.15 * Math.sin(97 * a + p[0]);
}

/** Height of one kind of scenery at the angle, in metres (before the side's own height setting). */
function baseHeight(kind: SceneryKind, ring: Ring, a: number): number {
  switch (kind) {
    case 'hills':
      return ring === 'far' ? 30 + 24 * bumps(ring, a) : 13 + 11 * bumps(ring, a);
    case 'mountains':
      return ring === 'far' ? 22 + 52 * ridges(ring, a) : 11 + 8 * bumps(ring, a);
    case 'forest':
      return ring === 'far' ? 8 + 3 * bumps(ring, a) + 5 * treeline(ring, a) : 5 + 2 * bumps(ring, a) + 4 * treeline(ring, a);
    case 'desert':
      return ring === 'far' ? 4 + 3.5 * bumps(ring, a) : 2 + 1.6 * bumps(ring, a);
    default:
      return 0; // open land, sea and city have no relief (a skyline is made of buildings)
  }
}

interface Palette {
  bottom: Rgb;
  top: Rgb;
}
const PALETTE: Record<'hills' | 'mountains' | 'forest' | 'desert', Record<Ring, Palette>> = {
  hills: { far: { bottom: hex('#cdd6db'), top: hex('#8aa0ae') }, near: { bottom: hex('#b9c9b2'), top: hex('#7d9876') } },
  mountains: { far: { bottom: hex('#aab6c2'), top: hex('#5d6a79') }, near: { bottom: hex('#aab9a6'), top: hex('#6f8768') } },
  forest: { far: { bottom: hex('#9db39a'), top: hex('#4a6b45') }, near: { bottom: hex('#86a082'), top: hex('#3f5f3b') } },
  desert: { far: { bottom: hex('#e8d9b2'), top: hex('#d6bd8a') }, near: { bottom: hex('#dccb9d'), top: hex('#cdb078') } },
};
const TONE: Record<NonNullable<ScenerySide['tone']>, Record<Ring, Palette> | null> = {
  natural: null,
  green: { far: { bottom: hex('#b4cca8'), top: hex('#6c9a5c') }, near: { bottom: hex('#a2c094'), top: hex('#5b8a4c') } },
  golden: { far: { bottom: hex('#e2d3a6'), top: hex('#b79b58') }, near: { bottom: hex('#d8c795'), top: hex('#a68a4b') } },
  rocky: { far: { bottom: hex('#c4c1ba'), top: hex('#86847f') }, near: { bottom: hex('#b3b0a8'), top: hex('#76746f') } },
  misty: { far: { bottom: hex('#dbe3ea'), top: hex('#a7b6c3') }, near: { bottom: hex('#cfd9e1'), top: hex('#9aabba') } },
};
const SNOW = hex('#f1f4f8');
const NO_RELIEF: [Rgb, Rgb, Rgb, Rgb] = [hex('#a5b595'), hex('#a5b595'), hex('#a5b595'), hex('#a5b595')];
/** Where the snow starts on mountains (m above the ground, for a normal-height side); it scales with the side's height. */
export const SNOW_LINE_M = 42;

/**
 * The four colours of the scenery wall of one side: at the foot, low on the slope, high on the slope and at the top.
 * Snowy mountains turn from rock to snow over the last two (see `WallPoint.snowAt` for the height).
 */
export function wallColors(side: Required<ScenerySide>, ring: Ring): [Rgb, Rgb, Rgb, Rgb] {
  if (side.kind !== 'hills' && side.kind !== 'mountains' && side.kind !== 'forest' && side.kind !== 'desert') return NO_RELIEF;
  const pal = TONE[side.tone]?.[ring] ?? PALETTE[side.kind][ring];
  if (side.kind === 'mountains' && side.snow && ring === 'far') return [pal.bottom, pal.top, SNOW, SNOW];
  return [pal.bottom, lerp(pal.bottom, pal.top, 0.6), lerp(pal.bottom, pal.top, 0.85), pal.top];
}

export interface WallPoint {
  /** Height of the top of the wall (m). */
  h: number;
  /** Height where the second colour row sits (the snow line on snowy mountains, else 0.6 of the height). The third is just above. */
  snowAt: number;
  /** Colours at the foot, low, high and at the top. */
  colors: [Rgb, Rgb, Rgb, Rgb];
}

/** The scenery wall at one angle: the heights and colours of the four sides blended by how close the angle is to each. */
export function wallAt(env: Pick<ResolvedEnvironment, 'sides'>, ring: Ring, a: number): WallPoint {
  const w = sideWeights(a);
  let h = 0;
  let snowAt = 0;
  const colors: [Rgb, Rgb, Rgb, Rgb] = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const s of SIDES) {
    if (w[s] < 1e-4) continue;
    const side = env.sides[s];
    const hs = Math.max(0, baseHeight(side.kind, ring, a)) * side.height;
    h += w[s] * hs;
    snowAt += w[s] * (side.kind === 'mountains' && side.snow && ring === 'far' ? SNOW_LINE_M * side.height : 0.6 * hs);
    const c = wallColors(side, ring);
    for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) colors[r]![k]! += w[s] * c[r]![k]!;
  }
  return { h, snowAt, colors };
}

/** How much of the horizon at this angle is a city (0..1), and how tall its buildings should be (the side's height setting). */
export function cityAt(env: Pick<ResolvedEnvironment, 'sides'>, a: number): { amount: number; height: number } {
  const w = sideWeights(a);
  let amount = 0;
  let height = 0;
  for (const s of SIDES) {
    if (env.sides[s].kind !== 'city') continue;
    amount += w[s];
    height += w[s] * env.sides[s].height;
  }
  return { amount, height: amount > 0 ? height / amount : 1 };
}

const GROUND_TINT: Partial<Record<SceneryKind, Rgb>> = {
  sea: hex('#2d6a92'),
  desert: hex('#d8c08e'),
  forest: hex('#5f7c55'),
  city: hex('#9a9d9c'),
};

/** Colour of the flat land beyond the plot at one angle: the home's own ground, or water, sand, woodland or paving. */
export function groundAt(env: Pick<ResolvedEnvironment, 'sides'>, a: number, base: Rgb): Rgb {
  const w = sideWeights(a);
  const out: Rgb = [0, 0, 0];
  for (const s of SIDES) {
    if (w[s] < 1e-4) continue;
    const c = GROUND_TINT[env.sides[s].kind] ?? base;
    for (let k = 0; k < 3; k++) out[k]! += w[s] * c[k]!;
  }
  return out;
}

/** True when nothing but flat land lies on the horizon (nothing to draw). */
export const isFlat = (env: Pick<ResolvedEnvironment, 'sides'>): boolean => SIDES.every((s) => env.sides[s].kind === 'plains');
