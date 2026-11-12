import { useEffect, useRef, useState } from 'react';
import { PopClose } from './PopClose';
import { useUi } from '../plan/session';
import { IconSnap } from './icons';

const OPTIONS = [
  { key: 'grid', label: 'Grid', hint: 'Round to the grid' },
  { key: 'angle', label: 'Angles', hint: 'Straight, 45° and 90°' },
  { key: 'nodes', label: 'Points', hint: 'Stick to corners' },
  { key: 'walls', label: 'Walls', hint: 'Join onto walls' },
] as const;

/** Snap settings tucked behind one control — most users never need to open it. */
export function SnapMenu() {
  const [open, setOpen] = useState(false);
  const snap = useUi((s) => s.snap);
  const toggle = useUi((s) => s.toggleSnap);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div ref={root} style={{ position: 'relative' }}>
      <button
        type="button"
        className="tool"
        title="Snapping options"
        aria-pressed={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
      >
        <IconSnap />
        <span>Snap</span>
      </button>
      {open && (
        <div className="popover" role="group" aria-label="Snapping">
          <PopClose onClick={() => setOpen(false)} />
          <h4>Snap to</h4>
          {OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              role="switch"
              aria-checked={snap[o.key]}
              className="switch-row"
              onClick={() => toggle(o.key)}
            >
              <div>
                {o.label}
                <small>{o.hint}</small>
              </div>
              <div className="switch" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
