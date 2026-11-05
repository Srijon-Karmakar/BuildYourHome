import { create } from 'zustand';
import { createEmptyScene } from '@hd/scene-schema';
import { createEditor, createWallTool, DEFAULT_SNAP, type SnapSettings } from '@hd/editor-core';

/** App-wide singletons for the editing session (one project open at a time). */
export const editor = createEditor(createEmptyScene());
export const wallTool = createWallTool(editor, () => useUi.getState().newWallKind);

export type ToolId = 'select' | 'wall' | 'door' | 'window' | 'place';
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
  newWallKind: 'interior' | 'exterior';
  setNewWallKind(k: 'interior' | 'exterior'): void;
  /** Which face of the selected walls paint swatches change; the plan highlights that side. */
  paintSide: 'both' | 'a' | 'b';
  setPaintSide(s: 'both' | 'a' | 'b'): void;
  setTool(t: ToolId): void;
  toggleSnap(k: 'grid' | 'nodes' | 'walls' | 'angle'): void;
  setDrawing(v: boolean): void;
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
  setView: (view) => set(view === '2d' ? { view, walk: false } : { view }),
  bumpFit: () => set((s) => ({ fitTick: s.fitTick + 1 })),
  tool: 'wall',
  snap: DEFAULT_SNAP,
  drawing: false,
  setTool: (tool) => set({ tool }),
  toggleSnap: (k) => set((s) => ({ snap: { ...s.snap, [k]: !s.snap[k] } })),
  setDrawing: (drawing) => set({ drawing }),
  newWallKind: 'interior',
  setNewWallKind: (newWallKind) => set({ newWallKind }),
  paintSide: 'both',
  setPaintSide: (paintSide) => set({ paintSide }),
  additive: false,
  toggleAdditive: () => set((s) => ({ additive: !s.additive })),
}));

export function finishDrawing(): void {
  wallTool.finish();
  useUi.getState().setLengthInput('');
  useUi.getState().setDrawing(false);
}
