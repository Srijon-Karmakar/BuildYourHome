import {
  BALCONY_MIN_AREA_M2,
  edgesAgainstWalls,
  isSimplePolygon,
  polygonArea,
  railingRuns,
  type RailingKind,
  type Segment,
  type Collider,
} from '@hd/geometry';
import { newId, type Balcony, type Id, type MaterialRef, type Scene, type Vec2 } from '@hd/scene-schema';
import { cleanPolygon } from './plot';
import { isHouseWall } from './walls';
import type { Command } from '../types';

export const DEFAULT_BALCONY_FLOOR = 'floor-tile-beige';

/** Why a balcony outline can't be used (null = fine). */
export function balconyProblem(points: readonly Vec2[]): string | null {
  const p = cleanPolygon(points);
  if (p.length < 3) return 'A balcony needs at least 3 corners.';
  if (!isSimplePolygon(p)) return 'The outline crosses itself.';
  if (polygonArea(p) < BALCONY_MIN_AREA_M2) return 'That balcony is too small.';
  return null;
}

export interface AddBalconyParams {
  levelId: Id;
  outline: readonly Vec2[];
  railing?: RailingKind;
  floorMaterial?: MaterialRef;
}

/** Add a balcony / porch slab to a floor. Invalid outlines are ignored. */
export function addBalcony(p: AddBalconyParams, rng?: () => number): Command {
  const id = newId('balcony', rng);
  return {
    type: 'AddBalcony',
    label: 'Add balcony',
    apply(d) {
      const outline = cleanPolygon(p.outline);
      if (!d.levels[p.levelId] || balconyProblem(outline) !== null) return;
      d.balconies[id] = {
        id,
        levelId: p.levelId,
        outline,
        railing: p.railing ?? 'glass',
        floorMaterial: p.floorMaterial ?? { id: DEFAULT_BALCONY_FLOOR },
      };
    },
  };
}

export interface BalconyProps {
  railing?: RailingKind;
  floorMaterial?: MaterialRef;
  /** Railing fine tuning: fields given are merged into the current ones; `null` goes back to the plain look. */
  railingOpts?: Partial<NonNullable<Balcony['railingOpts']>> | null;
  /** Slab, supports and canopy: merged the same way; `null` resets. */
  slab?: Partial<NonNullable<Balcony['slab']>> | null;
  supports?: Partial<NonNullable<Balcony['supports']>> | null;
  canopy?: Partial<NonNullable<Balcony['canopy']>> | null;
}

type OptKey = 'railingOpts' | 'slab' | 'supports' | 'canopy';

function mergeInto(b: Balcony, key: OptKey, add: object | null | undefined): void {
  if (add === undefined) return;
  const rec = b as unknown as Record<string, unknown>;
  if (add === null) {
    delete rec[key];
    return;
  }
  const merged = { ...((rec[key] as object | undefined) ?? {}), ...add } as Record<string, unknown>;
  for (const k of Object.keys(merged)) if (merged[k] === undefined) delete merged[k];
  if (Object.keys(merged).length) rec[key] = merged;
  else delete rec[key];
}

export function updateBalconies(ids: readonly Id[], props: BalconyProps): Command {
  return {
    type: 'UpdateBalconies',
    label: 'Edit balcony',
    apply(d) {
      for (const id of ids) {
        const b = d.balconies[id];
        if (!b) continue;
        if (props.railing) b.railing = props.railing;
        if (props.floorMaterial) b.floorMaterial = props.floorMaterial;
        mergeInto(b, 'railingOpts', props.railingOpts);
        mergeInto(b, 'slab', props.slab);
        mergeInto(b, 'supports', props.supports);
        mergeInto(b, 'canopy', props.canopy);
      }
    },
  };
}

export function translateBalconies(ids: readonly Id[], dx: number, dz: number): Command {
  return {
    type: 'TranslateBalconies',
    label: 'Move balcony',
    apply(d) {
      for (const id of ids) {
        const b = d.balconies[id];
        if (b) b.outline = b.outline.map((p): Vec2 => [p[0] + dx, p[1] + dz]);
      }
    },
  };
}

export function removeBalconies(ids: readonly Id[]): Command {
  return {
    type: 'RemoveBalconies',
    label: 'Delete balcony',
    apply(d) {
      for (const id of ids) delete d.balconies[id];
    },
  };
}

/** Wall centre lines of one floor (boundary walls excluded: they enclose the plot, not the house). */
export function wallSegments(scene: Scene, levelId: Id): Segment[] {
  const out: Segment[] = [];
  for (const w of Object.values(scene.walls)) {
    if (w.levelId !== levelId || !isHouseWall(w)) continue;
    const a = scene.nodes[w.a];
    const b = scene.nodes[w.b];
    if (a && b) out.push({ a: a.p, b: b.p });
  }
  return out;
}

/** Railing runs of a placed balcony (edges against a house wall have none). */
export function balconyRailings(scene: Scene, id: Id): Segment[] {
  const b = scene.balconies[id];
  if (!b) return [];
  const against = edgesAgainstWalls(b.outline, wallSegments(scene, b.levelId));
  return railingRuns(b.outline, against, b.railing);
}

/** Thin colliders along the railings so the walker cannot walk off the edge (open edges without a railing stay open). */
export function balconyColliders(scene: Scene, levelId: Id): Collider[] {
  const out: Collider[] = [];
  for (const b of Object.values(scene.balconies)) {
    if (b.levelId !== levelId || b.railing === 'none') continue;
    for (const r of balconyRailings(scene, b.id)) out.push({ a: r.a, b: r.b, halfThickness: 0.03 });
  }
  return out;
}
