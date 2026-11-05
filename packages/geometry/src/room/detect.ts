import type { Id, Vec2, Wall, WallNode } from '@hd/scene-schema';
import { computeFootprints, polygonArea } from '../wall/footprint';

export interface DetectedRoom {
  /** Wall ids around the room, canonical rotation (smallest id first). */
  wallLoop: Id[];
  /** Inner boundary (the floor outline, inside the wall thickness). */
  polygon: Vec2[];
  area: number;
  centroid: Vec2;
  /** Stable key of the wall set; used to carry names/materials across edits. */
  signature: string;
}

/** Order-independent key for a set of wall ids. */
export const loopSignature = (ids: readonly Id[]): string => [...ids].sort().join('|');

/** Rooms smaller than this (m²) are treated as slivers and ignored. */
const MIN_ROOM_AREA_M2 = 0.25;

interface HalfEdge {
  wall: Wall;
  from: Id;
  to: Id;
  forward: boolean;
  angle: number;
  twin: number;
}

/**
 * Detect rooms = bounded faces of the planar wall graph (one level's walls at a time).
 *
 * 1. Prune dangling walls (degree-1 chains) — they bound nothing.
 * 2. Build half-edges; at each node sort outgoing edges by angle.
 * 3. Face walk: arriving at v via u→v, leave along the edge just before v→u in angle order,
 *    which keeps the face on the LEFT. Interior faces then have positive signed area, the
 *    unbounded outer face negative.
 * 4. Floor outline = the wall faces that look into the room, taken from the mitered footprints.
 *
 * Limitation (P0-06): faces whose boundary touches itself (islands/courtyards joined by a bridge
 * wall) are skipped.
 */
export function detectRooms(
  nodes: Readonly<Record<Id, WallNode>>,
  walls: readonly Wall[],
): DetectedRoom[] {
  let usable = walls.filter((w) => {
    const a = nodes[w.a];
    const b = nodes[w.b];
    return a && b && w.a !== w.b && Math.hypot(b.p[0] - a.p[0], b.p[1] - a.p[1]) > 1e-6;
  });

  // 1. Prune dangling walls until stable.
  for (;;) {
    const deg = new Map<Id, number>();
    for (const w of usable) {
      deg.set(w.a, (deg.get(w.a) ?? 0) + 1);
      deg.set(w.b, (deg.get(w.b) ?? 0) + 1);
    }
    const next = usable.filter((w) => (deg.get(w.a) ?? 0) > 1 && (deg.get(w.b) ?? 0) > 1);
    if (next.length === usable.length) break;
    usable = next;
  }
  if (usable.length < 3) return [];

  const footprints = computeFootprints(nodes, usable);

  // 2. Half-edges.
  const hes: HalfEdge[] = [];
  for (const w of usable) {
    const a = nodes[w.a]!.p;
    const b = nodes[w.b]!.p;
    const i = hes.length;
    hes.push({ wall: w, from: w.a, to: w.b, forward: true, angle: Math.atan2(b[1] - a[1], b[0] - a[0]), twin: i + 1 });
    hes.push({ wall: w, from: w.b, to: w.a, forward: false, angle: Math.atan2(a[1] - b[1], a[0] - b[0]), twin: i });
  }
  const outgoing = new Map<Id, number[]>();
  hes.forEach((h, i) => {
    const l = outgoing.get(h.from) ?? [];
    l.push(i);
    outgoing.set(h.from, l);
  });
  for (const l of outgoing.values()) l.sort((p, q) => hes[p]!.angle - hes[q]!.angle);

  const nextOf = (i: number): number => {
    const h = hes[i]!;
    const list = outgoing.get(h.to)!;
    const k = list.indexOf(h.twin);
    return list[(k - 1 + list.length) % list.length]!;
  };

  // 3. Walk faces.
  const visited = new Set<number>();
  const rooms: DetectedRoom[] = [];
  for (let start = 0; start < hes.length; start++) {
    if (visited.has(start)) continue;
    const cycle: number[] = [];
    let cur = start;
    while (!visited.has(cur) && cycle.length <= hes.length) {
      visited.add(cur);
      cycle.push(cur);
      cur = nextOf(cur);
    }
    if (cur !== start) continue; // defensive: malformed walk

    // Interior faces wind positively around their node polygon.
    const nodePoly = cycle.map((i) => nodes[hes[i]!.from]!.p);
    let signed = 0;
    for (let k = 0; k < nodePoly.length; k++) {
      const p = nodePoly[k]!;
      const q = nodePoly[(k + 1) % nodePoly.length]!;
      signed += p[0] * q[1] - q[0] * p[1];
    }
    if (signed <= 1e-9) continue;

    const ids = cycle.map((i) => hes[i]!.wall.id);
    if (new Set(ids).size !== ids.length) continue; // bridge/antenna inside the face — unsupported

    // 4. Floor outline from footprint faces that look into the room.
    const pts: Vec2[] = [];
    const push = (p: Vec2) => {
      const last = pts[pts.length - 1];
      if (!last || Math.hypot(last[0] - p[0], last[1] - p[1]) > 1e-6) pts.push([p[0], p[1]]);
    };
    for (const i of cycle) {
      const h = hes[i]!;
      const fp = footprints[h.wall.id]?.footprint;
      if (!fp) continue;
      if (h.forward) {
        push(fp[0]);
        push(fp[1]);
      } else {
        push(fp[2]);
        push(fp[3]);
      }
    }
    if (pts.length > 1) {
      const f = pts[0]!;
      const l = pts[pts.length - 1]!;
      if (Math.hypot(f[0] - l[0], f[1] - l[1]) <= 1e-6) pts.pop();
    }
    if (pts.length < 3) continue;
    const area = polygonArea(pts);
    if (area < MIN_ROOM_AREA_M2) continue;

    // Canonical rotation of the wall loop (smallest id first, direction preserved).
    let minAt = 0;
    for (let k = 1; k < ids.length; k++) if (ids[k]! < ids[minAt]!) minAt = k;
    const wallLoop = [...ids.slice(minAt), ...ids.slice(0, minAt)];

    rooms.push({ wallLoop, polygon: pts, area, centroid: centroidOf(pts), signature: loopSignature(wallLoop) });
  }

  rooms.sort((a, b) => (a.signature < b.signature ? -1 : a.signature > b.signature ? 1 : 0));
  return rooms;
}

function centroidOf(p: readonly Vec2[]): Vec2 {
  let a = 0, cx = 0, cz = 0;
  for (let i = 0; i < p.length; i++) {
    const [x0, z0] = p[i]!;
    const [x1, z1] = p[(i + 1) % p.length]!;
    const c = x0 * z1 - x1 * z0;
    a += c;
    cx += (x0 + x1) * c;
    cz += (z0 + z1) * c;
  }
  if (Math.abs(a) < 1e-12) return [p[0]![0], p[0]![1]];
  return [cx / (3 * a), cz / (3 * a)];
}
