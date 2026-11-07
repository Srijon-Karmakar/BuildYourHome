import { createEmptyScene, type RoomType, type Scene, type Vec2 } from '@hd/scene-schema';
import {
  addBalcony,
  addItem,
  addLevel,
  addOpening,
  addStairAssembly,
  addWall,
  addZone,
  batch,
  createEditor,
  getRoomPreset,
  layoutItems,
  nearestWallPoint,
  setBoundary,
  setGround,
  setPlot,
  setRoomProps,
  turnOffset,
  type Editor,
} from '@hd/editor-core';
import { detectRooms } from '@hd/geometry';

/**
 * Ready-made homes for the sample gallery. They are built with the real editor commands (so junctions, rooms, roofs
 * and openings are the real thing). Rooms are furnished with the same layouts as the ready-made rooms, stretched to fit.
 */
export type SampleGroup = 'flat' | 'house' | 'villa' | 'commercial';

export interface SampleInfo {
  id: string;
  name: string;
  group: SampleGroup;
  blurb: string;
  build: () => Scene;
}

type Side = 'N' | 'E' | 'S' | 'W';
const SIDE_INDEX: Record<Side, number> = { N: 0, E: 1, S: 2, W: 3 };

interface Room {
  /** A ready-made room whose furniture fills it. */
  preset?: string;
  /** Width along the row (m). */
  w: number;
  name?: string;
  type?: RoomType;
  floor?: string;
  /** Extra furniture: [asset, x, z, facing] with x / z in plan metres and facing N / E / S / W (the way the front looks). */
  items?: Array<[string, number, number, Side?]>;
  /** A room without its own furniture preset that still gets a ceiling light. */
  light?: boolean;
}

interface Row {
  depth: number;
  rooms: Room[];
}

const FACE: Record<Side, number> = { S: 0, E: Math.PI / 2, N: Math.PI, W: -Math.PI / 2 };
const inPoly = (p: Vec2, poly: readonly Vec2[]): boolean => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]!;
    const [xj, zj] = poly[j]!;
    if (zi > p[1] !== zj > p[1] && p[0] < ((xj - xi) * (p[1] - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
};

class Home {
  e: Editor;
  constructor(name: string) {
    this.e = createEditor(createEmptyScene({ name }));
  }
  get scene(): Scene {
    return this.e.getState().scene;
  }
  level(i = 0): string {
    while (this.scene.levelOrder.length <= i) this.e.execute(addLevel());
    return this.scene.levelOrder[i]!;
  }
  shell(level: string, x0: number, z0: number, x1: number, z1: number): void {
    const w = (from: Vec2, to: Vec2) => addWall({ levelId: level, from, to, kind: 'exterior' });
    this.e.execute(batch('Outer walls', [w([x0, z0], [x1, z0]), w([x1, z0], [x1, z1]), w([x1, z1], [x0, z1]), w([x0, z1], [x0, z0])]));
  }
  wall(level: string, a: Vec2, b: Vec2): void {
    this.e.execute(addWall({ levelId: level, from: a, to: b }));
  }
  /** A door / window / arch on the wall nearest `at`. `inside` is a point on the side a door should open toward. */
  put(level: string, type: 'door' | 'window' | 'arch', at: Vec2, opts: { inside?: Vec2; width?: number; exteriorOnly?: boolean; sill?: number } = {}): void {
    const sc = this.scene;
    const hit = nearestWallPoint(sc, level, at, 0.3);
    if (!hit) return;
    if (opts.exteriorOnly && sc.walls[hit.wallId]?.kind !== 'exterior') return;
    const side = opts.inside ? (nearestWallPoint(sc, level, opts.inside, 6)?.side ?? hit.side) : hit.side;
    this.e.execute(addOpening({ wallId: hit.wallId, type, offset: hit.offset, swing: side < 0, width: opts.width, sill: opts.sill }));
  }
  item(level: string, asset: string, x: number, z: number, face: Side = 'S', y = 0): void {
    this.e.execute(addItem({ levelId: level, assetId: asset, position: [x, y, z], rotationY: FACE[face] }));
  }
  light(level: string, x: number, z: number, asset = 'ceiling-light'): void {
    this.item(level, asset, x, z, 'S', this.scene.levels[level]!.height);
  }
  /** Name the room that contains `pt`, and optionally its floor. */
  name(level: string, pt: Vec2, name: string, type: RoomType, floor?: string): void {
    const walls = Object.values(this.scene.walls).filter((w) => w.levelId === level);
    const hit = detectRooms(this.scene.nodes, walls).find((r) => inPoly(pt, r.polygon));
    if (!hit) return;
    const room = Object.values(this.scene.rooms).find((r) => r.wallLoop.length === hit.wallLoop.length && hit.wallLoop.every((id) => r.wallLoop.includes(id)));
    if (room) this.e.execute(setRoomProps(room.id, { name, type, ...(floor ? { floorMaterial: { id: floor } } : {}) }));
  }

  /**
   * Furnish a rectangular room (centre-line corners) from a ready-made room: its furniture, ceiling light, name and floor,
   * and its door and windows. `quarters` turns the room so that its door (south in the preset) faces the passage:
   * 0 = door on the south wall, 2 = on the north wall, 1 = west, 3 = east. Windows go only on outside walls.
   */
  furnish(level: string, rect: [number, number, number, number], presetId: string, quarters: number, extra: { door?: boolean; name?: string } = {}): void {
    const preset = getRoomPreset(presetId);
    if (!preset) return;
    const [x0, z0, x1, z1] = rect;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const W = x1 - x0;
    const D = z1 - z0;
    const odd = quarters % 2 === 1;
    const wl = odd ? D : W; // the room as the preset sees it, before turning
    const dl = odd ? W : D;
    const at = (p: Vec2): Vec2 => {
      const t = turnOffset(p, quarters);
      return [Math.round((cx + t[0]) * 1000) / 1000, Math.round((cz + t[1]) * 1000) / 1000];
    };
    const sized = { ...preset, w: wl, d: dl };
    for (const it of layoutItems(sized)) {
      const p = at(it.pos);
      this.e.execute(addItem({ levelId: level, assetId: it.asset, position: [p[0], 0, p[1]], rotationY: it.rot + (quarters * Math.PI) / 2 }));
    }
    const h = this.scene.levels[level]!.height;
    if (preset.ceilingLight) this.e.execute(addItem({ levelId: level, assetId: 'ceiling-light', position: [cx, h, cz] }));
    // Openings: the preset's own positions, turned with the room.
    for (const o of preset.openings) {
      if (o.type === 'door' && extra.door === false) continue;
      const local: Vec2 = o.side === 'N' ? [-wl / 2 + o.at, -dl / 2] : o.side === 'E' ? [wl / 2, -dl / 2 + o.at] : o.side === 'S' ? [wl / 2 - o.at, dl / 2] : [-wl / 2, dl / 2 - o.at];
      const p = at(local);
      const turned = ((SIDE_INDEX[o.side] + quarters) % 4 + 4) % 4;
      void turned;
      this.put(level, o.type, p, { inside: [cx, cz], width: o.width, exteriorOnly: o.type === 'window' });
    }
    this.name(level, [cx, cz], extra.name ?? preset.name, preset.roomType, preset.floor);
  }

  /**
   * A passage with a row of rooms on each side. Rooms north of the passage face south (their doors open onto it), rooms
   * south of it face north. Returns the rectangles of the rooms (by name) for the caller's extras.
   */
  doubleLoaded(level: string, plan: { north: Row; corridor: number; south: Row; entrance?: boolean }): { W: number; D: number; rects: Array<{ room: Room; rect: [number, number, number, number]; north: boolean }>; passageZ: [number, number] } {
    const { north, south, corridor: C } = plan;
    const W = north.rooms.reduce((n, r) => n + r.w, 0);
    const W2 = south.rooms.reduce((n, r) => n + r.w, 0);
    if (Math.abs(W - W2) > 1e-6) throw new Error(`Sample rows differ in width: ${W} vs ${W2}`);
    const D = north.depth + C + south.depth;
    this.shell(level, 0, 0, W, D);
    const zn = north.depth;
    const zs = north.depth + C;
    // Walls: the passage (two long walls) and the partitions inside each row.
    this.wall(level, [0, zn], [W, zn]);
    this.wall(level, [0, zs], [W, zs]);
    const rects: Array<{ room: Room; rect: [number, number, number, number]; north: boolean }> = [];
    const place = (row: Row, z0: number, z1: number, isNorth: boolean) => {
      let x = 0;
      row.rooms.forEach((r, i) => {
        if (i > 0) this.wall(level, [x, z0], [x, z1]);
        rects.push({ room: r, rect: [x, z0, x + r.w, z1], north: isNorth });
        x += r.w;
      });
    };
    place(north, 0, zn, true);
    place(south, zs, D, false);
    // Furnish and open the rooms.
    for (const { room, rect, north: isNorth } of rects) {
      const [rx0, rz0, rx1, rz1] = rect;
      const cx = (rx0 + rx1) / 2;
      const cz = (rz0 + rz1) / 2;
      if (room.preset) this.furnish(level, rect, room.preset, isNorth ? 0 : 2, { name: room.name });
      else {
        // A room without a preset: a door from the passage near its first corner, and an optional name.
        if (room.light !== false) this.light(level, cx, cz);
        const doorX = rx0 + Math.min(0.9, room.w / 2);
        this.put(level, 'door', [doorX, isNorth ? zn : zs], { inside: [doorX, cz] });
        if (room.name) this.name(level, [cx, cz], room.name, room.type ?? 'other', room.floor);
        // A window in the outer wall of the room.
        this.put(level, 'window', [cx, isNorth ? 0 : D], { exteriorOnly: true, width: 1.4 });
      }
      for (const [asset, x, z, face] of room.items ?? []) this.item(level, asset, x, z, face ?? 'S');
    }
    // The passage: name it, light it, and the front door at its west end.
    this.name(level, [W / 2, zn + C / 2], 'Passage', 'hall');
    for (let x = 2.4; x < W - 1; x += 3.6) this.light(level, x, zn + C / 2);
    if (plan.entrance) this.put(level, 'door', [0, zn + C / 2], { inside: [0.6, zn + C / 2], width: 1.0 });
    return { W, D, rects, passageZ: [zn, zs] };
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Flats
// ---------------------------------------------------------------------------------------------------------------------

function flat1(): Scene {
  const h = new Home('1 BHK flat');
  const L = h.level(0);
  const r = h.doubleLoaded(L, {
    north: { depth: 4.4, rooms: [{ preset: 'living', w: 5.4 }, { preset: 'kitchen', w: 4.0 }] },
    corridor: 1.4,
    south: { depth: 3.6, rooms: [{ preset: 'bedroom', w: 3.8 }, { preset: 'bathroom', w: 2.5 }, { w: 3.1, name: 'Utility', type: 'utility', items: [['washer-top', 7.0, 8.4, 'N'], ['inverter', 8.1, 8.4, 'N']] }] },
    entrance: true,
  });
  h.e.execute(addBalcony({ levelId: L, outline: [[0.8, -1.5], [4.6, -1.5], [4.6, 0], [0.8, 0]], railing: 'glass' }));
  void r;
  return h.scene;
}

function flat2(): Scene {
  const h = new Home('2 BHK flat');
  const L = h.level(0);
  h.doubleLoaded(L, {
    north: { depth: 4.4, rooms: [{ preset: 'living', w: 5.4 }, { preset: 'kitchen', w: 5.6 }] },
    corridor: 1.4,
    south: { depth: 4.2, rooms: [{ preset: 'master', w: 4.8 }, { preset: 'bedroom', w: 3.7 }, { preset: 'bathroom', w: 2.5 }] },
    entrance: true,
  });
  h.e.execute(addBalcony({ levelId: L, outline: [[0.8, -1.5], [4.6, -1.5], [4.6, 0], [0.8, 0]], railing: 'glass' }));
  return h.scene;
}

function flat3(): Scene {
  const h = new Home('3 BHK flat');
  const L = h.level(0);
  h.doubleLoaded(L, {
    north: { depth: 4.4, rooms: [{ preset: 'living', w: 5.4 }, { preset: 'dining', w: 4.5 }, { preset: 'kitchen', w: 4.6 }] },
    corridor: 1.4,
    south: { depth: 4.2, rooms: [{ preset: 'master', w: 4.8 }, { preset: 'bedroom', w: 3.8 }, { preset: 'kids', w: 3.4 }, { preset: 'bathroom', w: 2.5 }] },
    entrance: true,
  });
  h.e.execute(addBalcony({ levelId: L, outline: [[1, -1.5], [4.8, -1.5], [4.8, 0], [1, 0]], railing: 'glass' }));
  h.e.execute(addBalcony({ levelId: L, outline: [[10.2, -1.5], [13.8, -1.5], [13.8, 0], [10.2, 0]], railing: 'glass' }));
  return h.scene;
}

// ---------------------------------------------------------------------------------------------------------------------
// Houses
// ---------------------------------------------------------------------------------------------------------------------

/** Stairs in the first room of the north row: a U stair entered from the passage, with the same room on every floor. */
const STAIR_ORIGIN: Vec2 = [1.85, 3.9];

function stairRoom(): Room {
  return { w: 2.6, name: 'Staircase', type: 'hall', light: true };
}

/**
 * Garden, boundary and a path for a house standing at (0,0)–(W,D) with its front door on the west end: a plot with a
 * compound wall, a lawn along the north, a paved path from the front door to a gate in the south wall.
 */
function garden(h: Home, W: number, D: number, opts: { l: number; r: number; t: number; b: number; trees: Array<[string, number, number]>; extra?: (h: Home, L: string) => void }): void {
  const L = h.level(0);
  const { l, r, t, b } = opts;
  h.e.execute(setPlot([[-l, -t], [W + r, -t], [W + r, D + b], [-l, D + b]]));
  h.e.execute(setGround({ id: 'ground-grass' }));
  h.e.execute(setBoundary('wall'));
  h.e.execute(addZone({ shape: 'area', points: [[-l + 0.4, -t + 0.4], [W + r - 0.4, -t + 0.4], [W + r - 0.4, -0.6], [-l + 0.4, -0.6]], material: { id: 'ground-lawn-light' } }));
  const px = -Math.min(2.5, l / 2);
  h.e.execute(addZone({ shape: 'path', points: [[-0.8, D / 2], [px, D / 2], [px, D + b - 0.2]], width: 1.4, material: { id: 'ground-paving' } }));
  h.item(L, 'garden-gate', px, D + b, 'S');
  h.item(L, 'mailbox', px + 1.3, D + b - 0.4, 'S');
  for (const [asset, x, z] of opts.trees) h.item(L, asset, x, z, 'S');
  opts.extra?.(h, L);
}

function house3(): Scene {
  const h = new Home('4 BHK house with garden');
  const L0 = h.level(0);
  const L1 = h.level(1);
  const ground = h.doubleLoaded(L0, {
    north: { depth: 4.4, rooms: [stairRoom(), { preset: 'living', w: 5.4 }, { preset: 'kitchen', w: 4.5 }] },
    corridor: 1.4,
    south: { depth: 3.8, rooms: [{ preset: 'dining', w: 4.2 }, { preset: 'bedroom', w: 3.8 }, { preset: 'bathroom', w: 2.5 }, { preset: 'pooja', w: 2.0 }] },
    entrance: true,
  });
  h.doubleLoaded(L1, {
    north: { depth: 4.4, rooms: [stairRoom(), { preset: 'master', w: 4.8 }, { preset: 'bedroom', w: 5.1 }] },
    corridor: 1.4,
    south: { depth: 3.8, rooms: [{ preset: 'kids', w: 3.4 }, { preset: 'study', w: 3.2 }, { preset: 'bathroom', w: 2.5 }, { preset: 'bathroom', w: 3.4, name: 'Bath 2' }] },
  });
  // The staircase: ground door onto the passage, a different door on the floor above where the flight arrives.
  h.e.execute(addStairAssembly({ fromLevel: L0, origin: STAIR_ORIGIN, kind: 'U', hall: false }));
  h.put(L1, 'door', [0.75, 4.4], { inside: [0.75, 3.6] });
  const { W, D } = ground;
  garden(h, W, D, {
    l: 4.5, r: 6, t: 4.5, b: 4.5,
    trees: [['tree-mango', -2.8, -2.4], ['tree-neem', W + 4.0, -2.6], ['bush', 3, -1.1], ['bush', 5.5, -1.1], ['hibiscus', 9.4, -1.1], ['rose-bed', 7.4, -1.1], ['bush-flower', W + 1.3, D + 1.3], ['tree-fruit', W + 4.4, D + 1.2]],
    extra: (hh, L) => {
      hh.item(L, 'carport', W + 3.1, 5.2, 'S');
      hh.item(L, 'car', W + 3.1, 5.2, 'S');
      hh.item(L, 'garden-bench', 4.0, -2.4, 'S');
      hh.item(L, 'flower-bed', 8.0, -2.6, 'S');
    },
  });
  return h.scene;
}

function house2(): Scene {
  const h = new Home('2 BHK house with garden');
  const L = h.level(0);
  const { W, D } = h.doubleLoaded(L, {
    north: { depth: 4.4, rooms: [{ preset: 'living', w: 5.4 }, { preset: 'kitchen', w: 5.6 }] },
    corridor: 1.4,
    south: { depth: 4.2, rooms: [{ preset: 'master', w: 4.8 }, { preset: 'bedroom', w: 3.7 }, { preset: 'bathroom', w: 2.5 }] },
    entrance: true,
  });
  garden(h, W, D, {
    l: 4, r: 6, t: 4, b: 4,
    trees: [['tree-mango', -2.4, -2.2], ['tree-neem', W + 4.2, -2.2], ['bush', 2.6, -1.2], ['bush', 4.4, -1.2], ['bush-flower', 8.4, -1.2], ['hibiscus', 10.2, -1.2], ['tree-fruit', W + 4.2, D + 1.6]],
    extra: (hh, L2) => {
      hh.item(L2, 'swing-set', W + 3.0, 1.8, 'W');
      hh.item(L2, 'garden-bench', 5.0, -2.5, 'S');
      hh.item(L2, 'car', W + 3.0, D - 2.2, 'S');
    },
  });
  return h.scene;
}

// ---------------------------------------------------------------------------------------------------------------------
// Villa and duplex
// ---------------------------------------------------------------------------------------------------------------------

function villa(): Scene {
  const h = new Home('Villa with garden and pool');
  const L0 = h.level(0);
  const L1 = h.level(1);
  const ground = h.doubleLoaded(L0, {
    north: { depth: 4.4, rooms: [stairRoom(), { preset: 'living', w: 5.4 }, { preset: 'dining', w: 4.2 }, { preset: 'kitchen', w: 4.6 }] },
    corridor: 1.4,
    south: { depth: 4.2, rooms: [{ preset: 'master', w: 4.8 }, { preset: 'bedroom', w: 3.8 }, { preset: 'bathroom', w: 2.6 }, { preset: 'study', w: 3.2 }, { preset: 'utility', w: 2.4 }] },
    entrance: true,
  });
  h.doubleLoaded(L1, {
    north: { depth: 4.4, rooms: [stairRoom(), { preset: 'master', w: 4.8 }, { preset: 'kids', w: 3.4 }, { preset: 'bedroom', w: 6.0 }] },
    corridor: 1.4,
    south: { depth: 4.2, rooms: [{ preset: 'bedroom', w: 3.8 }, { preset: 'bathroom', w: 2.6 }, { preset: 'kids', w: 3.4 }, { preset: 'study', w: 3.2 }, { preset: 'bathroom', w: 3.8, name: 'Bath 2' }] },
  });
  h.e.execute(addStairAssembly({ fromLevel: L0, origin: STAIR_ORIGIN, kind: 'U', hall: false }));
  h.put(L1, 'door', [0.75, 4.4], { inside: [0.75, 3.6] });
  h.e.execute(addBalcony({ levelId: L1, outline: [[6.0, -1.6], [11.0, -1.6], [11.0, 0], [6.0, 0]], railing: 'glass' }));
  const { W, D } = ground;
  garden(h, W, D, {
    l: 5, r: 5, t: 4, b: 11,
    trees: [['tree-gulmohar', -2.5, -1.6], ['tree-banyan', W + 2.4, -1.4], ['tree-palm', -3.4, D + 4.5], ['tree-palm', W + 3.2, D + 9.0], ['bush', 3.0, -1.2], ['hedge', 6.8, -1.2], ['hedge', 9.2, -1.2], ['rose-bed', 12.8, -1.2], ['topiary-ball', 1.0, D + 1.7], ['topiary-ball', 3.0, D + 1.7]],
    extra: (hh, L) => {
      hh.item(L, 'pool', 8.4, D + 6.0, 'S');
      hh.item(L, 'sun-lounger', 11.9, D + 5.2, 'S');
      hh.item(L, 'sun-lounger', 12.9, D + 5.2, 'S');
      hh.item(L, 'patio-umbrella', 14.2, D + 6.8, 'S');
      hh.item(L, 'patio-table', 14.2, D + 6.8, 'S');
      hh.item(L, 'fountain', 3.0, D + 4.0, 'S');
      hh.item(L, 'gazebo', W + 2.6, D + 4.5, 'S');
      hh.item(L, 'carport', W + 2.6, 7.4, 'S');
      hh.item(L, 'car', W + 2.6, 7.4, 'S');
      hh.item(L, 'lamp-post', -1.5, 7.8, 'S');
      hh.item(L, 'lamp-post', -1.5, D + 1.2, 'S');
    },
  });
  return h.scene;
}

function duplex(): Scene {
  const h = new Home('Duplex apartment');
  const L0 = h.level(0);
  const L1 = h.level(1);
  h.doubleLoaded(L0, {
    north: { depth: 4.4, rooms: [stairRoom(), { preset: 'living', w: 5.6 }] },
    corridor: 1.4,
    south: { depth: 3.8, rooms: [{ preset: 'kitchen', w: 4.0 }, { preset: 'dining', w: 4.2 }] },
    entrance: true,
  });
  h.doubleLoaded(L1, {
    north: { depth: 4.4, rooms: [stairRoom(), { preset: 'master', w: 5.6 }] },
    corridor: 1.4,
    south: { depth: 3.8, rooms: [{ preset: 'bedroom', w: 3.7 }, { preset: 'bathroom', w: 2.5 }, { preset: 'pooja', w: 2.0, name: 'Study nook' }] },
  });
  h.e.execute(addStairAssembly({ fromLevel: L0, origin: STAIR_ORIGIN, kind: 'U', hall: false }));
  h.put(L1, 'door', [0.75, 4.4], { inside: [0.75, 3.6] });
  h.e.execute(addBalcony({ levelId: L0, outline: [[3.8, -1.5], [7.6, -1.5], [7.6, 0], [3.8, 0]], railing: 'glass' }));
  return h.scene;
}

// ---------------------------------------------------------------------------------------------------------------------
// Shop and office
// ---------------------------------------------------------------------------------------------------------------------

function shop(): Scene {
  const h = new Home('Shop');
  const L = h.level(0);
  h.shell(L, 0, 0, 6, 9);
  h.wall(L, [0, 6.4], [6, 6.4]); // the back rooms
  h.wall(L, [3.6, 6.4], [3.6, 9]); // store | toilet
  // Front (north): a glass door and two display windows.
  h.put(L, 'door', [3, 0], { inside: [3, 1], width: 1.4 });
  h.put(L, 'window', [1.3, 0], { width: 1.5, sill: 0.3 });
  h.put(L, 'window', [4.7, 0], { width: 1.5, sill: 0.3 });
  h.put(L, 'door', [1.6, 6.4], { inside: [1.6, 5.6] }); // to the store room
  h.put(L, 'door', [4.8, 6.4], { inside: [4.8, 5.6], width: 0.8 }); // to the toilet
  h.put(L, 'window', [0, 7.7], { exteriorOnly: true, width: 1.0 });
  h.name(L, [3, 3.2], 'Shop floor', 'other', 'floor-tile-cream');
  h.name(L, [1.8, 7.7], 'Store room', 'utility', 'floor-concrete');
  h.name(L, [4.8, 7.7], 'Toilet', 'bathroom', 'floor-tile-white');
  // Shelves along both side walls, display tables in the middle, the counter at the back.
  for (const z of [1.6, 2.9, 4.2, 5.5]) {
    h.item(L, 'display-cabinet', 0.4, z, 'E');
    h.item(L, 'bookshelf', 5.55, z, 'W');
  }
  h.item(L, 'console-table', 3, 2.6, 'S');
  h.item(L, 'console-table', 3, 3.9, 'S');
  h.item(L, 'reception-desk', 3.8, 5.3, 'N');
  h.item(L, 'office-chair', 3.8, 5.95, 'N');
  h.item(L, 'bar-stool', 2.4, 5.4, 'N');
  h.item(L, 'plant-tall', 5.4, 0.7, 'S');
  for (const x of [1.5, 3, 4.5]) for (const z of [1.5, 4.2]) h.light(L, x, z);
  // Store room and toilet.
  h.item(L, 'lockers', 0.5, 7.6, 'E');
  h.item(L, 'bookcase-low', 2.0, 8.6, 'N');
  h.item(L, 'filing-cabinet', 3.3, 8.6, 'N');
  h.item(L, 'toilet', 4.8, 8.4, 'N');
  h.item(L, 'washbasin', 5.5, 7.1, 'W');
  h.light(L, 1.8, 7.7);
  h.light(L, 4.8, 7.7);
  return h.scene;
}

function office(): Scene {
  const h = new Home('Office');
  const L = h.level(0);
  h.shell(L, 0, 0, 14, 9);
  // Cabins and the meeting room along the north wall.
  h.wall(L, [0, 3.6], [14, 3.6]);
  h.wall(L, [4.5, 0], [4.5, 3.6]);
  h.wall(L, [9, 0], [9, 3.6]);
  // Pantry and washrooms in the south-east corner.
  h.wall(L, [10, 6.2], [14, 6.2]);
  h.wall(L, [10, 6.2], [10, 9]);
  h.wall(L, [12.4, 6.2], [12.4, 9]);
  h.put(L, 'door', [2.2, 3.6], { inside: [2.2, 2.8] });
  h.put(L, 'door', [6.8, 3.6], { inside: [6.8, 2.8] });
  h.put(L, 'door', [11.6, 3.6], { inside: [11.6, 2.8], width: 1.0 });
  h.put(L, 'door', [11.0, 6.2], { inside: [11.0, 7.2], width: 0.9 });
  h.put(L, 'door', [13.2, 6.2], { inside: [13.2, 7.2], width: 0.8 });
  h.put(L, 'door', [1.8, 9], { inside: [1.8, 8.2], width: 1.6 }); // main entrance (south)
  for (const x of [2.2, 6.8, 11.5]) h.put(L, 'window', [x, 0], { width: 1.6 });
  h.put(L, 'window', [14, 4.8], { width: 1.6 });
  h.put(L, 'window', [5.5, 9], { width: 2.0 });
  h.put(L, 'window', [8.5, 9], { width: 2.0 });
  h.name(L, [2.2, 1.8], 'Manager cabin', 'study', 'floor-wood-walnut');
  h.name(L, [6.8, 1.8], 'Cabin', 'study', 'floor-wood-walnut');
  h.name(L, [11.5, 1.8], 'Meeting room', 'other', 'floor-carpet-grey');
  h.name(L, [7, 6], 'Open office', 'other', 'floor-carpet-grey');
  h.name(L, [13.2, 7.6], 'Washroom', 'bathroom', 'floor-tile-white');
  h.name(L, [11.2, 7.6], 'Pantry', 'kitchen', 'floor-tile-grey');
  // Cabins.
  h.item(L, 'desk-l', 1.5, 0.95, 'S');
  h.item(L, 'office-chair', 1.5, 1.85, 'N');
  h.item(L, 'bookcase-low', 3.6, 0.35, 'S');
  h.item(L, 'filing-cabinet', 4.1, 3.0, 'N');
  h.item(L, 'office-sofa', 3.0, 3.1, 'N');
  h.item(L, 'desk', 6.8, 0.8, 'S');
  h.item(L, 'office-chair', 6.8, 1.6, 'N');
  h.item(L, 'bookcase-low', 5.2, 0.35, 'S');
  h.item(L, 'whiteboard', 8.9, 1.8, 'W', 1.2);
  // Meeting room.
  h.item(L, 'meeting-table', 11.5, 1.8, 'S');
  for (const x of [10.7, 11.5, 12.3]) {
    h.item(L, 'conference-chair', x, 0.85, 'S');
    h.item(L, 'conference-chair', x, 2.75, 'N');
  }
  // Open office: two rows of desks.
  for (const x of [1.8, 4.2, 6.6, 9.0]) {
    h.item(L, 'desk', x, 4.7, 'S');
    h.item(L, 'office-chair', x, 5.5, 'N');
    h.item(L, 'desk', x, 6.9, 'S');
    h.item(L, 'office-chair', x, 7.7, 'N');
  }
  h.item(L, 'reception-desk', 3.9, 8.4, 'N');
  h.item(L, 'office-sofa', 7.4, 8.5, 'N');
  h.item(L, 'plant-tall', 0.6, 8.3, 'S');
  h.item(L, 'plant-tall', 9.7, 8.3, 'S');
  // Pantry and washroom.
  h.item(L, 'kitchen-sink', 11.5, 8.65, 'N');
  h.item(L, 'fridge', 10.5, 6.75, 'S');
  h.item(L, 'water-dispenser', 12.0, 6.55, 'S');
  h.item(L, 'toilet', 13.1, 8.5, 'N');
  h.item(L, 'washbasin', 13.65, 7.4, 'W');
  for (const [x, z] of [[2.2, 1.8], [6.8, 1.8], [11.5, 1.8], [2.5, 5.2], [6.0, 5.2], [9.5, 5.2], [2.5, 7.4], [6.0, 7.4], [9.5, 7.4], [11.2, 7.6], [13.2, 7.6]] as Array<[number, number]>) h.light(L, x, z, 'led-panel');
  return h.scene;
}

export const SAMPLES: readonly SampleInfo[] = [
  { id: 'flat1', name: '1 BHK flat', group: 'flat', blurb: 'Living room, kitchen, bedroom, bathroom and a balcony.', build: flat1 },
  { id: 'flat2', name: '2 BHK flat', group: 'flat', blurb: 'Master bedroom, second bedroom, living room, kitchen and a balcony.', build: flat2 },
  { id: 'flat3', name: '3 BHK flat', group: 'flat', blurb: 'Three bedrooms, living and dining rooms, kitchen and two balconies.', build: flat3 },
  { id: 'duplex', name: 'Duplex apartment', group: 'flat', blurb: 'Two floors joined by a staircase: living and dining below, bedrooms above.', build: duplex },
  { id: 'house2', name: '2 BHK house with garden', group: 'house', blurb: 'One floor, a garden with a lawn, trees, a path and a compound wall.', build: house2 },
  { id: 'house3', name: '4 BHK house, two floors', group: 'house', blurb: 'Living, kitchen, dining and a bedroom below; three bedrooms and a study upstairs; car porch and garden.', build: house3 },
  { id: 'villa', name: 'Villa with garden and pool', group: 'villa', blurb: 'A large two-floor villa with a swimming pool, gazebo, lawn, trees and a carport.', build: villa },
  { id: 'shop', name: 'Shop', group: 'commercial', blurb: 'A shop floor with shelves and a counter, a store room and a toilet.', build: shop },
  { id: 'office', name: 'Office', group: 'commercial', blurb: 'Two cabins, a meeting room, an open office, reception, a pantry and washrooms.', build: office },
];

export const SAMPLE_GROUPS: Array<{ id: SampleGroup | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'flat', label: 'Flats' },
  { id: 'house', label: 'Houses' },
  { id: 'villa', label: 'Villas' },
  { id: 'commercial', label: 'Shops & offices' },
];

export const getSample = (id: string): SampleInfo | undefined => SAMPLES.find((s) => s.id === id);
