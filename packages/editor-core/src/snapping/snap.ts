import type { Id, Scene, Vec2 } from '@hd/scene-schema';

export type SnapKind = 'node' | 'wall' | 'angle' | 'grid' | 'none';

export interface SnapSettings {
  grid: boolean;
  nodes: boolean;
  /** Snap onto the body of an existing wall (the wall is split there when you build on it). */
  walls: boolean;
  angle: boolean;
  angleStepDeg: number;
}

export const DEFAULT_SNAP: SnapSettings = { grid: true, nodes: true, walls: true, angle: true, angleStepDeg: 45 };

export interface SnapResult {
  point: Vec2;
  kind: SnapKind;
  /** Set when kind === 'node'. */
  nodeId?: Id;
  /** Set when kind === 'wall'. */
  wallId?: Id;
  /** Alignment guide to draw when kind === 'angle'. */
  guide?: { from: Vec2; to: Vec2 };
}

export interface SnapOptions {
  settings: SnapSettings;
  /** Grid spacing in metres (see niceGridStep). */
  gridStep: number;
  /** Capture radius in metres. Callers convert from screen pixels so feel is zoom-independent. */
  thresholdM: number;
  /** Previous point of the wall being drawn; enables angle snapping. */
  from?: Vec2;
  /** Nodes to ignore (e.g. the one being dragged). */
  excludeNodeIds?: readonly Id[];
}

const round = (v: number, step: number) => Math.round(v / step) * step;

function segDist(p: Vec2, a: Vec2, b: Vec2): number {
  const abx = b[0] - a[0], abz = b[1] - a[1];
  const len2 = abx * abx + abz * abz || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * abx + (p[1] - a[1]) * abz) / len2));
  return Math.hypot(p[0] - (a[0] + abx * t), p[1] - (a[1] + abz * t));
}

/**
 * Priority: existing node → angle ray ∩ wall → angle ray (length rounded to grid) → wall body → grid → none.
 * Pure function; threshold is in metres so callers decide screen feel.
 */
export function snapPoint(raw: Vec2, scene: Scene, levelId: Id, o: SnapOptions): SnapResult {
  const { settings: s } = o;

  if (s.nodes) {
    let best: { id: Id; p: Vec2; d: number } | undefined;
    for (const n of Object.values(scene.nodes)) {
      if (n.levelId !== levelId || o.excludeNodeIds?.includes(n.id)) continue;
      const d = Math.hypot(n.p[0] - raw[0], n.p[1] - raw[1]);
      if (d <= o.thresholdM && (!best || d < best.d)) best = { id: n.id, p: n.p, d };
    }
    if (best) return { point: [best.p[0], best.p[1]], kind: 'node', nodeId: best.id };
  }

  // Angle ray from the previous point (45°/90°…), computed once and reused below.
  let ray: { ux: number; uz: number; along: number } | undefined;
  if (s.angle && o.from) {
    const dx = raw[0] - o.from[0];
    const dz = raw[1] - o.from[1];
    if (Math.hypot(dx, dz) > 1e-6) {
      const step = (s.angleStepDeg * Math.PI) / 180;
      const a = round(Math.atan2(dz, dx), step);
      const ux = Math.cos(a);
      const uz = Math.sin(a);
      const along = dx * ux + dz * uz;
      const perp = Math.abs(dx * uz - dz * ux);
      if (along > 0 && perp <= o.thresholdM) ray = { ux, uz, along };
    }
  }

  // Walls that already contain the start point are ignored (you are building along them).
  const wallsToTest = s.walls
    ? Object.values(scene.walls).filter((w) => {
        if (w.levelId !== levelId) return false;
        const a = scene.nodes[w.a];
        const b = scene.nodes[w.b];
        if (!a || !b) return false;
        if (o.excludeNodeIds?.includes(w.a) || o.excludeNodeIds?.includes(w.b)) return false;
        return !o.from || segDist(o.from, a.p, b.p) > 1e-3;
      })
    : [];

  // Where the angle ray crosses a wall near the cursor: perpendicular dividers land exactly on walls.
  if (ray && o.from && wallsToTest.length) {
    let best: { p: Vec2; wallId: Id; d: number } | undefined;
    for (const w of wallsToTest) {
      const a = scene.nodes[w.a]!.p;
      const b = scene.nodes[w.b]!.p;
      const rx = ray.ux, rz = ray.uz;
      const sx = b[0] - a[0], sz = b[1] - a[1];
      const den = rx * sz - rz * sx;
      if (Math.abs(den) < 1e-9) continue;
      const qx = a[0] - o.from[0], qz = a[1] - o.from[1];
      const r = (qx * sz - qz * sx) / den;
      const u = (qx * rz - qz * rx) / den;
      if (r <= 1e-6 || u < 0 || u > 1) continue;
      const p: Vec2 = [o.from[0] + rx * r, o.from[1] + rz * r];
      const d = Math.hypot(p[0] - raw[0], p[1] - raw[1]);
      if (d <= o.thresholdM && (!best || d < best.d)) best = { p, wallId: w.id, d };
    }
    if (best) {
      return { point: best.p, kind: 'wall', wallId: best.wallId, guide: { from: [o.from[0], o.from[1]], to: best.p } };
    }
  }

  if (ray && o.from) {
    const len = s.grid ? Math.max(round(ray.along, o.gridStep), o.gridStep) : ray.along;
    return {
      point: [o.from[0] + ray.ux * len, o.from[1] + ray.uz * len],
      kind: 'angle',
      guide: { from: [o.from[0], o.from[1]], to: [o.from[0] + ray.ux * (len + 2), o.from[1] + ray.uz * (len + 2)] },
    };
  }

  // Nearest point on a wall body.
  if (wallsToTest.length) {
    let best: { p: Vec2; wallId: Id; d: number } | undefined;
    for (const w of wallsToTest) {
      const a = scene.nodes[w.a]!.p;
      const b = scene.nodes[w.b]!.p;
      const abx = b[0] - a[0], abz = b[1] - a[1];
      const len2 = abx * abx + abz * abz || 1;
      const t = Math.max(0, Math.min(1, ((raw[0] - a[0]) * abx + (raw[1] - a[1]) * abz) / len2));
      const p: Vec2 = [a[0] + abx * t, a[1] + abz * t];
      const d = Math.hypot(p[0] - raw[0], p[1] - raw[1]);
      if (d <= o.thresholdM && (!best || d < best.d)) best = { p, wallId: w.id, d };
    }
    if (best) return { point: best.p, kind: 'wall', wallId: best.wallId };
  }

  if (s.grid) return { point: [round(raw[0], o.gridStep), round(raw[1], o.gridStep)], kind: 'grid' };
  return { point: [raw[0], raw[1]], kind: 'none' };
}
