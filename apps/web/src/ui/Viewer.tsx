import { useUi } from '../plan/session';
import { Scene3D } from '../view3d/Scene3D';
import { WalkOverlay, WalkSettings } from '../walk/WalkOverlay';
import { useStore } from 'zustand';
import { editor } from '../plan/session';

/** Read-only page for a shared link: the 3D home, walkthrough, roof toggle — no editing tools. */
export function Viewer() {
  const walk = useUi((s) => s.walk);
  const setWalk = useUi((s) => s.setWalk);
  const showRoof = useUi((s) => s.showRoof);
  const toggleRoof = useUi((s) => s.toggleRoof);
  const bumpFit = useUi((s) => s.bumpFit);
  const name = useStore(editor.store, (s) => s.scene.meta.name);
  const hasRoof = useStore(editor.store, (s) => Object.keys(s.scene.roofs).length > 0);
  return (
    <div className="app panes-3d viewer">
      <div className="pane">
        <Scene3D />
        {walk && <WalkOverlay />}
            {walk && <WalkSettings />}
      </div>
      <header className="topbar">
        <div className="brand">
          <div className="wordmark">{name}</div>
          <small className="save-state">Shared · view only</small>
        </div>
        <div className="topbar-right">
          {hasRoof && (
            <button type="button" className="pill quiet" onClick={toggleRoof}>
              {showRoof ? 'Hide roof' : 'Show roof'}
            </button>
          )}
          <button type="button" className="pill quiet hide-phone" onClick={bumpFit}>
            Fit
          </button>
          <button type="button" className="pill" aria-pressed={walk} onClick={() => setWalk(!walk)}>
            {walk ? 'Exit walk' : 'Walk'}
          </button>
          <a className="pill solid" href={window.location.origin + window.location.pathname}>
            Design your own
          </a>
        </div>
      </header>
      <div className="bottom">
        <p className="caption">{walk ? 'W A S D to move · drag to look · Esc to exit' : 'Drag to look around · scroll or pinch to zoom'}</p>
      </div>
    </div>
  );
}

/** Shown when a share link is revoked, mistyped or the home was deleted. */
export function ViewerGone() {
  return (
    <div className="welcome" role="alert">
      <div className="welcome-card">
        <h1>This link isn’t available</h1>
        <p className="welcome-sub">The home may have been unshared or deleted. Ask the owner for a new link.</p>
        <a className="pill solid" href={window.location.origin + window.location.pathname}>
          Design your own home
        </a>
      </div>
    </div>
  );
}
