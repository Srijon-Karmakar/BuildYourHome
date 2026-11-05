import type { Id, Vec2, Wall, WallNode } from '@hd/scene-schema';

/**
 * Wall footprint = 4 plan points [aL, bL, bR, aR] in order around the wall.
 * Wall runs a → b with unit direction u; "L" is the side offset by n = (-u.z, u.x), "R" the opposite.
 * (Wall.materialA is the L face, materialB the R face.)
 */
export type Footprint = [Vec2, Vec2, Vec2, Vec2];

export interface WallFootprint {
  footprint: Footprint;
  /** Wall frame: node `a` position, unit direction a → b, centre-line length and thickness (metres). */
  origin: Vec2;
  dir: Vec2;
  length: number;
  thickness: number;
  /** End caps are only needed where the end is free or a sharp corner fell back to a bevel. */
  capA: boolean;
  capB: boolean;
}

/** Miter tip farther than this × the thicker wall from the node falls back to a bevel (≈ < 29°). */
export const MITER_LIMIT = 2;

const EPS = 1e-9;

interface End {
  wallId: Id;
  which: 'a' | 'b';
  /** Outward unit direction from the node. */
  d: Vec2;
  t: number;
  angle: number;
  /** Outline point on the "ascending" side (toward the next wall counter-clockwise in angle order). */
  asc: Vec2;
  desc: Vec2;
  cap: boolean;
}

const cross = (a: Vec2, b: Vec2) => a[0] * b[1] - a[1] * b[0];

/**
 * Compute mitered footprints for the given walls. Pass only the walls of ONE level.
 * At each node the incident walls are sorted by angle; each adjacent pair meets at the
 * intersection of their facing offset lines, so any number of walls (L, T, X…) joins cleanly.
 * Zero-length walls are skipped.
 */
export function computeFootprints(
  nodes: Readonly<Record<Id, WallNode>>,
  walls: readonly Wall[],
): Record<Id, WallFootprint> {
  const byNode = new Map<Id, End[]>();
  const ends = new Map<string, End>();

  for (const w of walls) {
    const a = nodes[w.a];
    const b = nodes[w.b];
    if (!a || !b) continue;
    const dx = b.p[0] - a.p[0];
    const dz = b.p[1] - a.p[1];
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) continue;
    const u: Vec2 = [dx / len, dz / len];
    for (const which of ['a', 'b'] as const) {
      const d: Vec2 = which === 'a' ? u : [-u[0], -u[1]];
      const e: End = {
        wallId: w.id,
        which,
        d,
        t: w.thickness,
        angle: Math.atan2(d[1], d[0]),
        asc: [0, 0],
        desc: [0, 0],
        cap: false,
      };
      const nodeId = which === 'a' ? w.a : w.b;
      const list = byNode.get(nodeId) ?? [];
      list.push(e);
      byNode.set(nodeId, list);
      ends.set(`${w.id}:${which}`, e);
    }
  }

  for (const [nodeId, list] of byNode) {
    const N = nodes[nodeId]!.p;
    list.sort((p, q) => p.angle - q.angle);
    const n = (e: End): Vec2 => [-e.d[1], e.d[0]]; // ascending-side normal

    if (list.length === 1) {
      const e = list[0]!;
      const nn = n(e);
      e.asc = [N[0] + (nn[0] * e.t) / 2, N[1] + (nn[1] * e.t) / 2];
      e.desc = [N[0] - (nn[0] * e.t) / 2, N[1] - (nn[1] * e.t) / 2];
      e.cap = true;
      continue;
    }

    for (let k = 0; k < list.length; k++) {
      const i = list[k]!;
      const j = list[(k + 1) % list.length]!;
      const ni = n(i);
      const nj = n(j);
      // i's ascending offset line and j's descending offset line.
      const p1: Vec2 = [N[0] + (ni[0] * i.t) / 2, N[1] + (ni[1] * i.t) / 2];
      const p2: Vec2 = [N[0] - (nj[0] * j.t) / 2, N[1] - (nj[1] * j.t) / 2];
      const den = cross(i.d, j.d);

      let m: Vec2 | null = null;
      if (Math.abs(den) > EPS) {
        const s = cross([p2[0] - p1[0], p2[1] - p1[1]], j.d) / den;
        const cand: Vec2 = [p1[0] + i.d[0] * s, p1[1] + i.d[1] * s];
        if (Math.hypot(cand[0] - N[0], cand[1] - N[1]) <= MITER_LIMIT * Math.max(i.t, j.t)) m = cand;
      }
      if (m) {
        i.asc = m;
        j.desc = m;
      } else {
        // Parallel or too sharp: each wall keeps its own square offset point.
        i.asc = p1;
        j.desc = p2;
        if (Math.hypot(p1[0] - p2[0], p1[1] - p2[1]) > 1e-6) {
          i.cap = true;
          j.cap = true;
        }
      }
    }
  }

  const out: Record<Id, WallFootprint> = {};
  for (const w of walls) {
    const ea = ends.get(`${w.id}:a`);
    const eb = ends.get(`${w.id}:b`);
    if (!ea || !eb) continue;
    const a = nodes[w.a]!.p;
    const b = nodes[w.b]!.p;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    out[w.id] = {
      origin: [a[0], a[1]],
      dir: [(b[0] - a[0]) / length, (b[1] - a[1]) / length],
      length,
      thickness: w.thickness,
      footprint: [ea.asc, eb.desc, eb.asc, ea.desc],
      capA: ea.cap,
      capB: eb.cap,
    };
  }
  return out;
}

/** Absolute polygon area (shoelace). */
export function polygonArea(p: readonly Vec2[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!;
    const b = p[(i + 1) % p.length]!;
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s) / 2;
}

const cross2 = (o: Vec2, a: Vec2, b: Vec2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

/** Do segments p1-p2 and p3-p4 cross or touch (excluding a shared endpoint)? */
function segmentsIntersect(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2): boolean {
  const d1 = cross2(p3, p4, p1);
  const d2 = cross2(p3, p4, p2);
  const d3 = cross2(p1, p2, p3);
  const d4 = cross2(p1, p2, p4);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  const on = (a: Vec2, b: Vec2, c: Vec2) =>
    Math.abs(cross2(a, b, c)) < 1e-9 && c[0] >= Math.min(a[0], b[0]) - 1e-9 && c[0] <= Math.max(a[0], b[0]) + 1e-9 && c[1] >= Math.min(a[1], b[1]) - 1e-9 && c[1] <= Math.max(a[1], b[1]) + 1e-9;
  return on(p3, p4, p1) || on(p3, p4, p2) || on(p1, p2, p3) || on(p1, p2, p4);
}

/** A polygon with >= 3 vertices whose edges never cross or touch each other (non-adjacent edges). */
export function isSimplePolygon(p: readonly Vec2[]): boolean {
  const n = p.length;
  if (n < 3) return false;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue; // adjacent edges share a vertex by definition
      if (segmentsIntersect(p[i]!, p[(i + 1) % n]!, p[j]!, p[(j + 1) % n]!)) return false;
    }
  }
  return true;
}

/** Ray-casting point-in-polygon (boundary counts as inside within `eps`). */
export function pointInPolygon(pt: Vec2, poly: readonly Vec2[], eps = 1e-6): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    const abx = b[0] - a[0];
    const abz = b[1] - a[1];
    const len2 = abx * abx + abz * abz || 1;
    const t = Math.max(0, Math.min(1, ((pt[0] - a[0]) * abx + (pt[1] - a[1]) * abz) / len2));
    if (Math.hypot(pt[0] - (a[0] + abx * t), pt[1] - (a[1] + abz * t)) <= eps) return true; // on the edge
    if (a[1] > pt[1] !== b[1] > pt[1] && pt[0] < ((b[0] - a[0]) * (pt[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
