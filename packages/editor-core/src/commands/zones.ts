import {
  ROAD_DEFAULT_WIDTH_M,
  ROAD_MAX_WIDTH_M,
  ROAD_MIN_WIDTH_M,
  roadFootprint,
  nearRoad,
  PATH_DEFAULT_WIDTH_M,
  PATH_MAX_WIDTH_M,
  PATH_MIN_WIDTH_M,
  pathPolygon,
  validZoneOutline,
} from '@hd/geometry';
import { newId, type Id, type MaterialRef, type RoadStyle, type Scene, type Vec2, type Zone } from '@hd/scene-schema';
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
const clampRoad = (w: number) => Math.min(ROAD_MAX_WIDTH_M, Math.max(ROAD_MIN_WIDTH_M, w));

/** Ready-made roads: width, lanes and the usual markings, pavements and kerb. */
export const ROAD_PRESETS = [
  { id: 'lane', label: 'Lane', width: 3.5, style: { lanes: 1, oneWay: false, centre: 'none', edges: false, kerb: 0, pavLeft: 0, pavRight: 0, parking: 'none' } },
  { id: 'street', label: 'Street', width: 6, style: { lanes: 2, oneWay: false, centre: 'dashed', edges: false, kerb: 0.12, pavLeft: 1.5, pavRight: 1.5, parking: 'none' } },
  { id: 'main', label: 'Main road', width: 9, style: { lanes: 2, oneWay: false, centre: 'double', edges: true, kerb: 0.15, pavLeft: 2.2, pavRight: 2.2, parking: 'none' } },
  { id: 'avenue', label: 'Avenue', width: 14, style: { lanes: 4, oneWay: false, centre: 'double', edges: true, kerb: 0.15, pavLeft: 2.5, pavRight: 2.5, parking: 'none' } },
] as const;
export type RoadPresetId = (typeof ROAD_PRESETS)[number]['id'];

/** A full road style from a preset (street lights on both sides for a main road or avenue, none on a lane). */
export function roadStyleFor(id: RoadPresetId, pavMaterial: MaterialRef = { id: 'ground-paving' }): { width: number; style: RoadStyle } {
  const p = ROAD_PRESETS.find((x) => x.id === id) ?? ROAD_PRESETS[1];
  const lights = id === 'main' || id === 'avenue' ? [{ kind: 'light' as const, side: 'both' as const, spacing: 24 }] : [];
  return { width: p.width, style: { ...p.style, oneWay: false, pavMaterial: { ...pavMaterial }, crossings: [], bumps: [], extras: lights } as RoadStyle };
}

/** The polygon a zone covers on the ground (the outline, or the widened centre line of a path). */
export function zonePolygon(z: Pick<Zone, 'shape' | 'points' | 'width'> & { road?: Pick<RoadStyle, 'pavLeft' | 'pavRight'> }): Vec2[] {
  if (z.shape === 'road') return roadFootprint(z.points, z.width ?? ROAD_DEFAULT_WIDTH_M, z.road?.pavLeft ?? 0, z.road?.pavRight ?? 0);
  return z.shape === 'path' ? pathPolygon(z.points, z.width ?? PATH_DEFAULT_WIDTH_M) : z.points.map((p): Vec2 => [p[0], p[1]]);
}

/** Why the points can't make a zone (null = fine). */
export function zoneProblem(shape: Zone['shape'], points: readonly Vec2[], width = PATH_DEFAULT_WIDTH_M): string | null {
  const p = cleanPolygon(points);
  if (shape === 'road') {
    if (p.length < 2) return 'A road needs at least 2 points.';
    return validZoneOutline(pathPolygon(p, Math.max(width, ROAD_MIN_WIDTH_M), ROAD_MAX_WIDTH_M)) ? null : 'That road folds back on itself.';
  }
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
  /** Roads only. */
  road?: RoadStyle;
}

/** Add a lawn / paving / path / road. Invalid shapes are ignored. */
export function addZone(p: AddZoneParams, rng?: () => number): Command {
  const id = newId('zone', rng);
  return {
    type: 'AddZone',
    label: p.shape === 'road' ? 'Add road' : p.shape === 'path' ? 'Add path' : 'Add garden area',
    apply(d) {
      // A path or road keeps its centre line; closing duplicates are only removed for areas.
      const line = p.shape !== 'area';
      const pts = line ? dedupe(p.points) : cleanPolygon(p.points);
      const width = p.shape === 'road' ? clampRoad(p.width ?? ROAD_DEFAULT_WIDTH_M) : clampWidth(p.width ?? PATH_DEFAULT_WIDTH_M);
      if (zoneProblem(p.shape, pts, width) !== null) return;
      d.zones[id] = {
        id,
        shape: p.shape,
        points: pts,
        ...(line ? { width } : {}),
        material: { ...p.material },
        ...(p.shape === 'road' ? { road: structuredClone(p.road ?? roadStyleFor('street').style) } : {}),
      };
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
  /** Roads: fields given replace those of the road's look (lists are replaced whole). */
  road?: Partial<RoadStyle>;
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
        if (z.shape === 'road') {
          if (props.width !== undefined) {
            const w = clampRoad(props.width);
            if (zoneProblem('road', z.points, w) === null) z.width = w;
          }
          if (props.road) {
            const cur = z.road ?? roadStyleFor('street').style;
            const next = { ...cur, ...props.road } as RoadStyle;
            next.lanes = Math.min(6, Math.max(1, Math.round(next.lanes)));
            next.kerb = Math.min(0.25, Math.max(0, next.kerb));
            next.pavLeft = Math.min(6, Math.max(0, next.pavLeft));
            next.pavRight = Math.min(6, Math.max(0, next.pavRight));
            next.crossings = [...next.crossings].slice(0, 8).map((v) => Math.min(1, Math.max(0, v)));
            next.bumps = [...next.bumps].slice(0, 8).map((v) => Math.min(1, Math.max(0, v)));
            next.extras = next.extras.slice(0, 6).map((e) => ({ ...e, spacing: Math.min(80, Math.max(3, e.spacing)) }));
            z.road = next;
          }
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
      for (const id of ids) {
        delete d.zones[id];
        // The neighbours that were filled in along a road go with it.
        for (const [iid, it] of Object.entries(d.items)) if (it.tag === `street:${id}`) delete d.items[iid];
      }
    },
  };
}

/** Everything the garden covers, for framing the view. */
export function zonePoints(scene: Scene): Vec2[] {
  return Object.values(scene.zones).flatMap((z) => zonePolygon(z));
}

/** For one road: says whether a point is inside another road's carriageway (paint and pavement are left out there). */
export function roadCoverage(scene: Scene, roadId: Id): (p: Vec2) => boolean {
  const others = Object.values(scene.zones).filter((z) => z.shape === 'road' && z.id !== roadId);
  if (others.length === 0) return () => false;
  return (p) => others.some((o) => nearRoad(o.points, o.width ?? ROAD_DEFAULT_WIDTH_M, p, 0.15));
}
