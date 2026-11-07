import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useUi } from '../plan/session';
import { BrandLogo } from './BrandLogo';

/** Minimum time the loader is shown, so it reads as a calm intro rather than a flash. */
const LOAD_FULL_MS = 1500;
const LOAD_BRIEF_MS = 900;
/** Total length of the reveal (frame grows, workspace settles). Keep in step with `.curtain.lifting` in styles.css. */
const LIFT_MS = 1950;
/** Space between the splash content and the orange frame drawn around it. */
const FRAME_PAD_X = 28;
const FRAME_PAD_Y = 24;
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
  [
    'sun',
    'M332 8V12M332 48V52M310 30H306M358 30H354M316 14L319 17M348 46L345 43M348 14L345 17M316 46L319 43',
    2.3,
  ],
];

function HouseArt() {
  return (
    <svg className="curtain-house" viewBox="0 0 360 184" aria-hidden="true">
      <rect className="house-glow" x="118" y="74" width="122" height="28" />
      <rect className="house-glow g2" x="56" y="124" width="78" height="38" />
      {HOUSE.map(([cls, d, delay], i) => (
        <path
          key={i}
          pathLength="1"
          d={d}
          className={cls}
          style={{ '--d': `${delay}s` } as CSSProperties}
        />
      ))}
    </svg>
  );
}

/**
 * Opening curtain: a paper-coloured screen where an orange frame (the PlotFramer mark) draws itself around a modern
 * house that sketches itself while the app settles. "Start designing" then grows that frame outward: it is a window
 * onto the workspace that expands until it passes the screen edges, and the bars pop in as it goes by
 * (`html[data-reveal]` drives the workspace side in styles.css). Reduced motion: no drawing, quick fade.
 */
export function Curtain() {
  const mode = useUi((s) => s.curtain);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'lifting'>('loading');
  const root = useRef<HTMLDivElement>(null);

  /** Place the frame around the splash content (house, logo, tagline, button). Sets --ft/--fr/--fb/--fl in px. */
  function fit() {
    const el = root.current;
    if (!el) return;
    const parts = el.querySelectorAll<HTMLElement>(
      '.curtain-house, .curtain-title, .curtain-sub, .curtain-cta',
    );
    if (!parts.length) return;
    let l = Infinity;
    let t = Infinity;
    let r = -Infinity;
    let b = -Infinity;
    parts.forEach((p) => {
      const q = p.getBoundingClientRect();
      l = Math.min(l, q.left);
      t = Math.min(t, q.top);
      r = Math.max(r, q.right);
      b = Math.max(b, q.bottom);
    });
    const w = el.clientWidth;
    const h = el.clientHeight;
    const px = (v: number) => `${Math.max(8, Math.round(v))}px`;
    el.style.setProperty('--fl', px(l - FRAME_PAD_X));
    el.style.setProperty('--ft', px(t - FRAME_PAD_Y));
    el.style.setProperty('--fr', px(w - r - FRAME_PAD_X));
    el.style.setProperty('--fb', px(h - b - FRAME_PAD_Y));
  }

  function lift() {
    if (phase === 'lifting') return;
    fit();
    setPhase('lifting');
    document.documentElement.dataset.reveal = 'on';
    window.setTimeout(() => {
      delete document.documentElement.dataset.reveal;
      useUi.getState().setCurtain('off');
    }, LIFT_MS);
  }

  useLayoutEffect(() => {
    if (mode === 'off') return;
    fit();
    const el = root.current;
    const ro = typeof ResizeObserver === 'function' && el ? new ResizeObserver(() => fit()) : null;
    if (el) ro?.observe(el);
    void document.fonts?.ready.then(fit);
    return () => ro?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (mode === 'off') return;
    const t = window.setTimeout(
      () => (mode === 'full' ? setPhase('ready') : lift()),
      mode === 'full' ? LOAD_FULL_MS : LOAD_BRIEF_MS,
    );
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
    <div
      ref={root}
      className={`curtain ${mode} ${phase}`}
      role="dialog"
      aria-modal="true"
      aria-label="PlotFramer"
    >
      <div className="curtain-frame" aria-hidden="true">
        <svg className="frame-line">
          <rect x="0" y="0" width="100%" height="100%" pathLength="1" />
        </svg>
      </div>

      <div className="curtain-inner">
        <HouseArt />
        <h1 className="curtain-title">
          <BrandLogo className="large" />
        </h1>
        <p className="curtain-sub">Draw your home in 2D. Walk through it in 3D.</p>
        {mode === 'full' && (
          <button
            type="button"
            className="curtain-cta"
            disabled={phase !== 'ready'}
            onClick={lift}
            autoFocus
          >
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
          <a
            className="credit-site"
            href="https://senevon.in"
            target="_blank"
            rel="noopener noreferrer"
          >
            senevon.in
          </a>
        </p>
        <p className="credit-meta">
          <span>v{__APP_VERSION__}</span>
          <i aria-hidden="true" />
          <span>Updated {APP_UPDATED}</span>
        </p>
        <p className="credit-legal">
          © {APP_UPDATED.slice(-4)} Senevon Studio · Proprietary licence · All rights reserved
        </p>
      </footer>
    </div>
  );
}
