import type { Id, Vec2 } from '@hd/scene-schema';
import { moveNode, niceGridStep, removeWalls, snapPoint, type SnapResult } from '@hd/editor-core';
import { editor, finishDrawing, useUi, wallTool } from './session';
import { drawPlan } from './render';
import { toWorld, zoomAt, type View } from './viewport';

const SNAP_PX = 14;
const NODE_HIT_PX = 16;
const WALL_HIT_PX = 10;
const TAP_SLOP_PX = 5;

type Mode = 'none' | 'pan' | 'place' | 'select' | 'dragNode' | 'gesture';

/**
 * Owns the 2D plan canvas: view transform, pointer/touch/keyboard handling, rendering on demand.
 * React only mounts/unmounts it. All scene edits go through the editor (commands).
 *
 * Input model (mouse + touch are equal citizens):
 *  - Wall tool: press shows the snapped preview, release places the point (so touch users can
 *    slide a finger to the exact spot). Esc / double-click / right-click / Done ends the chain.
 *  - Select tool: tap a wall to select, drag a corner point to move it (one undo step).
 *  - Pan: middle/right mouse drag, Space+drag, one-finger drag on empty space (select tool),
 *    or two fingers. Zoom: wheel / pinch.
 */
export class PlanController {
  view: View = { scale: 60, ox: 0, oy: 0 };
  hover: SnapResult | null = null;

  private ctx: CanvasRenderingContext2D;
  private cssW = 0;
  private cssH = 0;
  private dpr = 1;
  private centered = false;
  private raf = 0;
  private disposed = false;

  private pointers = new Map<number, { x: number; y: number }>();
  private mode: Mode = 'none';
  private down = { x: 0, y: 0, button: 0 };
  private moved = false;
  private spaceDown = false;
  private dragNodeId: Id | null = null;
  private gesture: { dist: number; scale: number; wx: number; wz: number } | null = null;

  private cleanup: Array<() => void> = [];

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas not supported');
    this.ctx = ctx;
    canvas.style.touchAction = 'none';

    const on = <K extends keyof HTMLElementEventMap>(
      el: HTMLElement | Window,
      type: string,
      fn: (e: K extends never ? never : any) => void, // eslint-disable-line @typescript-eslint/no-explicit-any
      opts?: AddEventListenerOptions,
    ) => {
      el.addEventListener(type, fn as EventListener, opts);
      this.cleanup.push(() => el.removeEventListener(type, fn as EventListener, opts));
    };

    on(canvas, 'pointerdown', (e: PointerEvent) => this.onDown(e));
    on(canvas, 'pointermove', (e: PointerEvent) => this.onMove(e));
    on(canvas, 'pointerup', (e: PointerEvent) => this.onUp(e));
    on(canvas, 'pointercancel', (e: PointerEvent) => this.onCancel(e));
    on(canvas, 'pointerleave', (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && this.mode === 'none') {
        this.hover = null;
        this.invalidate();
      }
    });
    on(canvas, 'wheel', (e: WheelEvent) => this.onWheel(e), { passive: false });
    on(canvas, 'dblclick', () => {
      if (useUi.getState().tool === 'wall') this.endChain();
    });
    on(canvas, 'contextmenu', (e: Event) => e.preventDefault());
    on(window, 'keydown', (e: KeyboardEvent) => this.onKey(e, true));
    on(window, 'keyup', (e: KeyboardEvent) => this.onKey(e, false));

    const ro = new ResizeObserver(() => this.resize());
    ro.observe(canvas);
    this.cleanup.push(() => ro.disconnect());

    this.cleanup.push(editor.subscribe(() => this.invalidate()));
    let prevTool = useUi.getState().tool;
    this.cleanup.push(
      useUi.subscribe((s) => {
        if (s.tool !== prevTool) {
          prevTool = s.tool;
          this.endChain();
          this.hover = null;
        }
        this.invalidate();
      }),
    );

    this.resize();
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    if (editor.getState().inTransaction) editor.cancelTransaction();
    this.cleanup.forEach((f) => f());
    this.cleanup = [];
  }

  /** Fit the whole plan (or reset to origin) into view. */
  fitToPlan(): void {
    const nodes = Object.values(editor.getState().scene.nodes);
    if (nodes.length === 0) {
      this.view = { scale: 60, ox: this.cssW / 2, oy: this.cssH / 2 };
    } else {
      let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
      for (const n of nodes) {
        minX = Math.min(minX, n.p[0]); maxX = Math.max(maxX, n.p[0]);
        minZ = Math.min(minZ, n.p[1]); maxZ = Math.max(maxZ, n.p[1]);
      }
      const pad = 80;
      const w = Math.max(maxX - minX, 1);
      const h = Math.max(maxZ - minZ, 1);
      const scale = Math.min(500, Math.max(8, Math.min((this.cssW - 2 * pad) / w, (this.cssH - 2 * pad) / h)));
      this.view = {
        scale,
        ox: this.cssW / 2 - ((minX + maxX) / 2) * scale,
        oy: this.cssH / 2 - ((minZ + maxZ) / 2) * scale,
      };
    }
    this.invalidate();
  }

  // ---------------------------------------------------------------- rendering

  invalidate(): void {
    if (this.disposed || this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.render();
    });
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cssW = rect.width;
    this.cssH = rect.height;
    this.canvas.width = Math.max(1, Math.round(rect.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * this.dpr));
    if (!this.centered && rect.width > 0) {
      this.view.ox = rect.width / 2;
      this.view.oy = rect.height / 2;
      this.centered = true;
    }
    this.invalidate();
  }

  private render(): void {
    const st = editor.getState();
    const ui = useUi.getState();
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    drawPlan(this.ctx, {
      view: this.view,
      width: this.cssW,
      height: this.cssH,
      scene: st.scene,
      levelId: st.activeLevelId,
      selection: st.selection,
      tool: ui.tool,
      hover: this.hover,
      drawingFrom: ui.tool === 'wall' ? wallTool.last : null,
      gridStep: niceGridStep(this.view.scale),
    });
  }

  // ------------------------------------------------------------------ helpers

  private local(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private snapAt(sx: number, sy: number, exclude?: Id[]): SnapResult {
    const st = editor.getState();
    const ui = useUi.getState();
    const raw = toWorld(this.view, sx, sy) as Vec2;
    return snapPoint(raw, st.scene, st.activeLevelId, {
      settings: ui.snap,
      gridStep: niceGridStep(this.view.scale),
      thresholdM: SNAP_PX / this.view.scale,
      from: ui.tool === 'wall' ? (wallTool.last ?? undefined) : undefined,
      excludeNodeIds: exclude,
    });
  }

  private hitNode(sx: number, sy: number): Id | null {
    const st = editor.getState();
    let best: Id | null = null;
    let bestD = NODE_HIT_PX;
    for (const n of Object.values(st.scene.nodes)) {
      if (n.levelId !== st.activeLevelId) continue;
      const d = Math.hypot(n.p[0] * this.view.scale + this.view.ox - sx, n.p[1] * this.view.scale + this.view.oy - sy);
      if (d < bestD) {
        best = n.id;
        bestD = d;
      }
    }
    return best;
  }

  private hitWall(sx: number, sy: number): Id | null {
    const st = editor.getState();
    const [px, pz] = toWorld(this.view, sx, sy);
    let best: Id | null = null;
    let bestD = Infinity;
    for (const w of Object.values(st.scene.walls)) {
      if (w.levelId !== st.activeLevelId) continue;
      const a = st.scene.nodes[w.a];
      const b = st.scene.nodes[w.b];
      if (!a || !b) continue;
      const abx = b.p[0] - a.p[0];
      const abz = b.p[1] - a.p[1];
      const len2 = abx * abx + abz * abz || 1;
      const t = Math.max(0, Math.min(1, ((px - a.p[0]) * abx + (pz - a.p[1]) * abz) / len2));
      const d = Math.hypot(px - (a.p[0] + abx * t), pz - (a.p[1] + abz * t)) * this.view.scale;
      const reach = Math.max(WALL_HIT_PX, (w.thickness * this.view.scale) / 2);
      if (d <= reach && d < bestD) {
        best = w.id;
        bestD = d;
      }
    }
    return best;
  }

  private endChain(): void {
    finishDrawing();
    this.invalidate();
  }

  // ------------------------------------------------------------------- pointer

  private onDown(e: PointerEvent): void {
    this.canvas.setPointerCapture(e.pointerId);
    const p = this.local(e);
    this.pointers.set(e.pointerId, p);

    if (this.pointers.size === 2) {
      // Second finger: abandon whatever the first one started and switch to pinch/pan.
      if (this.mode === 'dragNode' && editor.getState().inTransaction) editor.cancelTransaction();
      this.dragNodeId = null;
      this.beginGesture();
      this.mode = 'gesture';
      this.hover = null;
      this.invalidate();
      return;
    }
    if (this.pointers.size > 2 || this.mode === 'gesture') return;

    this.down = { x: p.x, y: p.y, button: e.button };
    this.moved = false;
    const tool = useUi.getState().tool;

    if (e.button === 1 || e.button === 2 || this.spaceDown) {
      this.mode = 'pan';
      return;
    }
    if (tool === 'wall') {
      this.mode = 'place';
      this.hover = this.snapAt(p.x, p.y);
    } else {
      const nodeId = this.hitNode(p.x, p.y);
      if (nodeId) {
        this.mode = 'dragNode';
        this.dragNodeId = nodeId;
        editor.beginTransaction('Move wall point');
      } else {
        this.mode = 'select';
      }
    }
    this.invalidate();
  }

  private onMove(e: PointerEvent): void {
    const prev = this.pointers.get(e.pointerId);
    const p = this.local(e);
    if (prev) this.pointers.set(e.pointerId, p);

    if (this.mode === 'gesture') {
      this.updateGesture();
      return;
    }
    if (!prev) {
      // Hovering mouse (no button down).
      if (useUi.getState().tool === 'wall' && e.pointerType === 'mouse') {
        this.hover = this.snapAt(p.x, p.y);
        this.invalidate();
      }
      return;
    }
    if (Math.hypot(p.x - this.down.x, p.y - this.down.y) > TAP_SLOP_PX) this.moved = true;

    switch (this.mode) {
      case 'pan':
        this.panBy(p.x - prev.x, p.y - prev.y);
        break;
      case 'select':
        // Dragging empty space in select mode pans (one-finger pan on touch).
        if (this.moved) this.panBy(p.x - prev.x, p.y - prev.y);
        break;
      case 'place':
        this.hover = this.snapAt(p.x, p.y);
        this.invalidate();
        break;
      case 'dragNode':
        if (this.dragNodeId) {
          const s = this.snapAt(p.x, p.y, [this.dragNodeId]);
          this.hover = s;
          editor.preview(moveNode(this.dragNodeId, s.point));
        }
        break;
      default:
    }
  }

  private onUp(e: PointerEvent): void {
    const p = this.local(e);
    this.pointers.delete(e.pointerId);

    if (this.mode === 'gesture') {
      if (this.pointers.size === 0) this.mode = 'none';
      else if (this.pointers.size === 1) this.gesture = null;
      return;
    }

    const mode = this.mode;
    this.mode = 'none';

    if (mode === 'place') {
      const s = this.snapAt(p.x, p.y);
      wallTool.click(s.point, s.kind);
      useUi.getState().setDrawing(wallTool.last !== null);
      this.hover = e.pointerType === 'mouse' ? this.snapAt(p.x, p.y) : null;
    } else if (mode === 'dragNode') {
      editor.commitTransaction();
      this.dragNodeId = null;
      this.hover = null;
    } else if (mode === 'select' && !this.moved) {
      const hit = this.hitWall(p.x, p.y);
      const cur = editor.getState().selection;
      if (!hit) editor.select([]);
      else if (e.shiftKey) editor.select(cur.includes(hit) ? cur.filter((i) => i !== hit) : [...cur, hit]);
      else editor.select([hit]);
    } else if (mode === 'pan' && this.down.button === 2 && !this.moved) {
      // Right-click without dragging = finish the chain.
      if (useUi.getState().tool === 'wall') this.endChain();
    }
    this.invalidate();
  }

  private onCancel(e: PointerEvent): void {
    this.pointers.delete(e.pointerId);
    if (this.mode === 'dragNode' && editor.getState().inTransaction) editor.cancelTransaction();
    this.dragNodeId = null;
    if (this.pointers.size === 0) this.mode = 'none';
    this.hover = null;
    this.invalidate();
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const p = this.local(e);
    zoomAt(this.view, p.x, p.y, this.view.scale * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
    if (useUi.getState().tool === 'wall' && e.deltaY !== 0 && this.pointers.size === 0) {
      this.hover = this.snapAt(p.x, p.y);
    }
    this.invalidate();
  }

  // ------------------------------------------------------------------ gestures

  private panBy(dx: number, dy: number): void {
    this.view.ox += dx;
    this.view.oy += dy;
    this.invalidate();
  }

  private beginGesture(): void {
    const [a, b] = [...this.pointers.values()];
    if (!a || !b) return;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const [wx, wz] = toWorld(this.view, mx, my);
    this.gesture = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, scale: this.view.scale, wx, wz };
  }

  private updateGesture(): void {
    const g = this.gesture;
    const pts = [...this.pointers.values()];
    const a = pts[0];
    const b = pts[1];
    if (!g || !a || !b) return;
    const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    // Keep the world point that started under the fingers' midpoint under the midpoint now.
    const scale = Math.min(500, Math.max(8, g.scale * (dist / g.dist)));
    this.view.scale = scale;
    this.view.ox = mx - g.wx * scale;
    this.view.oy = my - g.wz * scale;
    this.invalidate();
  }

  // ------------------------------------------------------------------- keyboard

  private onKey(e: KeyboardEvent, isDown: boolean): void {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.code === 'Space') {
      this.spaceDown = isDown;
      if (isDown) e.preventDefault();
      return;
    }
    if (!isDown) return;

    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (mod && key === 'z') {
      e.preventDefault();
      if (e.shiftKey) editor.redo();
      else editor.undo();
    } else if (mod && key === 'y') {
      e.preventDefault();
      editor.redo();
    } else if (e.key === 'Escape') {
      this.endChain();
      editor.select([]);
    } else if (e.key === 'Enter') {
      if (useUi.getState().tool === 'wall') this.endChain();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      deleteSelection();
    } else if (!mod && key === 'w') {
      useUi.getState().setTool('wall');
    } else if (!mod && key === 'v') {
      useUi.getState().setTool('select');
    } else if (!mod && key === 'f') {
      this.fitToPlan();
    }
  }
}

export function deleteSelection(): void {
  const st = editor.getState();
  const ids = st.selection.filter((id) => st.scene.walls[id]);
  if (ids.length) editor.execute(removeWalls(ids));
}
