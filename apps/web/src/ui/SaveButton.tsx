import { useEffect } from 'react';
import { create } from 'zustand';
import { editor } from '../plan/session';
import { useCloud } from '../cloud/store';
import { downloadSceneFile, saveLocalNow } from '../lib/persistence';

type Phase = 'idle' | 'saving' | 'done' | 'failed';
const useManualSave = create<{ phase: Phase; note: string }>(() => ({ phase: 'idle', note: '' }));
let resetTimer: number | undefined;

/**
 * Save right now (top-bar Save button / Ctrl+S). The home is autosaved anyway; this skips the wait and says where it
 * went: this device, plus the account when signed in. Links that never autosave (`?demo`, `?fresh`) download a file.
 */
export async function saveHomeNow(): Promise<boolean> {
  if (useManualSave.getState().phase === 'saving') return false;
  window.clearTimeout(resetTimer);
  useManualSave.setState({ phase: 'saving', note: '' });
  const scene = editor.getState().scene;
  const local = await saveLocalNow();
  const signedIn = !!useCloud.getState().session;
  const online = typeof navigator === 'undefined' || navigator.onLine !== false;
  const cloud = signedIn && online ? await useCloud.getState().saveNow() : null;
  let ok = local || cloud === true;
  let note: string;
  if (!ok && !signedIn) {
    downloadSceneFile(scene); // nowhere else to keep it: hand the user a file
    ok = true;
    note = 'Saved to your downloads';
  } else if (cloud === true) note = 'Saved to this device and your account';
  else if (cloud === false) note = local ? 'Saved on this device · account save failed' : 'Could not save — try Home › Save to file';
  else if (signedIn && !online) note = 'Offline · saved on this device, syncs when back online';
  else note = local ? 'Saved on this device' : 'Could not save — try Home › Save to file';
  useManualSave.setState({ phase: ok ? 'done' : 'failed', note });
  resetTimer = window.setTimeout(() => useManualSave.setState({ phase: 'idle' }), ok ? 1800 : 4000);
  return ok;
}

/** Ctrl/Cmd+S anywhere saves the home instead of the browser's "save page". Mount once. */
export function useSaveHotkey(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void saveHomeNow();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** One-tap Save pill (icon + label; icon only on phones). */
export function SaveButton() {
  const phase = useManualSave((s) => s.phase);
  const note = useManualSave((s) => s.note);
  const label = phase === 'saving' ? 'Saving…' : phase === 'done' ? 'Saved' : phase === 'failed' ? 'Not saved' : 'Save';
  return (
    <button
      type="button"
      className={`pill save-btn ${phase}`}
      title={phase === 'idle' || !note ? 'Save your home now (Ctrl+S). It is also saved automatically.' : note}
      aria-label={phase === 'idle' || !note ? 'Save' : note}
      aria-busy={phase === 'saving'}
      onClick={() => void saveHomeNow()}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true">
        {phase === 'done' ? (
          <path d="M4.5 10.5L8.5 14.5L15.5 6" />
        ) : (
          <path d="M4 4.5A1 1 0 0 1 5 3.5H13L16 6.5V15.5A1 1 0 0 1 15 16.5H5A1 1 0 0 1 4 15.5ZM7 3.5V7.5H12.5V3.5M6.5 16.5V11.5H13.5V16.5" />
        )}
      </svg>
      <span className="lbl">{label}</span>
    </button>
  );
}
