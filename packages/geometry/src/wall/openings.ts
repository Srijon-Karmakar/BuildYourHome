import type { Vec2 } from '@hd/scene-schema';
import type { WallFootprint } from './footprint';

/** A rectangular hole in a wall, in the wall's own frame (metres). */
export interface OpeningCut {
  /** Distance of the opening's centre from node `a`, along the wall centre line. */
  offset: number;
  width: number;
  height: number;
  /** Height of the bottom edge above the floor (0 for doors). */
  sill: number;
}

/** Axial coordinate (distance from node a along the wall direction) of a plan point. */
export const axialOf = (fp: WallFootprint, p: Vec2): number =>
  (p[0] - fp.origin[0]) * fp.dir[0] + (p[1] - fp.origin[1]) * fp.dir[1];

/** Left normal of the wall (the "L"/A side): (-dir.z, dir.x). */
export const leftNormal = (fp: WallFootprint): Vec2 => [-fp.dir[1], fp.dir[0]];

/** Plan point on the L (side = +1) or R (side = -1) face at axial position `s`. */
export function facePoint(fp: WallFootprint, s: number, side: 1 | -1): Vec2 {
  const n = leftNormal(fp);
  const h = (fp.thickness / 2) * side;
  return [fp.origin[0] + fp.dir[0] * s + n[0] * h, fp.origin[1] + fp.dir[1] * s + n[1] * h];
}

/** Openings must clear the wall ends by at least this much (also covers miter shift at corners). */
export const OPENING_END_MARGIN_M = 0.15;

/** Tiny tolerance for comparing axial positions. */
const EPS = 1e-6;

/**
 * Keep only cuts that can actually be built: inside the wall (both faces), sorted, non-overlapping
 * (a later overlapping cut is dropped) and with positive size. Heights are clamped below the wall top
 * so a lintel always remains.
 */
export function validCuts(fp: WallFootprint, cuts: readonly OpeningCut[], wallHeight: number): OpeningCut[] {
  const [aL, bL, bR, aR] = fp.footprint;
  const lo = Math.max(axialOf(fp, aL), axialOf(fp, aR));
  const hi = Math.min(axialOf(fp, bL), axialOf(fp, bR));
  const out: OpeningCut[] = [];
  let lastEnd = -Infinity;
  for (const c of [...cuts].sort((p, q) => p.offset - q.offset)) {
    const s0 = c.offset - c.width / 2;
    const s1 = c.offset + c.width / 2;
    const sill = Math.max(0, c.sill);
    const top = Math.min(sill + c.height, wallHeight - 0.05);
    if (c.width <= EPS || top - sill <= EPS) continue;
    if (s0 < lo + EPS || s1 > hi - EPS || s0 < lastEnd - EPS) continue;
    out.push({ offset: c.offset, width: c.width, height: top - sill, sill });
    lastEnd = s1;
  }
  return out;
}

/**
 * Solid pieces of the wall as seen in plan, with a gap at every opening (doors AND windows).
 * Each piece is a quad [Lstart, Lend, Rend, Rstart]; the outer pieces keep the mitered wall ends.
 */
export function wallPlanPieces(fp: WallFootprint, cuts: readonly OpeningCut[], wallHeight: number): Vec2[][] {
  const [aL, bL, bR, aR] = fp.footprint;
  const valid = validCuts(fp, cuts, wallHeight);
  const pieces: Vec2[][] = [];
  let startL: Vec2 = aL;
  let startR: Vec2 = aR;
  for (const c of valid) {
    const s0 = c.offset - c.width / 2;
    const s1 = c.offset + c.width / 2;
    pieces.push([startL, facePoint(fp, s0, 1), facePoint(fp, s0, -1), startR]);
    startL = facePoint(fp, s1, 1);
    startR = facePoint(fp, s1, -1);
  }
  pieces.push([startL, bL, bR, startR]);
  return pieces;
}
