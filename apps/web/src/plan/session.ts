import { create } from 'zustand';
import { createEmptyScene } from '@hd/scene-schema';
import { createEditor, createWallTool, DEFAULT_SNAP, type SnapSettings } from '@hd/editor-core';

/** App-wide singletons for the editing session (one project open at a time). */
export const editor = createEditor(createEmptyScene());
export const wallTool = createWallTool(editor);

export type ToolId = 'select' | 'wall';

interface UiState {
  tool: ToolId;
  snap: SnapSettings;
  /** True while a wall chain is in progress (drives the "Done" button). */
  drawing: boolean;
  setTool(t: ToolId): void;
  toggleSnap(k: 'grid' | 'nodes' | 'angle'): void;
  setDrawing(v: boolean): void;
}

export const useUi = create<UiState>((set) => ({
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
