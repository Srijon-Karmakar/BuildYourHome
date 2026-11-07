import type { Vec2 } from '@hd/scene-schema';
import { densify, offsetLine, roadLayout, ROAD_MAX_WIDTH_M, ROAD_MIN_WIDTH_M, type RoadStyleInput } from './road';

export type RoadSlot = 'asphalt' | 'white' | 'yellow' | 'pavement' | 'kerb';
export const ROAD_SLOTS: readonly RoadSlot[] = ['asphalt', 'white', 'yellow', 'pavement', 'kerb'];

export interface RoadMeshData {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
  /** Non-empty groups only, in ROAD_SLOTS order. */
  groups: { slot: RoadSlot; start: number; count: number }[];
}

/** Heights (m) above the ground: the road surface, paint on it, and a pavement with no kerb. */
export const ROAD_Y = 0.006;
const PAINT_Y = 0.012;
const FLUSH_PAVEMENT_Y = 0.01;

type V3 = [number, number, number];

class Pieces {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];

  /** A triangle that faces `dir` (flipped when needed). `uv` are the texture coordinates of a, b, c. */
  tri(a: V3, b: V3, c: V3, dir: V3, uv: [Vec2, Vec2, Vec2]): void {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!];
    const len = Math.hypot(n[0]!, n[1]!, n[2]!);
    if (len < 1e-12) return;
    n = n.map((v) => v / len);
    let tri: Array<[V3, Vec2]> = [[a, uv[0]], [b, uv[1]], [c, uv[2]]];
    if (n[0]! * dir[0] + n[1]! * dir[1] + n[2]! * dir[2] < 0) {
      tri = [tri[0]!, tri[2]!, tri[1]!];
      n = n.map((v) => -v);
    }
    for (const [p, t] of tri) {
      this.pos.push(...p);
      this.nor.push(n[0]!, n[1]!, n[2]!);
      this.uv.push(t[0], t[1]);
    }
  }

  quad(a: V3, b: V3, c: V3, d: V3, dir: V3, uv: [Vec2, Vec2, Vec2, Vec2]): void {
    this.tri(a, b, c, dir, [uv[0], uv[1], uv[2]]);
    this.tri(a, c, d, dir, [uv[0], uv[2], uv[3]]);
  }
}

const UP: V3 = [0, 1, 0];

/**
 * The 3D shape of a road: the surface, the paint on it, and the pavements with their kerbs. Texture coordinates run
 * across the road and along it in metres, so tiles and grain keep their size however long the road is.
 * `covered(p)` leaves paint and pavement out where another road crosses (a clean junction).
 */
export function buildRoadMesh(points: readonly Vec2[], width: number, style: RoadStyleInput, covered: (p: Vec2) => boolean = () => false): RoadMeshData | null {
  const w = Math.min(ROAD_MAX_WIDTH_M, Math.max(ROAD_MIN_WIDTH_M, width));
  const h = w / 2;
  const layout = roadLayout(points, w, style, covered);
  if (layout.carriage.length === 0) return null;
  const S: Record<RoadSlot, Pieces> = { asphalt: new Pieces(), white: new Pieces(), yellow: new Pieces(), pavement: new Pieces(), kerb: new Pieces() };
  // Pieces of at most 2 m, so a crossing road can cut a pavement short exactly where it passes.
  const dense = densify(points, 2);
  const lineL = offsetLine(dense, h);
  const lineR = offsetLine(dense, -h);
  const dist: number[] = [0];
  for (let i = 1; i < lineL.length; i++) {
    const a = lineL[i - 1]!;
    const b = lineL[i]!;
    const c = lineR[i - 1]!;
    const d = lineR[i]!;
    dist.push(dist[i - 1]! + (Math.hypot(b[0] - a[0], b[1] - a[1]) + Math.hypot(d[0] - c[0], d[1] - c[1])) / 2);
  }
  const mid = (a: Vec2, b: Vec2): Vec2 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const at = (p: Vec2, y: number): V3 => [p[0], y, p[1]];

  // The carriageway.
  for (let i = 0; i + 1 < lineL.length; i++) {
    S.asphalt.quad(at(lineL[i]!, ROAD_Y), at(lineR[i]!, ROAD_Y), at(lineR[i + 1]!, ROAD_Y), at(lineL[i + 1]!, ROAD_Y), UP, [[0, dist[i]!], [w, dist[i]!], [w, dist[i + 1]!], [0, dist[i + 1]!]]);
  }

  // A pavement on one side, with its kerb face.
  const side = (sgn: 1 | -1, pav: number) => {
    if (pav <= 0.05) return;
    const inner = sgn === 1 ? lineL : lineR;
    const outer = offsetLine(dense, sgn * (h + pav));
    const top = style.kerb > 0.01 ? style.kerb : FLUSH_PAVEMENT_Y;
    for (let i = 0; i + 1 < inner.length; i++) {
      if (covered(mid(mid(inner[i]!, inner[i + 1]!), mid(outer[i]!, outer[i + 1]!)))) continue;
      S.pavement.quad(at(inner[i]!, top), at(outer[i]!, top), at(outer[i + 1]!, top), at(inner[i + 1]!, top), UP, [[0, dist[i]!], [pav, dist[i]!], [pav, dist[i + 1]!], [0, dist[i + 1]!]]);
      if (style.kerb > 0.01) {
        // The face of the kerb looks toward the road.
        const a = inner[i]!;
        const b = inner[i + 1]!;
        const dx = b[0] - a[0];
        const dz = b[1] - a[1];
        const l = Math.hypot(dx, dz) || 1;
        const toRoad: V3 = [(dz / l) * sgn, 0, (-dx / l) * sgn]; // from the kerb toward the road centre
        S.kerb.quad(at(a, ROAD_Y), at(b, ROAD_Y), at(b, top), at(a, top), toRoad, [[0, 0], [1, 0], [1, 1], [0, 1]]);
      }
    }
  };
  side(1, style.pavLeft);
  side(-1, style.pavRight);

  // Paint.
  for (const m of layout.marks) {
    const g = m.color === 'yellow' ? S.yellow : S.white;
    g.quad(at(m.pts[0], PAINT_Y), at(m.pts[1], PAINT_Y), at(m.pts[2], PAINT_Y), at(m.pts[3], PAINT_Y), UP, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  }

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const groups: RoadMeshData['groups'] = [];
  let at0 = 0;
  for (const slot of ROAD_SLOTS) {
    const g = S[slot];
    const n = g.pos.length / 3;
    if (n === 0) continue;
    positions.push(...g.pos);
    normals.push(...g.nor);
    uvs.push(...g.uv);
    groups.push({ slot, start: at0, count: n });
    at0 += n;
  }
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), uvs: new Float32Array(uvs), indices: Uint32Array.from({ length: at0 }, (_, i) => i), groups };
}
