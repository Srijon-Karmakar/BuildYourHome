import type { HiddenLayers, LayerId } from '../view3d/layers';
import { create } from 'zustand';
import { createEmptyScene, type Vec2 } from '@hd/scene-schema';
import type { StairKind } from '@hd/geometry';
import { type RoadPresetId, roadStyleFor, setAutoRoofs, setRoof, addBalcony, addZone, balconyProblem, GARDEN_SURFACES, zoneProblem, type GardenSurface, cleanPolygon, createEditor, createWallTool, DEFAULT_SNAP, plotProblem, setPlot, type SnapSettings } from '@hd/editor-core';

/** App-wide singletons for the editing session (one project open at a time). */
export const editor = createEditor(createEmptyScene());
export const wallTool = createWallTool(editor, () => useUi.getState().newWallKind);

export type ToolId = 'select' | 'wall' | 'door' | 'window' | 'place' | 'plot' | 'stair' | 'balcony' | 'garden' | 'road' | 'room';
export type ViewMode = '2d' | '3d' | 'split';
export type { FloorView } from '../view3d/floors';

const wide = typeof window !== 'undefined' && window.matchMedia('(min-width: 900px)').matches;

interface UiState {
  /** Pro tools: overall dimensions, room width x depth, all wall lengths. Remembered. */
  pro: boolean;
  setPro(on: boolean): void;
  /** Characters typed while drawing a wall (an exact length, e.g. 3.5 or 12'6"). */
  lengthInput: string;
  setLengthInput(s: string): void;
  /** Opening curtain: full (first visit, with button), brief (returning) or off. */
  curtain: 'full' | 'brief' | 'off';
  setCurtain(c: 'full' | 'brief' | 'off'): void;
  /** Quick tour: current step, or null when not running. */
  tourStep: number | null;
  setTourStep(s: number | null): void;
  /** The tour starts after the chooser only when the curtain introduced this session (or ?tour=1). */
  tourPending: boolean;
  setTourPending(p: boolean): void;
  /** First-run welcome / "New home" chooser. */
  welcomeOpen: boolean;
  setWelcomeOpen(open: boolean): void;
  samplesOpen: boolean;
  setSamplesOpen(open: boolean): void;
  /** "Next step" tips (chosen on the welcome screen; can be hidden for good). */
  tipsOn: boolean;
  setTipsOn(on: boolean): void;
  /** Has the user walked through the home yet (finishes the tips). */
  hasWalked: boolean;
  helpOpen: boolean;
  shareOpen: boolean;
  setShareOpen(open: boolean): void;
  setHelpOpen(open: boolean): void;
  /** Lamps: on when it gets dark (auto), always on, or off. Remembered. */
  lights: 'auto' | 'on' | 'off';
  setLights(m: 'auto' | 'on' | 'off'): void;
  /** Grass tufts, pebbles, leaves and puddles on the ground in 3D. Remembered. */
  groundDetail: boolean;
  setGroundDetail(on: boolean): void;
  /** Draw roofs in 3D (turn off to look into the house from above). */
  showRoof: boolean;
  /** 3D layers the user switched off (see view3d/layers). */
  hiddenLayers: HiddenLayers;
  /** Walk mode: field of view (degrees, vertical) and eye height (metres); remembered between visits. */
  walkFov: number;
  walkEye: number;
  setWalkFov(v: number): void;
  setWalkEye(v: number): void;
  toggleLayer(id: LayerId): void;
  resetLayers(): void;
  toggleRoof(): void;
  /** Catalog item being placed (tool === 'place'). */
  placing: string | null;
  /** Rotation (radians) applied to the next placed item when it is not snapped to a wall. */
  placeRotation: number;
  furnitureOpen: boolean;
  setFurnitureOpen(open: boolean): void;
  /** Pick an item from the catalog: closes the panel and switches to placement. */
  startPlacing(assetId: string): void;
  rotatePlacing(delta: number): void;
  /** Which floors the 3D view draws. */
  floorView: import('../view3d/floors').FloorView;
  setFloorView(v: import('../view3d/floors').FloorView): void;
  /** Cut the current floor's walls low and hide floors above, to look into the rooms from above. */
  cutaway: boolean;
  toggleCutaway(): void;
  view: ViewMode;
  /** First-person walkthrough active (3D pane only). */
  walk: boolean;
  setWalk(on: boolean): void;
  /** Bumped by "Fit" so the 3D camera can re-frame the plan. */
  fitTick: number;
  setView(v: ViewMode): void;
  bumpFit(): void;
  tool: ToolId;
  snap: SnapSettings;
  /** True while a wall chain is in progress (drives the "Done" button). */
  drawing: boolean;
  /** Kind of the walls drawn next (outside walls are thicker by default). */
  newWallKind: 'interior' | 'exterior' | 'fence';
  setNewWallKind(k: 'interior' | 'exterior' | 'fence'): void;
  /** Surface the Garden tool lays next (lawn, paving, driveway, gravel, deck or a path). */
  gardenSurface: GardenSurface;
  /** The kind of road the Road tool draws next. */
  roadPreset: RoadPresetId;
  setRoadPreset(p: RoadPresetId): void;
  setGardenSurface(s: GardenSurface): void;
  /** Which face of the selected walls paint swatches change; the plan highlights that side. */
  paintSide: 'both' | 'interior' | 'exterior';
  setPaintSide(s: 'both' | 'interior' | 'exterior'): void;
  /** Ready-made rooms: panel open, the preset being placed and its turn (quarter-turns). */
  roomsOpen: boolean;
  setRoomsOpen(open: boolean): void;
  roomPreset: string | null;
  roomQuarters: number;
  startRoom(id: string): void;
  turnRoom(delta: number): void;
  /** Hand mode: the design is locked (view only); dragging moves the view and nothing can be changed. */
  viewOnly: boolean;
  setViewOnly(on: boolean): void;
  setTool(t: ToolId): void;
  toggleSnap(k: 'grid' | 'nodes' | 'walls' | 'angle'): void;
  setDrawing(v: boolean): void;
  /** Settings of the stairs the Stairs tool places next. */
  newStair: { kind: StairKind; mirror: boolean; width: number; hall: boolean; toTop: boolean };
  setNewStair(p: Partial<{ kind: StairKind; mirror: boolean; width: number; hall: boolean; toTop: boolean }>): void;
  /** Rotation (radians) of the stairs about to be placed. */
  stairRotation: number;
  rotateStair(delta: number): void;
  /** Corners of the plot being drawn by hand (tool === 'plot'). */
  plotDraft: Vec2[];
  setPlotDraft(p: Vec2[]): void;
  /** Why the last attempt to finish a plot failed. */
  plotError: string | null;
  /** "Add more": taps toggle items in/out of the selection (touch devices have no Shift key). */
  additive: boolean;
  toggleAdditive(): void;
}

function storedNumber(key: string, fallback: number, lo: number, hi: number): number {
  try {
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) && v >= lo && v <= hi && localStorage.getItem(key) !== null ? v : fallback;
  } catch {
    return fallback;
  }
}
function saveNumber(key: string, v: number, lo: number, hi: number): number {
  const n = Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));
  try {
    localStorage.setItem(key, String(n));
  } catch {
    /* ignore */
  }
  return n;
}

export const useUi = create<UiState>((set) => ({
  showRoof: true,
  walkFov: storedNumber('hd.walkFov', 80, 50, 110),
  walkEye: storedNumber('hd.walkEye', 1.65, 0.8, 2.1),
  setWalkFov: (v) => set({ walkFov: saveNumber('hd.walkFov', v, 50, 110) }),
  setWalkEye: (v) => set({ walkEye: saveNumber('hd.walkEye', v, 0.8, 2.1) }),
  hiddenLayers: {},
  toggleLayer: (id) => set((s) => ({ hiddenLayers: { ...s.hiddenLayers, [id]: !s.hiddenLayers[id] } })),
  resetLayers: () => set({ hiddenLayers: {}, showRoof: true }),
  lights: (() => {
    try {
      const v = localStorage.getItem('hd.lights');
      return v === 'on' || v === 'off' ? v : 'auto';
    } catch {
      return 'auto';
    }
  })(),
  setLights: (lights) => {
    try {
      localStorage.setItem('hd.lights', lights);
    } catch {
      /* ignore */
    }
    set({ lights });
  },
  groundDetail: (() => {
    try {
      return localStorage.getItem('hd.groundDetail') !== 'off';
    } catch {
      return true;
    }
  })(),
  setGroundDetail: (groundDetail) => {
    try {
      localStorage.setItem('hd.groundDetail', groundDetail ? 'on' : 'off');
    } catch {
      /* ignore */
    }
    set({ groundDetail });
  },
  toggleRoof: () => set((s) => ({ showRoof: !s.showRoof })),
  pro: (() => {
    try {
      return localStorage.getItem('hd.pro') === 'on';
    } catch {
      return false;
    }
  })(),
  setPro: (pro) => {
    try {
      localStorage.setItem('hd.pro', pro ? 'on' : 'off');
    } catch {
      /* ignore */
    }
    set({ pro });
  },
  lengthInput: '',
  setLengthInput: (lengthInput) => set({ lengthInput }),
  curtain: 'off',
  setCurtain: (curtain) => set({ curtain }),
  tourStep: null,
  setTourStep: (tourStep) => set({ tourStep }),
  tourPending: false,
  setTourPending: (tourPending) => set({ tourPending }),
  welcomeOpen: false,
  setWelcomeOpen: (welcomeOpen) => set({ welcomeOpen }),
  samplesOpen: false,
  setSamplesOpen: (samplesOpen) => set({ samplesOpen }),
  tipsOn: false,
  setTipsOn: (tipsOn) => {
    try {
      localStorage.setItem('hd.tips', tipsOn ? 'on' : 'off');
    } catch {
      /* ignore */
    }
    set({ tipsOn });
  },
  hasWalked: false,
  helpOpen: false,
  shareOpen: false,
  setShareOpen: (shareOpen) => set({ shareOpen }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  placing: null,
  placeRotation: 0,
  furnitureOpen: false,
  setFurnitureOpen: (furnitureOpen) => set(furnitureOpen ? { furnitureOpen, roomsOpen: false } : { furnitureOpen }),
  startPlacing: (assetId) => set({ placing: assetId, tool: 'place', furnitureOpen: false, placeRotation: 0 }),
  rotatePlacing: (delta) => set((s) => ({ placeRotation: s.placeRotation + delta })),
  floorView: 'all',
  setFloorView: (floorView) => set({ floorView }),
  cutaway: false,
  toggleCutaway: () => set((s) => ({ cutaway: !s.cutaway })),
  view: wide ? 'split' : '2d',
  fitTick: 0,
  walk: false,
  setWalk: (on) =>
    set((s) => {
      if (!on) return { walk: false, fitTick: s.fitTick + 1 }; // re-frame the orbit camera after walking
      // Walking needs the 3D pane.
      return { walk: true, hasWalked: true, view: s.view === '2d' ? (wide ? 'split' : '3d') : s.view };
    }),
  // Drawing tools only work on the plan: in the 3D-only view you select and edit.
  setView: (view) => set(view === '2d' ? { view, walk: false } : view === '3d' ? { view, tool: 'select' } : { view }),
  bumpFit: () => set((s) => ({ fitTick: s.fitTick + 1 })),
  tool: 'wall',
  snap: DEFAULT_SNAP,
  drawing: false,
  setTool: (tool) => set({ tool }),
  toggleSnap: (k) => set((s) => ({ snap: { ...s.snap, [k]: !s.snap[k] } })),
  setDrawing: (drawing) => set({ drawing }),
  newWallKind: 'interior',
  gardenSurface: 'lawn',
  roadPreset: 'street',
  setRoadPreset: (roadPreset) => set({ roadPreset }),
  setGardenSurface: (gardenSurface) => set({ gardenSurface }),
  setNewWallKind: (newWallKind) => set({ newWallKind }),
  paintSide: 'both',
  viewOnly: false,
  roomsOpen: false,
  setRoomsOpen: (roomsOpen) => set(roomsOpen ? { roomsOpen, furnitureOpen: false } : { roomsOpen }),
  roomPreset: null,
  roomQuarters: 0,
  startRoom: (id) => set({ roomPreset: id, tool: 'room', roomsOpen: false, roomQuarters: 0 }),
  turnRoom: (delta) => set((s) => ({ roomQuarters: (((s.roomQuarters + delta) % 4) + 4) % 4 })),
  setViewOnly: (on) => {
    if (on) {
      wallTool.finish();
      editor.select([]);
      set({ viewOnly: true, tool: 'select', drawing: false, plotDraft: [], placing: null, furnitureOpen: false, lengthInput: '' });
    } else set({ viewOnly: false });
  },
  setPaintSide: (paintSide) => set({ paintSide }),
  additive: false,
  newStair: { kind: 'straight', mirror: false, width: 1, hall: true, toTop: false },
  setNewStair: (p) => set((s) => ({ newStair: { ...s.newStair, ...p } })),
  stairRotation: 0,
  rotateStair: (delta) => set((s) => ({ stairRotation: s.stairRotation + delta })),
  plotDraft: [],
  setPlotDraft: (plotDraft) => set({ plotDraft, plotError: null }),
  plotError: null,
  toggleAdditive: () => set((s) => ({ additive: !s.additive })),
}));

/**
 * The "Roof" button: make sure the top floor has its roofs (automatic ones follow the rooms; a floor that cannot get any
 * yet falls back to one roof over the whole floor), show them, and select them so the designer opens.
 */
export function addOrSelectRoof(): void {
  const sc = editor.getState().scene;
  const top = sc.levelOrder[sc.levelOrder.length - 1];
  if (!top) return;
  const onTop = () => Object.values(editor.getState().scene.roofs).filter((r) => r.levelId === top);
  if (onTop().length === 0) {
    editor.execute(setAutoRoofs(top, true));
    if (onTop().length === 0) editor.execute(setRoof(top, { style: 'gable' }));
  }
  useUi.setState({ showRoof: true, tool: 'select' });
  editor.setActiveLevel(top);
  editor.select(onTop().map((r) => r.id));
}

export function finishDrawing(): void {
  wallTool.finish();
  useUi.getState().setLengthInput('');
  useUi.getState().setDrawing(false);
}

/** Close the hand-drawn plot: validate, store it, and go back to selecting. */
export function finishPlot(): void {
  const ui = useUi.getState();
  const isPath = ui.tool === 'road' || (ui.tool === 'garden' && GARDEN_SURFACES.find((x) => x.id === ui.gardenSurface)?.shape === 'path');
  const pts = isPath ? ui.plotDraft.filter((p, i, a) => i === 0 || Math.hypot(p[0] - a[i - 1]![0], p[1] - a[i - 1]![1]) > 1e-3) : cleanPolygon(ui.plotDraft);
  if (pts.length === 0) {
    ui.setTool('select');
    return;
  }
  if (ui.tool === 'road') {
    const preset = roadStyleFor(ui.roadPreset);
    const bad = zoneProblem('road', pts, preset.width);
    if (bad) {
      useUi.setState({ plotError: bad });
      return;
    }
    const before = new Set(Object.keys(editor.getState().scene.zones));
    editor.execute(addZone({ shape: 'road', points: pts, material: { id: 'ground-asphalt' }, width: preset.width, road: preset.style }));
    const added = Object.keys(editor.getState().scene.zones).filter((id) => !before.has(id));
    useUi.setState({ plotDraft: [], plotError: null, tool: 'select' });
    if (added.length) editor.select(added);
    return;
  }
  if (ui.tool === 'garden') {
    const surf = GARDEN_SURFACES.find((x) => x.id === ui.gardenSurface)!;
    const bad = zoneProblem(surf.shape, pts);
    if (bad) {
      useUi.setState({ plotError: bad });
      return;
    }
    const before = new Set(Object.keys(editor.getState().scene.zones));
    editor.execute(addZone({ shape: surf.shape, points: pts, material: { id: surf.material } }));
    const added = Object.keys(editor.getState().scene.zones).filter((id) => !before.has(id));
    useUi.setState({ plotDraft: [], plotError: null, tool: 'select' });
    if (added.length) editor.select(added);
    return;
  }
  if (ui.tool === 'balcony') {
    const bad = balconyProblem(pts);
    if (bad) {
      useUi.setState({ plotError: bad });
      return;
    }
    const before = new Set(Object.keys(editor.getState().scene.balconies));
    editor.execute(addBalcony({ levelId: editor.getState().activeLevelId, outline: pts }));
    const added = Object.keys(editor.getState().scene.balconies).filter((id) => !before.has(id));
    useUi.setState({ plotDraft: [], plotError: null, tool: 'select' });
    if (added.length) editor.select(added);
    return;
  }
  const problem = plotProblem(pts);
  if (problem) {
    useUi.setState({ plotError: problem });
    return;
  }
  editor.execute(setPlot(pts));
  useUi.setState({ plotDraft: [], plotError: null, tool: 'select' });
}

export function cancelPlot(): void {
  useUi.setState({ plotDraft: [], plotError: null });
}
