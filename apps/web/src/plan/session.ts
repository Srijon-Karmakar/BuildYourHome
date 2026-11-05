import { create } from 'zustand';
import { createEmptyScene } from '@hd/scene-schema';
import { createEditor, createWallTool, DEFAULT_SNAP, type SnapSettings } from '@hd/editor-core';

/** App-wide singletons for the editing session (one project open at a time). */
export const editor = createEditor(createEmptyScene());
export const wallTool = createWallTool(editor);

export type ToolId = 'select' | 'wall';
export type ViewMode = '2d' | '3d' | 'split';

const wide = typeof window !== 'undefined' && window.matchMedia('(min-width: 900px)').matches;

interface UiState {
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
  setTool(t: ToolId): void;
  toggleSnap(k: 'grid' | 'nodes' | 'walls' | 'angle'): void;
  setDrawing(v: boolean): void;
}

export const useUi = create<UiState>((set) => ({
  view: wide ? 'split' : '2d',
  fitTick: 0,
  walk: false,
  setWalk: (on) =>
    set((s) => {
      if (!on) return { walk: false, fitTick: s.fitTick + 1 }; // re-frame the orbit camera after walking
      // Walking needs the 3D pane.
      return { walk: true, view: s.view === '2d' ? (wide ? 'split' : '3d') : s.view };
    }),
  setView: (view) => set(view === '2d' ? { view, walk: false } : { view }),
  bumpFit: () => set((s) => ({ fitTick: s.fitTick + 1 })),
  tool: 'wall',
  snap: DEFAULT_SNAP,
  drawing: false,
  setTool: (tool) => set({ tool }),
  toggleSnap: (k) => set((s) => ({ snap: { ...s.snap, [k]: !s.snap[k] } })),
  setDrawing: (drawing) => set({ drawing }),
}));

export function finishDrawing(): void {
  wallTool.finish();
  useUi.getState().setDrawing(false);
}
