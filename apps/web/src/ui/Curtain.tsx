import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useUi } from '../plan/session';
import { BrandLogo } from './BrandLogo';

/** Minimum time the loader is shown, so it reads as a calm intro rather than a flash. */
const LOAD_FULL_MS = 1500;
const LOAD_BRIEF_MS = 900;
/** Total length of the reveal (panels part, workspace settles). Keep in step with `.curtain.lifting` in styles.css. */
const LIFT_MS = 1600;
/** Date of the latest release, shown in the credits. */
const APP_UPDATED = '5 Nov 2026';

/**
 * Line art of a modern house: [css class, path, draw delay in s]. Every path draws itself (pathLength = 1), in the
 * order a person would sketch it: ground, volumes, roof slab, glazing, details, landscaping.
 */
const HOUSE: Array<[string, string, number]> = [
  ['ground', 'M6 170H354', 0.1],
  ['wall', 'M40 170V112H230V170', 0.3],
  ['wall', 'M104 112V62M286 112V62', 0.55],
  ['slab', 'M88 62H302V54H88Z', 0.8],
  ['wall', 'M112 54V46H146V54', 1.05], // roof lantern
  ['glass', 'M118 74H240V102H118Z', 1.15],
  ['glass', 'M148 74V102M178 74V102M208 74V102', 1.3],
  ['glass', 'M254 74H274V102H254Z', 1.3],
  ['glass', 'M56 124H134V162H56Z', 1.4],
  ['glass', 'M95 124V162', 1.5],
  ['door', 'M150 170V126H182V170', 1.55],
  ['door', 'M175 150V158', 1.7],
  ['slat', 'M196 124H222M196 132H222M196 140H222M196 148H222M196 156H222', 1.6],
  ['wall', 'M284 112V170M290 112V170', 1.5], // slim column under the cantilever
  ['wall', 'M240 112H300', 1.6], // balcony slab
  ['rail', 'M246 112V100M262 112V100M278 112V100M294 112V100M244 100H296', 1.75],
  ['step', 'M146 174H186M142 178H190', 1.85],
  ['tree', 'M20 170V146M20 150L12 142M20 156L28 148', 1.9],
  ['tree', 'M8 134a12 14 0 1 0 24 0a12 14 0 1 0 -24 0', 2.0],
  ['tree', 'M332 170V150M332 158L326 152', 2.0],
  ['tree', 'M322 140a10 12 0 1 0 20 0a10 12 0 1 0 -20 0', 2.1],
  ['sun', 'M318 30a14 14 0 1 0 28 0a14 14 0 1 0 -28 0', 2.2],
  ['sun', 'M332 8V12M332 48V52M310 30H306M358 30H354M316 14L319 17M348 46L345 43M348 14L345 17M316 46L319 43', 2.3],
];

function HouseArt() {
  return (
    <svg className="curtain-house" viewBox="0 0 360 184" aria-hidden="true">
      <rect className="house-glow" x="118" y="74" width="122" height="28" />
      <rect className="house-glow g2" x="56" y="124" width="78" height="38" />
      {HOUSE.map(([cls, d, delay], i) => (
        <path key={i} pathLength="1" d={d} className={cls} style={{ '--d': `${delay}s` } as CSSProperties} />
      ))}
    </svg>
  );
}

/**
 * Opening curtain: a clean paper-coloured screen where a modern house draws itself while the app settles, then a
 * "Start designing" button lifts the curtain into the editor: the content falls away, the two curtain halves part
 * up and down along a horizontal orange seam that opens from the button and the workspace settles in underneath (`html[data-reveal]` drives that in styles.css).
 * Respects reduced-motion (no drawing, quick fade).
 */
export function Curtain() {
  const mode = useUi((s) => s.curtain);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'lifting'>('loading');
  const root = useRef<HTMLDivElement>(null);
  const cta = useRef<HTMLButtonElement>(null);

  function lift() {
    if (phase === 'lifting') return;
    // The reveal opens horizontally from the button: the seam runs through its centre.
    const r = cta.current?.getBoundingClientRect();
    if (r && root.current) {
      root.current.style.setProperty('--seam-y', `${r.top + r.height / 2}px`);
      root.current.style.setProperty('--seam-x', `${r.left + r.width / 2}px`);
    }
    setPhase('lifting');
    document.documentElement.dataset.reveal = 'on';
    window.setTimeout(() => {
      delete document.documentElement.dataset.reveal;
      useUi.getState().setCurtain('off');
    }, LIFT_MS);
  }

  useEffect(() => {
    if (mode === 'off') return;
    const t = window.setTimeout(() => (mode === 'full' ? setPhase('ready') : lift()), mode === 'full' ? LOAD_FULL_MS : LOAD_BRIEF_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (phase !== 'ready') return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Enter') lift();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (mode === 'off') return null;
  return (
    <div ref={root} className={`curtain ${mode} ${phase}`} role="dialog" aria-modal="true" aria-label="Home Designer">
      <div className="curtain-panel t" aria-hidden="true" />
      <div className="curtain-panel b" aria-hidden="true" />
      <div className="curtain-seam" aria-hidden="true" />

      <div className="curtain-inner">
        <HouseArt />
        <h1 className="curtain-title">
          <BrandLogo className="large" />
        </h1>
        <p className="curtain-sub">Draw your home in 2D. Walk through it in 3D.</p>
        {mode === 'full' && (
          <button ref={cta} type="button" className="curtain-cta" disabled={phase !== 'ready'} onClick={lift} autoFocus>
            <span>Start designing</span>
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M4 10H15M10.5 5.5L15 10L10.5 14.5" />
            </svg>
          </button>
        )}
        <div className={`curtain-line${phase === 'loading' ? '' : ' done'}`} aria-hidden="true">
          <span />
        </div>
      </div>

      <footer className="curtain-credits">
        <p className="credit-main">
          Designed &amp; developed by <strong>Senevon Studio</strong>
        </p>
        <p className="credit-people">
          <span>Srijon Karmakar</span>
          <i aria-hidden="true" />
          <a className="credit-site" href="https://senevon.in" target="_blank" rel="noopener noreferrer">
            senevon.in
          </a>
        </p>
        <p className="credit-meta">
          <span>v{__APP_VERSION__}</span>
          <i aria-hidden="true" />
          <span>Updated {APP_UPDATED}</span>
          <i aria-hidden="true" />
          <span>© {APP_UPDATED.slice(-4)} Senevon Studio</span>
          <i aria-hidden="true" />
          <span>Proprietary licence · All rights reserved</span>
        </p>
      </footer>
    </div>
  );
}
