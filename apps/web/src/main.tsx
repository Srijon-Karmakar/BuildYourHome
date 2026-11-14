import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { getBackend, SHARE_PATH_PARAM } from './cloud';
import { useCloud } from './cloud/store';
import { buildDemoScene } from './plan/demo';
import { editor, useUi, type ViewMode } from './plan/session';
import { loadLocal, registerLocalFlush, startAutosave } from './lib/persistence';
import { Viewer, ViewerGone } from './ui/Viewer';
import { startBenchmark } from './view3d/benchmark';
import { rememberPose, walkInput, walkPose } from './walk/walkState';
import { frameInfo, usePerf } from './view3d/qualityStore';
import { flyCameraTo, getCameraPose } from './view3d/cameraBridge';
import * as core from '@hd/editor-core';
import { SAMPLES } from './plan/samples';
import '@fontsource-variable/outfit';
import './styles.css';
import { startPwa } from './lib/pwa';
import { startNative } from './lib/native';

startPwa();
startNative();

const params = new URLSearchParams(window.location.search);

// Dev-only handle for automated browser tests (never shipped in production builds).
if (import.meta.env.DEV) (window as unknown as { __hd: unknown }).__hd = { editor, useUi, walkPose, rememberPose, useCloud, frameInfo, usePerf, core, samples: SAMPLES, walkInput, camera: { flyCameraTo, getCameraPose } };

function render(node: ReactNode): void {
  createRoot(document.getElementById('root')!).render(<StrictMode>{node}</StrictMode>);
}

/** A shared link (`?share=token`): read-only 3D viewer; never touches the visitor's own saved home. */
async function startViewer(token: string): Promise<void> {
  const scene = await (await getBackend()).getShared(token);
  if (!scene) return render(<ViewerGone />);
  editor.loadScene(scene);
  useUi.setState({ view: '3d' });
  render(<Viewer />);
}

async function startEditor(): Promise<void> {
  // `?demo=1` opens a sample home (handy for demos and screenshots) and `?bench=1` runs the benchmark; neither
  // reads or writes the saved home, so a sample can never overwrite real work.
  const ephemeral = params.has('demo') || params.has('bench') || params.has('fresh');
  if (params.has('demo')) editor.loadScene(buildDemoScene());
  else if (!ephemeral) {
    // Restore the autosaved home before the first paint (IndexedDB is fast; failures just start empty).
    const saved = await loadLocal();
    if (saved) editor.loadScene(saved);
  }

  // Greet first-time visitors with an empty home (never in test / demo links unless asked with ?welcome=1).
  {
    const testFlags = ['view', 'walk', 'perf', 'persist'].some((k) => params.has(k));
    let welcomed = false;
    let tips = false;
    try {
      welcomed = localStorage.getItem('hd.welcomed') === '1';
      tips = localStorage.getItem('hd.tips') === 'on';
    } catch {
      /* storage unavailable: treat as a first visit every time */
    }
    const empty = Object.keys(editor.getState().scene.walls).length === 0;
    if (params.has('welcome') || (!ephemeral && !testFlags && !welcomed && empty)) useUi.getState().setWelcomeOpen(true);
    else if (tips && !ephemeral) useUi.setState({ tipsOn: true });
  }

  if (!ephemeral || params.has('persist')) {
    const autosave = startAutosave(editor.subscribe, () => editor.getState().scene);
    registerLocalFlush(autosave.flush); // the top-bar Save button / Ctrl+S
    // Don't lose the last second of work when the tab is hidden or closed.
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && void autosave.flush());
    window.addEventListener('pagehide', () => void autosave.flush());
    // A home attached to an account is also synced to the cloud (quietly: the top bar tracks the local save).
    startAutosave(editor.subscribe, () => editor.getState().scene, (s) => useCloud.getState().syncScene(s), 2000, false);
  }

  // Test/demo flags: `?view=2d|split|3d`, `?walk=1`, `?bench=1` (auto-run the benchmark), `?perf=1` (live stats).
  const v = params.get('view');
  if (v === '2d' || v === 'split' || v === '3d') useUi.getState().setView(v as ViewMode);
  if (params.has('walk')) useUi.getState().setWalk(true);
  // Opening curtain: never in test / demo links (unless `?curtain=1`). Always the full splash with a button.
  {
    const plain = ['view', 'walk', 'perf', 'persist', 'demo', 'bench', 'fresh', 'welcome'].some((k) => params.has(k));
    let visited = false;
    let toured = false;
    // Development builds only: the browser tests switch the curtain off with this flag.
    let optOut = false;
    try {
      optOut = import.meta.env.DEV && localStorage.getItem('hd.nocurtain') === '1';
      visited = localStorage.getItem('hd.visited') === '1';
      toured = localStorage.getItem('hd.toured') === '1';
    } catch {
      /* treat as a first visit */
    }
    if (params.has('curtain') || (!plain && !optOut)) {
      // Always the full splash with the "Start designing" button (the workspace opens only after it is clicked).
      const first = params.get('curtain') === 'full' || !visited;
      useUi.setState({ curtain: 'full', tourPending: params.has('tour') || (first && !toured) });
      try {
        localStorage.setItem('hd.visited', '1');
      } catch {
        /* ignore */
      }
    }
  }
  if (params.has('bench')) startBenchmark(); // open the link on a device to run the benchmark straight away

  void useCloud.getState().init(); // account, saved homes and entitlements load in the background
  render(<App />);
}

const share = params.get(SHARE_PATH_PARAM);
if (share) await startViewer(share);
else await startEditor();
