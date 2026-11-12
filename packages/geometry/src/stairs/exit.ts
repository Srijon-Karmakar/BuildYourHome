import type { Vec2 } from '@hd/scene-schema';
import { stairHole, type StairLayout } from './stairs';
import { Solids, type V3 } from './solids';

/**
 * The structure over the top of a stair where it comes out on a roof or an empty floor:
 *  - `room`  a small masonry room (roof room / chilekotha / mumty) with a door and its own flat roof,
 *  - `glass` a glass box on a metal frame with a sliding glass door,
 *  - `hatch` a low kerb round the opening with a hinged glass lid, propped open.
 */
export type StairExitKind = 'room' | 'glass' | 'hatch';
export const STAIR_EXIT_KINDS: readonly StairExitKind[] = ['room', 'glass', 'hatch'];

export const EXIT_WALL_M = 0.15;
export const EXIT_DOOR_W_M = 0.9;
export const EXIT_DOOR_H_M = 2.1;
export const EXIT_KERB_M = 0.3;
/** Free floor inside a room / glass box in front of the top step, where you step off toward the door. */
export const EXIT_LANDING_M = 1.0;
const MARGIN_M = 0.15;
export const DEFAULT_EXIT_HEIGHT_M: Record<StairExitKind, number> = { room: 2.4, glass: 2.3, hatch: EXIT_KERB_M };

export interface StairExitPlan {
  kind: StairExitKind;
  /** Wall centre lines, local stair frame: [x0, z0, x1, z1]. */
  rect: [number, number, number, number];
  /** The open side (room / glass: the door; hatch: no kerb): 0 = z0, 1 = x1, 2 = z1, 3 = x0. */
  side: 0 | 1 | 2 | 3;
  /** The door along that side, as [from, to] in the side's own axis (x for sides 0 / 2, z for sides 1 / 3). */
  door: [number, number];
}

/** Corners of side `i` of the rectangle (in order round it). */
export function exitSide(rect: StairExitPlan['rect'], i: number): [Vec2, Vec2] {
  const [x0, z0, x1, z1] = rect;
  const c: Vec2[] = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  return [c[i % 4]!, c[(i + 1) % 4]!];
}

/** Where the exit stands round a stair's top (local frame). */
export function stairExitPlan(layout: StairLayout, kind: StairExitKind): StairExitPlan {
  const hole = stairHole(layout);
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z] of hole) {
    x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z);
  }
  const m = kind === 'hatch' ? 0.1 : MARGIN_M;
  x0 -= m; z0 -= m; x1 += m; z1 += m;
  const last = layout.treads[layout.treads.length - 1];
  const d = last?.dir ?? [0, -1];
  const side: 0 | 1 | 2 | 3 = Math.abs(d[1]) >= Math.abs(d[0]) ? (d[1] < 0 ? 0 : 2) : d[0] > 0 ? 1 : 3;
  if (kind !== 'hatch') {
    if (side === 0) z0 -= EXIT_LANDING_M;
    else if (side === 1) x1 += EXIT_LANDING_M;
    else if (side === 2) z1 += EXIT_LANDING_M;
    else x0 -= EXIT_LANDING_M;
  }
  // The door lines up with the top step, kept inside the side.
  const c = last ? (last.centre ?? [(last.rect[0] + last.rect[2]) / 2, (last.rect[1] + last.rect[3]) / 2]) : [0, 0];
  const along = side === 0 || side === 2;
  const lo = (along ? x0 : z0) + EXIT_WALL_M;
  const hi = (along ? x1 : z1) - EXIT_WALL_M;
  const w = Math.min(EXIT_DOOR_W_M, hi - lo);
  const mid = Math.min(hi - w / 2, Math.max(lo + w / 2, along ? c[0]! : c[1]!));
  return { kind, rect: [x0, z0, x1, z1], side, door: [mid - w / 2, mid + w / 2] };
}

/** Wall runs of the exit (local), the door gap left out; a hatch has no kerb on its open side. For collisions and the plan. */
export function stairExitWalls(plan: StairExitPlan): Array<[Vec2, Vec2]> {
  const out: Array<[Vec2, Vec2]> = [];
  for (let i = 0; i < 4; i++) {
    const [a, b] = exitSide(plan.rect, i);
    if (i !== plan.side) {
      out.push([a, b]);
      continue;
    }
    if (plan.kind === 'hatch') continue;
    const along = i === 0 || i === 2;
    const at = (t: number): Vec2 => (along ? [t, a[1]] : [a[0], t]);
    const s0 = along ? a[0] : a[1];
    const s1 = along ? b[0] : b[1];
    const [d0, d1] = s0 < s1 ? plan.door : [plan.door[1], plan.door[0]];
    if (Math.abs(d0 - s0) > 0.02) out.push([a, at(d0)]);
    if (Math.abs(s1 - d1) > 0.02) out.push([at(d1), b]);
  }
  return out;
}

export type StairExitSlot = 'wall' | 'roof' | 'frame' | 'glass';
export const STAIR_EXIT_SLOTS: readonly StairExitSlot[] = ['wall', 'roof', 'frame', 'glass'];

export interface StairExitMesh {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
  groups: { slot: StairExitSlot; start: number; count: number }[];
}

/** A thin flat slab through four corners (in order), `t` thick along its normal. */
function slab(S: Solids, c: V3[], t: number): void {
  const e1 = [c[1]![0] - c[0]![0], c[1]![1] - c[0]![1], c[1]![2] - c[0]![2]];
  const e2 = [c[3]![0] - c[0]![0], c[3]![1] - c[0]![1], c[3]![2] - c[0]![2]];
  let n = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!];
  const l = Math.hypot(n[0]!, n[1]!, n[2]!) || 1;
  n = n.map((v) => (v / l) * (t / 2));
  const A = c.map((p): V3 => [p[0] + n[0]!, p[1] + n[1]!, p[2] + n[2]!]);
  const B = c.map((p): V3 => [p[0] - n[0]!, p[1] - n[1]!, p[2] - n[2]!]);
  const mid: V3 = [(c[0]![0] + c[2]![0]) / 2, (c[0]![1] + c[2]![1]) / 2, (c[0]![2] + c[2]![2]) / 2];
  S.quad(A[0]!, A[1]!, A[2]!, A[3]!, mid);
  S.quad(B[0]!, B[1]!, B[2]!, B[3]!, mid);
  for (let k = 0; k < 4; k++) S.quad(A[k]!, A[(k + 1) % 4]!, B[(k + 1) % 4]!, B[k]!, mid);
}

/** A horizontal box [x0..x1] × [z0..z1] × [y0..y1]. */
function box(S: Solids, x0: number, z0: number, x1: number, z1: number, y0: number, y1: number): void {
  const mid: V3 = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
  const P = (x: number, y: number, z: number): V3 => [x, y, z];
  S.quad(P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1), mid); // top
  S.quad(P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1), mid); // underside
  S.quad(P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0), mid);
  S.quad(P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0), mid);
  S.quad(P(x1, y0, z1), P(x0, y0, z1), P(x0, y1, z1), P(x1, y1, z1), mid);
  S.quad(P(x0, y0, z1), P(x0, y0, z0), P(x0, y1, z0), P(x0, y1, z1), mid);
}

/** The exit as a mesh in the stair's local frame; y = 0 is the floor (or roof top) it stands on. */
export function buildStairExit(layout: StairLayout, kind: StairExitKind, height?: number): StairExitMesh {
  const plan = stairExitPlan(layout, kind);
  const S: Record<StairExitSlot, Solids> = { wall: new Solids(), roof: new Solids(), frame: new Solids(), glass: new Solids() };
  const [x0, z0, x1, z1] = plan.rect;
  const H = Math.min(3.5, Math.max(kind === 'hatch' ? 0.15 : 1.9, height ?? DEFAULT_EXIT_HEIGHT_M[kind]));
  const runs = stairExitWalls(plan);
  const half = EXIT_WALL_M / 2;
  // Each run grows by half a wall at a rectangle corner so the corners close (not at the door jambs).
  const isCorner = (p: Vec2) => (Math.abs(p[0] - x0) < 1e-6 || Math.abs(p[0] - x1) < 1e-6) && (Math.abs(p[1] - z0) < 1e-6 || Math.abs(p[1] - z1) < 1e-6);
  const grow = (a: Vec2, b: Vec2): [Vec2, Vec2] => {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const u: Vec2 = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
    const e = (p: Vec2, s: number): Vec2 => (isCorner(p) ? [p[0] + u[0] * half * s, p[1] + u[1] * half * s] : p);
    return [e(a, -1), e(b, 1)];
  };
  const [da, db] = exitSide(plan.rect, plan.side);
  const along = plan.side === 0 || plan.side === 2;
  const at = (t: number): Vec2 => (along ? [t, da[1]] : [da[0], t]);
  const outward: Vec2 = plan.side === 0 ? [0, -1] : plan.side === 1 ? [1, 0] : plan.side === 2 ? [0, 1] : [-1, 0];
  const doorH = Math.min(EXIT_DOOR_H_M, H - 0.15);

  if (kind === 'room') {
    for (const [a, b] of runs) {
      const [p, q] = grow(a, b);
      S.wall.panel(p, q, 0, H, 0, H, EXIT_WALL_M);
    }
    // Over the door.
    const [p, q] = [at(plan.door[0]), at(plan.door[1])];
    S.wall.panel(p, q, doorH, H, doorH, H, EXIT_WALL_M);
    // Door frame, and the door leaf standing open outward against the wall.
    for (const t of plan.door) {
      const j = at(t);
      S.frame.post(j[0], j[1], 0, doorH, EXIT_WALL_M + 0.02);
    }
    S.frame.bar([p[0], doorH + 0.03, p[1]], [q[0], doorH + 0.03, q[1]], EXIT_WALL_M + 0.02, 0.06);
    const hinge = at(plan.door[0]);
    const w = plan.door[1] - plan.door[0];
    const off = half + 0.03;
    const h0: Vec2 = [hinge[0] + outward[0] * off, hinge[1] + outward[1] * off];
    const h1: Vec2 = [h0[0] + outward[0] * w * 0.95, h0[1] + outward[1] * w * 0.95];
    S.frame.panel(h0, h1, 0.02, doorH - 0.02, 0.02, doorH - 0.02, 0.045);
    // Flat roof with an overhang, and a drip edge.
    const o = 0.25;
    box(S.roof, x0 - half - o, z0 - half - o, x1 + half + o, z1 + half + o, H, H + 0.12);
  } else if (kind === 'glass') {
    const F = 0.06;
    const corners: Vec2[] = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
    for (const c of corners) S.frame.post(c[0], c[1], 0, H, F);
    // Top ring and a sill ring.
    for (let i = 0; i < 4; i++) {
      const [a, b] = exitSide(plan.rect, i);
      S.frame.bar([a[0], H - F / 2, a[1]], [b[0], H - F / 2, b[1]], F, F);
      if (i !== plan.side) S.frame.bar([a[0], 0.02, a[1]], [b[0], 0.02, b[1]], F, 0.04);
    }
    for (const [a, b] of runs) S.glass.panel(a, b, 0.04, H - F, 0.04, H - F, 0.02);
    // Door posts, and the sliding door parked outside the fixed glass beside it.
    for (const t of plan.door) {
      const j = at(t);
      S.frame.post(j[0], j[1], 0, H, F * 0.8);
    }
    const w = plan.door[1] - plan.door[0];
    const s0 = along ? Math.min(da[0], db[0]) : Math.min(da[1], db[1]);
    const s1 = along ? Math.max(da[0], db[0]) : Math.max(da[1], db[1]);
    // Park it on the side with more fixed glass.
    const right = s1 - plan.door[1] >= plan.door[0] - s0;
    const p0 = right ? plan.door[1] - 0.05 : plan.door[0] - w + 0.05;
    const slide: Vec2[] = [at(p0), at(p0 + w)].map((p): Vec2 => [p[0] + outward[0] * 0.06, p[1] + outward[1] * 0.06]);
    S.glass.panel(slide[0]!, slide[1]!, 0.04, doorH, 0.04, doorH, 0.02);
    S.frame.bar([slide[0]![0], doorH, slide[0]![1]], [slide[1]![0], doorH, slide[1]![1]], 0.03, 0.04);
    for (const p of slide) S.frame.post(p[0], p[1], 0.02, doorH, 0.03);
    // Glass roof, with a small fall and the frame round it.
    S.glass.panel([x0, (z0 + z1) / 2], [x1, (z0 + z1) / 2], H, H + 0.02, H, H + 0.02, z1 - z0);
  } else {
    // Hatch: kerb on three sides, a frame on top, the lid hinged on the far side and propped open toward it.
    for (const [a, b] of runs) {
      const [p, q] = grow(a, b);
      S.wall.panel(p, q, 0, H, 0, H, 0.12);
    }
    const far = (plan.side + 2) % 4;
    const [ha, hb] = exitSide(plan.rect, far);
    const depth = plan.side === 0 || plan.side === 2 ? z1 - z0 : x1 - x0;
    const ang = (70 * Math.PI) / 180;
    // Closed, the lid reaches from the hinge (far side) across to the open side; it swings up about the hinge line.
    const rise = depth * Math.sin(ang);
    const back = depth * Math.cos(ang);
    const free = (p: Vec2): V3 => [p[0] + outward[0] * back, H + rise, p[1] + outward[1] * back];
    const hingeA: V3 = [ha[0], H + 0.02, ha[1]];
    const hingeB: V3 = [hb[0], H + 0.02, hb[1]];
    slab(S.glass, [hingeA, hingeB, free(hb), free(ha)], 0.025);
    for (const [p, q] of [[hingeA, hingeB], [hingeB, free(hb)], [free(hb), free(ha)], [free(ha), hingeA]] as Array<[V3, V3]>) S.frame.bar(p, q, 0.045, 0.045);
    // A stay holding the lid open.
    const mid: Vec2 = [(ha[0] + hb[0]) / 2, (ha[1] + hb[1]) / 2];
    const stayFoot: V3 = [mid[0] + outward[0] * 0.35, H, mid[1] + outward[1] * 0.35];
    const stayTop: V3 = [mid[0] + outward[0] * back * 0.5, H + rise * 0.5, mid[1] + outward[1] * back * 0.5];
    S.frame.rod(stayFoot, stayTop, 0.012);
  }

  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const groups: StairExitMesh['groups'] = [];
  for (const slot of STAIR_EXIT_SLOTS) {
    const s = S[slot];
    const n = s.pos.length / 3;
    if (n === 0) continue;
    groups.push({ slot, start: pos.length / 3, count: n });
    pos.push(...s.pos);
    nor.push(...s.nor);
    uv.push(...s.uv);
  }
  const indices = new Uint32Array(pos.length / 3);
  for (let i = 0; i < indices.length; i++) indices[i] = i;
  return { positions: new Float32Array(pos), normals: new Float32Array(nor), uvs: new Float32Array(uv), indices, groups };
}
