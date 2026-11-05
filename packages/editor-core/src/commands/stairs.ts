import {
  MAX_STAIR_WIDTH_M,
  MIN_STAIR_WIDTH_M,
  pointInPolygon,
  stairLayout,
  stairOutlineWorld,
  type StairKind,
  type StairLayout,
} from '@hd/geometry';
import { newId, type Id, type MaterialRef, type Scene, type Stair, type Vec2 } from '@hd/scene-schema';
import { wrapAngle } from '../placement';
import type { Command } from '../types';

export const DEFAULT_STAIR_WIDTH_M = 1;
/** Darker than the default oak floor so stairs stand out from above. */
export const DEFAULT_STAIR_MATERIAL = 'floor-wood-walnut';
const clampWidth = (w: number) => Math.min(MAX_STAIR_WIDTH_M, Math.max(MIN_STAIR_WIDTH_M, w));

/** The floor directly above `levelId`, if there is one. */
export function levelAbove(scene: Scene, levelId: Id): Id | undefined {
  const i = scene.levelOrder.indexOf(levelId);
  return i >= 0 ? scene.levelOrder[i + 1] : undefined;
}

/** Floor-to-floor height a stair has to climb (derived, never stored: changing a floor height re-fits the stairs). */
export function stairRise(scene: Scene, s: Pick<Stair, 'fromLevel' | 'toLevel'>): number | null {
  const a = scene.levels[s.fromLevel];
  const b = scene.levels[s.toLevel];
  return a && b && b.elevation > a.elevation ? b.elevation - a.elevation : null;
}

/** Steps of a placed stair (null when its floors no longer make sense). */
export function layoutOf(scene: Scene, s: Stair): StairLayout | null {
  const rise = stairRise(scene, s);
  return rise === null ? null : stairLayout({ kind: s.kind, width: s.width, rise, mirror: s.mirror });
}

/** Outline of a placed stair on the plan (world x, z). */
export function stairOutline(scene: Scene, s: Stair): Vec2[] | null {
  const l = layoutOf(scene, s);
  return l ? stairOutlineWorld(l, [s.origin[0], s.origin[2]], s.rotationY) : null;
}

export interface AddStairParams {
  /** The floor the stair starts on; it climbs to the floor above (which must exist when the command runs). */
  fromLevel: Id;
  /** Centre of the bottom edge of the first step, on the plan. */
  origin: Vec2;
  rotationY?: number;
  kind?: StairKind;
  width?: number;
  mirror?: boolean;
  material?: MaterialRef;
}

/** Add a stair from `fromLevel` to the floor above it. Ignored when there is no floor above. */
export function addStair(p: AddStairParams, rng?: () => number): Command {
  const id = newId('stair', rng);
  return {
    type: 'AddStair',
    label: 'Add stairs',
    apply(d) {
      const toLevel = levelAbove(d, p.fromLevel);
      if (!d.levels[p.fromLevel] || !toLevel) return;
      d.stairs[id] = {
        id,
        fromLevel: p.fromLevel,
        toLevel,
        kind: p.kind ?? 'straight',
        origin: [p.origin[0], 0, p.origin[1]],
        rotationY: wrapAngle(p.rotationY ?? 0),
        width: clampWidth(p.width ?? DEFAULT_STAIR_WIDTH_M),
        ...(p.mirror ? { mirror: true } : {}),
        material: p.material ?? { id: DEFAULT_STAIR_MATERIAL },
      };
    },
  };
}

export interface StairProps {
  kind?: StairKind;
  width?: number;
  rotationY?: number;
  mirror?: boolean;
  material?: MaterialRef;
  /** New position on the plan. */
  origin?: Vec2;
}

/** Change one or more stairs (kind, width, turn, material, position). */
export function updateStairs(ids: readonly Id[], props: StairProps): Command {
  return {
    type: 'UpdateStairs',
    label: props.origin ? 'Move stairs' : 'Edit stairs',
    apply(d) {
      for (const id of ids) {
        const s = d.stairs[id];
        if (!s) continue;
        if (props.kind !== undefined) s.kind = props.kind;
        if (props.width !== undefined) s.width = clampWidth(props.width);
        if (props.rotationY !== undefined) s.rotationY = wrapAngle(props.rotationY);
        if (props.mirror !== undefined) {
          if (props.mirror) s.mirror = true;
          else delete s.mirror;
        }
        if (props.material) s.material = props.material;
        if (props.origin) s.origin = [props.origin[0], 0, props.origin[1]];
      }
    },
  };
}

/** Turn stairs by `delta` radians around their first step. */
export function rotateStairs(ids: readonly Id[], delta: number): Command {
  return {
    type: 'RotateStairs',
    label: 'Turn stairs',
    apply(d) {
      for (const id of ids) {
        const s = d.stairs[id];
        if (s) s.rotationY = wrapAngle(s.rotationY + delta);
      }
    },
  };
}

/** Shift stairs on the plan (arrow keys, group moves). */
export function translateStairs(ids: readonly Id[], dx: number, dz: number): Command {
  return {
    type: 'TranslateStairs',
    label: 'Move stairs',
    apply(d) {
      for (const id of ids) {
        const s = d.stairs[id];
        if (s) s.origin = [s.origin[0] + dx, 0, s.origin[2] + dz];
      }
    },
  };
}

export function removeStairs(ids: readonly Id[]): Command {
  return {
    type: 'RemoveStairs',
    label: ids.length > 1 ? 'Delete stairs' : 'Delete stairs',
    apply(d) {
      for (const id of ids) delete d.stairs[id];
    },
  };
}

/**
 * Stairwell openings that apply to one room outline on one floor:
 *  - `floor`: stairs that arrive on this floor from below cut a hole in its floor,
 *  - `ceiling`: stairs that leave this floor upward cut a hole in its ceiling.
 * An opening is only cut when the whole outline lies inside the room (and no room corner pokes into it);
 * otherwise the floor stays closed there and `stairNeedsRoom` reports it.
 */
export function stairOpenings(scene: Scene, levelId: Id, part: 'floor' | 'ceiling', room: readonly Vec2[]): Vec2[][] {
  const out: Vec2[][] = [];
  for (const s of Object.values(scene.stairs)) {
    if ((part === 'floor' ? s.toLevel : s.fromLevel) !== levelId) continue;
    const o = stairOutline(scene, s);
    if (o && outlineInside(o, room)) out.push(o);
  }
  return out;
}

function outlineInside(outline: readonly Vec2[], room: readonly Vec2[]): boolean {
  if (!outline.every((p) => pointInPolygon(p, room, 0.01))) return false;
  // A concave room corner inside the opening would make the hole cross the room's edge.
  const strictlyInside = (p: Vec2) => pointInPolygon(p, outline, 0) && !outline.some((q, i) => nearSegment(p, q, outline[(i + 1) % outline.length]!));
  return !room.some(strictlyInside);
}

function nearSegment(p: Vec2, a: Vec2, b: Vec2): boolean {
  const abx = b[0] - a[0];
  const abz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * abx + (p[1] - a[1]) * abz) / (abx * abx + abz * abz || 1)));
  return Math.hypot(p[0] - (a[0] + abx * t), p[1] - (a[1] + abz * t)) < 0.01;
}

/** Floor above + the stairwell: which of the stair's floors have no room around the opening (for the inspector's warning). */
export function stairNeedsRoom(scene: Scene, s: Stair, rooms: (levelId: Id) => readonly (readonly Vec2[])[]): Id | null {
  const o = stairOutline(scene, s);
  if (!o) return null;
  const upper = rooms(s.toLevel);
  return upper.some((r) => outlineInside(o, r)) ? null : s.toLevel;
}
