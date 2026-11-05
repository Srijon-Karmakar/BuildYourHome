import { editor, useUi } from '../plan/session';
import { buildDemoScene } from '../plan/demo';
import { formatReport, type DeviceInfo } from './perfStats';
import { useBench, usePerf } from './qualityStore';

/** Starts the one-tap benchmark. An empty plan is replaced by the sample home so runs are comparable. */
export function startBenchmark(): void {
  const empty = Object.keys(editor.getState().scene.walls).length === 0;
  if (empty) editor.loadScene(buildDemoScene());
  const ui = useUi.getState();
  ui.setWalk(false);
  ui.setView('3d'); // full-size 3D pane so numbers are comparable between devices
  useBench.getState().begin(empty ? 'sample home' : 'your current plan');
}

export function deviceInfo(): DeviceInfo {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    userAgent: navigator.userAgent,
    screen: `${window.screen.width}x${window.screen.height}`,
    dpr: window.devicePixelRatio,
    cores: nav.hardwareConcurrency,
    memoryGb: nav.deviceMemory,
    gpu: usePerf.getState().gpu,
  };
}

export function benchReport(): string {
  const b = useBench.getState();
  return formatReport(deviceInfo(), b.results, b.sceneNote);
}

/** Copy text; falls back to a hidden textarea where the async clipboard API is unavailable (http on LAN). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}
