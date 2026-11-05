import type { Id, Scene, Vec2 } from '@hd/scene-schema';

export type SnapKind = 'node' | 'angle' | 'grid' | 'none';

export interface SnapSettings {
  grid: boolean;
  nodes: boolean;
  angle: boolean;
  angleStepDeg: number;
}

export const DEFAULT_SNAP: SnapSettings = { grid: true, nodes: true, angle: true, angleStepDeg: 45 };

export interface SnapResult {
  point: Vec2;
  kind: SnapKind;
  /** Set when kind === 'node'. */
  nodeId?: Id;
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

/**
 * Priority: existing node → angle from `from` (length rounded to grid) → grid → none.
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
      if (along > 0 && perp <= o.thresholdM) {
        const len = s.grid ? Math.max(round(along, o.gridStep), o.gridStep) : along;
        return {
          point: [o.from[0] + ux * len, o.from[1] + uz * len],
          kind: 'angle',
          guide: { from: [o.from[0], o.from[1]], to: [o.from[0] + ux * (len + 2), o.from[1] + uz * (len + 2)] },
        };
      }
    }
  }

  if (s.grid) return { point: [round(raw[0], o.gridStep), round(raw[1], o.gridStep)], kind: 'grid' };
  return { point: [raw[0], raw[1]], kind: 'none' };
}
