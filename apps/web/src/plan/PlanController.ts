import type { Id, Vec2 } from '@hd/scene-schema';
import { getAsset, itemFootprint, pointInItem } from '@hd/assets';
import {
  addItem,
  addOpening,
  balconyRailings,
  getRoomPreset,
  layoutItems,
  placeRoomPreset,
  presetFootprint,
  turnOffset,
  batch,
  removeBalconies,
  removeZones,
  removeRoofs,
  translateBalconies,
  translateZones,
  zonePolygon,
  zonePoints,
  GARDEN_SURFACES,
  layoutOf,
  levelAbove,
  removeStairs,
  rotateStairs,
  stairOutline,
  stairRise,
  translateStairs,
  updateStairs,
  defaultSize,
  duplicateItems,
  removeItems,
  rotateItems,
  setItemTransform,
  solvePlacement,
  translateItems,
  freeOffset,
  moveNode,
  moveOpening,
  nearestWallPoint,
  niceGridStep,
  removeOpenings,
  removeWalls,
  snapPoint,
  type SnapResult,
} from '@hd/editor-core';
import { cancelPlot, editor, finishDrawing, finishPlot, useUi, wallTool } from './session';
import { stairLayout, stairOutlineWorld, type StairLayout } from '@hd/geometry';
import { addStairAssembly, snapStairToWalls } from '@hd/editor-core';
import { drawPlan, pointInPolygon, type ItemGhost, type OpeningPreview, type StairDraw } from './render';
import { levelRooms } from './rooms';
import { highlightSides } from './wallFaces';
import { useAnchor } from '../ui/ObjectBar';
import { catalogMaterial } from '../view3d/placeholderMaterials';
import { levelGeometry } from './wallGeom';
import { walkPose } from '../walk/walkState';
import { requireAccess } from '../cloud/store';
import { nodesOutsidePlot } from '@hd/editor-core';
import { defaultInputUnit, LENGTH_CHARS, LENGTH_UNIT_CHARS, parseLength } from '../lib/units';
import { toWorld, zoomAt, type View } from './viewport';

const SNAP_PX = 14;
const NODE_HIT_PX = 16;
const WALL_HIT_PX = 10;
const TAP_SLOP_PX = 5;

type Mode = 'none' | 'pan' | 'place' | 'placeOpening' | 'placeItem' | 'placeRoom' | 'placeStair' | 'select' | 'dragNode' | 'dragOpening' | 'dragItem' | 'dragStair' | 'dragBalcony' | 'dragZone' | 'gesture';

/**
 * Owns the 2D plan canvas: view transform, pointer/touch/keyboard handling, rendering on demand.
 * React only mounts/unmounts it. All scene edits go through the editor (commands).
 *
 * Input model (mouse + touch are equal citizens):
 *  - Wall tool: press shows the snapped preview, release places the point (so touch users can
 *    slide a finger to the exact spot). Esc / double-click / right-click / Done ends the chain.
 *  - Door / Window tools: a ghost follows the pointer along the nearest wall (snapped to a free spot, door
 *    swings toward the pointer side); release places it.
 *  - Select tool: tap a wall or opening to select, drag a corner point to move it, drag an opening to slide
 *    it along (or onto another) wall. Each gesture is one undo step.
 *  - Pan: middle/right mouse drag, Space+drag, one-finger drag on empty space (select tool),
 *    or two fingers. Zoom: wheel / pinch.
 */
export class PlanController {
  view: View = { scale: 60, ox: 0, oy: 0 };
  hover: SnapResult | null = null;
  preview: OpeningPreview | null = null;
  itemGhost: ItemGhost | null = null;
  stairGhost: StairDraw | null = null;
  roomGhost: { center: Vec2 } | null = null;

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
  private dragOpeningId: Id | null = null;
  private dragItemId: Id | null = null;
  private dragStairId: Id | null = null;
  private dragBalconyId: Id | null = null;
  private dragZoneId: Id | null = null;
  private dragZoneLast: Vec2 = [0, 0];
  private dragBalconyLast: Vec2 = [0, 0];
  /** Pointer offset from the item's centre when the drag began (so it doesn't jump). */
  private dragGrab: Vec2 = [0, 0];
  private dragBaseRotation = 0;
  private dragStarted = false;
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
      else if (isDraftTool()) finishPlot();
    });
    on(canvas, 'contextmenu', (e: Event) => e.preventDefault());
    on(window, 'keydown', (e: KeyboardEvent) => this.onKey(e, true));
    on(window, 'keyup', (e: KeyboardEvent) => this.onKey(e, false));

    const ro = new ResizeObserver(() => this.resize());
    ro.observe(canvas);
    this.cleanup.push(() => ro.disconnect());

    this.cleanup.push(editor.subscribe(() => this.invalidate()));
    this.cleanup.push(walkPose.subscribe(() => this.invalidate()));
    let prevTool = useUi.getState().tool;
    this.cleanup.push(
      useUi.subscribe((s) => {
        this.updateCursor();
        if (s.tool !== prevTool) {
          prevTool = s.tool;
          this.endChain();
          cancelPlot();
          this.hover = null;
          this.preview = null;
          this.itemGhost = null;
          this.stairGhost = null;
          this.roomGhost = null;
          this.updateCursor();
        }
        this.invalidate();
      }),
    );

    this.resize();
    // Canvas text must be redrawn once the web font is available.
    void document.fonts?.load('400 13px "Outfit Variable"').then(() => this.invalidate());
    this.updateCursor();
  }

  private updateCursor(): void {
    const ui = useUi.getState();
    this.canvas.style.cursor = ui.viewOnly ? 'grab' : ui.tool === 'select' ? 'default' : 'crosshair';
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
    const scene = editor.getState().scene;
    const nodes: { p: Vec2 }[] = [...Object.values(scene.nodes), ...(scene.plot?.boundary ?? []).map((p) => ({ p })), ...Object.values(scene.balconies).flatMap((b) => b.outline.map((p) => ({ p }))), ...zonePoints(scene).map((p) => ({ p }))];
    if (nodes.length === 0) {
      this.view = { scale: 60, ox: this.cssW / 2, oy: this.cssH / 2 };
    } else {
      let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
      for (const n of nodes) {
        minX = Math.min(minX, n.p[0]); maxX = Math.max(maxX, n.p[0]);
        minZ = Math.min(minZ, n.p[1]); maxZ = Math.max(maxZ, n.p[1]);
      }
      // Keep clear of the floating chrome: tool rail on the left (bottom on phones), top bar, caption.
      const phone = window.matchMedia('(max-width: 699px)').matches;
      const padL = phone ? 28 : 120;
      // Pro mode draws overall dimension lines outside the plan: leave room for them.
      const proExtra = useUi.getState().pro ? 90 : 0;
      const padR = 40 + proExtra;
      const padT = phone ? 190 : 90;
      const padB = (phone && useUi.getState().view === '2d' ? 200 : 110) + proExtra;
      const availW = Math.max(this.cssW - padL - padR, 50);
      const availH = Math.max(this.cssH - padT - padB, 50);
      const w = Math.max(maxX - minX, 1);
      const h = Math.max(maxZ - minZ, 1);
      const scale = Math.min(500, Math.max(8, Math.min(availW / w, availH / h)));
      this.view = {
        scale,
        ox: padL + availW / 2 - ((minX + maxX) / 2) * scale,
        oy: padT + availH / 2 - ((minZ + maxZ) / 2) * scale,
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
      // A project opened with content (sample home, later: saved projects) starts framed.
      if (Object.keys(editor.getState().scene.nodes).length > 0 || editor.getState().scene.plot) this.fitToPlan();
    }
    this.invalidate();
  }

  /** Screen box (page pixels) of the selected things on this plan; null when none of them is on this floor. */
  private selectionBox(): { x: number; y: number; w: number; h: number } | null {
    const st = editor.getState();
    const sc = st.scene;
    const pts: Vec2[] = [];
    for (const id of st.selection) {
      const it = sc.items[id];
      const a = it && getAsset(it.assetId);
      if (it && a && it.levelId === st.activeLevelId) pts.push(...itemFootprint(a, [it.position[0], it.position[2]], it.rotationY, it.scale));
      const s = sc.stairs[id];
      if (s && (s.fromLevel === st.activeLevelId || s.toLevel === st.activeLevelId)) pts.push(...(stairOutline(sc, s) ?? []));
      const b = sc.balconies[id];
      if (b && b.levelId === st.activeLevelId) pts.push(...b.outline);
      const z = sc.zones[id];
      if (z) pts.push(...zonePolygon(z));
      const w = sc.walls[id];
      if (w && w.levelId === st.activeLevelId) {
        const n1 = sc.nodes[w.a];
        const n2 = sc.nodes[w.b];
        if (n1 && n2) pts.push(n1.p, n2.p);
      }
      const o = sc.openings[id];
      const ow = o && sc.walls[o.wallId];
      if (o && ow && ow.levelId === st.activeLevelId) {
        const n1 = sc.nodes[ow.a];
        const n2 = sc.nodes[ow.b];
        if (n1 && n2) {
          const len = Math.hypot(n2.p[0] - n1.p[0], n2.p[1] - n1.p[1]) || 1;
          const t = o.offset / len;
          pts.push([n1.p[0] + (n2.p[0] - n1.p[0]) * t, n1.p[1] + (n2.p[1] - n1.p[1]) * t]);
        }
      }
    }
    if (pts.length === 0) return null;
    const r = this.canvas.getBoundingClientRect();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pts) {
      const sx = r.left + p[0] * this.view.scale + this.view.ox;
      const sy = r.top + p[1] * this.view.scale + this.view.oy;
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx);
      y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
    // Keep the box inside this pane (the bar must not float away when the object is panned off screen).
    x0 = Math.max(r.left, Math.min(r.right - 4, x0));
    x1 = Math.max(r.left + 4, Math.min(r.right, x1));
    y0 = Math.max(r.top + 60, Math.min(r.bottom - 120, y0));
    y1 = Math.max(y0 + 4, Math.min(r.bottom - 100, y1));
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  private publishAnchor(): void {
    const b = this.selectionBox();
    const cur = useAnchor.getState().box;
    const same = (!b && !cur) || (b && cur && Math.abs(b.x - cur.x) < 1 && Math.abs(b.y - cur.y) < 1 && Math.abs(b.w - cur.w) < 1 && Math.abs(b.h - cur.h) < 1);
    if (!same) useAnchor.getState().set(b);
  }

  private render(): void {
    this.publishAnchor();
    const st = editor.getState();
    const ui = useUi.getState();
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    drawPlan(this.ctx, {
      geom: levelGeometry(st.scene, st.activeLevelId),
      ghost: this.ghostBelow(),
      preview: this.preview,
      itemGhost: this.itemGhost,
      paintSides: highlightSides(st.scene, st.selection, ui.paintSide),
      units: st.scene.meta.units,
      pro: ui.pro,
      lengthInput: ui.lengthInput,
      rooms: levelRooms(st.scene, st.activeLevelId).map((r) => ({
        polygon: r.polygon,
        centroid: r.centroid,
        area: r.area,
        name: r.room?.name ?? 'Room',
        selected: !!r.room && st.selection.includes(r.room.id),
      })),
      walker: walkPose.getState().active ? walkPose.getState() : null,
      view: this.view,
      width: this.cssW,
      height: this.cssH,
      scene: st.scene,
      levelId: st.activeLevelId,
      selection: st.selection,
      tool: ui.tool,
      hover: this.hover,
      drawingFrom: ui.tool === 'wall' ? wallTool.last : null,
      roomGhost: this.roomGhostDraw(),
      zones: Object.values(st.scene.zones).map((z) => ({ polygon: zonePolygon(z), color: catalogMaterial(z.material.id).color, selected: st.selection.includes(z.id), path: z.shape === 'path' })),
      balconies: Object.values(st.scene.balconies)
        .filter((b) => b.levelId === st.activeLevelId)
        .map((b) => ({ outline: b.outline, railings: balconyRailings(st.scene, b.id), selected: st.selection.includes(b.id) })),
      stairs: [...this.stairDraws(), ...(this.stairGhost ? [this.stairGhost] : [])],
      plot: {
        boundary: st.scene.plot?.boundary ?? null,
        draft: isDraftTool() ? ui.plotDraft : null,
        outside: nodesOutsidePlot(st.scene).flatMap((id) => {
          const n = st.scene.nodes[id];
          return n && n.levelId === st.activeLevelId ? [n.p as Vec2] : [];
        }),
      },
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
      // Dragging a point onto a wall body would not join them (only drawing splits walls), so don't offer it.
      settings: exclude ? { ...ui.snap, walls: false } : ui.snap,
      gridStep: niceGridStep(this.view.scale),
      thresholdM: SNAP_PX / this.view.scale,
      from: ui.tool === 'wall' ? (wallTool.last ?? undefined) : isDraftTool() ? (ui.plotDraft[ui.plotDraft.length - 1] ?? undefined) : undefined,
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

  /** Wall pieces of the floor directly below the active one (for tracing). */
  private ghostBelow(): Vec2[][] {
    const st = editor.getState();
    const i = st.scene.levelOrder.indexOf(st.activeLevelId);
    const below = i > 0 ? st.scene.levelOrder[i - 1] : undefined;
    return below ? Object.values(levelGeometry(st.scene, below).pieces).flat() : [];
  }

  /** Ghost opening for the Door/Window tools at a screen position (null when no wall is near or it can't fit). */
  private previewAt(sx: number, sy: number): OpeningPreview | null {
    const tool = useUi.getState().tool;
    if (tool !== 'door' && tool !== 'window') return null;
    const st = editor.getState();
    const world = toWorld(this.view, sx, sy) as Vec2;
    const hit = nearestWallPoint(st.scene, st.activeLevelId, world, Math.max(0.35, 30 / this.view.scale));
    const wall = hit && st.scene.walls[hit.wallId];
    if (!hit || !wall) return null;
    const size = defaultSize(tool, wall);
    const offset = freeOffset(st.scene, hit.wallId, hit.offset, size.width);
    if (offset === null) return null;
    // Doors open toward the side the pointer is on.
    return { type: tool, wallId: hit.wallId, offset, width: size.width, swing: hit.side < 0 };
  }

  private hitOpening(sx: number, sy: number): Id | null {
    const st = editor.getState();
    const geom = levelGeometry(st.scene, st.activeLevelId);
    const [px, pz] = toWorld(this.view, sx, sy);
    let best: Id | null = null;
    let bestD = Infinity;
    for (const o of Object.values(st.scene.openings)) {
      const w = st.scene.walls[o.wallId];
      const fp = geom.footprints[o.wallId];
      if (!w || !fp || w.levelId !== st.activeLevelId) continue;
      const dx = px - fp.origin[0];
      const dz = pz - fp.origin[1];
      const along = dx * fp.dir[0] + dz * fp.dir[1];
      const perp = -dx * fp.dir[1] + dz * fp.dir[0];
      const reachAlong = o.width / 2 + 6 / this.view.scale;
      const reachPerp = Math.max(w.thickness / 2, 10 / this.view.scale);
      const d = Math.abs(along - o.offset);
      if (d <= reachAlong && Math.abs(perp) <= reachPerp && d < bestD) {
        best = o.id;
        bestD = d;
      }
    }
    return best;
  }

  /** Ghost of the catalog item being placed, snapped to the floor / a wall (null when it cannot go there). */
  private itemGhostAt(sx: number, sy: number): ItemGhost | null {
    const ui = useUi.getState();
    const asset = ui.placing ? getAsset(ui.placing) : undefined;
    if (ui.tool !== 'place' || !asset) return null;
    const st = editor.getState();
    const world = toWorld(this.view, sx, sy) as Vec2;
    const p = solvePlacement(st.scene, st.activeLevelId, asset, world, {
      rotationY: ui.placeRotation,
      snapWalls: ui.snap.walls,
      grid: ui.snap.grid ? 0.05 : 0,
    });
    return p && { assetId: asset.id, position: p.position, rotationY: p.rotationY, scale: [1, 1, 1] };
  }

  /** Topmost item under a screen point (later items are drawn on top). */
  private hitItem(sx: number, sy: number): Id | null {
    const st = editor.getState();
    const [px, pz] = toWorld(this.view, sx, sy);
    const margin = 4 / this.view.scale;
    let solid: Id | null = null;
    let flat: Id | null = null;
    for (const it of Object.values(st.scene.items)) {
      if (it.levelId !== st.activeLevelId) continue;
      const asset = getAsset(it.assetId);
      if (!asset || !pointInItem(asset, [it.position[0], it.position[2]], it.rotationY, it.scale, [px, pz], margin)) continue;
      if (asset.size[2] < 0.05) flat = it.id;
      else solid = it.id;
    }
    // A rug never hides the furniture standing on it.
    return solid ?? flat;
  }

  /** Room under a screen point (rooms are derived from wall loops; only those with an identity can be selected). */
  private hitRoom(sx: number, sy: number): Id | null {
    const st = editor.getState();
    const [px, pz] = toWorld(this.view, sx, sy);
    for (const r of levelRooms(st.scene, st.activeLevelId)) {
      if (r.room && pointInPolygon(px, pz, r.polygon)) return r.room.id;
    }
    return null;
  }

  /** Stairs that start or end on the active floor, as drawn on the plan. */
  private stairDraws(): StairDraw[] {
    const st = editor.getState();
    const out: StairDraw[] = [];
    for (const s of Object.values(st.scene.stairs)) {
      if (s.fromLevel !== st.activeLevelId && s.toLevel !== st.activeLevelId) continue;
      const layout = layoutOf(st.scene, s);
      if (!layout) continue;
      out.push({ layout, origin: [s.origin[0], s.origin[2]], rotationY: s.rotationY, selected: st.selection.includes(s.id), role: s.fromLevel === st.activeLevelId ? 'up' : 'down' });
    }
    return out;
  }

  private hitStair(sx: number, sy: number): Id | null {
    const st = editor.getState();
    const [px, pz] = toWorld(this.view, sx, sy);
    let hit: Id | null = null;
    for (const s of Object.values(st.scene.stairs)) {
      if (s.fromLevel !== st.activeLevelId && s.toLevel !== st.activeLevelId) continue;
      const o = stairOutline(st.scene, s);
      if (o && pointInPolygon(px, pz, o)) hit = s.id;
    }
    return hit;
  }

  private snapStairOrigin(sx: number, sy: number): Vec2 {
    const w = toWorld(this.view, sx, sy) as Vec2;
    const g = useUi.getState().snap.grid ? 0.05 : 0;
    return g ? [Math.round(w[0] / g) * g, Math.round(w[1] / g) * g] : w;
  }

  /** Pull stairs flush against nearby walls (when "Join onto walls" snapping is on). */
  private snapStairToWalls(origin: Vec2, layout: StairLayout, rotationY: number): Vec2 {
    if (!useUi.getState().snap.walls) return origin;
    const st = editor.getState();
    const [dx, dz] = snapStairToWalls(st.scene, st.activeLevelId, stairOutlineWorld(layout, origin, rotationY));
    return [origin[0] + dx, origin[1] + dz];
  }

  /** Where the ready-made room would go: centred on the pointer, on a 10 cm grid, edges pulled onto nearby walls. */
  private roomGhostAt(sx: number, sy: number): { center: Vec2 } | null {
    const ui = useUi.getState();
    const preset = ui.roomPreset ? getRoomPreset(ui.roomPreset) : undefined;
    if (ui.tool !== 'room' || !preset) return null;
    const st = editor.getState();
    const w = toWorld(this.view, sx, sy) as Vec2;
    let cx = Math.round(w[0] * 10) / 10;
    let cz = Math.round(w[1] * 10) / 10;
    const foot = presetFootprint(preset, [cx, cz], ui.roomQuarters);
    const xs = foot.map((p) => p[0]);
    const zs = foot.map((p) => p[1]);
    const edgesX = [Math.min(...xs), Math.max(...xs)];
    const edgesZ = [Math.min(...zs), Math.max(...zs)];
    const nodes = Object.values(st.scene.nodes).filter((n) => n.levelId === st.activeLevelId);
    const pull = (edges: number[], key: 0 | 1): number => {
      let best = 0;
      let bestD = 0.3;
      for (const e of edges) for (const n of nodes) {
        const dlt = n.p[key] - e;
        if (Math.abs(dlt) < bestD) {
          bestD = Math.abs(dlt);
          best = dlt;
        }
      }
      return best;
    };
    cx += pull(edgesX, 0);
    cz += pull(edgesZ, 1);
    return { center: [cx, cz] };
  }

  private roomGhostDraw(): { outline: Vec2[]; items: Vec2[][]; label: string; center: Vec2 } | null {
    const ui = useUi.getState();
    const preset = ui.roomPreset ? getRoomPreset(ui.roomPreset) : undefined;
    if (!this.roomGhost || !preset) return null;
    const c = this.roomGhost.center;
    const q = ui.roomQuarters;
    const items = layoutItems(preset).flatMap((it) => {
      const a = getAsset(it.asset);
      if (!a) return [];
      const t = turnOffset(it.pos, q);
      return [itemFootprint(a, [c[0] + t[0], c[1] + t[1]], it.rot + (q * Math.PI) / 2, [1, 1, 1])];
    });
    return { outline: presetFootprint(preset, c, q), items, label: preset.name, center: c };
  }

  /** Ghost of the stairs the next click would place. */
  private stairGhostAt(sx: number, sy: number): StairDraw | null {
    const ui = useUi.getState();
    if (ui.tool !== 'stair') return null;
    const st = editor.getState();
    const lv = st.scene.levels[st.activeLevelId];
    if (!lv) return null;
    const above = levelAbove(st.scene, st.activeLevelId);
    const rise = (above && stairRise(st.scene, { fromLevel: st.activeLevelId, toLevel: above })) || lv.height;
    const layout = stairLayout({ kind: ui.newStair.kind, width: ui.newStair.width, rise, mirror: ui.newStair.mirror });
    return {
      layout,
      origin: this.snapStairToWalls(this.snapStairOrigin(sx, sy), layout, ui.stairRotation),
      rotationY: ui.stairRotation,
      role: 'ghost',
    };
  }

  private hitBalcony(sx: number, sy: number): Id | null {
    const st = editor.getState();
    const [px, pz] = toWorld(this.view, sx, sy);
    let hit: Id | null = null;
    for (const b of Object.values(st.scene.balconies)) {
      if (b.levelId === st.activeLevelId && pointInPolygon(px, pz, b.outline)) hit = b.id;
    }
    return hit;
  }

  private hitZone(sx: number, sy: number): Id | null {
    const st = editor.getState();
    const [px, pz] = toWorld(this.view, sx, sy);
    let hit: Id | null = null;
    for (const z of Object.values(st.scene.zones)) if (pointInPolygon(px, pz, zonePolygon(z))) hit = z.id;
    return hit;
  }

  private selectedZoneIds(): Id[] {
    const st = editor.getState();
    return st.selection.filter((id) => st.scene.zones[id]);
  }

  private selectedBalconyIds(): Id[] {
    const st = editor.getState();
    return st.selection.filter((id) => st.scene.balconies[id]);
  }

  private selectedStairIds(): Id[] {
    const st = editor.getState();
    return st.selection.filter((id) => st.scene.stairs[id]);
  }

  /** Replace the selection, or toggle membership when Shift is held / "Add more" is on. */
  private pick(id: Id | null, additive: boolean): void {
    const cur = editor.getState().selection;
    if (id === null) {
      if (!additive) editor.select([]);
    } else if (additive) editor.select(cur.includes(id) ? cur.filter((i) => i !== id) : [...cur, id]);
    else editor.select([id]);
  }

  /** Place the next wall point `text` away from the last one, along the pointer's (snapped) direction. */
  private commitTypedLength(text: string): void {
    const ui = useUi.getState();
    const last = wallTool.last;
    const len = parseLength(text, defaultInputUnit(editor.getState().scene.meta.units));
    if (!last || len === null || len < 0.05 || len > 100) {
      ui.setLengthInput('');
      return;
    }
    const target = this.hover?.point;
    let dx = target ? target[0] - last[0] : 1;
    let dz = target ? target[1] - last[1] : 0;
    const n = Math.hypot(dx, dz);
    if (n < 1e-6) [dx, dz] = [1, 0];
    else [dx, dz] = [dx / n, dz / n];
    const to: Vec2 = [last[0] + dx * len, last[1] + dz * len];
    wallTool.click(to, 'none');
    ui.setDrawing(wallTool.last !== null);
    ui.setLengthInput('');
    this.invalidate();
  }

  private selectedItemIds(): Id[] {
    const st = editor.getState();
    return st.selection.filter((id) => st.scene.items[id]);
  }

  /** Put the stairs in the scene (adding a floor above first when there is none) and select them. */
  private placeStair(g: StairDraw): void {
    const st = editor.getState();
    const ui = useUi.getState();
    const before = new Set(Object.keys(st.scene.stairs));
    // Ready-made assembly: the floor above (if missing), the flight, the room round its top with a door, and optionally every floor up.
    editor.execute(
      addStairAssembly({
        fromLevel: st.activeLevelId,
        origin: g.origin,
        rotationY: g.rotationY,
        kind: ui.newStair.kind,
        width: ui.newStair.width,
        mirror: ui.newStair.mirror,
        hall: ui.newStair.hall,
        toTop: ui.newStair.toTop,
      }),
    );
    const added = Object.keys(editor.getState().scene.stairs).filter((id) => !before.has(id));
    if (added.length) {
      editor.select(added);
      ui.setTool('select');
    }
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
      if ((this.mode === 'dragNode' || this.mode === 'dragOpening' || this.mode === 'dragItem' || this.mode === 'dragStair' || this.mode === 'dragBalcony' || this.mode === 'dragZone') && editor.getState().inTransaction) editor.cancelTransaction();
      this.dragNodeId = null;
      this.dragOpeningId = null;
      this.dragItemId = null;
      this.dragStarted = false;
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

    if (e.button === 1 || e.button === 2 || this.spaceDown || useUi.getState().viewOnly) {
      this.mode = 'pan';
      return;
    }
    if (tool === 'wall' || tool === 'plot' || tool === 'balcony' || tool === 'garden') {
      this.mode = 'place';
      this.hover = this.snapAt(p.x, p.y);
    } else if (tool === 'door' || tool === 'window') {
      this.mode = 'placeOpening';
      this.preview = this.previewAt(p.x, p.y);
    } else if (tool === 'place') {
      this.mode = 'placeItem';
      this.itemGhost = this.itemGhostAt(p.x, p.y);
    } else if (tool === 'room') {
      this.mode = 'placeRoom';
      this.roomGhost = this.roomGhostAt(p.x, p.y);
    } else if (tool === 'stair') {
      this.mode = 'placeStair';
      this.stairGhost = this.stairGhostAt(p.x, p.y);
    } else {
      const nodeId = this.hitNode(p.x, p.y);
      const openingId = nodeId ? null : this.hitOpening(p.x, p.y);
      const itemId = nodeId || openingId ? null : this.hitItem(p.x, p.y);
      const stairId = nodeId || openingId || itemId ? null : this.hitStair(p.x, p.y);
      const balconyId = nodeId || openingId || itemId || stairId ? null : this.hitBalcony(p.x, p.y);
      const zoneId = nodeId || openingId || itemId || stairId || balconyId ? null : this.hitZone(p.x, p.y);
      if (nodeId) {
        this.mode = 'dragNode';
        this.dragNodeId = nodeId;
        editor.beginTransaction('Move wall point');
      } else if (openingId) {
        // The transaction only starts once the pointer really moves, so a plain tap just selects.
        this.mode = 'dragOpening';
        this.dragOpeningId = openingId;
        this.dragStarted = false;
      } else if (zoneId) {
        this.mode = 'dragZone';
        this.dragZoneId = zoneId;
        this.dragZoneLast = toWorld(this.view, p.x, p.y) as Vec2;
        this.dragStarted = false;
      } else if (balconyId) {
        const w = toWorld(this.view, p.x, p.y) as Vec2;
        this.mode = 'dragBalcony';
        this.dragBalconyId = balconyId;
        this.dragBalconyLast = w;
        this.dragStarted = false;
      } else if (stairId) {
        const s = editor.getState().scene.stairs[stairId]!;
        const w = toWorld(this.view, p.x, p.y);
        this.mode = 'dragStair';
        this.dragStairId = stairId;
        this.dragStarted = false;
        this.dragGrab = [w[0] - s.origin[0], w[1] - s.origin[2]];
      } else if (itemId) {
        const it = editor.getState().scene.items[itemId]!;
        const w = toWorld(this.view, p.x, p.y);
        this.mode = 'dragItem';
        this.dragItemId = itemId;
        this.dragStarted = false;
        this.dragGrab = [w[0] - it.position[0], w[1] - it.position[2]];
        this.dragBaseRotation = it.rotationY;
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
      const tool = useUi.getState().tool;
      if ((tool === 'wall' || tool === 'plot' || tool === 'balcony' || tool === 'garden') && e.pointerType === 'mouse') {
        this.hover = this.snapAt(p.x, p.y);
        this.invalidate();
      } else if ((tool === 'door' || tool === 'window') && e.pointerType === 'mouse') {
        this.preview = this.previewAt(p.x, p.y);
        this.invalidate();
      } else if (tool === 'place' && e.pointerType === 'mouse') {
        this.itemGhost = this.itemGhostAt(p.x, p.y);
        this.invalidate();
      } else if (tool === 'room' && e.pointerType === 'mouse') {
        this.roomGhost = this.roomGhostAt(p.x, p.y);
        this.invalidate();
      } else if (tool === 'stair' && e.pointerType === 'mouse') {
        this.stairGhost = this.stairGhostAt(p.x, p.y);
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
      case 'placeOpening':
        this.preview = this.previewAt(p.x, p.y);
        this.invalidate();
        break;
      case 'placeItem':
        this.itemGhost = this.itemGhostAt(p.x, p.y);
        this.invalidate();
        break;
      case 'placeStair':
        this.stairGhost = this.stairGhostAt(p.x, p.y);
        this.invalidate();
        break;
      case 'placeRoom':
        this.roomGhost = this.roomGhostAt(p.x, p.y);
        this.invalidate();
        break;
      case 'dragZone':
        if (this.dragZoneId && this.moved) {
          if (!this.dragStarted) {
            editor.beginTransaction('Move garden area');
            this.dragStarted = true;
          }
          const w = toWorld(this.view, p.x, p.y) as Vec2;
          editor.preview(translateZones([this.dragZoneId], w[0] - this.dragZoneLast[0], w[1] - this.dragZoneLast[1]));
          this.dragZoneLast = w;
        }
        break;
      case 'dragBalcony':
        if (this.dragBalconyId && this.moved) {
          if (!this.dragStarted) {
            editor.beginTransaction('Move balcony');
            this.dragStarted = true;
          }
          const w = toWorld(this.view, p.x, p.y) as Vec2;
          editor.preview(translateBalconies([this.dragBalconyId], w[0] - this.dragBalconyLast[0], w[1] - this.dragBalconyLast[1]));
          this.dragBalconyLast = w;
        }
        break;
      case 'dragStair':
        if (this.dragStairId && this.moved) {
          if (!this.dragStarted) {
            editor.beginTransaction('Move stairs');
            this.dragStarted = true;
          }
          const w = toWorld(this.view, p.x, p.y);
          const g = useUi.getState().snap.grid ? 0.05 : 0;
          const o: Vec2 = [w[0] - this.dragGrab[0], w[1] - this.dragGrab[1]];
          let origin: Vec2 = g ? [Math.round(o[0] / g) * g, Math.round(o[1] / g) * g] : o;
          const moving = editor.getState().scene.stairs[this.dragStairId];
          const layout = moving ? layoutOf(editor.getState().scene, moving) : null;
          if (moving && layout) origin = this.snapStairToWalls(origin, layout, moving.rotationY);
          editor.preview(updateStairs([this.dragStairId], { origin }));
        }
        break;
      case 'dragItem':
        if (this.dragItemId && this.moved) {
          const st = editor.getState();
          const it = st.scene.items[this.dragItemId];
          const asset = it && getAsset(it.assetId);
          if (!it || !asset) break;
          if (!this.dragStarted) {
            editor.beginTransaction('Move item');
            this.dragStarted = true;
          }
          const w = toWorld(this.view, p.x, p.y);
          const pl = solvePlacement(st.scene, it.levelId, asset, [w[0] - this.dragGrab[0], w[1] - this.dragGrab[1]], {
            rotationY: this.dragBaseRotation,
            scale: it.scale,
            snapWalls: useUi.getState().snap.walls,
            grid: useUi.getState().snap.grid ? 0.05 : 0,
          });
          if (pl) editor.preview(setItemTransform(it.id, { position: pl.position, rotationY: pl.rotationY }));
        }
        break;
      case 'dragNode':
        if (this.dragNodeId) {
          const s = this.snapAt(p.x, p.y, [this.dragNodeId]);
          this.hover = s;
          editor.preview(moveNode(this.dragNodeId, s.point));
        }
        break;
      case 'dragOpening':
        if (this.dragOpeningId && this.moved) {
          if (!this.dragStarted) {
            editor.beginTransaction('Move opening');
            this.dragStarted = true;
          }
          const st = editor.getState();
          const world = toWorld(this.view, p.x, p.y) as Vec2;
          const hit = nearestWallPoint(st.scene, st.activeLevelId, world, Math.max(0.6, 40 / this.view.scale));
          if (hit) editor.preview(moveOpening(this.dragOpeningId, hit.wallId, hit.offset));
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

    if (mode === 'place' && isDraftTool()) {
      const s = this.snapAt(p.x, p.y);
      const ui = useUi.getState();
      const first = ui.plotDraft[0];
      const pathTool = ui.tool === 'garden' && GARDEN_SURFACES.find((x) => x.id === ui.gardenSurface)?.shape === 'path';
      if (!pathTool && first && ui.plotDraft.length >= 3 && Math.hypot(s.point[0] - first[0], s.point[1] - first[1]) * this.view.scale < 14) finishPlot();
      else ui.setPlotDraft([...ui.plotDraft, s.point]);
      this.hover = e.pointerType === 'mouse' ? this.snapAt(p.x, p.y) : null;
    } else if (mode === 'place') {
      const s = this.snapAt(p.x, p.y);
      useUi.getState().setLengthInput('');
      wallTool.click(s.point, s.kind);
      useUi.getState().setDrawing(wallTool.last !== null);
      this.hover = e.pointerType === 'mouse' ? this.snapAt(p.x, p.y) : null;
    } else if (mode === 'placeOpening') {
      const pv = this.previewAt(p.x, p.y);
      if (pv) {
        editor.execute(addOpening({ wallId: pv.wallId, type: pv.type, offset: pv.offset, swing: pv.swing }));
      }
      this.preview = e.pointerType === 'mouse' ? this.previewAt(p.x, p.y) : null;
    } else if (mode === 'placeItem') {
      const g = this.itemGhostAt(p.x, p.y);
      if (g) editor.execute(addItem({ levelId: editor.getState().activeLevelId, assetId: g.assetId, position: g.position, rotationY: g.rotationY }));
      this.itemGhost = e.pointerType === 'mouse' ? this.itemGhostAt(p.x, p.y) : null;
    } else if (mode === 'placeRoom') {
      const g = this.roomGhostAt(p.x, p.y);
      const ui = useUi.getState();
      if (g && ui.roomPreset) editor.execute(placeRoomPreset({ levelId: editor.getState().activeLevelId, presetId: ui.roomPreset, center: g.center, quarters: ui.roomQuarters }));
      this.roomGhost = e.pointerType === 'mouse' ? this.roomGhostAt(p.x, p.y) : null;
    } else if (mode === 'placeStair') {
      const g = this.stairGhostAt(p.x, p.y);
      if (g) this.placeStair(g);
    } else if (mode === 'dragZone') {
      const id = this.dragZoneId;
      if (this.dragStarted) editor.commitTransaction();
      else if (id) this.pick(id, e.shiftKey || useUi.getState().additive);
      this.dragZoneId = null;
      this.dragStarted = false;
    } else if (mode === 'dragBalcony') {
      const id = this.dragBalconyId;
      if (this.dragStarted) editor.commitTransaction();
      else if (id) this.pick(id, e.shiftKey || useUi.getState().additive);
      this.dragBalconyId = null;
      this.dragStarted = false;
    } else if (mode === 'dragStair') {
      const id = this.dragStairId;
      if (this.dragStarted) editor.commitTransaction();
      else if (id) this.pick(id, e.shiftKey || useUi.getState().additive);
      this.dragStairId = null;
      this.dragStarted = false;
    } else if (mode === 'dragItem') {
      const id = this.dragItemId;
      if (this.dragStarted) editor.commitTransaction();
      else if (id) this.pick(id, e.shiftKey || useUi.getState().additive);
      this.dragItemId = null;
      this.dragStarted = false;
    } else if (mode === 'dragNode') {
      editor.commitTransaction();
      this.dragNodeId = null;
      this.hover = null;
    } else if (mode === 'dragOpening') {
      const id = this.dragOpeningId;
      if (this.dragStarted) editor.commitTransaction();
      else if (id) {
        this.pick(id, e.shiftKey || useUi.getState().additive);
      }
      this.dragOpeningId = null;
      this.dragStarted = false;
    } else if (mode === 'select' && !this.moved) {
      // Walls win over the room they bound; empty space clears.
      this.pick(this.hitWall(p.x, p.y) ?? this.hitRoom(p.x, p.y), e.shiftKey || useUi.getState().additive);
    } else if (mode === 'pan' && this.down.button === 2 && !this.moved) {
      // Right-click without dragging = finish the chain.
      if (useUi.getState().tool === 'wall') this.endChain();
    }
    this.invalidate();
  }

  private onCancel(e: PointerEvent): void {
    this.pointers.delete(e.pointerId);
    if ((this.mode === 'dragNode' || this.mode === 'dragOpening' || this.mode === 'dragItem') && editor.getState().inTransaction) editor.cancelTransaction();
    this.dragNodeId = null;
    this.dragOpeningId = null;
    this.dragItemId = null;
    this.dragStairId = null;
    this.dragBalconyId = null;
    this.dragZoneId = null;
    this.dragStarted = false;
    if (this.pointers.size === 0) this.mode = 'none';
    this.hover = null;
    this.preview = null;
    this.itemGhost = null;
    this.stairGhost = null;
    this.roomGhost = null;
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
    // Hand mode: the design is locked; only fitting the view is allowed.
    if (useUi.getState().viewOnly) {
      if (!(e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') this.fitToPlan();
      return;
    }
    // While walking, WASD & friends belong to the walker, not the tool shortcuts.
    if (useUi.getState().walk && !(e.ctrlKey || e.metaKey) && e.key !== 'Escape') return;

    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();

    // Exact wall length: while a wall is being drawn, typing a length and pressing Enter places the next
    // point that far along the current direction (e.g. 3.5  ·  350cm  ·  12'6").
    if (!mod && useUi.getState().tool === 'wall' && wallTool.last) {
      const ui = useUi.getState();
      const buf = ui.lengthInput;
      if (LENGTH_CHARS.test(e.key) || (buf !== '' && LENGTH_UNIT_CHARS.test(e.key))) {
        e.preventDefault();
        ui.setLengthInput(buf + e.key);
        this.invalidate();
        return;
      }
      if (buf !== '' && e.key === 'Backspace') {
        e.preventDefault();
        ui.setLengthInput(buf.slice(0, -1));
        this.invalidate();
        return;
      }
      if (buf !== '' && e.key === 'Escape') {
        ui.setLengthInput('');
        this.invalidate();
        return;
      }
      if (buf !== '' && e.key === 'Enter') {
        e.preventDefault();
        this.commitTypedLength(buf);
        return;
      }
    }

    if (mod && key === 'z') {
      e.preventDefault();
      if (e.shiftKey) editor.redo();
      else editor.undo();
    } else if (mod && key === 'a') {
      e.preventDefault();
      const st = editor.getState();
      editor.select(Object.values(st.scene.walls).filter((w) => w.levelId === st.activeLevelId).map((w) => w.id));
    } else if (mod && key === 'y') {
      e.preventDefault();
      editor.redo();
    } else if (e.key === 'Escape') {
      this.endChain();
      if (isDraftTool()) {
        if (useUi.getState().plotDraft.length) cancelPlot();
        else useUi.getState().setTool('select');
      }
      this.preview = null;
      this.itemGhost = null;
      if (useUi.getState().tool === 'place' || useUi.getState().tool === 'stair' || useUi.getState().tool === 'room') useUi.getState().setTool('select');
      editor.select([]);
    } else if (e.key === 'Enter') {
      if (useUi.getState().tool === 'wall') this.endChain();
      else if (isDraftTool()) finishPlot();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      deleteSelection();
    } else if (!mod && key === 'w') {
      useUi.getState().setTool('wall');
    } else if (mod && key === 'd') {
      e.preventDefault();
      const ids = this.selectedItemIds();
      const assets = ids.map((id) => editor.getState().scene.items[id]?.assetId ?? '');
      if (ids.length && requireAccess(assets, 'copy')) editor.execute(duplicateItems(ids));
    } else if (!mod && key === 'r') {
      // Turn the item being placed, or the selected items, by 90° (Shift = the other way).
      const delta = (e.shiftKey ? -1 : 1) * (Math.PI / 2);
      const ids = this.selectedItemIds();
      const stairIds = this.selectedStairIds();
      if (useUi.getState().tool === 'place') {
        useUi.getState().rotatePlacing(delta);
        this.itemGhost = null;
      } else if (useUi.getState().tool === 'room') {
        useUi.getState().turnRoom(e.shiftKey ? -1 : 1);
      } else if (useUi.getState().tool === 'stair') {
        useUi.getState().rotateStair(delta);
        this.stairGhost = null;
      } else if (ids.length) editor.execute(rotateItems(ids, delta));
      else if (stairIds.length) editor.execute(rotateStairs(stairIds, delta));
    } else if (!mod && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') && (this.selectedItemIds().length || this.selectedStairIds().length || this.selectedBalconyIds().length || this.selectedZoneIds().length)) {
      // Nudge selected furniture or stairs: 5 cm, Shift = 25 cm.
      e.preventDefault();
      const d = e.shiftKey ? 0.25 : 0.05;
      const dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0;
      const dz = e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0;
      if (this.selectedItemIds().length) editor.execute(translateItems(this.selectedItemIds(), dx, dz));
      else if (this.selectedStairIds().length) editor.execute(translateStairs(this.selectedStairIds(), dx, dz));
      else if (this.selectedBalconyIds().length) editor.execute(translateBalconies(this.selectedBalconyIds(), dx, dz));
      else editor.execute(translateZones(this.selectedZoneIds(), dx, dz));
    } else if (!mod && key === 'g') {
      useUi.getState().setTool('garden');
    } else if (!mod && key === 'b') {
      useUi.getState().setTool('balcony');
    } else if (!mod && key === 's') {
      useUi.getState().setTool('stair');
    } else if (!mod && key === 'v') {
      useUi.getState().setTool('select');
    } else if (!mod && key === 'd') {
      useUi.getState().setTool('door');
    } else if (!mod && key === 'n') {
      useUi.getState().setTool('window');
    } else if (!mod && key === 'f') {
      this.fitToPlan();
    }
  }
}

/** The wall-like tools that collect corner points (plot outline, balcony slab). */
function isDraftTool(): boolean {
  const t = useUi.getState().tool;
  return t === 'plot' || t === 'balcony' || t === 'garden';
}

export function deleteSelection(): void {
  const st = editor.getState();
  const sc = st.scene;
  const sel = st.selection;
  const cmds = [
    ...(sel.some((id) => sc.items[id]) ? [removeItems(sel.filter((id) => sc.items[id]))] : []),
    ...(sel.some((id) => sc.openings[id]) ? [removeOpenings(sel.filter((id) => sc.openings[id]))] : []),
    ...(sel.some((id) => sc.walls[id]) ? [removeWalls(sel.filter((id) => sc.walls[id]))] : []),
    ...(sel.some((id) => sc.stairs[id]) ? [removeStairs(sel.filter((id) => sc.stairs[id]))] : []),
    ...(sel.some((id) => sc.balconies[id]) ? [removeBalconies(sel.filter((id) => sc.balconies[id]))] : []),
    ...(sel.some((id) => sc.zones[id]) ? [removeZones(sel.filter((id) => sc.zones[id]))] : []),
    ...(sel.some((id) => sc.roofs[id]) ? [removeRoofs(sel.filter((id) => sc.roofs[id]))] : []),
  ];
  if (cmds.length) editor.execute(batch(cmds.length > 1 ? 'Delete' : cmds[0]!.label ?? 'Delete', cmds));
}
