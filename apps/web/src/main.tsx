import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { buildDemoScene } from './plan/demo';
import { editor, useUi, type ViewMode } from './plan/session';
import { startBenchmark } from './view3d/benchmark';
import { rememberPose, walkPose } from './walk/walkState';
import '@fontsource-variable/outfit';
import './styles.css';

// `?demo=1` opens a sample home (handy for demos and screenshots).
if (new URLSearchParams(window.location.search).has('demo')) editor.loadScene(buildDemoScene());

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
