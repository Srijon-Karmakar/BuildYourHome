import { create } from 'zustand';
import { loadScene, type Scene } from '@hd/scene-schema';

/**
 * Local persistence (FR-602, NFR-11): the current home is autosaved to IndexedDB shortly after every change and
 * restored on start; homes can also be saved to / opened from a `.homedesign.json` file.
 * Storage failures (private mode, quota) never break editing — the status just says so.
 */
const DB_NAME = 'home-designer';
const STORE = 'projects';
const KEY = 'current';
export const AUTOSAVE_DELAY_MS = 800;
export const MAX_FILE_BYTES = 8 * 1024 * 1024;

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
export const useSaveStatus = create<{ status: SaveStatus; at: number | null }>(() => ({ status: 'idle', at: null }));

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export const saveLocal = (scene: Scene): Promise<IDBValidKey> =>
  run('readwrite', (s) => s.put({ scene, savedAt: Date.now() }, KEY));

export const clearLocal = (): Promise<undefined> => run('readwrite', (s) => s.delete(KEY));

/** The autosaved home, or null when there is none / it is unreadable (never throws). */
export async function loadLocal(): Promise<Scene | null> {
  try {
    const rec = (await run('readonly', (s) => s.get(KEY))) as { scene?: unknown } | undefined;
    if (!rec?.scene) return null;
    const r = loadScene(rec.scene);
    return r.ok ? r.scene : null;
  } catch {
    return null;
  }
}

/** Parse a user-supplied file's text into a validated scene. */
export function parseSceneFile(text: string): { ok: true; scene: Scene } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file is not a valid PlotFramer file.' };
  }
  const r = loadScene(raw);
  return r.ok ? r : { ok: false, error: `Could not open this file: ${r.error}` };
}

export const serializeScene = (scene: Scene): string => JSON.stringify(scene, null, 1);

export function fileNameFor(scene: Scene): string {
  const stem = scene.meta.name.trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').toLowerCase();
  return `${stem || 'home'}.homedesign.json`;
}

/**
 * Debounced autosave of every scene change. `getScene` + `subscribe` are injected so this is testable.
 * Returns a disposer; `flush()` saves immediately (used when the tab is hidden).
 */
export function startAutosave(
  subscribe: (fn: () => void) => () => void,
  getScene: () => Scene,
  save: (s: Scene) => Promise<unknown> = saveLocal,
  delay = AUTOSAVE_DELAY_MS,
  /** The local autosave drives the top-bar "Saved" indicator; secondary ones (cloud sync) stay quiet. */
  reportStatus = true,
): { stop: () => void; flush: () => Promise<void> } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let last = getScene();
  const set = (status: SaveStatus) => reportStatus && useSaveStatus.setState({ status, at: status === 'saved' ? Date.now() : useSaveStatus.getState().at });

  const flush = async () => {
    clearTimeout(timer);
    timer = undefined;
    const scene = getScene();
    if (scene === last) return;
    last = scene;
    set('saving');
    try {
      await save({ ...scene, meta: { ...scene.meta, updatedAt: new Date().toISOString() } });
      set('saved');
    } catch {
      set('error');
    }
  };
  const unsub = subscribe(() => {
    if (getScene() === last) return;
    set('saving');
    clearTimeout(timer);
    timer = setTimeout(() => void flush(), delay);
  });
  return { stop: () => (clearTimeout(timer), unsub()), flush };
}

/** Download the home as a `.homedesign.json` file (Home › Save to file, and the Save button's fallback). */
export function downloadSceneFile(scene: Scene): void {
  const url = URL.createObjectURL(new Blob([serializeScene(scene)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileNameFor(scene);
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** The running local autosave's flush (set by main.tsx); null in ephemeral links (`?demo`, `?fresh`…). */
let localFlush: (() => Promise<void>) | null = null;
export const registerLocalFlush = (fn: (() => Promise<void>) | null): void => {
  localFlush = fn;
};

/**
 * Save button / Ctrl+S: write the home to this device right away (skipping the autosave delay).
 * Resolves true when the home is safely stored here (or nothing changed since the last save).
 */
export async function saveLocalNow(): Promise<boolean> {
  if (!localFlush) return false;
  await localFlush();
  return useSaveStatus.getState().status !== 'error';
}
