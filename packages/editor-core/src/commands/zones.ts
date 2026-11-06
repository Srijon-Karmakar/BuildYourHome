import {
  PATH_DEFAULT_WIDTH_M,
  PATH_MAX_WIDTH_M,
  PATH_MIN_WIDTH_M,
  pathPolygon,
  validZoneOutline,
} from '@hd/geometry';
import { newId, type Id, type MaterialRef, type Scene, type Vec2, type Zone } from '@hd/scene-schema';
import { cleanPolygon } from './plot';
import type { Command } from '../types';

/** What the garden tool offers: a surface preset and whether it is drawn as an outline or a centre line. */
export const GARDEN_SURFACES = [
  { id: 'lawn', label: 'Lawn', shape: 'area', material: 'ground-grass' },
  { id: 'paving', label: 'Paving', shape: 'area', material: 'ground-stone' },
  { id: 'driveway', label: 'Driveway', shape: 'area', material: 'ground-brick-paving' },
  { id: 'gravel', label: 'Gravel', shape: 'area', material: 'ground-gravel' },
  { id: 'deck', label: 'Deck', shape: 'area', material: 'ground-deck' },
  { id: 'path', label: 'Path', shape: 'path', material: 'ground-paving' },
] as const;
export type GardenSurface = (typeof GARDEN_SURFACES)[number]['id'];

const clampWidth = (w: number) => Math.min(PATH_MAX_WIDTH_M, Math.max(PATH_MIN_WIDTH_M, w));

/** The polygon a zone covers on the ground (the outline, or the widened centre line of a path). */
export function zonePolygon(z: Pick<Zone, 'shape' | 'points' | 'width'>): Vec2[] {
  return z.shape === 'path' ? pathPolygon(z.points, z.width ?? PATH_DEFAULT_WIDTH_M) : z.points.map((p): Vec2 => [p[0], p[1]]);
}

/** Why the points can't make a zone (null = fine). */
export function zoneProblem(shape: Zone['shape'], points: readonly Vec2[], width = PATH_DEFAULT_WIDTH_M): string | null {
  const p = cleanPolygon(points);
  if (shape === 'path') {
    if (p.length < 2) return 'A path needs at least 2 points.';
    return validZoneOutline(pathPolygon(p, width)) ? null : 'That path folds back on itself.';
  }
  if (p.length < 3) return 'An area needs at least 3 corners.';
  if (!validZoneOutline(p)) return 'The outline crosses itself or is too small.';
  return null;
}

export interface AddZoneParams {
  shape: Zone['shape'];
  points: readonly Vec2[];
  material: MaterialRef;
  width?: number;
}

/** Add a lawn / paving / path. Invalid shapes are ignored. */
export function addZone(p: AddZoneParams, rng?: () => number): Command {
  const id = newId('zone', rng);
  return {
    type: 'AddZone',
    label: p.shape === 'path' ? 'Add path' : 'Add garden area',
    apply(d) {
      // A path keeps its centre line; closing duplicates are only removed for areas.
      const pts = p.shape === 'path' ? dedupe(p.points) : cleanPolygon(p.points);
      const width = clampWidth(p.width ?? PATH_DEFAULT_WIDTH_M);
      if (zoneProblem(p.shape, pts, width) !== null) return;
      d.zones[id] = { id, shape: p.shape, points: pts, ...(p.shape === 'path' ? { width } : {}), material: { ...p.material } };
    },
  };
}

function dedupe(points: readonly Vec2[]): Vec2[] {
  const out: Vec2[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 1e-3) out.push([p[0], p[1]]);
  }
  return out;
}

export interface ZoneProps {
  material?: MaterialRef;
  width?: number;
}

export function updateZones(ids: readonly Id[], props: ZoneProps): Command {
  return {
    type: 'UpdateZones',
    label: 'Edit garden area',
    apply(d) {
      for (const id of ids) {
        const z = d.zones[id];
        if (!z) continue;
        if (props.material) z.material = { ...props.material };
        if (props.width !== undefined && z.shape === 'path') {
          const w = clampWidth(props.width);
          if (zoneProblem('path', z.points, w) === null) z.width = w;
        }
      }
    },
  };
}

export function translateZones(ids: readonly Id[], dx: number, dz: number): Command {
  return {
    type: 'TranslateZones',
    label: 'Move garden area',
    apply(d) {
      for (const id of ids) {
        const z = d.zones[id];
        if (z) z.points = z.points.map((p): Vec2 => [p[0] + dx, p[1] + dz]);
      }
    },
  };
}

export function removeZones(ids: readonly Id[]): Command {
  return {
    type: 'RemoveZones',
    label: 'Delete garden area',
    apply(d) {
      for (const id of ids) delete d.zones[id];
    },
  };
}

/** Everything the garden covers, for framing the view. */
export function zonePoints(scene: Scene): Vec2[] {
  return Object.values(scene.zones).flatMap((z) => zonePolygon(z));
}
