import type { Id, Scene } from '@hd/scene-schema';

/**
 * A reversible edit. `apply` mutates an Immer draft of the scene; Immer records patches,
 * so undo/redo needs no hand-written inverse. Commands must be deterministic: generate
 * any ids when the command is CREATED, not inside `apply`.
 */
export interface Command {
  readonly type: string;
  readonly label: string;
  apply(draft: Scene): void;
}

export interface EditorState {
  scene: Scene;
  activeLevelId: Id;
  selection: Id[];
  canUndo: boolean;
  canRedo: boolean;
  inTransaction: boolean;
}
