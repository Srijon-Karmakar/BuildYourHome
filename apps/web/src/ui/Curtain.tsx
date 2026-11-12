import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useUi } from '../plan/session';
import { BrandLogo } from './BrandLogo';
import WebThreads from './WebThreads';

/** Minimum time the loader is shown, so it reads as a calm intro rather than a flash. */
const LOAD_FULL_MS = 1500;
const LOAD_BRIEF_MS = 900;
/** Total length of the reveal (button becomes a frame, frame grows, workspace settles). Keep in step with `.curtain.lifting` in styles.css. */
const LIFT_MS = 1950;
const TAGLINE = 'Draw your home in 2D. Walk through it in 3D.';
/** Date of the latest release, shown in the credits. */
const APP_UPDATED = '5 Nov 2026';
/** Where the splash's light / dark choice is remembered (this device only). */
const THEME_KEY = 'hd.splashTheme';
type SplashTheme = 'light' | 'dark';

function savedTheme(): SplashTheme {
  try {
    // Dark is the default; light only when the viewer picked it.
    return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

/** Thread settings per theme: dark = the glowing look; light = ink strokes, a little bolder so they read on paper. */
const THREADS: Record<SplashTheme, { lightMode: boolean; glow: number; thickness: number }> = {
  dark: { lightMode: false, glow: 0.011, thickness: 1.3 },
  light: { lightMode: true, glow: 0.016, thickness: 1.5 },
};

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
      <circle className="sun-glow" cx="332" cy="30" r="30" />
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
 * Opening curtain: a clean paper screen with a faint plan grid where a modern house sketches itself while the app
 * settles. "Start designing" then turns the orange button into a frame: it swells, hollows out into a window onto the
 * workspace and grows past the screen edges while the bars pop in (`html[data-reveal]` drives the workspace side in
 * styles.css). Reduced motion: no drawing, quick fade.
 */
export function Curtain() {
  const mode = useUi((s) => s.curtain);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'lifting'>('loading');
  const root = useRef<HTMLDivElement>(null);
  const cta = useRef<HTMLButtonElement>(null);
  const [theme, setTheme] = useState<SplashTheme>(savedTheme);
  const dark = theme === 'dark';

  function toggleTheme() {
    const next: SplashTheme = dark ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // private mode / blocked storage: the choice just isn't remembered
    }
  }

  function lift() {
    if (phase === 'lifting') return;
    // The frame starts exactly on the button (or a small box in the middle when there is none) and grows from there.
    const el = root.current;
    if (el) {
      const w = el.clientWidth;
      const h = el.clientHeight;
      const r = cta.current?.getBoundingClientRect();
      const box = r ?? { left: w / 2 - 70, top: h / 2 - 22, right: w / 2 + 70, bottom: h / 2 + 22 };
      el.style.setProperty('--fl', `${Math.round(box.left)}px`);
      el.style.setProperty('--ft', `${Math.round(box.top)}px`);
      el.style.setProperty('--fr', `${Math.round(w - box.right)}px`);
      el.style.setProperty('--fb', `${Math.round(h - box.bottom)}px`);
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
      // Enter on the theme switch toggles the theme (its own click), it must not also start the app.
      if (e.key === 'Enter' && !(e.target instanceof Element && e.target.closest('.curtain-theme'))) lift();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (mode === 'off') return null;
  return (
    <div
      ref={root}
      className={`curtain ${mode} ${phase}${dark ? ' theme-dark' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="PlotFramer"
    >
      <div className="curtain-frame" aria-hidden="true">
        <svg className="frame-line">
          <rect x="0" y="0" width="100%" height="100%" />
        </svg>
      </div>

      {/* Animated glowing threads (WebGL2) behind the content. Sits above the frame so it can fade out over the frame's
          paper ring when the reveal starts. */}
      <div className="curtain-waves" aria-hidden="true">
        <WebThreads
          colors={['#ff0000', '#ff6900']}
          coreColor="#FFFFFF"
          threadCount={7}
          spread={0.15}
          lightMode={THREADS[theme].lightMode}
          speed={0.2}
          frequency={4.2}
          taper={1}
          position={0.38}
          pinch={0.5}
          nodes={1}
          angle={-13}
          glow={THREADS[theme].glow}
          falloff={0.6}
          thickness={THREADS[theme].thickness}
          brightness={0.55}
          opacity={1}
          depth={0.78}
          pulses={0}
          mirror
          shimmer
          fade={0.51}
          grain={0.04}
          intro
          mouseInteraction
          mouseStrength={0.5}
          pulseOnClick
          paused={phase === 'lifting'}
        />
      </div>

      {mode === 'full' && (
        <button
          type="button"
          className="curtain-theme"
          onClick={toggleTheme}
          aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={dark ? 'Light mode' : 'Dark mode'}
        >
          {dark ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2.5V4.5M12 19.5V21.5M2.5 12H4.5M19.5 12H21.5M5.3 5.3L6.7 6.7M17.3 17.3L18.7 18.7M5.3 18.7L6.7 17.3M17.3 6.7L18.7 5.3" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />
            </svg>
          )}
        </button>
      )}

      <div className="curtain-inner">
        <HouseArt />
        <h1 className="curtain-title">
          <BrandLogo className="large" light={dark} />
        </h1>
        <p className="curtain-sub" aria-label={TAGLINE}>
          {TAGLINE.split(' ').map((word, i) => (
            <span key={i} className="w" aria-hidden="true" style={{ '--i': i } as CSSProperties}>
              {word}
            </span>
          ))}
        </p>
        <div className={`curtain-line${phase === 'loading' ? '' : ' done'}`} aria-hidden="true">
          <span />
        </div>
      </div>

      <footer className="curtain-credits">
        {mode === 'full' && (
          // Keycap: a dark well (.cta-cover) with a square key tilted back in 3D on top; it presses down when clicked.
          <div className="cta-key">
            <span className="cta-cover" aria-hidden="true" />
            <button
              type="button"
              ref={cta}
              className="curtain-cta"
              disabled={phase !== 'ready'}
              onClick={lift}
              aria-label="Start designing"
              title="Start designing"
              autoFocus
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M4.5 10H15.5M11 5.5L15.5 10L11 14.5" />
              </svg>
            </button>
          </div>
        )}
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
