import { useEffect, useLayoutEffect, useState, type CSSProperties } from 'react';
import { useUi } from '../plan/session';

interface Step {
  /** CSS selector of the thing to point at; none = a centred card. */
  target?: string;
  title: string;
  text: string;
}

const STEPS: Step[] = [
  { title: 'Welcome to Home Designer', text: 'A quick look around: six short steps. You can skip any time.' },
  { target: '.rail button[title^="Draw walls"]', title: '1 · Draw walls', text: 'Pick Wall (W), click to place points, press Esc to finish. Close a loop and the room appears by itself. Type a length like 3.5 for exact sizes.' },
  { target: '.rail button[title^="Add doors"]', title: '2 · Add doors and windows', text: 'Choose Door (D) or Window (N), move over a wall and click. Select anything to change its size, colour or style.' },
  { target: '.rail button[title="Furniture catalog"]', title: '3 · Furnish it', text: 'Open the catalog, pick a piece and click to place it. R turns it. Items marked Premium or Watch ad unlock with an account or a short ad.' },
  { target: '.topbar [aria-label="View"]', title: '4 · See it in 3D', text: 'Switch between Plan, Split and 3D. In 3D you can click anything to select it and drag furniture along the floor.' },
  { target: '.topbar button[title^="Walk through"]', title: '5 · Walk through it', text: 'Step inside in first person: W A S D to move, drag to look, Esc to leave. Stairs take you between floors.' },
  { target: '.topbar button[title^="Name, ground"]', title: '6 · Save and share', text: 'Your home saves automatically in this browser. Home has file save, units and your plot. Sign in to keep homes in your account and share a link.' },
];

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const PAD = 6;

/** First-run coach marks pointing at the real controls. Esc or Skip ends it; Help › Replay the quick tour starts it again. */
export function Tour() {
  const step = useUi((s) => s.tourStep);
  const [box, setBox] = useState<Box | null>(null);
  const [tick, setTick] = useState(0);

  useLayoutEffect(() => {
    if (step === null) return;
    const sel = STEPS[step]?.target;
    const el = sel ? document.querySelector(sel) : null;
    const r = el?.getBoundingClientRect();
    setBox(r && r.width > 0 ? { x: r.left, y: r.top, w: r.width, h: r.height } : null);
  }, [step, tick]);

  useEffect(() => {
    if (step === null) return;
    const last = step === STEPS.length - 1;
    const goNext = () => (last ? end() : useUi.getState().setTourStep(step + 1));
    const goBack = () => step > 0 && useUi.getState().setTourStep(step - 1);
    const re = () => setTick((t) => t + 1);
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') end();
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goBack();
    };
    window.addEventListener('resize', re);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('resize', re);
      window.removeEventListener('keydown', key);
    };
  }, [step]);

  if (step === null) return null;
  const s = STEPS[step]!;
  const last = step === STEPS.length - 1;
  const next = () => (last ? end() : useUi.getState().setTourStep(step + 1));
  const back = () => step > 0 && useUi.getState().setTourStep(step - 1);

  // Card placement: beside / below / above the target, kept inside the window.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const CW = Math.min(320, vw - 24);
  let style: CSSProperties = { width: CW, left: (vw - CW) / 2, top: Math.max(12, vh / 2 - 100) };
  if (box) {
    const below = box.y + box.h / 2 < vh / 2;
    const beside = box.x + box.w < 140 && vw >= 700; // the left tool rail
    let left = beside ? box.x + box.w + PAD + 14 : box.x + box.w / 2 - CW / 2;
    left = Math.max(12, Math.min(vw - CW - 12, left));
    style = beside
      ? { width: CW, left, top: Math.max(12, Math.min(vh - 230, box.y + box.h / 2 - 70)) }
      : below
        ? { width: CW, left, top: box.y + box.h + PAD + 14 }
        : { width: CW, left, bottom: vh - box.y + PAD + 14 };
  }

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label="Quick tour">
      {box ? (
        <div className="tour-spot" style={{ left: box.x - PAD, top: box.y - PAD, width: box.w + 2 * PAD, height: box.h + 2 * PAD }} />
      ) : (
        <div className="tour-dim" />
      )}
      <div className="tour-card" style={style}>
        <h2>{s.title}</h2>
        <p>{s.text}</p>
        <div className="tour-foot">
          <div className="tour-dots" aria-hidden="true">
            {STEPS.map((_, i) => (
              <i key={i} className={i === step ? 'on' : ''} />
            ))}
          </div>
          <button type="button" className="pill small quiet" onClick={end}>
            Skip
          </button>
          {step > 0 && (
            <button type="button" className="pill small" onClick={back}>
              Back
            </button>
          )}
          <button type="button" className="pill small solid" onClick={next} autoFocus>
            {last ? 'Done' : step === 0 ? 'Start' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

function end(): void {
  try {
    localStorage.setItem('hd.toured', '1');
  } catch {
    /* ignore */
  }
  useUi.getState().setTourStep(null);
}
