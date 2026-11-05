import { useEffect, useState } from 'react';
import { useUi } from '../plan/session';

/** Minimum time the loader is shown, so it reads as a calm intro rather than a flash. */
const LOAD_FULL_MS = 1500;
const LOAD_BRIEF_MS = 900;
const LIFT_MS = 900;

/**
 * Opening curtain: a clean paper-coloured screen where a little house draws itself while the app settles, then a
 * "Start designing" button (first visit) lifts the curtain into the editor. Returning visitors get a brief loader
 * that lifts by itself. Respects reduced-motion (no drawing, quick fade).
 */
export function Curtain() {
  const mode = useUi((s) => s.curtain);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'lifting'>('loading');

  function lift() {
    setPhase('lifting');
    window.setTimeout(() => useUi.getState().setCurtain('off'), LIFT_MS);
  }

  useEffect(() => {
    if (mode === 'off') return;
    const t = window.setTimeout(() => (mode === 'full' ? setPhase('ready') : lift()), mode === 'full' ? LOAD_FULL_MS : LOAD_BRIEF_MS);
    return () => window.clearTimeout(t);
  }, [mode]);

  useEffect(() => {
    if (phase !== 'ready') return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Enter') lift();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [phase]);

  if (mode === 'off') return null;
  return (
    <div className={`curtain ${mode} ${phase}`} role="dialog" aria-modal="true" aria-label="Home Designer">
      <div className="curtain-inner">
        <svg className="curtain-house" viewBox="0 0 120 92" aria-hidden="true">
          <path pathLength="1" d="M16 82V42L60 10L104 42V82Z" className="c1" />
          <path pathLength="1" d="M10 44L60 6L110 44" className="c2" />
          <path pathLength="1" d="M50 82V58H70V82" className="c3" />
          <path pathLength="1" d="M26 52H40V66H26ZM80 52H94V66H80Z" className="c4" />
          <path pathLength="1" d="M4 82H116" className="c5" />
        </svg>
        <h1 className="curtain-title">Home Designer</h1>
        <p className="curtain-sub">Draw your home in 2D. Walk through it in 3D.</p>
        {mode === 'full' && (
          <button type="button" className="curtain-cta" disabled={phase !== 'ready'} onClick={lift} autoFocus>
            Start designing
          </button>
        )}
        <div className={`curtain-line${phase === 'loading' ? '' : ' done'}`} aria-hidden="true">
          <span />
        </div>
      </div>
    </div>
  );
}
