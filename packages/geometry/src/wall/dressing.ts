import type { WallFootprint } from './footprint';
import { axialOf, type OpeningCut } from './openings';

/**
 * Wall dressing (ADR-030): feature panels and mouldings are thin solids proud of a wall face, cut round the openings.
 * Everything here works in the wall's face coordinates: `s` = distance along the wall from node a (the same axis as
 * opening offsets, for both faces), `y` = height above the wall's floor.
 */

/** An axis-aligned rectangle on a wall face. */
export interface FaceRect {
  s0: number;
  s1: number;
  y0: number;
  y1: number;
}

const EPS = 1e-6;

/**
 * A rectangle minus the openings, as non-overlapping rectangles (columns between the opening edges, each split
 * vertically round the openings that cover it). Openings may be grown by `margin` (a gap round each hole).
 */
export function rectMinusCuts(rect: FaceRect, cuts: readonly OpeningCut[], margin = 0): FaceRect[] {
  if (rect.s1 - rect.s0 <= EPS || rect.y1 - rect.y0 <= EPS) return [];
  const holes = cuts
    .map((c) => ({ s0: c.offset - c.width / 2 - margin, s1: c.offset + c.width / 2 + margin, y0: c.sill - margin, y1: c.sill + c.height + margin }))
    .filter((h) => h.s1 > rect.s0 + EPS && h.s0 < rect.s1 - EPS && h.y1 > rect.y0 + EPS && h.y0 < rect.y1 - EPS);
  if (holes.length === 0) return [{ ...rect }];
  const xs = new Set<number>([rect.s0, rect.s1]);
  for (const h of holes) {
    if (h.s0 > rect.s0 && h.s0 < rect.s1) xs.add(h.s0);
    if (h.s1 > rect.s0 && h.s1 < rect.s1) xs.add(h.s1);
  }
  const cols = [...xs].sort((a, b) => a - b);
  const out: FaceRect[] = [];
  for (let i = 0; i + 1 < cols.length; i++) {
    const s0 = cols[i]!;
    const s1 = cols[i + 1]!;
    if (s1 - s0 <= EPS) continue;
    const mid = (s0 + s1) / 2;
    // Vertical intervals of the rect not covered by a hole spanning this column.
    const covered = holes.filter((h) => h.s0 < mid && h.s1 > mid).map((h) => [Math.max(rect.y0, h.y0), Math.min(rect.y1, h.y1)] as const).sort((a, b) => a[0] - b[0]);
    let y = rect.y0;
    for (const [c0, c1] of covered) {
      if (c0 > y + EPS) out.push({ s0, s1, y0: y, y1: c0 });
      y = Math.max(y, c1);
    }
    if (rect.y1 > y + EPS) out.push({ s0, s1, y0: y, y1: rect.y1 });
  }
  return mergeColumns(out);
}

/** Join neighbouring pieces with the same vertical extent (fewer, longer boxes). */
function mergeColumns(rects: FaceRect[]): FaceRect[] {
  const sorted = [...rects].sort((a, b) => a.y0 - b.y0 || a.y1 - b.y1 || a.s0 - b.s0);
  const out: FaceRect[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.y0 - r.y0) < EPS && Math.abs(last.y1 - r.y1) < EPS && Math.abs(last.s1 - r.s0) < EPS) last.s1 = r.s1;
    else out.push({ ...r });
  }
  return out;
}

/** Axial extent [start, end] of one face (A = +1 / L, B = -1 / R), mitered corners included. */
export function faceSpan(fp: WallFootprint, side: 1 | -1): [number, number] {
  const [aL, bL, bR, aR] = fp.footprint;
  return side === 1 ? [axialOf(fp, aL), axialOf(fp, bL)] : [axialOf(fp, aR), axialOf(fp, bR)];
}

/** Horizontal runs of a band at height y0..y1 along a face, broken at the openings it would cross. */
export function bandRuns(span: readonly [number, number], y0: number, y1: number, cuts: readonly OpeningCut[], margin = 0): FaceRect[] {
  return rectMinusCuts({ s0: span[0], s1: span[1], y0, y1 }, cuts, margin);
}
