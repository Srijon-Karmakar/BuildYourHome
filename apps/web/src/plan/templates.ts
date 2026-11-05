import { createEmptyScene, type RoomType, type Scene, type Vec2 } from '@hd/scene-schema';
import { addOpening, addWall, batch, createEditor, nearestWallPoint, setRoomProps, setWallsProps, type Editor } from '@hd/editor-core';
import { detectRooms } from '@hd/geometry';
import { buildDemoScene } from './demo';

/**
 * Starting points for the welcome screen, built with the real editor commands (so they get proper junctions,
 * rooms and openings, and stay valid when the rules change).
 */
export type TemplateId = 'blank' | 'room' | 'studio' | 'home' | 'sample';

export const QUICK_ROOM_MIN_M = 1.5;
export const QUICK_ROOM_MAX_M = 30;

function levelOf(e: Editor): string {
  return e.getState().activeLevelId;
}

function outerWalls(e: Editor, w: number, d: number): void {
  const levelId = levelOf(e);
  const wall = (from: Vec2, to: Vec2) => addWall({ levelId, from, to, kind: 'exterior' });
  e.execute(batch('Outer walls', [wall([0, 0], [w, 0]), wall([w, 0], [w, d]), wall([w, d], [0, d]), wall([0, d], [0, 0])]));
}

function inner(e: Editor, from: Vec2, to: Vec2): void {
  e.execute(addWall({ levelId: levelOf(e), from, to }));
}

/** Add a door/window/arch on the wall nearest `at`; `inside` is a point on the side a door should open toward. */
function put(e: Editor, type: 'door' | 'window' | 'arch', at: Vec2, inside?: Vec2, width?: number): void {
  const scene = e.getState().scene;
  const hit = nearestWallPoint(scene, levelOf(e), at, 0.6);
  if (!hit) return;
  const side = inside ? (nearestWallPoint(scene, levelOf(e), inside, 5)?.side ?? hit.side) : hit.side;
  e.execute(addOpening({ wallId: hit.wallId, type, offset: hit.offset, swing: side < 0, width }));
}

function inPoly(p: Vec2, poly: readonly Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]!;
    const [xj, zj] = poly[j]!;
    if (zi > p[1] !== zj > p[1] && p[0] < ((xj - xi) * (p[1] - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** Name the room that contains each target point. */
function nameRooms(e: Editor, targets: Array<[Vec2, string, RoomType]>): void {
  const s = e.getState().scene;
  const walls = Object.values(s.walls).filter((w) => w.levelId === levelOf(e));
  const detected = detectRooms(s.nodes, walls);
  for (const [pt, name, type] of targets) {
    const hit = detected.find((r) => inPoly(pt, r.polygon));
    const room = hit && Object.values(e.getState().scene.rooms).find((r) => r.wallLoop.length === hit.wallLoop.length && hit.wallLoop.every((id) => r.wallLoop.includes(id)));
    if (room) e.execute(setRoomProps(room.id, { name, type }));
  }
}

const clamp = (v: number) => Math.min(QUICK_ROOM_MAX_M, Math.max(QUICK_ROOM_MIN_M, v));

/** One rectangular room with a door on the south wall and windows on the north (and east when wide). */
export function buildQuickRoom(width: number, depth: number): Scene {
  const w = Math.round(clamp(width) * 20) / 20;
  const d = Math.round(clamp(depth) * 20) / 20;
  const e = createEditor(createEmptyScene({ name: 'My room' }));
  outerWalls(e, w, d);
  nameRooms(e, [[[w / 2, d / 2], 'Room', 'other']]);
  put(e, 'door', [Math.min(w - 1, 1.2 + 0.0), d], [1.2, d - 0.5]);
  put(e, 'window', [w / 2, 0]);
  if (w >= 4) put(e, 'window', [w, d / 2]);
  if (d >= 4) put(e, 'window', [0, d / 2]);
  return e.getState().scene;
}

/** 6 × 5 m studio: living area plus a bathroom in the corner. */
export function buildStudio(): Scene {
  const e = createEditor(createEmptyScene({ name: 'Studio' }));
  outerWalls(e, 6, 5);
  inner(e, [4, 0], [4, 2.5]);
  inner(e, [4, 2.5], [6, 2.5]);
  nameRooms(e, [[[2, 2.5], 'Living', 'living'], [[5, 1.2], 'Bath', 'bathroom']]);
  put(e, 'door', [2, 5], [2, 4.5]);
  put(e, 'window', [2, 0]);
  put(e, 'window', [0, 2.5]);
  put(e, 'window', [6, 3.8]);
  put(e, 'door', [5, 2.5], [5, 1.5]); // bathroom door opens into the bathroom
  return e.getState().scene;
}

/** 12 × 7 m family home: living, kitchen, two bedrooms and a bathroom. */
export function buildFamilyHome(): Scene {
  const e = createEditor(createEmptyScene({ name: 'Family home' }));
  outerWalls(e, 12, 7);
  inner(e, [6, 0], [6, 7]);
  inner(e, [0, 4.5], [6, 4.5]);
  inner(e, [6, 3.5], [12, 3.5]);
  inner(e, [9, 3.5], [9, 7]);
  nameRooms(e, [
    [[3, 2.2], 'Living', 'living'],
    [[3, 5.8], 'Kitchen', 'kitchen'],
    [[9, 1.7], 'Bedroom', 'bedroom'],
    [[7.5, 5.2], 'Bedroom 2', 'bedroom'],
    [[10.5, 5.2], 'Bath', 'bathroom'],
  ]);
  const outer = Object.values(e.getState().scene.walls).filter((w) => w.kind === 'exterior').map((w) => w.id);
  e.execute(setWallsProps(outer, { materialB: { id: 'wall-brick-red' } }));
  put(e, 'door', [3, 7], [3, 6]); // front door → kitchen side
  put(e, 'arch', [3, 4.5], undefined, 1.6); // living ↔ kitchen
  put(e, 'door', [6, 2.2], [5, 2.2]); // living → bedroom
  put(e, 'door', [6, 5.8], [5, 5.8]); // kitchen → bedroom 2
  put(e, 'door', [10.5, 3.5], [10.5, 4.5]); // bedroom → bath
  put(e, 'window', [3, 0]);
  put(e, 'window', [0, 2.2]);
  put(e, 'window', [0, 5.8]);
  put(e, 'window', [9, 0]);
  put(e, 'window', [12, 1.7]);
  put(e, 'window', [7.5, 7]);
  put(e, 'window', [10.5, 7], undefined, 0.7);
  return e.getState().scene;
}

export function buildTemplate(id: TemplateId, opts: { width?: number; depth?: number } = {}): Scene {
  switch (id) {
    case 'room':
      return buildQuickRoom(opts.width ?? 4, opts.depth ?? 3.5);
    case 'studio':
      return buildStudio();
    case 'home':
      return buildFamilyHome();
    case 'sample':
      return buildDemoScene();
    default:
      return createEmptyScene();
  }
}
