import { create } from 'zustand';
import { createEmptyScene, type Vec2 } from '@hd/scene-schema';
import type { StairKind } from '@hd/geometry';
import { addBalcony, addZone, balconyProblem, GARDEN_SURFACES, zoneProblem, type GardenSurface, cleanPolygon, createEditor, createWallTool, DEFAULT_SNAP, plotProblem, setPlot, type SnapSettings } from '@hd/editor-core';

/** App-wide singletons for the editing session (one project open at a time). */
export const editor = createEditor(createEmptyScene());
export const wallTool = createWallTool(editor, () => useUi.getState().newWallKind);

export type ToolId = 'select' | 'wall' | 'door' | 'window' | 'place' | 'plot' | 'stair' | 'balcony' | 'garden';
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
  /** "Next step" tips (chosen on the welcome screen; can be hidden for good). */
  tipsOn: boolean;
  setTipsOn(on: boolean): void;
  /** Has the user walked through the home yet (finishes the tips). */
  hasWalked: boolean;
  helpOpen: boolean;
  setHelpOpen(open: boolean): void;
  /** Draw roofs in 3D (turn off to look into the house from above). */
  showRoof: boolean;
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
  setGardenSurface(s: GardenSurface): void;
  /** Which face of the selected walls paint swatches change; the plan highlights that side. */
  paintSide: 'both' | 'a' | 'b';
  setPaintSide(s: 'both' | 'a' | 'b'): void;
  setTool(t: ToolId): void;
  toggleSnap(k: 'grid' | 'nodes' | 'walls' | 'angle'): void;
  setDrawing(v: boolean): void;
  /** Settings of the stairs the Stairs tool places next. */
  newStair: { kind: StairKind; mirror: boolean; width: number };
  setNewStair(p: Partial<{ kind: StairKind; mirror: boolean; width: number }>): void;
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

export const useUi = create<UiState>((set) => ({
  showRoof: true,
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
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  placing: null,
  placeRotation: 0,
  furnitureOpen: false,
  setFurnitureOpen: (furnitureOpen) => set({ furnitureOpen }),
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
  setGardenSurface: (gardenSurface) => set({ gardenSurface }),
  setNewWallKind: (newWallKind) => set({ newWallKind }),
  paintSide: 'both',
  setPaintSide: (paintSide) => set({ paintSide }),
  additive: false,
  newStair: { kind: 'straight', mirror: false, width: 1 },
  setNewStair: (p) => set((s) => ({ newStair: { ...s.newStair, ...p } })),
  stairRotation: 0,
  rotateStair: (delta) => set((s) => ({ stairRotation: s.stairRotation + delta })),
  plotDraft: [],
  setPlotDraft: (plotDraft) => set({ plotDraft, plotError: null }),
  plotError: null,
  toggleAdditive: () => set((s) => ({ additive: !s.additive })),
}));

export function finishDrawing(): void {
  wallTool.finish();
  useUi.getState().setLengthInput('');
  useUi.getState().setDrawing(false);
}

/** Close the hand-drawn plot: validate, store it, and go back to selecting. */
export function finishPlot(): void {
  const ui = useUi.getState();
  const isPath = ui.tool === 'garden' && GARDEN_SURFACES.find((x) => x.id === ui.gardenSurface)?.shape === 'path';
  const pts = isPath ? ui.plotDraft.filter((p, i, a) => i === 0 || Math.hypot(p[0] - a[i - 1]![0], p[1] - a[i - 1]![1]) > 1e-3) : cleanPolygon(ui.plotDraft);
  if (pts.length === 0) {
    ui.setTool('select');
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
