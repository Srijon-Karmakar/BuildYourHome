import { getAsset, itemFootprint, frontOf } from '@hd/assets';
import type { Opening, Scene, Vec2, Vec3 } from '@hd/scene-schema';
import type { SnapResult } from '@hd/editor-core';
import { facePoint, leftNormal, stairToWorld, type StairLayout, type WallFootprint } from '@hd/geometry';
import { formatArea, formatLength, type DisplayUnits } from '../lib/units';
import { toScreen, toWorld, type View } from './viewport';
import type { LevelGeometry } from './wallGeom';

/** Canvas colours mirror the CSS tokens in styles.css (docs/DESIGN.md §4). */
const C = {
  bg: '#e6e4e0',
  gridMinor: 'rgba(17,17,17,0.045)',
  gridMajor: 'rgba(17,17,17,0.10)',
  axis: 'rgba(17,17,17,0.24)',
  wallEdge: '#111111',
  wall: '#111111',
  wallSel: '#7a4236',
  node: '#ffffff',
  accent: '#111111',
  brick: '#7a4236',
  guide: 'rgba(17,17,17,0.4)',
  roomFill: 'rgba(201,191,160,0.38)',
  text: '#111111',
  textSoft: '#5b5852',
};
const FONT = '"Outfit Variable", system-ui, sans-serif';

export interface RoomDraw {
  selected?: boolean;
  polygon: readonly Vec2[];
  centroid: Vec2;
  area: number;
  name: string;
}

/** Ghost of the furniture item that the next click would place. */
export interface ItemGhost {
  assetId: string;
  position: Vec3;
  rotationY: number;
  scale: Vec3;
}

/** Ghost of the door/window that the next click would place. */
export interface OpeningPreview {
  type: Opening['type'];
  wallId: string;
  offset: number;
  width: number;
  /** Door swings toward the pointer side. */
  swing: boolean;
}

/** A stair as drawn on the plan of one floor. */
export interface StairDraw {
  layout: StairLayout;
  origin: Vec2;
  rotationY: number;
  selected?: boolean;
  /** `up`: starts on this floor. `down`: arrives from below (a stairwell). `ghost`: about to be placed. */
  role: 'up' | 'down' | 'ghost';
}

export interface RenderState {
  units: DisplayUnits;
  /** Pro tools: overall dimensions, room width x depth, every wall length. */
  pro: boolean;
  /** Digits typed while drawing a wall (replaces the live length readout). */
  lengthInput: string;
  itemGhost: ItemGhost | null;
  /** Walls of the floor below, drawn faintly as a tracing reference. */
  ghost: readonly Vec2[][];
  paintSide: 'both' | 'a' | 'b';
  geom: LevelGeometry;
  preview: OpeningPreview | null;
  /** First-person walker (shown as a view cone) while the walkthrough is active. */
  walker: { x: number; z: number; yaw: number } | null;
  rooms: readonly RoomDraw[];
  view: View;
  width: number;
  height: number;
  scene: Scene;
  levelId: string;
  selection: readonly string[];
  tool: 'select' | 'wall' | 'door' | 'window' | 'place' | 'plot' | 'stair';
  hover: SnapResult | null;
  drawingFrom: Vec2 | null;
  gridStep: number;
  /** Stairs that start or end on this floor, plus the ghost of the ones about to be placed. */
  stairs: readonly StairDraw[];
  /** The property outline, the outline being drawn, and house points that stick out of the plot. */
  plot: { boundary: readonly Vec2[] | null; draft: readonly Vec2[] | null; outside: readonly Vec2[] };
}

function drawGrid(ctx: CanvasRenderingContext2D, s: RenderState): void {
  const { view: v, width, height, gridStep: step } = s;
  const [x0, z0] = toWorld(v, 0, 0);
  const [x1, z1] = toWorld(v, width, height);
  const majorStep = step >= 1 ? step * 5 : 1;
  ctx.lineWidth = 1;
  const line = (a: number, vertical: boolean) => {
    ctx.beginPath();
    if (vertical) {
      const sx = Math.round(a * v.scale + v.ox) + 0.5;
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, height);
    } else {
      const sy = Math.round(a * v.scale + v.oy) + 0.5;
      ctx.moveTo(0, sy);
      ctx.lineTo(width, sy);
    }
    ctx.stroke();
  };
  const pass = (from: number, to: number, vertical: boolean) => {
    for (let i = Math.floor(from / step); i * step <= to; i++) {
      const a = i * step;
      const isAxis = Math.abs(a) < 1e-9;
      const isMajor = Math.abs(a / majorStep - Math.round(a / majorStep)) < 1e-6;
      ctx.strokeStyle = isAxis ? C.axis : isMajor ? C.gridMajor : C.gridMinor;
      line(a, vertical);
    }
  };
  pass(x0, x1, true);
  pass(z0, z1, false);
}

function halo(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = C.bg;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = C.text;
  ctx.fillText(text, x, y);
}

export function pointInPolygon(x: number, z: number, poly: readonly Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]!;
    const [xj, zj] = poly[j]!;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function drawRooms(ctx: CanvasRenderingContext2D, s: RenderState, part: 'fills' | 'labels'): void {
  const { view: v } = s;
  if (part === 'fills') for (const r of s.rooms) {
    ctx.beginPath();
    r.polygon.forEach((p, i) => {
      const [x, y] = toScreen(v, p[0], p[1]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = r.selected ? 'rgba(122,66,54,0.2)' : C.roomFill;
    ctx.fill();
    if (r.selected) {
      ctx.strokeStyle = C.wallSel;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  // Labels are drawn last of all, above furniture, so names and areas stay readable.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (part === 'labels') for (const r of s.rooms) {
    const [cx, cy] = toScreen(v, r.centroid[0], r.centroid[1]);
    // Skip when the room is too small on screen to hold text.
    if (Math.sqrt(r.area) * v.scale < 56) continue;
    ctx.font = `400 14px ${FONT}`;
    halo(ctx, r.name, cx, cy - 8);
    ctx.font = `300 12.5px ${FONT}`;
    halo(ctx, formatArea(r.area, s.units), cx, cy + 9);
    if (s.pro) {
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const p of r.polygon) {
        x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]);
        z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]);
      }
      ctx.font = `300 11.5px ${FONT}`;
      ctx.fillStyle = C.textSoft;
      halo(ctx, `${formatLength(x1 - x0, s.units)} × ${formatLength(z1 - z0, s.units)}`, cx, cy + 25);
    }
  }
}

function drawWalls(ctx: CanvasRenderingContext2D, s: RenderState): void {
  const { scene, view: v, levelId } = s;
  const sel = new Set(s.selection);
  const walls = Object.values(scene.walls).filter((w) => w.levelId === levelId);

  // Solid wall pieces (mitered corners, gaps at doors/windows). A hairline stroke in the same colour hides
  // anti-aliasing seams between touching pieces and keeps very thin walls visible when zoomed out.
  for (const w of walls) {
    const color = sel.has(w.id) ? C.wallSel : C.wall;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, 3 - w.thickness * v.scale);
    ctx.lineJoin = 'miter';
    for (const piece of s.geom.pieces[w.id] ?? []) {
      ctx.beginPath();
      piece.forEach((p, i) => {
        const [x, y] = toScreen(v, p[0], p[1]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  // Length labels.
  ctx.font = `400 12px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const w of walls) {
    if (v.scale < 30 && !s.pro && !sel.has(w.id)) continue;
    const a = scene.nodes[w.a];
    const b = scene.nodes[w.b];
    if (!a || !b) continue;
    const [ax, ay] = toScreen(v, a.p[0], a.p[1]);
    const [bx, by] = toScreen(v, b.p[0], b.p[1]);
    const len = Math.hypot(b.p[0] - a.p[0], b.p[1] - a.p[1]);
    const text = formatLength(len, s.units);
    const dx = bx - ax;
    const dy = by - ay;
    const n = Math.hypot(dx, dy) || 1;
    const nx = -dy / n;
    const ny = dx / n;
    // Clear the wall by its half thickness plus half the text's extent along the normal.
    const textW = ctx.measureText(text).width;
    const off = (w.thickness * v.scale) / 2 + 7 + (Math.abs(nx) * textW) / 2 + Math.abs(ny) * 7;
    // Sit on the longest solid stretch of the wall so the label never lands on a door swing or window.
    let mx = (ax + bx) / 2;
    let my = (ay + by) / 2;
    const pieces = s.geom.pieces[w.id];
    if (pieces && pieces.length > 1) {
      let bestLen = -1;
      let centre: Vec2 = [0, 0];
      for (const pc of pieces) {
        const len = Math.hypot(pc[1]![0] - pc[0]![0], pc[1]![1] - pc[0]![1]);
        if (len > bestLen) {
          bestLen = len;
          centre = [(pc[0]![0] + pc[1]![0] + pc[2]![0] + pc[3]![0]) / 4, (pc[0]![1] + pc[1]![1] + pc[2]![1] + pc[3]![1]) / 4];
        }
      }
      // Too short to hold the text without touching an opening: skip rather than clutter.
      if (bestLen * v.scale < textW * 0.9) continue;
      [mx, my] = toScreen(v, centre[0], centre[1]);
    }
    // Prefer the side that lies inside a room (reads like a floor-plan dimension).
    const inside = (sx: number, sy: number) => {
      const [wx, wz] = toWorld(v, sx, sy);
      return s.rooms.some((r) => pointInPolygon(wx, wz, r.polygon));
    };
    const side = !inside(mx + nx * off, my + ny * off) && inside(mx - nx * off, my - ny * off) ? -1 : 1;
    halo(ctx, text, mx + side * nx * off, my + side * ny * off);
  }

  // Node handles.
  for (const n of Object.values(scene.nodes)) {
    if (n.levelId !== levelId) continue;
    const [x, y] = toScreen(v, n.p[0], n.p[1]);
    ctx.fillStyle = C.node;
    ctx.strokeStyle = C.wallEdge;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, s.tool === 'select' ? 5 : 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

/**
 * Architectural plan symbol of an opening inside its wall gap.
 * Door: leaf + swing arc. Window: glazing lines. Arch: jamb ticks.
 */
function drawOpeningSymbol(
  ctx: CanvasRenderingContext2D,
  v: View,
  fp: WallFootprint,
  o: { type: Opening['type']; offset: number; width: number; flip: Opening['flip']; style?: string },
  color: string,
  alpha = 1,
): void {
  const s0 = o.offset - o.width / 2;
  const s1 = o.offset + o.width / 2;
  const P = (s: number, side: 1 | -1): [number, number] => {
    const p = facePoint(fp, s, side);
    return toScreen(v, p[0], p[1]);
  };
  const [lx0, ly0] = P(s0, 1), [lx1, ly1] = P(s1, 1), [rx1, ry1] = P(s1, -1), [rx0, ry0] = P(s0, -1);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';

  if (o.type === 'window' || (o.type === 'door' && o.style === 'sliding')) {
    // Windows, and sliding doors, are drawn as a glazed strip (sliding ones with two offset sash lines).
    ctx.fillStyle = '#f4f3ef';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(lx0, ly0);
    ctx.lineTo(lx1, ly1);
    ctx.lineTo(rx1, ry1);
    ctx.lineTo(rx0, ry0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (o.style === 'sliding') {
      // Two offset glazing lines (two sashes on separate tracks).
      const lineAt = (a: number, b: number, side: number) => {
        const pa = facePoint(fp, a, 1), pb = facePoint(fp, b, 1), qa = facePoint(fp, a, -1), qb = facePoint(fp, b, -1);
        const mix = (p: Vec2, q: Vec2): [number, number] => toScreen(v, p[0] * (0.5 - side) + q[0] * (0.5 + side), p[1] * (0.5 - side) + q[1] * (0.5 + side));
        const [ax, ay] = mix(pa, qa);
        const [bx, by] = mix(pb, qb);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
      };
      lineAt(s0, s0 + o.width * 0.55, 0.18);
      lineAt(s1 - o.width * 0.55, s1, -0.18);
    } else {
      // Glazing line along the centre.
      const [cx0, cy0] = P(s0, 1), [cx1, cy1] = P(s1, 1);
      const [dx0, dy0] = P(s0, -1), [dx1, dy1] = P(s1, -1);
      ctx.beginPath();
      ctx.moveTo((cx0 + dx0) / 2, (cy0 + dy0) / 2);
      ctx.lineTo((cx1 + dx1) / 2, (cy1 + dy1) / 2);
      ctx.stroke();
    }
  } else if (o.type === 'arch') {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(lx0, ly0);
    ctx.lineTo(rx0, ry0);
    ctx.moveTo(lx1, ly1);
    ctx.lineTo(rx1, ry1);
    ctx.stroke();
  } else {
    // Door: leaf hinged at one jamb (two leaves for a double door), opening toward the L side (swing = false) or the R side.
    const n = leftNormal(fp);
    const sgn = o.flip.swing ? -1 : 1;
    const leafAt = (hs: number, along: 1 | -1, len: number) => {
      const hinge = facePoint(fp, hs, 1);
      const hingeR = facePoint(fp, hs, -1);
      const cx = (hinge[0] + hingeR[0]) / 2;
      const cz = (hinge[1] + hingeR[1]) / 2;
      const closed: Vec2 = [cx + fp.dir[0] * along * len, cz + fp.dir[1] * along * len]; // toward the other jamb
      const open: Vec2 = [cx + n[0] * sgn * len, cz + n[1] * sgn * len];
      const [hx, hy] = toScreen(v, cx, cz);
      const [ox, oy] = toScreen(v, open[0], open[1]);
      const [kx, ky] = toScreen(v, closed[0], closed[1]);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(ox, oy);
      ctx.stroke();
      const a0 = Math.atan2(ky - hy, kx - hx);
      const a1 = Math.atan2(oy - hy, ox - hx);
      let delta = a1 - a0;
      while (delta > Math.PI) delta -= 2 * Math.PI;
      while (delta < -Math.PI) delta += 2 * Math.PI;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(hx, hy, len * v.scale, a0, a0 + delta, delta < 0);
      ctx.stroke();
    };
    if (o.style === 'double' || o.style === 'french') {
      leafAt(s0, 1, o.width / 2);
      leafAt(s1, -1, o.width / 2);
    } else {
      leafAt(o.flip.side ? s1 : s0, o.flip.side ? -1 : 1, o.width);
    }
  }
  ctx.restore();
}

/** When painting one face of the selected walls, show which side that is with a thin brick line. */
function drawPaintSide(ctx: CanvasRenderingContext2D, s: RenderState): void {
  if (s.paintSide === 'both') return;
  const side: 1 | -1 = s.paintSide === 'a' ? 1 : -1;
  ctx.strokeStyle = C.brick;
  ctx.lineWidth = 3;
  ctx.lineCap = 'butt';
  for (const id of s.selection) {
    const fp = s.geom.footprints[id];
    if (!fp) continue;
    const [ax, ay] = toScreen(s.view, ...(facePoint(fp, 0, side) as [number, number]));
    const [bx, by] = toScreen(s.view, ...(facePoint(fp, fp.length, side) as [number, number]));
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }
}

function drawOpenings(ctx: CanvasRenderingContext2D, s: RenderState): void {
  const { scene, levelId, view: v } = s;
  const sel = new Set(s.selection);
  for (const o of Object.values(scene.openings)) {
    const w = scene.walls[o.wallId];
    if (!w || w.levelId !== levelId) continue;
    const fp = s.geom.footprints[w.id];
    if (!fp) continue;
    const selected = sel.has(o.id);
    drawOpeningSymbol(ctx, v, fp, o, selected ? C.wallSel : C.wall);
    if (selected) {
      // Brick outline around the whole gap.
      const q = [facePoint(fp, o.offset - o.width / 2, 1), facePoint(fp, o.offset + o.width / 2, 1), facePoint(fp, o.offset + o.width / 2, -1), facePoint(fp, o.offset - o.width / 2, -1)];
      ctx.strokeStyle = C.wallSel;
      ctx.lineWidth = 2;
      ctx.beginPath();
      q.forEach((p, i) => {
        const [x, y] = toScreen(v, p[0], p[1]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.stroke();
    }
  }

  // Ghost of what the next click will place.
  const pv = s.preview;
  if (pv) {
    const fp = s.geom.footprints[pv.wallId];
    if (fp) {
      // Cut a temporary gap so the ghost reads as inside the wall.
      drawOpeningSymbol(ctx, v, fp, { type: pv.type, offset: pv.offset, width: pv.width, flip: { swing: pv.swing, side: false } }, C.brick, 0.75);
    }
  }
}

/** Plan symbol of furniture: footprint with a small chevron on the front edge (and its name when there is room). */
function drawItem(
  ctx: CanvasRenderingContext2D,
  s: RenderState,
  it: { assetId: string; position: Vec3; rotationY: number; scale: Vec3 },
  style: { fill: string; stroke: string; width: number; ghost?: boolean },
): void {
  const asset = getAsset(it.assetId);
  if (!asset) return;
  const v = s.view;
  const poly = itemFootprint(asset, [it.position[0], it.position[2]], it.rotationY, it.scale);
  ctx.beginPath();
  poly.forEach((p, i) => {
    const [x, y] = toScreen(v, p[0], p[1]);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = style.fill;
  ctx.fill();
  ctx.setLineDash(asset.mount === 'ceiling' ? [4, 3] : []);
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = style.width;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.setLineDash([]);

  // Which way it faces: a chevron just inside the front edge.
  const f = frontOf(it.rotationY);
  const halfD = (asset.size[1] * it.scale[2]) / 2;
  const [cx, cy] = toScreen(v, it.position[0] + f[0] * (halfD * 0.72), it.position[2] + f[1] * (halfD * 0.72));
  const px = f[0];
  const py = f[1];
  const k = Math.min(7, Math.max(3, halfD * v.scale * 0.35));
  ctx.beginPath();
  ctx.moveTo(cx - py * k - px * k * 0.6, cy + px * k - py * k * 0.6);
  ctx.lineTo(cx + px * k * 0.6, cy + py * k * 0.6);
  ctx.lineTo(cx + py * k - px * k * 0.6, cy - px * k - py * k * 0.6);
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Name, only when it fits comfortably.
  const [mx, my] = toScreen(v, it.position[0], it.position[2]);
  const wpx = asset.size[0] * it.scale[0] * v.scale;
  const dpx = asset.size[1] * it.scale[2] * v.scale;
  if (!style.ghost && asset.size[2] >= 0.05 && Math.min(wpx, dpx) > 46 && wpx > 90) {
    ctx.font = `300 11px ${FONT}`;
    ctx.fillStyle = C.textSoft;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(asset.name, mx, my);
  }
}

function drawItems(ctx: CanvasRenderingContext2D, s: RenderState): void {
  const sel = new Set(s.selection);
  const items = Object.values(s.scene.items).filter((it) => it.levelId === s.levelId);
  // Flat things (rugs) first so furniture draws on top of them.
  const flat = (id: string) => (getAsset(id)?.size[2] ?? 1) < 0.05;
  items.sort((a, b) => Number(flat(b.assetId)) - Number(flat(a.assetId)));
  for (const it of items) {
    const selected = sel.has(it.id);
    drawItem(ctx, s, it, {
      fill: selected ? 'rgba(122,66,54,0.16)' : flat(it.assetId) ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.72)',
      stroke: selected ? C.wallSel : C.wall,
      width: selected ? 2.4 : 1.2,
    });
  }
  if (s.itemGhost) drawItem(ctx, s, s.itemGhost, { fill: 'rgba(122,66,54,0.18)', stroke: C.brick, width: 2, ghost: true });
}

/** Pro: overall width and depth of the building, drawn as dimension lines outside the plan. */
function drawOverall(ctx: CanvasRenderingContext2D, s: RenderState): void {
  if (!s.pro) return;
  const nodes = Object.values(s.scene.nodes).filter((n) => n.levelId === s.levelId);
  if (nodes.length < 2) return;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const n of nodes) {
    x0 = Math.min(x0, n.p[0]); x1 = Math.max(x1, n.p[0]);
    z0 = Math.min(z0, n.p[1]); z1 = Math.max(z1, n.p[1]);
  }
  const v = s.view;
  const off = 0.75; // metres outside the centre lines
  const tick = 6;
  ctx.strokeStyle = C.textSoft;
  ctx.fillStyle = C.textSoft;
  ctx.lineWidth = 1;
  ctx.font = `400 12px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const line = (ax: number, ay: number, bx: number, by: number) => {
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  };
  // Horizontal, below the plan.
  if (x1 - x0 > 0.01) {
    const [ax, ay] = toScreen(v, x0, z1 + off);
    const [bx] = toScreen(v, x1, z1 + off);
    line(ax, ay, bx, ay);
    line(ax, ay - tick, ax, ay + tick);
    line(bx, ay - tick, bx, ay + tick);
    halo(ctx, formatLength(x1 - x0, s.units), (ax + bx) / 2, ay - 11);
  }
  // Vertical, right of the plan.
  if (z1 - z0 > 0.01) {
    const [ax, ay] = toScreen(v, x1 + off, z0);
    const [, by] = toScreen(v, x1 + off, z1);
    line(ax, ay, ax, by);
    line(ax - tick, ay, ax + tick, ay);
    line(ax - tick, by, ax + tick, by);
    ctx.save();
    ctx.translate(ax + 14, (ay + by) / 2);
    ctx.rotate(Math.PI / 2);
    halo(ctx, formatLength(z1 - z0, s.units), 0, 0);
    ctx.restore();
  }
}

function drawWalker(ctx: CanvasRenderingContext2D, s: RenderState): void {
  if (!s.walker) return;
  const { x, z, yaw } = s.walker;
  const [px, py] = toScreen(s.view, x, z);
  // Forward in plan = (−sin yaw, −cos yaw); canvas angle uses atan2(dz, dx).
  const heading = Math.atan2(-Math.cos(yaw), -Math.sin(yaw));
  const reach = Math.max(1.8 * s.view.scale, 30);
  ctx.fillStyle = 'rgba(122,66,54,0.16)';
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.arc(px, py, reach, heading - Math.PI / 4, heading + Math.PI / 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = C.brick;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(px, py, Math.max(0.25 * s.view.scale, 6), 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawOverlay(ctx: CanvasRenderingContext2D, s: RenderState): void {
  const { hover, view: v } = s;
  if (!hover) return;

  if (hover.guide) {
    const [gx, gy] = toScreen(v, hover.guide.from[0], hover.guide.from[1]);
    const [hx, hy] = toScreen(v, hover.guide.to[0], hover.guide.to[1]);
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = C.guide;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const [px, py] = toScreen(v, hover.point[0], hover.point[1]);

  if (s.drawingFrom) {
    const [fx, fy] = toScreen(v, s.drawingFrom[0], s.drawingFrom[1]);
    ctx.strokeStyle = 'rgba(122,66,54,0.7)';
    ctx.lineWidth = Math.max(0.115 * v.scale, 3);
    ctx.lineCap = 'square';
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(px, py);
    ctx.stroke();

    const dx = hover.point[0] - s.drawingFrom[0];
    const dz = hover.point[1] - s.drawingFrom[1];
    const len = Math.hypot(dx, dz);
    if (len > 1e-6) {
      let deg = (Math.atan2(-dz, dx) * 180) / Math.PI;
      if (deg < 0) deg += 360;
      ctx.font = `400 13px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      halo(ctx, s.lengthInput ? `${s.lengthInput}▏  ${deg.toFixed(0)}°` : `${formatLength(len, s.units)}   ${deg.toFixed(0)}°`, px, py - 22);
    }
  }

  // Snap marker.
  ctx.strokeStyle = C.accent;
  ctx.fillStyle = C.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (hover.kind === 'node') {
    ctx.rect(px - 7, py - 7, 14, 14);
    ctx.stroke();
  } else if (hover.kind === 'wall') {
    ctx.moveTo(px, py - 8);
    ctx.lineTo(px + 8, py);
    ctx.lineTo(px, py + 8);
    ctx.lineTo(px - 8, py);
    ctx.closePath();
    ctx.stroke();
  } else if (hover.kind === 'angle') {
    ctx.moveTo(px, py - 7);
    ctx.lineTo(px + 7, py + 6);
    ctx.lineTo(px - 7, py + 6);
    ctx.closePath();
    ctx.stroke();
  } else {
    ctx.arc(px, py, hover.kind === 'grid' ? 3.5 : 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function polyArea(p: readonly Vec2[]): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[i]!;
    const r = p[(i + 1) % p.length]!;
    a += q[0] * r[1] - r[0] * q[1];
  }
  return Math.abs(a) / 2;
}

/** Plot: land outside it is dimmed, the outline is dashed, edges are measured and the area is labelled. */
function drawPlotBefore(ctx: CanvasRenderingContext2D, s: RenderState): void {
  const b = s.plot.boundary;
  if (!b || b.length < 3) return;
  ctx.beginPath();
  ctx.rect(0, 0, s.width, s.height);
  b.forEach((p, i) => {
    const [x, y] = toScreen(s.view, p[0], p[1]);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = 'rgba(17,17,17,0.07)';
  ctx.fill('evenodd');
}

function drawPlotAfter(ctx: CanvasRenderingContext2D, s: RenderState): void {
  const { view: v } = s;
  const b = s.plot.boundary;
  if (b && b.length >= 3) {
    ctx.beginPath();
    b.forEach((p, i) => {
      const [x, y] = toScreen(v, p[0], p[1]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.setLineDash([10, 6]);
    ctx.strokeStyle = C.brick;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = `400 12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < b.length; i++) {
      const a = b[i]!;
      const c = b[(i + 1) % b.length]!;
      const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (len * v.scale < 60) continue;
      const [ax, ay] = toScreen(v, a[0], a[1]);
      const [cx, cy] = toScreen(v, c[0], c[1]);
      halo(ctx, formatLength(len, s.units), (ax + cx) / 2, (ay + cy) / 2 - 11);
    }
    const minX = Math.min(...b.map((p) => p[0]));
    const minZ = Math.min(...b.map((p) => p[1]));
    const [lx, ly] = toScreen(v, minX, minZ);
    ctx.font = `500 12px ${FONT}`;
    ctx.textAlign = 'left';
    halo(ctx, `Plot · ${formatArea(polyArea(b), s.units)}`, lx + 10, ly + 18);
    ctx.textAlign = 'center';
    // House points outside the plot.
    ctx.strokeStyle = '#c0392b';
    ctx.lineWidth = 2;
    for (const p of s.plot.outside) {
      const [x, y] = toScreen(v, p[0], p[1]);
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  const d = s.plot.draft;
  if (d && d.length) {
    ctx.strokeStyle = C.brick;
    ctx.fillStyle = C.brick;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 5]);
    ctx.beginPath();
    d.forEach((p, i) => {
      const [x, y] = toScreen(v, p[0], p[1]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    if (s.hover) {
      const [hx, hy] = toScreen(v, s.hover.point[0], s.hover.point[1]);
      ctx.lineTo(hx, hy);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    d.forEach((p, i) => {
      const [x, y] = toScreen(v, p[0], p[1]);
      ctx.beginPath();
      ctx.arc(x, y, i === 0 ? 6 : 4, 0, Math.PI * 2);
      ctx.fill();
    });
    const last = d[d.length - 1]!;
    if (s.hover) {
      const len = Math.hypot(s.hover.point[0] - last[0], s.hover.point[1] - last[1]);
      if (len > 1e-6) {
        const [hx, hy] = toScreen(v, s.hover.point[0], s.hover.point[1]);
        ctx.font = `400 13px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        halo(ctx, formatLength(len, s.units), hx, hy - 22);
      }
    }
  }
}

function drawStairs(ctx: CanvasRenderingContext2D, s: RenderState): void {
  const { view: v } = s;
  for (const d of s.stairs) {
    const sc = (p: Vec2): [number, number] => {
      const w = stairToWorld(d.origin, d.rotationY, p);
      return toScreen(v, w[0], w[1]);
    };
    const faint = d.role === 'down';
    ctx.save();
    if (d.role === 'ghost') ctx.globalAlpha = 0.7;
    ctx.beginPath();
    d.layout.outline.forEach((p, i) => {
      const [x, y] = sc(p);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = faint ? 'rgba(17,17,17,0.05)' : 'rgba(255,255,255,0.6)';
    ctx.fill();
    const ink = d.selected ? C.wallSel : d.role === 'ghost' ? C.brick : C.wall;
    ctx.strokeStyle = ink;
    ctx.lineWidth = d.selected ? 2.2 : 1.4;
    ctx.setLineDash(faint ? [7, 5] : []);
    ctx.stroke();
    ctx.setLineDash([]);

    // Step lines: one line across every step at its far edge; the landing gets its outline.
    ctx.lineWidth = 1;
    ctx.strokeStyle = faint ? 'rgba(17,17,17,0.28)' : 'rgba(17,17,17,0.55)';
    ctx.beginPath();
    for (const t of d.layout.treads) {
      const [x0, z0, x1, z1] = t.rect;
      if (t.landing) {
        const a = sc([x0, z0]), b = sc([x1, z0]), c = sc([x1, z1]), e = sc([x0, z1]);
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.lineTo(c[0], c[1]);
        ctx.lineTo(e[0], e[1]);
        ctx.closePath();
        continue;
      }
      const [dx, dz] = t.dir;
      const [a, b] = dz < 0 ? [sc([x0, z0]), sc([x1, z0])] : dz > 0 ? [sc([x0, z1]), sc([x1, z1])] : dx < 0 ? [sc([x0, z0]), sc([x0, z1])] : [sc([x1, z0]), sc([x1, z1])];
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
    }
    ctx.stroke();

    // Walking line with an arrow: up the stairs (or down, as seen from the floor above).
    const tr = d.layout.treads;
    const cxOf = (i: number) => (tr[i]!.rect[0] + tr[i]!.rect[2]) / 2;
    const czOf = (i: number) => (tr[i]!.rect[1] + tr[i]!.rect[3]) / 2;
    const centres: [number, number][] = [];
    tr.forEach((t, i) => {
      if (t.landing && i > 0 && i < tr.length - 1) {
        // Walk straight into the landing, turn there, walk out (no diagonal across it).
        centres.push(sc([cxOf(i - 1), czOf(i)]), sc([cxOf(i + 1), czOf(i)]));
      } else centres.push(sc([cxOf(i), czOf(i)]));
    });
    if (centres.length >= 2) {
      const path = faint ? [...centres].reverse() : centres;
      ctx.strokeStyle = ink;
      ctx.fillStyle = ink;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      path.forEach((p, i) => (i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])));
      ctx.stroke();
      const a = path[path.length - 2]!;
      const b = path[path.length - 1]!;
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      ctx.beginPath();
      ctx.moveTo(b[0], b[1]);
      ctx.lineTo(b[0] - 9 * Math.cos(ang - 0.45), b[1] - 9 * Math.sin(ang - 0.45));
      ctx.lineTo(b[0] - 9 * Math.cos(ang + 0.45), b[1] - 9 * Math.sin(ang + 0.45));
      ctx.closePath();
      ctx.fill();
      const start = path[0]!;
      ctx.beginPath();
      ctx.arc(start[0], start[1], 3.5, 0, Math.PI * 2);
      ctx.fill();
      if (d.role !== 'ghost') {
        ctx.font = `500 11px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        halo(ctx, faint ? 'DN' : 'UP', start[0] + 18, start[1] - (faint ? -10 : 10));
      }
    }
    ctx.restore();
  }
}

export function drawPlan(ctx: CanvasRenderingContext2D, s: RenderState): void {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, s.width, s.height);
  drawGrid(ctx, s);
  // Floor below as a faint reference (walls only).
  ctx.fillStyle = 'rgba(17,17,17,0.11)';
  for (const piece of s.ghost) {
    ctx.beginPath();
    piece.forEach((p, i) => {
      const [x, y] = toScreen(s.view, p[0], p[1]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
  }
  drawPlotBefore(ctx, s);
  drawRooms(ctx, s, 'fills');
  drawStairs(ctx, s);
  drawItems(ctx, s);
  drawWalls(ctx, s);
  drawPaintSide(ctx, s);
  drawOpenings(ctx, s);
  drawOverall(ctx, s);
  drawRooms(ctx, s, 'labels');
  drawPlotAfter(ctx, s);
  drawWalker(ctx, s);
  drawOverlay(ctx, s);
}
