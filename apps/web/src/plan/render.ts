import type { Scene, Vec2 } from '@hd/scene-schema';
import type { SnapResult } from '@hd/editor-core';
import { toScreen, toWorld, type View } from './viewport';

const C = {
  bg: '#1b1e24',
  gridMinor: 'rgba(255,255,255,0.05)',
  gridMajor: 'rgba(255,255,255,0.11)',
  axis: 'rgba(255,255,255,0.22)',
  wallEdge: '#0e1013',
  wall: '#d4d8df',
  wallSel: '#4da3ff',
  node: '#ffffff',
  accent: '#ffb347',
  guide: 'rgba(255,179,71,0.65)',
  text: '#e8eaee',
};

export interface RenderState {
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
  ctx.strokeStyle = C.bg;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = C.text;
  ctx.fillText(text, x, y);
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
  stroke(C.wallEdge, 2); // outline pass
  stroke(C.wall, 0, (id) => !sel.has(id));
  stroke(C.wallSel, 0, (id) => sel.has(id));

  // Length labels.
  ctx.font = '12px system-ui, sans-serif';
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
    const dx = bx - ax;
    const dy = by - ay;
    const n = Math.hypot(dx, dy) || 1;
    const off = (w.thickness * v.scale) / 2 + 12;
    halo(ctx, `${len.toFixed(2)} m`, (ax + bx) / 2 - (dy / n) * off, (ay + by) / 2 + (dx / n) * off);
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
    ctx.strokeStyle = 'rgba(77,163,255,0.8)';
    ctx.lineWidth = 0.115 * v.scale;
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
      ctx.font = '13px system-ui, sans-serif';
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
  drawWalls(ctx, s);
  drawOverlay(ctx, s);
}
