import { detectRooms, stairToWorld, type StairLayout } from '@hd/geometry';
import { newId, type Id, type Scene, type Stair, type Vec2 } from '@hd/scene-schema';
import { wrapAngle } from '../placement';
import type { Command } from '../types';
import { addOpening } from './openings';
import { addLevel, MAX_LEVEL_HEIGHT_M, MIN_LEVEL_HEIGHT_M } from './levels';
import { addWall, isHouseWall } from './walls';
import { DEFAULT_STAIR_MATERIAL, DEFAULT_STAIR_WIDTH_M, layoutOf, levelAbove, stairOutline, type AddStairParams } from './stairs';

/** Free floor the hall leaves in front of the top step (where you step off). */
export const STAIR_LANDING_M = 1.0;
/** Space around the flight, measured to the wall centre lines (a wall is ≈ 12 cm thick and the opening must clear it). */
export const STAIR_HALL_MARGIN_M = 0.3;
/** Extra floor beside a straight flight (on its right) so you can walk from the top of one flight back to the start of the next. */
export const STAIR_HALL_PASSAGE_M = 0.9;

/**
 * Four corners (world x, z) of the hall around a stair on the floor it arrives on: the flight's bounding box with a
 * landing in front of the top step and a margin on the other sides. Returned in order; `arrival` is the index `i` of the
 * side (corner i → corner i+1) that the climber walks toward.
 */
export function stairHallCorners(layout: StairLayout, origin: Vec2, rotationY: number): { corners: Vec2[]; arrival: number } {
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (const [x, z] of layout.outline) {
    x0 = Math.min(x0, x);
    z0 = Math.min(z0, z);
    x1 = Math.max(x1, x);
    z1 = Math.max(z1, z);
  }
  const last = layout.treads[layout.treads.length - 1];
  const dir = last?.dir ?? [0, -1];
  const m = STAIR_HALL_MARGIN_M;
  const L = STAIR_LANDING_M;
  // Local box [x0, z0] .. [x1, z1]; corners go (x0,z0) → (x1,z0) → (x1,z1) → (x0,z1).
  let arrival: number;
  if (dir[1]! < -0.5) {
    z0 -= L;
    arrival = 0;
  } else if (dir[0]! > 0.5) {
    x1 += L;
    arrival = 1;
  } else if (dir[1]! > 0.5) {
    z1 += L;
    arrival = 2;
  } else {
    x0 -= L;
    arrival = 3;
  }
  if (arrival !== 3) x0 -= m;
  if (arrival !== 1) x1 += m;
  // A straight flight on a straight flight: the climber must be able to walk back along the opening to the start of the next flight.
  if (layout.kind === 'straight' && arrival === 0) x1 += STAIR_HALL_PASSAGE_M;
  if (arrival !== 0) z0 -= m;
  if (arrival !== 2) z1 += m;
  const local: Vec2[] = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  return { corners: local.map((p) => stairToWorld(origin, rotationY, p)), arrival };
}

function inside(p: Vec2, poly: readonly Vec2[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}

/** True when a room of `levelId` already surrounds the whole stairwell. */
function stairwellHasRoom(d: Scene, stair: Stair): boolean {
  const o = stairOutline(d, stair);
  if (!o) return true;
  const walls = Object.values(d.walls).filter((w) => w.levelId === stair.toLevel && isHouseWall(w));
  return detectRooms(d.nodes, walls).some((r) => {
    const poly = r.polygon.map((p): Vec2 => [p[0], p[1]]);
    return o.every((p) => inside(p, poly));
  });
}

/**
 * Build the room that carries the top of a stair on the floor it arrives on: four walls around the stairwell with a
 * landing in front of the top step and a door on the landing side. Does nothing when a room already surrounds the opening.
 */
export function buildStairHall(d: Scene, stair: Stair): void {
  const layout = layoutOf(d, stair);
  if (!layout || stairwellHasRoom(d, stair)) return;
  const { corners, arrival } = stairHallCorners(layout, [stair.origin[0], stair.origin[2]], stair.rotationY);
  const bare = !Object.values(d.walls).some((w) => w.levelId === stair.toLevel && isHouseWall(w));
  for (let i = 0; i < 4; i++) {
    addWall({ levelId: stair.toLevel, from: corners[i]!, to: corners[(i + 1) % 4]!, kind: bare ? 'exterior' : 'interior' }).apply(d);
  }
  // A door in the middle of the landing-side wall so the hall opens onto the rest of the floor.
  const a = corners[arrival]!;
  const b = corners[(arrival + 1) % 4]!;
  const mid: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const onSide = (w: { a: Id; b: Id; levelId: Id }) => {
    if (w.levelId !== stair.toLevel) return null;
    const p = d.nodes[w.a]?.p;
    const q = d.nodes[w.b]?.p;
    if (!p || !q) return null;
    const mx = (p[0] + q[0]) / 2;
    const mz = (p[1] + q[1]) / 2;
    const ab = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const dist = Math.abs((b[0] - a[0]) * (a[1] - mz) - (a[0] - mx) * (b[1] - a[1])) / ab;
    const t = ((mx - a[0]) * (b[0] - a[0]) + (mz - a[1]) * (b[1] - a[1])) / (ab * ab);
    return dist < 0.03 && t > -0.01 && t < 1.01 ? { p, q, len: Math.hypot(q[0] - p[0], q[1] - p[1]) } : null;
  };
  let best: { id: Id; offset: number; len: number } | null = null;
  for (const w of Object.values(d.walls)) {
    const hit = onSide(w);
    if (!hit || hit.len < 1.1) continue;
    const toMid = Math.hypot(mid[0] - hit.p[0], mid[1] - hit.p[1]);
    const within = toMid <= hit.len && Math.hypot(mid[0] - hit.q[0], mid[1] - hit.q[1]) <= hit.len;
    const offset = within ? toMid : hit.len / 2;
    if (!best || (within && hit.len > best.len)) best = { id: w.id, offset, len: hit.len };
  }
  if (best) addOpening({ wallId: best.id, type: 'door', offset: best.offset }).apply(d);
}

/**
 * Where the next flight of a stack starts. Straight, L and U flights stack in the same footprint (the lower flight's opening
 * only covers the steps close to the floor, so the next one starts on solid floor). A spiral turns on: the next one starts at
 * the angle where the last one arrived.
 */
export function nextFlightRotation(d: Scene, s: Stair): number {
  if (s.kind !== 'spiral') return s.rotationY;
  const layout = layoutOf(d, s);
  const sp = layout?.spiral;
  return sp && layout ? wrapAngle(s.rotationY + layout.treads.length * sp.delta) : s.rotationY;
}

/** Most floors one staircase can climb in one go. */
export const MAX_STAIR_FLIGHTS = 12;

export interface AddStairAssemblyParams extends AddStairParams {
  /** Build the room (walls, landing, door) that carries the top of the stair on the floor above. Default true. */
  hall?: boolean;
  /** Keep going: a stair on every floor up to the top one, one above the other. Default false (one flight). */
  toTop?: boolean;
  /**
   * How many floors to climb (one flight per floor, stacked). Floors missing above are added. Wins over `toTop`.
   * Clamped to 1..MAX_STAIR_FLIGHTS.
   */
  flights?: number;
  /** Floor-to-floor height of the floors this adds (m). Default: the height of the floor below the new one. */
  floorHeight?: number;
  build?: Stair['build'];
  steps?: Stair['steps'];
  stringer?: Stair['stringer'];
  railingOpts?: Stair['railingOpts'];
}

/**
 * Ready-made staircase that connects floors by itself: adds the floor above when there is none, the flight, the room
 * around its top (so the floor opens up and you can step off; skip it with `hall: false` for stairs that stand on their
 * own), and with `flights` / `toTop` a matching flight on every floor above. One undo step.
 */
export function addStairAssembly(p: AddStairAssemblyParams, rng?: () => number): Command {
  const ids = Array.from({ length: MAX_STAIR_FLIGHTS }, () => newId('stair', rng));
  const count = p.flights !== undefined ? Math.min(MAX_STAIR_FLIGHTS, Math.max(1, Math.round(p.flights))) : p.toTop ? MAX_STAIR_FLIGHTS : 1;
  // `toTop` alone only adds a floor when there is none above the start; `flights` adds every floor it needs.
  const addFloors = p.flights !== undefined;
  return {
    type: 'AddStairAssembly',
    label: count > 1 && addFloors ? `Add stairs (${count} floors)` : 'Add stairs',
    apply(d) {
      const start = d.levels[p.fromLevel];
      if (!start) return;
      let from: Id = p.fromLevel;
      let rotation = wrapAngle(p.rotationY ?? 0);
      for (let n = 0; n < count; n++) {
        if (!levelAbove(d, from) && (n === 0 || addFloors)) {
          const below = d.levels[from];
          const h = p.floorHeight ?? below?.height ?? start.height;
          addLevel(undefined, Math.min(MAX_LEVEL_HEIGHT_M, Math.max(MIN_LEVEL_HEIGHT_M, h))).apply(d);
        }
        const to = levelAbove(d, from);
        if (!to) break;
        const stair: Stair = {
          id: ids[n]!,
          fromLevel: from,
          toLevel: to,
          kind: p.kind ?? 'straight',
          origin: [p.origin[0], 0, p.origin[1]],
          rotationY: rotation,
          width: Math.min(3, Math.max(0.6, p.width ?? DEFAULT_STAIR_WIDTH_M)),
          ...(p.mirror ? { mirror: true } : {}),
          material: p.material ?? { id: DEFAULT_STAIR_MATERIAL },
          railing: p.railing ?? 'wood',
          ...(p.build && p.build !== 'solid' ? { build: p.build } : {}),
          ...(p.steps ? { steps: { ...p.steps } } : {}),
          ...(p.stringer ? { stringer: { ...p.stringer } } : {}),
          ...(p.railingOpts ? { railingOpts: { ...p.railingOpts } } : {}),
        };
        d.stairs[stair.id] = stair;
        if (p.hall !== false) buildStairHall(d, stair);
        from = to;
        rotation = nextFlightRotation(d, stair);
      }
    },
  };
}

/** Give an existing stair its room on the floor above (the inspector's "Build the room above" button). */
export function connectStairHall(stairId: Id): Command {
  return {
    type: 'ConnectStairHall',
    label: 'Build room above the stairs',
    apply(d) {
      const s = d.stairs[stairId];
      if (s) buildStairHall(d, s);
    },
  };
}

/**
 * Carry a stair on up: a matching flight from its top floor to the next one (adding that floor when needed) with its room
 * (`hall: false` leaves the room out, for stairs that stand on their own).
 */
export function continueStairUp(stairId: Id, rng?: () => number, opts: { hall?: boolean } = {}): Command {
  const id = newId('stair', rng);
  return {
    type: 'ContinueStairUp',
    label: 'Continue stairs up',
    apply(d) {
      const s = d.stairs[stairId];
      if (!s) return;
      const top = d.levels[s.toLevel];
      if (!top) return;
      if (!levelAbove(d, s.toLevel)) addLevel(undefined, top.height).apply(d);
      const next = levelAbove(d, s.toLevel);
      if (!next || Object.values(d.stairs).some((o) => o.fromLevel === s.toLevel && o.toLevel === next)) return;
      const up: Stair = { ...s, id, fromLevel: s.toLevel, toLevel: next, rotationY: nextFlightRotation(d, s) };
      d.stairs[id] = up;
      if (opts.hall !== false) buildStairHall(d, up);
    },
  };
}
