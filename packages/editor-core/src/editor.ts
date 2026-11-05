import { applyPatches, enablePatches, produceWithPatches, type Patch } from 'immer';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { Id, Scene } from '@hd/scene-schema';
import { postProcess } from './postProcess';
import type { Command, EditorState } from './types';

enablePatches();

const MAX_HISTORY = 200;

interface Entry {
  label: string;
  patches: Patch[];
  inverse: Patch[];
}

interface Transaction {
  label: string;
  patches: Patch[];
  /** Inverse patch lists in application order; undo applies them in reverse. */
  inverses: Patch[][];
}

export interface Editor {
  store: StoreApi<EditorState>;
  getState(): EditorState;
  subscribe: StoreApi<EditorState>['subscribe'];
  /** Apply a command as one undoable step. Returns false if it changed nothing. */
  execute(cmd: Command): boolean;
  /** Gesture support: many live previews collapse into ONE history entry on commit. */
  beginTransaction(label: string): void;
  preview(cmd: Command): void;
  commitTransaction(): boolean;
  cancelTransaction(): void;
  undo(): boolean;
  redo(): boolean;
  /** Replace the whole scene (load/new project). Clears history. */
  loadScene(scene: Scene): void;
  select(ids: Id[]): void;
  setActiveLevel(id: Id): void;
}

function exists(scene: Scene, id: Id): boolean {
  return Boolean(
    scene.walls[id] ??
      scene.nodes[id] ??
      scene.openings[id] ??
      scene.rooms[id] ??
      scene.items[id] ??
      scene.roofs[id] ??
      scene.stairs[id],
  );
}

export function createEditor(initial: Scene): Editor {
  let past: Entry[] = [];
  let future: Entry[] = [];
  let tx: Transaction | null = null;

  const firstLevel = initial.levelOrder[0];
  if (!firstLevel) throw new Error('Scene must have at least one level');

  const store = createStore<EditorState>(() => ({
    scene: initial,
    activeLevelId: firstLevel,
    selection: [],
    canUndo: false,
    canRedo: false,
    inTransaction: false,
  }));

  /** Single place that updates derived flags and keeps selection/active level valid. */
  function commit(scene: Scene): void {
    const s = store.getState();
    const selection = s.selection.filter((id) => exists(scene, id));
    const activeLevelId = scene.levels[s.activeLevelId] ? s.activeLevelId : (scene.levelOrder[0] ?? s.activeLevelId);
    store.setState({
      scene,
      selection: selection.length === s.selection.length ? s.selection : selection,
      activeLevelId,
      canUndo: past.length > 0,
      canRedo: future.length > 0,
      inTransaction: tx !== null,
    });
  }

  function run(cmd: Command): readonly [Scene, Patch[], Patch[]] {
    return produceWithPatches(store.getState().scene, (draft) => {
      cmd.apply(draft);
      postProcess(draft);
    });
  }

  function pushHistory(e: Entry): void {
    past.push(e);
    if (past.length > MAX_HISTORY) past.shift();
    future = [];
  }

  return {
    store,
    getState: store.getState,
    subscribe: store.subscribe,

    execute(cmd) {
      if (tx) throw new Error('execute() during a transaction; use preview()');
      const [next, patches, inverse] = run(cmd);
      if (patches.length === 0) return false;
      pushHistory({ label: cmd.label, patches, inverse });
      commit(next);
      return true;
    },

    beginTransaction(label) {
      if (tx) throw new Error('Transaction already open');
      tx = { label, patches: [], inverses: [] };
      commit(store.getState().scene);
    },

    preview(cmd) {
      if (!tx) throw new Error('preview() requires beginTransaction()');
      const [next, patches, inverse] = run(cmd);
      if (patches.length === 0) return;
      tx.patches.push(...patches);
      tx.inverses.push(inverse);
      commit(next);
    },

    commitTransaction() {
      if (!tx) throw new Error('No open transaction');
      const t = tx;
      tx = null;
      if (t.patches.length === 0) {
        commit(store.getState().scene);
        return false;
      }
      const inverse = t.inverses.reverse().flat();
      pushHistory({ label: t.label, patches: t.patches, inverse });
      commit(store.getState().scene);
      return true;
    },

    cancelTransaction() {
      if (!tx) return;
      const t = tx;
      tx = null;
      let scene = store.getState().scene;
      for (const inv of t.inverses.reverse()) scene = applyPatches(scene, inv);
      commit(scene);
    },

    undo() {
      if (tx) return false;
      const e = past.pop();
      if (!e) return false;
      future.push(e);
      commit(applyPatches(store.getState().scene, e.inverse));
      return true;
    },

    redo() {
      if (tx) return false;
      const e = future.pop();
      if (!e) return false;
      past.push(e);
      commit(applyPatches(store.getState().scene, e.patches));
      return true;
    },

    loadScene(scene) {
      past = [];
      future = [];
      tx = null;
      const lvl = scene.levelOrder[0];
      if (!lvl) throw new Error('Scene must have at least one level');
      store.setState({
        scene,
        activeLevelId: lvl,
        selection: [],
        canUndo: false,
        canRedo: false,
        inTransaction: false,
      });
    },

    select(ids) {
      store.setState({ selection: ids.filter((id) => exists(store.getState().scene, id)) });
    },

    setActiveLevel(id) {
      if (store.getState().scene.levels[id]) store.setState({ activeLevelId: id });
    },
  };
}
