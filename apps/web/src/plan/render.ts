import type { Scene, Vec2 } from '@hd/scene-schema';
import type { SnapResult } from '@hd/editor-core';
import { toScreen, toWorld, type View } from './viewport';

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
  polygon: readonly Vec2[];
  centroid: Vec2;
  area: number;
  name: string;
}

export interface RenderState {
  /** First-person walker (shown as a view cone) while the walkthrough is active. */
  walker: { x: number; z: number; yaw: number } | null;
  rooms: readonly RoomDraw[];
  view: View;
  width: number;
  height: number;
  scene: Scene;
  levelId: string;
  selection: readonly string[];
  tool: 'select' | 'wall';
  hover: SnapResult | null;
  drawingFrom: Vec2 | null;
  gridStep: number;
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

function pointInPolygon(x: number, z: number, poly: readonly Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]!;
    const [xj, zj] = poly[j]!;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function drawRooms(ctx: CanvasRenderingContext2D, s: RenderState): void {
  const { view: v } = s;
  for (const r of s.rooms) {
    ctx.beginPath();
    r.polygon.forEach((p, i) => {
      const [x, y] = toScreen(v, p[0], p[1]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = C.roomFill;
    ctx.fill();
  }
  // Labels after fills so neighbouring rooms never paint over them.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const r of s.rooms) {
    const [cx, cy] = toScreen(v, r.centroid[0], r.centroid[1]);
    // Skip when the room is too small on screen to hold text.
    if (Math.sqrt(r.area) * v.scale < 56) continue;
    ctx.font = `400 14px ${FONT}`;
    halo(ctx, r.name, cx, cy - 8);
    ctx.font = `300 12.5px ${FONT}`;
    halo(ctx, `${r.area.toFixed(1)} m²`, cx, cy + 9);
  }
}

function drawWalls(ctx: CanvasRenderingContext2D, s: RenderState): void {
  const { scene, view: v, levelId } = s;
  const sel = new Set(s.selection);
  ctx.lineCap = 'square';
  const walls = Object.values(scene.walls).filter((w) => w.levelId === levelId);

  const stroke = (color: string, extra: number, only?: (id: string) => boolean) => {
    for (const w of walls) {
      if (only && !only(w.id)) continue;
      const a = scene.nodes[w.a];
      const b = scene.nodes[w.b];
      if (!a || !b) continue;
      const [ax, ay] = toScreen(v, a.p[0], a.p[1]);
      const [bx, by] = toScreen(v, b.p[0], b.p[1]);
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(w.thickness * v.scale, 3) + extra;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }
  };
  stroke(C.wall, 0, (id) => !sel.has(id));
  stroke(C.wallSel, 0, (id) => sel.has(id));

  // Length labels.
  ctx.font = `400 12px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const w of walls) {
    if (v.scale < 30 && !sel.has(w.id)) continue;
    const a = scene.nodes[w.a];
    const b = scene.nodes[w.b];
    if (!a || !b) continue;
    const [ax, ay] = toScreen(v, a.p[0], a.p[1]);
    const [bx, by] = toScreen(v, b.p[0], b.p[1]);
    const len = Math.hypot(b.p[0] - a.p[0], b.p[1] - a.p[1]);
    const text = `${len.toFixed(2)} m`;
    const dx = bx - ax;
    const dy = by - ay;
    const n = Math.hypot(dx, dy) || 1;
    const nx = -dy / n;
    const ny = dx / n;
    // Clear the wall by its half thickness plus half the text's extent along the normal.
    const off = (w.thickness * v.scale) / 2 + 7 + (Math.abs(nx) * ctx.measureText(text).width) / 2 + Math.abs(ny) * 7;
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
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
      halo(ctx, `${len.toFixed(2)} m   ${deg.toFixed(0)}°`, px, py - 22);
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

export function drawPlan(ctx: CanvasRenderingContext2D, s: RenderState): void {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, s.width, s.height);
  drawGrid(ctx, s);
  drawRooms(ctx, s);
  drawWalls(ctx, s);
  drawWalker(ctx, s);
  drawOverlay(ctx, s);
}
