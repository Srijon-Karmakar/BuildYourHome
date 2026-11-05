import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { buildDemoScene } from './plan/demo';
import { editor, useUi, type ViewMode } from './plan/session';
import { loadLocal, startAutosave } from './lib/persistence';
import { startBenchmark } from './view3d/benchmark';
import { rememberPose, walkPose } from './walk/walkState';
import '@fontsource-variable/outfit';
import './styles.css';

const params = new URLSearchParams(window.location.search);
// `?demo=1` opens a sample home (handy for demos and screenshots) and `?bench=1` runs the benchmark; neither
// reads or writes the saved home, so a sample can never overwrite real work.
const ephemeral = params.has('demo') || params.has('bench') || params.has('fresh');
if (params.has('demo')) editor.loadScene(buildDemoScene());
else if (!ephemeral) {
  // Restore the autosaved home before the first paint (IndexedDB is fast; failures just start empty).
  const saved = await loadLocal();
  if (saved) editor.loadScene(saved);
}
if (!ephemeral || params.has('persist')) {
  const autosave = startAutosave(editor.subscribe, () => editor.getState().scene);
  // Don't lose the last second of work when the tab is hidden or closed.
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && void autosave.flush());
  window.addEventListener('pagehide', () => void autosave.flush());
}

// Test/demo flags: `?view=2d|split|3d`, `?walk=1`, `?bench=1` (auto-run the benchmark), `?perf=1` (live stats).
{
  const q = new URLSearchParams(window.location.search);
  const v = q.get('view');
  if (v === '2d' || v === 'split' || v === '3d') useUi.getState().setView(v as ViewMode);
  if (q.has('walk')) useUi.getState().setWalk(true);
  if (q.has('bench')) startBenchmark(); // open the link on a device to run the benchmark straight away
}

// Dev-only handle for automated browser tests (never shipped in production builds).
if (import.meta.env.DEV) (window as unknown as { __hd: unknown }).__hd = { editor, useUi, walkPose, rememberPose };

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
