import { useEffect } from 'react';
import { useUi } from '../plan/session';
import { AdBanner } from './AdBanner';

const GROUPS: Array<{ title: string; rows: Array<[string, string]> }> = [
  {
    title: 'Drawing',
    rows: [
      ['W', 'Wall tool'],
      ['D', 'Door tool'],
      ['N', 'Window tool'],
      ['S', 'Stairs tool'],
      ['V', 'Select and move'],
      ['Esc', 'Finish / cancel'],
      ['Space + drag', 'Pan the plan'],
      ['Scroll / pinch', 'Zoom'],
      ['F', 'Fit the plan to the screen'],
    ],
  },
  {
    title: 'Editing',
    rows: [
      ['Ctrl + Z / Y', 'Undo / redo'],
      ['Delete', 'Delete the selection'],
      ['Shift + click', 'Add to the selection'],
      ['Ctrl + A', 'Select all walls'],
      ['R', 'Rotate furniture or stairs 90°'],
      ['Ctrl + D', 'Duplicate furniture'],
      ['Arrow keys', 'Nudge furniture or stairs 5 cm (Shift 25 cm)'],
    ],
  },
  {
    title: 'Walking',
    rows: [
      ['W A S D', 'Move'],
      ['Shift', 'Run'],
      ['Drag', 'Look around'],
      ['Esc', 'Exit walk mode'],
    ],
  },
  {
    title: 'Typing sizes',
    rows: [
      ['3.5', 'metres'],
      ['350cm', 'centimetres'],
      ['12\'6"', 'feet and inches'],
    ],
  },
];

/** Shortcuts and tips. Open with the ? key or Home › Help. */
export function Help() {
  const open = useUi((s) => s.helpOpen);
  const setOpen = useUi((s) => s.setHelpOpen);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === '?') setOpen(!useUi.getState().helpOpen);
      else if (e.key === 'Escape' && useUi.getState().helpOpen) setOpen(false);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [setOpen]);

  if (!open) return null;
  return (
    <div className="welcome" role="dialog" aria-modal="true" aria-labelledby="help-title" onPointerDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="welcome-card help">
        <header>
          <h1 id="help-title">Help &amp; shortcuts</h1>
          <button type="button" className="ins-close" aria-label="Close" onClick={() => setOpen(false)}>
            ×
          </button>
        </header>
        <div className="help-grid">
          {GROUPS.map((g) => (
            <section key={g.title}>
              <h4>{g.title}</h4>
              <dl>
                {g.rows.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        <AdBanner />
        <p className="welcome-sub">On a phone: tap to place, pinch to zoom, two fingers to pan, and drag with your left thumb to walk.</p>
      </div>
    </div>
  );
}
