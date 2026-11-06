import { getAsset, localToPlan } from '@hd/assets';
import type { Id, MaterialRef, RoomType, Scene, Vec2 } from '@hd/scene-schema';
import { addItem } from '../commands/items';
import { addOpening } from '../commands/openings';
import { addWall } from '../commands/walls';
import { syncRooms } from '../rooms';
import type { Command } from '../types';

/** A side of a preset room, seen from above with north up: N = −z, E = +x, S = +z, W = −x. */
export type Side = 'N' | 'E' | 'S' | 'W';

interface OpeningSpec {
  side: Side;
  type: 'door' | 'window';
  /** Distance along the side from its first corner (N: from the west, E: from the north, S: from the east, W: from the south), metres. */
  at: number;
  width?: number;
}

interface ItemSpec {
  asset: string;
  /** Put the item against a wall (back to the wall, facing in) at `along` metres from the side's centre; or place it freely with x / z. */
  side?: Side;
  along?: number;
  x?: number;
  z?: number;
  /** Extra turn (radians) for free items. */
  rot?: number;
}

export interface RoomPreset {
  id: string;
  name: string;
  description: string;
  /** Centre-line size of the walls (metres). */
  w: number;
  d: number;
  roomType: RoomType;
  floor: string;
  /** Walls: 'exterior' for rooms that stand alone, 'interior' for ones meant to sit inside a house. */
  openings: OpeningSpec[];
  items: ItemSpec[];
  ceilingLight?: boolean;
}

const WALL_T = 0.23; // exterior wall thickness; items keep this much clear

export const ROOM_PRESETS: readonly RoomPreset[] = [
  {
    id: 'bedroom', name: 'Bedroom', description: 'Double bed, side tables, wardrobe', w: 3.8, d: 3.6, roomType: 'bedroom', floor: 'floor-wood-oak', ceilingLight: true,
    openings: [{ side: 'S', type: 'door', at: 0.7 }, { side: 'N', type: 'window', at: 1.9, width: 1.4 }],
    items: [{ asset: 'bed-double', side: 'N', along: 0 }, { asset: 'nightstand', side: 'N', along: -1.25 }, { asset: 'nightstand', side: 'N', along: 1.25 }, { asset: 'wardrobe', side: 'W', along: 0.5 }, { asset: 'rug', x: 0, z: 0.7 }],
  },
  {
    id: 'master', name: 'Master bedroom', description: 'King bed, dresser, big wardrobe, rug', w: 4.8, d: 4.2, roomType: 'bedroom', floor: 'floor-wood-walnut', ceilingLight: true,
    openings: [{ side: 'S', type: 'door', at: 0.8 }, { side: 'N', type: 'window', at: 2.4, width: 1.8 }, { side: 'E', type: 'window', at: 2.1, width: 1.2 }],
    items: [{ asset: 'bed-king', side: 'N', along: 0 }, { asset: 'nightstand', side: 'N', along: -1.4 }, { asset: 'nightstand', side: 'N', along: 1.4 }, { asset: 'wardrobe-sliding', side: 'W', along: 0.2 }, { asset: 'dresser', side: 'S', along: -1.2 }, { asset: 'rug', x: 0, z: 0.6 }, { asset: 'floor-lamp', x: 1.8, z: -1.5 }],
  },
  {
    id: 'kids', name: 'Kids room', description: 'Bed, study desk, toy box', w: 3.4, d: 3.4, roomType: 'bedroom', floor: 'floor-carpet-blue', ceilingLight: true,
    openings: [{ side: 'S', type: 'door', at: 0.7 }, { side: 'E', type: 'window', at: 1.7, width: 1.3 }],
    items: [{ asset: 'kids-bed', side: 'W', along: -0.6 }, { asset: 'kids-desk', side: 'N', along: 0.6 }, { asset: 'kids-chair', x: 0.5, z: -0.9, rot: Math.PI }, { asset: 'toy-box', side: 'S', along: 0.4 }, { asset: 'rug-round', x: 0.4, z: 0.5 }],
  },
  {
    id: 'living', name: 'Living room', description: 'Sofa set, TV, coffee table, plants', w: 5.4, d: 4.4, roomType: 'living', floor: 'floor-tile-cream', ceilingLight: true,
    openings: [{ side: 'S', type: 'door', at: 1.0, width: 1.0 }, { side: 'E', type: 'window', at: 2.2, width: 1.8 }, { side: 'N', type: 'window', at: 2.7, width: 1.6 }],
    items: [{ asset: 'tv-console', side: 'W', along: 0 }, { asset: 'sofa-3', side: 'E', along: 0 }, { asset: 'armchair', side: 'N', along: 1.2 }, { asset: 'coffee-table', x: 0.2, z: 0 }, { asset: 'rug', x: 0.2, z: 0 }, { asset: 'plant-tall', side: 'S', along: -1.8 }, { asset: 'bookshelf', side: 'N', along: -1.8 }],
  },
  {
    id: 'dining', name: 'Dining room', description: 'Six-seat table, sideboard', w: 4.2, d: 3.8, roomType: 'dining', floor: 'floor-wood-oak', ceilingLight: false,
    openings: [{ side: 'S', type: 'door', at: 0.9 }, { side: 'N', type: 'window', at: 2.1, width: 1.5 }],
    items: [{ asset: 'dining-table', x: 0, z: 0 }, { asset: 'dining-chair', x: -0.5, z: -0.7 }, { asset: 'dining-chair', x: 0.5, z: -0.7 }, { asset: 'dining-chair', x: -0.5, z: 0.7, rot: Math.PI }, { asset: 'dining-chair', x: 0.5, z: 0.7, rot: Math.PI }, { asset: 'sideboard', side: 'W', along: 0 }, { asset: 'pendant', x: 0, z: 0 }],
  },
  {
    id: 'kitchen', name: 'Kitchen', description: 'Cabinets, sink, stove, fridge, island', w: 4.0, d: 3.4, roomType: 'kitchen', floor: 'floor-tile-white', ceilingLight: true,
    openings: [{ side: 'S', type: 'door', at: 0.7 }, { side: 'E', type: 'window', at: 1.7, width: 1.3 }],
    items: [{ asset: 'fridge', side: 'N', along: -1.4 }, { asset: 'kitchen-base', side: 'N', along: -0.6 }, { asset: 'stove', side: 'N', along: 0.05 }, { asset: 'kitchen-sink', side: 'N', along: 0.95 }, { asset: 'kitchen-base', side: 'N', along: 1.6 }, { asset: 'kitchen-island', x: -0.1, z: 0.2 }, { asset: 'bar-stool', x: -0.7, z: 0.95 }, { asset: 'bar-stool', x: 0.5, z: 0.95 }],
  },
  {
    id: 'bathroom', name: 'Bathroom', description: 'Toilet, basin, shower', w: 2.5, d: 2.3, roomType: 'bathroom', floor: 'floor-tile-grey', ceilingLight: true,
    openings: [{ side: 'S', type: 'door', at: 0.6, width: 0.8 }, { side: 'N', type: 'window', at: 1.25, width: 0.6 }],
    items: [{ asset: 'shower', side: 'E', along: -0.55 }, { asset: 'washbasin', side: 'W', along: 0.55 }, { asset: 'toilet', side: 'N', along: -0.4 }],
  },
  {
    id: 'study', name: 'Study', description: 'Desk, chair, bookshelves', w: 3.2, d: 3.2, roomType: 'study', floor: 'floor-wood-walnut', ceilingLight: true,
    openings: [{ side: 'S', type: 'door', at: 0.7 }, { side: 'N', type: 'window', at: 1.6, width: 1.3 }],
    items: [{ asset: 'desk', side: 'N', along: 0 }, { asset: 'office-chair', x: 0, z: -0.55, rot: Math.PI }, { asset: 'bookshelf', side: 'W', along: 0.2 }, { asset: 'bookshelf', side: 'E', along: 0.2 }, { asset: 'floor-lamp', side: 'S', along: -1.2 }],
  },
  {
    id: 'pooja', name: 'Pooja room', description: 'Small prayer room with a mandir', w: 2.0, d: 2.0, roomType: 'other', floor: 'floor-marble', ceilingLight: true,
    openings: [{ side: 'S', type: 'door', at: 0.5, width: 0.8 }],
    items: [{ asset: 'pooja-mandir', side: 'N', along: 0 }, { asset: 'floor-cushion', x: -0.3, z: 0.3 }, { asset: 'floor-cushion', x: 0.3, z: 0.3 }],
  },
  {
    id: 'utility', name: 'Utility room', description: 'Washing machine, inverter, storage', w: 2.6, d: 2.2, roomType: 'utility', floor: 'floor-tile-grey', ceilingLight: true,
    openings: [{ side: 'S', type: 'door', at: 0.6, width: 0.8 }, { side: 'N', type: 'window', at: 1.3, width: 0.7 }],
    items: [{ asset: 'washer-top', side: 'N', along: -0.7 }, { asset: 'inverter', side: 'N', along: 0.5 }, { asset: 'kitchen-trolley', side: 'E', along: 0.2 }, { asset: 'laundry-basket', side: 'W', along: 0.3 }],
  },
  {
    id: 'garage', name: 'Garage', description: 'One-car garage', w: 3.6, d: 6.2, roomType: 'garage', floor: 'floor-concrete', ceilingLight: true,
    openings: [{ side: 'S', type: 'door', at: 1.8, width: 2.4 }, { side: 'W', type: 'door', at: 1.0, width: 0.9 }],
    items: [{ asset: 'car', x: 0, z: -0.2 }, { asset: 'shoe-rack', side: 'E', along: -1.2 }],
  },
  {
    id: 'studio', name: 'Studio flat', description: 'One room: bed, sofa, kitchen run, table', w: 6.0, d: 4.6, roomType: 'living', floor: 'floor-wood-ash', ceilingLight: true,
    openings: [{ side: 'S', type: 'door', at: 0.9 }, { side: 'N', type: 'window', at: 3.0, width: 2.0 }, { side: 'E', type: 'window', at: 2.3, width: 1.4 }],
    items: [{ asset: 'bed-double', side: 'W', along: -1.0 }, { asset: 'nightstand', side: 'W', along: 0.4 }, { asset: 'sofa-2', side: 'N', along: 1.3 }, { asset: 'tv-console', side: 'E', along: -0.2 }, { asset: 'kitchen-base', side: 'S', along: -2.2 }, { asset: 'kitchen-sink', side: 'S', along: -1.4 }, { asset: 'dining-table', x: 0.6, z: 0.5 }],
  },
];

export const getRoomPreset = (id: string): RoomPreset | undefined => ROOM_PRESETS.find((p) => p.id === id);

/** Rotate a plan offset by `quarters` quarter-turns (clockwise on the plan). */
export function turnOffset(p: Vec2, quarters: number): Vec2 {
  const q = ((quarters % 4) + 4) % 4;
  let [x, z] = p;
  for (let i = 0; i < q; i++) [x, z] = [-z, x];
  return [x, z];
}

interface Placed {
  asset: string;
  pos: Vec2;
  rot: number;
}

/** Where each item of a preset sits, relative to the room centre, before any turning. */
export function layoutItems(preset: RoomPreset): Placed[] {
  const hx = preset.w / 2 - WALL_T / 2 - 0.03;
  const hz = preset.d / 2 - WALL_T / 2 - 0.03;
  return preset.items.flatMap((it): Placed[] => {
    const a = getAsset(it.asset);
    if (!a) return [];
    if (!it.side) return [{ asset: it.asset, pos: [it.x ?? 0, it.z ?? 0], rot: it.rot ?? 0 }];
    const along = it.along ?? 0;
    // Back to the wall, facing the room.
    switch (it.side) {
      case 'N': return [{ asset: it.asset, pos: [along, -hz + a.size[1] / 2], rot: 0 }];
      case 'S': return [{ asset: it.asset, pos: [along, hz - a.size[1] / 2], rot: Math.PI }];
      case 'E': return [{ asset: it.asset, pos: [hx - a.size[1] / 2, along], rot: -Math.PI / 2 }];
      case 'W': return [{ asset: it.asset, pos: [-hx + a.size[1] / 2, along], rot: Math.PI / 2 }];
    }
  });
}

export interface PlaceRoomParams {
  levelId: Id;
  presetId: string;
  /** Centre of the room on the plan. */
  center: Vec2;
  /** Quarter-turns (0..3), clockwise. */
  quarters?: number;
}

const roomCorners = (w: number, d: number): Vec2[] => [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];

/** Footprint (corners, plan metres) the preset covers when placed — for the placement ghost and overlap checks. */
export function presetFootprint(preset: RoomPreset, center: Vec2, quarters = 0): Vec2[] {
  return roomCorners(preset.w, preset.d).map((c) => {
    const t = turnOffset(c, quarters);
    return [center[0] + t[0], center[1] + t[1]] as Vec2;
  });
}

/**
 * Place a furnished room: four walls, doors and windows, and its furniture, named and with its floor set.
 * One undo step. Ignored when the floor does not exist.
 */
export function placeRoomPreset(params: PlaceRoomParams): Command {
  const preset = getRoomPreset(params.presetId);
  return {
    type: 'PlaceRoomPreset',
    label: preset ? `Add ${preset.name.toLowerCase()}` : 'Add room',
    apply(d: Scene) {
      const level = d.levels[params.levelId];
      if (!preset || !level) return;
      const q = params.quarters ?? 0;
      const at = (p: Vec2): Vec2 => {
        const t = turnOffset(p, q);
        return [Math.round((params.center[0] + t[0]) * 1000) / 1000, Math.round((params.center[1] + t[1]) * 1000) / 1000];
      };
      const [c0, c1, c2, c3] = roomCorners(preset.w, preset.d).map(at) as [Vec2, Vec2, Vec2, Vec2];
      const sides: Array<[Side, Vec2, Vec2]> = [['N', c0, c1], ['E', c1, c2], ['S', c2, c3], ['W', c3, c0]];
      const before = new Set(Object.keys(d.walls));
      for (const [, a, b] of sides) addWall({ levelId: params.levelId, from: a, to: b, kind: 'exterior' }).apply(d);
      void before;

      // Find the wall that lies along each side (walls may have been split by neighbours, so match by midpoint).
      const wallAlong = (a: Vec2, b: Vec2, atDist: number): { id: Id; offset: number } | null => {
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const ux = (b[0] - a[0]) / len;
        const uz = (b[1] - a[1]) / len;
        const p: Vec2 = [a[0] + ux * atDist, a[1] + uz * atDist];
        for (const w of Object.values(d.walls)) {
          if (w.levelId !== params.levelId) continue;
          const na = d.nodes[w.a];
          const nb = d.nodes[w.b];
          if (!na || !nb) continue;
          const wl = Math.hypot(nb.p[0] - na.p[0], nb.p[1] - na.p[1]);
          const t = ((p[0] - na.p[0]) * (nb.p[0] - na.p[0]) + (p[1] - na.p[1]) * (nb.p[1] - na.p[1])) / (wl * wl);
          const dist = Math.hypot(p[0] - (na.p[0] + (nb.p[0] - na.p[0]) * t), p[1] - (na.p[1] + (nb.p[1] - na.p[1]) * t));
          if (t >= 0 && t <= 1 && dist < 0.02) return { id: w.id, offset: t * wl };
        }
        return null;
      };
      for (const o of preset.openings) {
        const [, a, b] = sides.find((s) => s[0] === o.side)!;
        const hit = wallAlong(a, b, o.at);
        if (hit) addOpening({ wallId: hit.id, type: o.type, offset: hit.offset, ...(o.width ? { width: o.width } : {}) }).apply(d);
      }

      for (const it of layoutItems(preset)) {
        const p = at(it.pos);
        const asset = getAsset(it.asset);
        if (!asset) continue;
        addItem({ levelId: params.levelId, assetId: it.asset, position: [p[0], 0, p[1]], rotationY: it.rot + (q * Math.PI) / 2 }).apply(d);
      }
      if (preset.ceilingLight) {
        addItem({ levelId: params.levelId, assetId: 'ceiling-light', position: [at([0, 0])[0], level.height, at([0, 0])[1]] }).apply(d);
      }

      // Name the room and set its floor (rooms are found by the walls we just made).
      syncRooms(d);
      const centre = at([0, 0]);
      for (const r of Object.values(d.rooms)) {
        if (r.levelId !== params.levelId) continue;
        const pts = r.wallLoop.map((id) => d.walls[id]).filter(Boolean).flatMap((w) => [d.nodes[w!.a]?.p, d.nodes[w!.b]?.p]).filter(Boolean) as Vec2[];
        if (!pts.length) continue;
        const inside = pointInPoly(centre, pts);
        if (inside) {
          r.name = preset.name;
          r.type = preset.roomType;
          r.floorMaterial = { id: preset.floor } as MaterialRef;
        }
      }
    },
  };
}

function pointInPoly(p: Vec2, pts: readonly Vec2[]): boolean {
  // The loop's points are in walking order only per wall; use the bounding box (rooms here are rectangles).
  const xs = pts.map((q) => q[0]);
  const zs = pts.map((q) => q[1]);
  return p[0] > Math.min(...xs) + 0.05 && p[0] < Math.max(...xs) - 0.05 && p[1] > Math.min(...zs) + 0.05 && p[1] < Math.max(...zs) - 0.05;
}

void localToPlan;
