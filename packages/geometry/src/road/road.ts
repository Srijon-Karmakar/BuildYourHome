import type { Vec2 } from '@hd/scene-schema';

/**
 * Roads: a centre line with a width, lanes, markings, pavements and kerbs. Everything here is plan geometry in metres
 * (the 3D mesh and the plan drawing are both built from the same `roadLayout`, so they always agree).
 */

export const ROAD_MIN_WIDTH_M = 2.5;
export const ROAD_MAX_WIDTH_M = 24;
export const ROAD_DEFAULT_WIDTH_M = 6;

export type CentreLine = 'none' | 'dashed' | 'solid' | 'double';
export type ParkingSide = 'none' | 'left' | 'right' | 'both';
export type ExtraKind = 'light' | 'tree' | 'bench' | 'bin' | 'bollard';
export type ExtraSide = 'both' | 'left' | 'right' | 'alternate';

export interface RoadExtra {
  kind: ExtraKind;
  side: ExtraSide;
  spacing: number;
  /** For trees: which tree. */
  asset?: string;
}

/** The look of a road (the same shape as `Zone.road` in the scene). */
export interface RoadStyleInput {
  lanes: number;
  oneWay?: boolean;
  centre: CentreLine;
  edges: boolean;
  /** Kerb height (m); 0 = the pavement is level with the road. */
  kerb: number;
  pavLeft: number;
  pavRight: number;
  parking: ParkingSide;
  /** Zebra crossings and speed bumps: positions along the road, 0..1. */
  crossings: readonly number[];
  bumps: readonly number[];
  extras: readonly RoadExtra[];
}

export type Mark = { pts: [Vec2, Vec2, Vec2, Vec2]; color: 'white' | 'yellow' };

export interface RoadLayout {
  /** The carriageway outline. */
  carriage: Vec2[];
  /** Pavement outlines (null when that side has no pavement). */
  left: Vec2[] | null;
  right: Vec2[] | null;
  /** Paint on the carriageway, as little quads. */
  marks: Mark[];
  /** Total length of the centre line. */
  length: number;
}

const dedupe = (line: readonly Vec2[]): Vec2[] => {
  const out: Vec2[] = [];
  for (const p of line) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 1e-3) out.push([p[0], p[1]]);
  }
  return out;
};

/** The centre line shifted sideways by `d` (positive = left of the direction of travel), mitred at corners. */
export function offsetLine(line: readonly Vec2[], d: number): Vec2[] {
  const pts = dedupe(line);
  if (pts.length < 2) return [];
  const dirs = pts.slice(0, -1).map((p, i) => {
    const q = pts[i + 1]!;
    const l = Math.hypot(q[0] - p[0], q[1] - p[1]);
    return [(q[0] - p[0]) / l, (q[1] - p[1]) / l] as Vec2;
  });
  const normal = (v: Vec2): Vec2 => [-v[1], v[0]];
  return pts.map((p, i) => {
    if (i === 0) {
      const n = normal(dirs[0]!);
      return [p[0] + n[0] * d, p[1] + n[1] * d];
    }
    if (i === pts.length - 1) {
      const n = normal(dirs[i - 1]!);
      return [p[0] + n[0] * d, p[1] + n[1] * d];
    }
    const n0 = normal(dirs[i - 1]!);
    const n1 = normal(dirs[i]!);
    let mx = n0[0] + n1[0];
    let mz = n0[1] + n1[1];
    const ml = Math.hypot(mx, mz);
    if (ml < 1e-6) return [p[0] + n1[0] * d, p[1] + n1[1] * d];
    mx /= ml;
    mz /= ml;
    const cos = mx * n1[0] + mz * n1[1];
    const k = d / Math.max(cos, 0.5); // the mitre never grows past twice the offset
    return [p[0] + mx * k, p[1] + mz * k];
  });
}

export function lineLength(line: readonly Vec2[]): number {
  const pts = dedupe(line);
  let l = 0;
  for (let i = 0; i + 1 < pts.length; i++) l += Math.hypot(pts[i + 1]![0] - pts[i]![0], pts[i + 1]![1] - pts[i]![1]);
  return l;
}

/** The same line with extra points so no piece is longer than `maxStep` (so a junction can cut a pavement short). */
export function densify(line: readonly Vec2[], maxStep: number): Vec2[] {
  const pts = dedupe(line);
  if (pts.length < 2) return pts;
  const out: Vec2[] = [pts[0]!];
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / maxStep));
    for (let k = 1; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}

/** The point at distance `s` along the line, with its unit direction. */
export function samplePath(line: readonly Vec2[], s: number): { p: Vec2; dir: Vec2 } {
  const pts = dedupe(line);
  let rest = Math.max(0, s);
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (rest <= l || i + 2 === pts.length) {
      const t = l > 0 ? Math.min(1, rest / l) : 0;
      return { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], dir: [(b[0] - a[0]) / l, (b[1] - a[1]) / l] };
    }
    rest -= l;
  }
  return { p: pts[0] ?? [0, 0], dir: [1, 0] };
}

const polygonOf = (a: readonly Vec2[], b: readonly Vec2[]): Vec2[] => [...a, ...b.slice().reverse()];

/** A little quad of paint from distance s0 to s1 along the road, between sideways offsets d0 and d1. */
function quadAt(line: readonly Vec2[], s0: number, s1: number, d0: number, d1: number): [Vec2, Vec2, Vec2, Vec2] {
  const a = samplePath(line, s0);
  const b = samplePath(line, s1);
  const na: Vec2 = [-a.dir[1], a.dir[0]];
  const nb: Vec2 = [-b.dir[1], b.dir[0]];
  return [
    [a.p[0] + na[0] * d0, a.p[1] + na[1] * d0],
    [b.p[0] + nb[0] * d0, b.p[1] + nb[1] * d0],
    [b.p[0] + nb[0] * d1, b.p[1] + nb[1] * d1],
    [a.p[0] + na[0] * d1, a.p[1] + na[1] * d1],
  ];
}

export const DASH_M = 3;
export const GAP_M = 6;
const LINE_W = 0.15;

export const PARKING_BAY_LENGTH_M = 5.5;
export const PARKING_BAY_DEPTH_M = 2.2;
export const ZEBRA_LENGTH_M = 3;

/** Marks of one kind along the road: continuous paint is cut into 1.5 m pieces so it follows curves. */
function line(out: Mark[], pts: readonly Vec2[], length: number, d: number, color: Mark['color'], dashed: boolean, covered: (p: Vec2) => boolean, dash = DASH_M, gap = GAP_M): void {
  const step = dashed ? dash : 1.5;
  const every = dashed ? dash + gap : step;
  for (let s = dashed ? gap / 2 : 0; s < length - 0.05; s += every) {
    const s1 = Math.min(length, s + step);
    const q = quadAt(pts, s, s1, d - LINE_W / 2, d + LINE_W / 2);
    const mid: Vec2 = [(q[0][0] + q[2][0]) / 2, (q[0][1] + q[2][1]) / 2];
    if (!covered(mid)) out.push({ pts: q, color });
  }
}

/**
 * Work out everything a road is made of on the plan. `covered(p)` says whether a point lies inside another road's
 * carriageway: paint and pavement are left out there, so two roads meet in a clean junction.
 */
export function roadLayout(points: readonly Vec2[], width: number, style: RoadStyleInput, covered: (p: Vec2) => boolean = () => false): RoadLayout {
  const pts = dedupe(points);
  const w = Math.min(ROAD_MAX_WIDTH_M, Math.max(ROAD_MIN_WIDTH_M, width));
  const h = w / 2;
  const empty: RoadLayout = { carriage: [], left: null, right: null, marks: [], length: 0 };
  if (pts.length < 2) return empty;
  const length = lineLength(pts);
  const carriage = polygonOf(offsetLine(pts, h), offsetLine(pts, -h));
  const left = style.pavLeft > 0.05 ? polygonOf(offsetLine(pts, h + style.pavLeft), offsetLine(pts, h)) : null;
  const right = style.pavRight > 0.05 ? polygonOf(offsetLine(pts, -h), offsetLine(pts, -h - style.pavRight)) : null;
  const marks: Mark[] = [];
  const lanes = Math.max(1, Math.round(style.lanes));
  const laneW = w / lanes;

  // Edge lines, a little in from the kerb.
  if (style.edges) {
    for (const sgn of [1, -1]) line(marks, pts, length, sgn * (h - 0.3), 'white', false, covered);
  }
  // Centre line (two-way roads) or lane lines.
  if (!style.oneWay && style.centre !== 'none') {
    if (style.centre === 'dashed') line(marks, pts, length, 0, 'white', true, covered);
    else if (style.centre === 'solid') line(marks, pts, length, 0, 'white', false, covered);
    else for (const sgn of [1, -1]) line(marks, pts, length, sgn * 0.13, 'yellow', false, covered);
  }
  // Lane lines between lanes of the same direction.
  for (let k = 1; k < lanes; k++) {
    const d = -h + k * laneW;
    // The middle of a two-way road belongs to the centre line (or to nothing when that is switched off).
    const isCentre = !style.oneWay && lanes % 2 === 0 && k === lanes / 2;
    if (isCentre) continue;
    line(marks, pts, length, d, 'white', true, covered, 2, 4);
  }
  // Parking bays along a kerb: a short line across the bay at every boundary.
  const bays = (sgn: 1 | -1) => {
    const edge = sgn * (h - 0.3);
    for (let s = 0; s + PARKING_BAY_LENGTH_M <= length + 0.01; s += PARKING_BAY_LENGTH_M) {
      const q = quadAt(pts, s, s + 0.12, edge, edge - sgn * PARKING_BAY_DEPTH_M);
      const mid: Vec2 = [(q[0][0] + q[2][0]) / 2, (q[0][1] + q[2][1]) / 2];
      if (!covered(mid)) marks.push({ pts: q, color: 'white' });
    }
  };
  if (style.parking === 'left' || style.parking === 'both') bays(1);
  if (style.parking === 'right' || style.parking === 'both') bays(-1);
  // Zebra crossings: bars along the road, across its whole width.
  for (const t of style.crossings) {
    const s = Math.min(length - ZEBRA_LENGTH_M / 2, Math.max(ZEBRA_LENGTH_M / 2, t * length));
    for (let d = -h + 0.5; d < h - 0.2; d += 0.9) marks.push({ pts: quadAt(pts, s - ZEBRA_LENGTH_M / 2, s + ZEBRA_LENGTH_M / 2, d - 0.22, d + 0.22), color: 'white' });
  }
  // Speed bumps: yellow bars across the road.
  for (const t of style.bumps) {
    const s = Math.min(length - 0.6, Math.max(0.6, t * length));
    for (let i = 0; i < 6; i++) {
      const d0 = -h + (i * w) / 6;
      marks.push({ pts: quadAt(pts, s - 0.5, s + 0.5, d0, d0 + w / 6), color: i % 2 ? 'white' : 'yellow' });
    }
  }
  return { carriage, left, right, marks, length };
}

/** The outline used to select a road on the plan: carriageway and pavements together. */
export function roadFootprint(points: readonly Vec2[], width: number, pavLeft: number, pavRight: number): Vec2[] {
  const pts = dedupe(points);
  if (pts.length < 2) return [];
  const h = Math.min(ROAD_MAX_WIDTH_M, Math.max(ROAD_MIN_WIDTH_M, width)) / 2;
  return polygonOf(offsetLine(pts, h + Math.max(0, pavLeft)), offsetLine(pts, -h - Math.max(0, pavRight)));
}

/** Does `p` lie within `width / 2 + margin` of the centre line? */
export function nearRoad(points: readonly Vec2[], width: number, p: Vec2, margin = 0): boolean {
  const pts = dedupe(points);
  const r = width / 2 + margin;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const abx = b[0] - a[0];
    const abz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * abx + (p[1] - a[1]) * abz) / (abx * abx + abz * abz || 1)));
    if (Math.hypot(p[0] - (a[0] + abx * t), p[1] - (a[1] + abz * t)) <= r) return true;
  }
  return false;
}

export interface RoadSpot {
  kind: ExtraKind;
  asset: string;
  x: number;
  z: number;
  /** Rotation about Y so that the front of the item faces the road. */
  rot: number;
  side: 'left' | 'right';
}

const EXTRA_ASSET: Record<ExtraKind, string> = { light: 'street-light', tree: 'tree-neem', bench: 'garden-bench', bin: 'dustbin', bollard: 'bollard-light' };

/** Where the lights, trees, benches, bins and bollards go along a road (on the pavements, or just off the kerb). */
export function roadsideSpots(points: readonly Vec2[], width: number, style: RoadStyleInput, covered: (p: Vec2) => boolean = () => false): RoadSpot[] {
  const pts = dedupe(points);
  if (pts.length < 2) return [];
  const length = lineLength(pts);
  const h = width / 2;
  const out: RoadSpot[] = [];
  for (const ex of style.extras.slice(0, 6)) {
    const spacing = Math.max(3, ex.spacing);
    const asset = ex.asset ?? EXTRA_ASSET[ex.kind];
    let i = 0;
    for (let s = spacing / 2; s < length; s += spacing, i++) {
      const sides: Array<'left' | 'right'> = ex.side === 'both' ? ['left', 'right'] : ex.side === 'alternate' ? [i % 2 ? 'right' : 'left'] : [ex.side];
      for (const side of sides) {
        const pav = side === 'left' ? style.pavLeft : style.pavRight;
        // Trees and lights stand just inside the kerb of a pavement; with no pavement they stand a metre off the road.
        const off = h + (pav > 0.3 ? Math.min(pav / 2 + (ex.kind === 'light' ? 0.35 : 0), pav - 0.3) : 1.0);
        const { p, dir } = samplePath(pts, s);
        const n: Vec2 = side === 'left' ? [-dir[1], dir[0]] : [dir[1], -dir[0]];
        const pos: Vec2 = [p[0] + n[0] * off, p[1] + n[1] * off];
        if (covered(pos)) continue;
        // The front (+z) points at the road: toward -n.
        const rot = Math.atan2(-n[0], -n[1]);
        out.push({ kind: ex.kind, asset, x: pos[0], z: pos[1], rot, side });
      }
    }
  }
  return out;
}
