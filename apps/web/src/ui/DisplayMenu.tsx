import { useEffect, useRef, useState } from 'react';
import { startBenchmark } from '../view3d/benchmark';
import type { QualitySetting } from '../view3d/qualityLogic';
import { useBench, useQuality } from '../view3d/qualityStore';

const LEVELS: Array<{ id: QualitySetting; label: string; hint: string }> = [
  { id: 'auto', label: 'Auto', hint: 'Adapts to your device' },
  { id: 'low', label: 'Low', hint: 'Fastest, simple lighting' },
  { id: 'medium', label: 'Medium', hint: 'Shadows and textures' },
  { id: 'high', label: 'High', hint: 'Most realistic' },
];

/** Display options: quality level + diagnostics (stats, benchmark). Kept in one quiet popover. */
export function DisplayMenu() {
  const [open, setOpen] = useState(false);
  const setting = useQuality((s) => s.setting);
  const setSetting = useQuality((s) => s.setSetting);
  const showStats = useQuality((s) => s.showStats);
  const toggleStats = useQuality((s) => s.toggleStats);
  const running = useBench((s) => s.phase === 'running');
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
    <div ref={root} className="menu-anchor">
      <button
        type="button"
        className="pill quiet"
        title="Quality and performance"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        Display
      </button>
      {open && (
        <div className="popover below" role="group" aria-label="Display">
          <h4>Quality</h4>
          {LEVELS.map((l) => (
            <button
              key={l.id}
              type="button"
              role="radio"
              aria-checked={setting === l.id}
              className="switch-row"
              onClick={() => setSetting(l.id)}
            >
              <div>
                {l.label}
                <small>{l.hint}</small>
              </div>
              <div className="radio" />
            </button>
          ))}

          <h4 style={{ marginTop: 12 }}>Diagnostics</h4>
          <button type="button" role="switch" aria-checked={showStats} className="switch-row" onClick={toggleStats}>
            <div>
              Show stats
              <small>Frame rate while you move</small>
            </div>
            <div className="switch" />
          </button>
          <button
            type="button"
            className="pill solid wide"
            disabled={running}
            onClick={() => {
              setOpen(false);
              startBenchmark();
            }}
          >
            {running ? 'Running…' : 'Run benchmark'}
          </button>
          <small className="fine">Orbits the home for about 20 seconds and reports frames per second.</small>
        </div>
      )}
    </div>
  );
}
