import { isSimplePolygon, pointInPolygon, polygonArea } from '@hd/geometry';
import { type Id, type Scene, type Vec2 } from '@hd/scene-schema';
import { addWall, isHouseWall } from './walls';
import type { Command } from '../types';

export const PLOT_MIN_AREA_M2 = 4;
export const DEFAULT_PLOT_MARGIN_M = 3;

export type BoundaryKind = 'none' | 'wall' | 'fence';

/** Look of each boundary type. */
export const BOUNDARY_STYLES: Record<Exclude<BoundaryKind, 'none'>, { thickness: number; height: number; material: string }> = {
  wall: { thickness: 0.2, height: 1.8, material: 'wall-stone' },
  fence: { thickness: 0.06, height: 1.2, material: 'wall-wood-panel' },
};

/** Remove repeated points (and a closing copy of the first) so a polygon is clean. */
export function cleanPolygon(points: readonly Vec2[]): Vec2[] {
  const out: Vec2[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 1e-3) out.push([p[0], p[1]]);
  }
  const first = out[0];
  const end = out[out.length - 1];
  if (out.length > 1 && first && end && Math.hypot(first[0] - end[0], first[1] - end[1]) <= 1e-3) out.pop();
  return out;
}

/** Why a plot outline can't be used (null = fine). */
export function plotProblem(points: readonly Vec2[]): string | null {
  const p = cleanPolygon(points);
  if (p.length < 3) return 'A plot needs at least 3 corners.';
  if (!isSimplePolygon(p)) return 'The plot outline crosses itself.';
  if (polygonArea(p) < PLOT_MIN_AREA_M2) return 'That plot is too small.';
  return null;
}

/** Set (or with null remove) the plot outline. Invalid outlines are ignored. */
export function setPlot(boundary: readonly Vec2[] | null): Command {
  return {
    type: 'SetPlot',
    label: boundary ? 'Set plot' : 'Remove plot',
    apply(d) {
      if (boundary === null) {
        delete d.plot;
        return;
      }
      const p = cleanPolygon(boundary);
      if (plotProblem(p) !== null) return;
      d.plot = { boundary: p, northAngle: d.plot?.northAngle ?? 0 };
    },
  };
}

/** Bounding box of the house (every non-boundary wall point on every floor). */
export function houseBounds(scene: Scene): { min: Vec2; max: Vec2 } | null {
  const boundaryNodes = new Set<Id>();
  for (const w of Object.values(scene.walls)) if (w.kind === 'boundary') boundaryNodes.add(w.a).add(w.b);
  const walls = Object.values(scene.walls).filter(isHouseWall);
  const ids = new Set<Id>();
  for (const w of walls) ids.add(w.a).add(w.b);
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const id of ids) {
    const n = scene.nodes[id];
    if (!n) continue;
    minX = Math.min(minX, n.p[0]); maxX = Math.max(maxX, n.p[0]);
    minZ = Math.min(minZ, n.p[1]); maxZ = Math.max(maxZ, n.p[1]);
  }
  return Number.isFinite(minX) ? { min: [minX, minZ], max: [maxX, maxZ] } : null;
}

/** A rectangular plot around the house with `margin` metres on every side (a 20 × 15 m plot if nothing is drawn yet). */
export function plotAroundHouse(scene: Scene, margin = DEFAULT_PLOT_MARGIN_M): Vec2[] {
  const b = houseBounds(scene);
  const m = Math.min(30, Math.max(0, margin));
  const r = (v: number) => Math.round(v * 20) / 20; // 5 cm
  if (!b) return [[-10, -7.5], [10, -7.5], [10, 7.5], [-10, 7.5]];
  return [
    [r(b.min[0] - m), r(b.min[1] - m)],
    [r(b.max[0] + m), r(b.min[1] - m)],
    [r(b.max[0] + m), r(b.max[1] + m)],
    [r(b.min[0] - m), r(b.max[1] + m)],
  ];
}

/** Create the plot around the house in one step. */
export function setPlotAroundHouse(margin = DEFAULT_PLOT_MARGIN_M): Command {
  return {
    type: 'SetPlotAroundHouse',
    label: 'Set plot',
    apply(d) {
      d.plot = { boundary: plotAroundHouse(d, margin), northAngle: d.plot?.northAngle ?? 0 };
    },
  };
}

/** Points of the house (walls that are not part of the boundary) that lie outside the plot. Empty when there is no plot. */
export function nodesOutsidePlot(scene: Scene): Id[] {
  const plot = scene.plot?.boundary;
  if (!plot || plot.length < 3) return [];
  const used = new Set<Id>();
  for (const w of Object.values(scene.walls)) if (isHouseWall(w)) used.add(w.a).add(w.b);
  return [...used].filter((id) => {
    const n = scene.nodes[id];
    return n ? !pointInPolygon(n.p, plot, 0.02) : false;
  });
}

/**
 * Put a compound wall or fence along the plot edge (on the ground floor), replacing any earlier boundary.
 * 'none' just removes it. Boundary walls are never mistaken for rooms and block the walker.
 */
export function setBoundary(kind: BoundaryKind): Command {
  return {
    type: 'SetBoundary',
    label: kind === 'none' ? 'Remove boundary' : kind === 'wall' ? 'Add compound wall' : 'Add fence',
    apply(d) {
      for (const [id, w] of Object.entries(d.walls)) if (w.kind === 'boundary') delete d.walls[id];
      if (kind === 'none') return; // orphan points are cleaned by postProcess
      const plot = d.plot?.boundary;
      const levelId = d.levelOrder[0];
      if (!plot || plot.length < 3 || !levelId) return;
      const style = BOUNDARY_STYLES[kind];
      for (let i = 0; i < plot.length; i++) {
        addWall({ levelId, from: plot[i]!, to: plot[(i + 1) % plot.length]!, kind: 'boundary', thickness: style.thickness, height: style.height }).apply(d);
      }
      for (const w of Object.values(d.walls)) {
        if (w.kind !== 'boundary') continue;
        w.materialA = { id: style.material };
        w.materialB = { id: style.material };
      }
    },
  };
}

/** Which boundary the plot currently has (derived from the walls). */
export function boundaryKind(scene: Scene): BoundaryKind {
  const w = Object.values(scene.walls).find((x) => x.kind === 'boundary');
  if (!w) return 'none';
  return w.height >= (BOUNDARY_STYLES.wall.height + BOUNDARY_STYLES.fence.height) / 2 ? 'wall' : 'fence';
}
