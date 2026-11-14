import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { editor, useUi } from '../plan/session';

/**
 * Inside the Android / iOS app only (ADR-037): the Back button, the status bar colours and the native launch screen.
 * In a browser `isNative()` is false and nothing here runs.
 */

export const isNative = (): boolean => Capacitor.isNativePlatform();

const PAPER = '#e6e4e0';
const DARK = '#131116';

/** What Esc could close or cancel; if this does not change after an Esc, there was nothing open. */
function openState(): string {
  const ui = useUi.getState();
  const overlays = document.querySelectorAll('.popover, .topbar-right.open, [role="dialog"], .sheet-backdrop, .fp, .tour').length;
  return JSON.stringify([
    overlays,
    ui.walk,
    ui.tool,
    ui.welcomeOpen,
    ui.samplesOpen,
    ui.helpOpen,
    ui.shareOpen,
    ui.envOpen,
    ui.tourStep,
    editor.getState().selection.length,
  ]);
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

/** Android Back: close the open sheet / card / mode / tool / selection first (the app's Esc); leave the app last. */
async function onBack(): Promise<void> {
  if (useUi.getState().curtain !== 'off') {
    void App.minimizeApp();
    return;
  }
  const before = openState();
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
  await nextFrame();
  if (openState() === before) void App.minimizeApp();
}

/** Status bar: the splash colours while the opening screen is up, then the paper theme of the workspace. */
function paintStatusBar(): void {
  const curtainUp = useUi.getState().curtain !== 'off';
  let darkSplash = true;
  try {
    darkSplash = localStorage.getItem('hd.splashTheme') !== 'light';
  } catch {
    /* storage blocked: default dark */
  }
  const dark = curtainUp && darkSplash;
  void StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
  if (Capacitor.getPlatform() === 'android') void StatusBar.setBackgroundColor({ color: dark ? DARK : PAPER }).catch(() => {});
}

/** Call once at start-up, before the first render. */
export function startNative(): void {
  if (!isNative()) return;
  document.documentElement.dataset.native = Capacitor.getPlatform();
  void App.addListener('backButton', () => void onBack());
  paintStatusBar();
  let curtain = useUi.getState().curtain;
  useUi.subscribe((s) => {
    if (s.curtain === curtain) return;
    curtain = s.curtain;
    paintStatusBar();
  });
  // The splash theme switch writes localStorage; repaint when it is flipped.
  window.addEventListener('storage', paintStatusBar);
  document.addEventListener('click', (e) => {
    if (e.target instanceof Element && e.target.closest('.curtain-theme')) setTimeout(paintStatusBar, 0);
  });
  // Hide the native launch screen once the web splash has painted (no blank flash in between).
  const hide = () => void nextFrame().then(() => SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {}));
  if (document.readyState === 'complete') hide();
  else window.addEventListener('load', hide, { once: true });
}
