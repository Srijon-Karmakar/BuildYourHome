import { getAsset, itemFootprint } from '@hd/assets';
import { balconyRailings, zonePolygon } from '@hd/editor-core';
import { facePoint, leftNormal, stairOutlineWorld, stairToWorld, type WallFootprint } from '@hd/geometry';
import type { Id, Opening, Scene, Vec2 } from '@hd/scene-schema';
import { layoutOf } from '@hd/editor-core';
import { levelGeometry } from '../plan/wallGeom';
import { levelRooms } from '../plan/rooms';
import { formatArea, formatLength, type DisplayUnits } from '../lib/units';

/**
 * A floor plan as plain drawing primitives (metres, plan axes: x east, z south). Both the PDF and the DXF writers
 * turn the same list into their format, so the two always agree.
 */
export type LayerName = 'WALLS' | 'DOORS' | 'WINDOWS' | 'ROOMS' | 'FURNITURE' | 'STAIRS' | 'BALCONY' | 'GARDEN' | 'PLOT' | 'DIMENSIONS';

export type Prim =
  | { layer: LayerName; type: 'poly'; pts: Vec2[]; closed: boolean; fill?: boolean }
  | { layer: LayerName; type: 'text'; pos: Vec2; text: string; /** Height on paper in millimetres. */ mm: number; align?: 'left' | 'center'; bold?: boolean };

export interface Drawing {
  levelName: string;
  prims: Prim[];
  min: Vec2;
  max: Vec2;
}

const quarterArc = (hinge: Vec2, from: Vec2, to: Vec2, steps = 8): Vec2[] => {
  const a0 = Math.atan2(from[1] - hinge[1], from[0] - hinge[0]);
  const a1 = Math.atan2(to[1] - hinge[1], to[0] - hinge[0]);
  let d = a1 - a0;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  const r = Math.hypot(from[0] - hinge[0], from[1] - hinge[1]);
  return Array.from({ length: steps + 1 }, (_, i): Vec2 => [hinge[0] + Math.cos(a0 + (d * i) / steps) * r, hinge[1] + Math.sin(a0 + (d * i) / steps) * r]);
};

function openingPrims(o: Opening, fp: WallFootprint): Prim[] {
  const s0 = o.offset - o.width / 2;
  const s1 = o.offset + o.width / 2;
  const L = (s: number): Vec2 => facePoint(fp, s, 1);
  const R = (s: number): Vec2 => facePoint(fp, s, -1);
  if (o.type === 'window') {
    const mid = (s: number): Vec2 => [(L(s)[0] + R(s)[0]) / 2, (L(s)[1] + R(s)[1]) / 2];
    return [
      { layer: 'WINDOWS', type: 'poly', pts: [L(s0), L(s1), R(s1), R(s0)], closed: true },
      { layer: 'WINDOWS', type: 'poly', pts: [mid(s0), mid(s1)], closed: false },
    ];
  }
  if (o.type === 'arch') {
    return [
      { layer: 'DOORS', type: 'poly', pts: [L(s0), R(s0)], closed: false },
      { layer: 'DOORS', type: 'poly', pts: [L(s1), R(s1)], closed: false },
    ];
  }
  // Door: leaf from the hinge jamb, swung open toward the L side (or the R side when flipped), with its swing arc.
  const n = leftNormal(fp);
  const sgn = o.flip.swing ? -1 : 1;
  const out: Prim[] = [];
  const leaf = (hs: number, along: 1 | -1, len: number) => {
    const hl = L(hs);
    const hr = R(hs);
    const hinge: Vec2 = [(hl[0] + hr[0]) / 2, (hl[1] + hr[1]) / 2];
    const closed: Vec2 = [hinge[0] + fp.dir[0] * along * len, hinge[1] + fp.dir[1] * along * len];
    const open: Vec2 = [hinge[0] + n[0] * sgn * len, hinge[1] + n[1] * sgn * len];
    out.push({ layer: 'DOORS', type: 'poly', pts: [hinge, open], closed: false });
    out.push({ layer: 'DOORS', type: 'poly', pts: quarterArc(hinge, closed, open), closed: false });
  };
  if (o.style === 'double' || o.style === 'french') {
    leaf(s0, 1, o.width / 2);
    leaf(s1, -1, o.width / 2);
  } else if (o.style === 'sliding') {
    out.push({ layer: 'DOORS', type: 'poly', pts: [L(s0), L(s1), R(s1), R(s0)], closed: true });
  } else {
    if (o.flip.side) leaf(s1, -1, o.width);
    else leaf(s0, 1, o.width);
  }
  return out;
}

/** Everything on one floor as drawing primitives. */
export function buildDrawing(scene: Scene, levelId: Id): Drawing {
  const level = scene.levels[levelId]!;
  const units: DisplayUnits = scene.meta.units;
  const prims: Prim[] = [];
  const geom = levelGeometry(scene, levelId);

  if (scene.plot && levelId === scene.levelOrder[0]) prims.push({ layer: 'PLOT', type: 'poly', pts: scene.plot.boundary, closed: true });

  if (levelId === scene.levelOrder[0]) {
    for (const z of Object.values(scene.zones)) prims.push({ layer: 'GARDEN', type: 'poly', pts: zonePolygon(z), closed: true, fill: true });
  }

  for (const w of Object.values(scene.walls)) {
    if (w.levelId !== levelId) continue;
    for (const piece of geom.pieces[w.id] ?? []) prims.push({ layer: 'WALLS', type: 'poly', pts: piece, closed: true, fill: true });
  }

  for (const o of Object.values(scene.openings)) {
    const wall = scene.walls[o.wallId];
    const fp = geom.footprints[o.wallId];
    if (wall && fp && wall.levelId === levelId) prims.push(...openingPrims(o, fp));
  }

  for (const b of Object.values(scene.balconies)) {
    if (b.levelId !== levelId) continue;
    prims.push({ layer: 'BALCONY', type: 'poly', pts: b.outline, closed: true });
    for (const r of balconyRailings(scene, b.id)) prims.push({ layer: 'BALCONY', type: 'poly', pts: [r.a, r.b], closed: false });
  }

  for (const s of Object.values(scene.stairs)) {
    if (s.fromLevel !== levelId && s.toLevel !== levelId) continue;
    const layout = layoutOf(scene, s);
    if (!layout) continue;
    const origin: Vec2 = [s.origin[0], s.origin[2]];
    prims.push({ layer: 'STAIRS', type: 'poly', pts: stairOutlineWorld(layout, origin, s.rotationY), closed: true });
    for (const t of layout.treads) {
      const [x0, z0, x1, z1] = t.rect;
      const [dx, dz] = t.dir;
      const seg: [Vec2, Vec2] = t.line ? t.line : dz < 0 ? [[x0, z0], [x1, z0]] : dz > 0 ? [[x0, z1], [x1, z1]] : dx < 0 ? [[x0, z0], [x0, z1]] : [[x1, z0], [x1, z1]];
      prims.push({ layer: 'STAIRS', type: 'poly', pts: seg.map((p) => stairToWorld(origin, s.rotationY, p)), closed: false });
    }
    const first = layout.treads[0];
    const last = layout.treads[layout.treads.length - 1];
    if (first && last) {
      const c = (t: typeof first): Vec2 => stairToWorld(origin, s.rotationY, t.centre ?? [(t.rect[0] + t.rect[2]) / 2, (t.rect[1] + t.rect[3]) / 2]);
      prims.push({ layer: 'STAIRS', type: 'text', pos: c(first), text: s.fromLevel === levelId ? 'UP' : 'DN', mm: 2.2, align: 'center' });
    }
  }

  for (const it of Object.values(scene.items)) {
    if (it.levelId !== levelId) continue;
    const a = getAsset(it.assetId);
    if (a && a.mount !== 'ceiling') prims.push({ layer: 'FURNITURE', type: 'poly', pts: itemFootprint(a, [it.position[0], it.position[2]], it.rotationY, it.scale), closed: true });
  }

  for (const r of levelRooms(scene, levelId)) {
    const name = r.room?.name ?? 'Room';
    prims.push({ layer: 'ROOMS', type: 'text', pos: [r.centroid[0], r.centroid[1] - 0.12], text: name, mm: 3, align: 'center', bold: true });
    prims.push({ layer: 'ROOMS', type: 'text', pos: [r.centroid[0], r.centroid[1] + 0.18], text: formatArea(r.area, units), mm: 2.4, align: 'center' });
  }

  // Extent of everything drawn (text positions count as points).
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  const grow = (p: Vec2) => {
    minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
    minZ = Math.min(minZ, p[1]); maxZ = Math.max(maxZ, p[1]);
  };
  for (const p of prims) (p.type === 'poly' ? p.pts : [p.pos]).forEach(grow);
  if (!Number.isFinite(minX)) {
    minX = minZ = -1;
    maxX = maxZ = 1;
  }

  // Overall dimensions of the building (walls only) — what an architect expects on a plan.
  let wx0 = Infinity, wz0 = Infinity, wx1 = -Infinity, wz1 = -Infinity;
  for (const p of prims) if (p.layer === 'WALLS' && p.type === 'poly') for (const q of p.pts) {
    wx0 = Math.min(wx0, q[0]); wx1 = Math.max(wx1, q[0]); wz0 = Math.min(wz0, q[1]); wz1 = Math.max(wz1, q[1]);
  }
  if (Number.isFinite(wx0)) {
    const off = 0.5;
    prims.push({ layer: 'DIMENSIONS', type: 'poly', pts: [[wx0, wz1 + off], [wx1, wz1 + off]], closed: false });
    prims.push({ layer: 'DIMENSIONS', type: 'text', pos: [(wx0 + wx1) / 2, wz1 + off + 0.28], text: formatLength(wx1 - wx0, units), mm: 2.6, align: 'center' });
    prims.push({ layer: 'DIMENSIONS', type: 'poly', pts: [[wx1 + off, wz0], [wx1 + off, wz1]], closed: false });
    prims.push({ layer: 'DIMENSIONS', type: 'text', pos: [wx1 + off + 0.15, (wz0 + wz1) / 2], text: formatLength(wz1 - wz0, units), mm: 2.6, align: 'left' });
    grow([wx0, wz1 + off + 0.5]);
    grow([wx1 + off + 1.2, wz0]);
  }

  return { levelName: level.name, prims, min: [minX, minZ], max: [maxX, maxZ] };
}

/** Standard drawing scales (1 : n), largest first. */
export const SCALES = [20, 25, 50, 75, 100, 150, 200, 250, 500, 1000] as const;

/** The largest standard scale at which `size` metres fit in `availMm` millimetres of paper. */
export function pickScale(sizeM: Vec2, availMm: Vec2): number {
  for (const n of SCALES) if ((sizeM[0] * 1000) / n <= availMm[0] && (sizeM[1] * 1000) / n <= availMm[1]) return n;
  return SCALES[SCALES.length - 1]!;
}
