import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { editor, useUi } from '../plan/session';
import { startBenchmark } from '../view3d/benchmark';
import type { FloorView } from '../view3d/floors';
import { setTimeOfDay } from '@hd/editor-core';
import { hourLabel } from '../view3d/sun';
import type { QualitySetting } from '../view3d/qualityLogic';
import { useBench, useQuality } from '../view3d/qualityStore';

const LEVELS: Array<{ id: QualitySetting; label: string; hint: string }> = [
  { id: 'auto', label: 'Auto', hint: 'Adapts to your device' },
  { id: 'low', label: 'Low', hint: 'Fastest, simple lighting' },
  { id: 'medium', label: 'Medium', hint: 'Shadows and textures' },
  { id: 'high', label: 'High', hint: 'Most realistic' },
];

const FLOOR_VIEWS: Array<{ id: FloorView; label: string }> = [
  { id: 'all', label: 'All floors' },
  { id: 'below', label: 'This floor and below' },
  { id: 'single', label: 'This floor only' },
];

/** Display options: quality level + diagnostics (stats, benchmark). Kept in one quiet popover. */
export function DisplayMenu() {
  const [open, setOpen] = useState(false);
  const setting = useQuality((s) => s.setting);
  const setSetting = useQuality((s) => s.setSetting);
  const showStats = useQuality((s) => s.showStats);
  const toggleStats = useQuality((s) => s.toggleStats);
  const running = useBench((s) => s.phase === 'running');
  const floorView = useUi((s) => s.floorView);
  const setFloorView = useUi((s) => s.setFloorView);
  const levelCount = useStore(editor.store, (s) => s.scene.levelOrder.length);
  const hour = useStore(editor.store, (s) => s.scene.lighting.timeOfDay);
  const lights = useUi((s) => s.lights);
  const setLights = useUi((s) => s.setLights);
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

          <h4 style={{ marginTop: 12 }}>Time of day</h4>
          <div className="f-row" style={{ alignItems: 'center' }}>
            <input
              type="range"
              className="tod-range"
              aria-label="Time of day"
              min={0}
              max={24}
              step={0.25}
              value={hour}
              onChange={(e) => {
                if (!editor.getState().inTransaction) editor.beginTransaction('Change time of day');
                editor.preview(setTimeOfDay(Number(e.target.value)));
              }}
              onPointerUp={() => editor.getState().inTransaction && editor.commitTransaction()}
              onKeyUp={() => editor.getState().inTransaction && editor.commitTransaction()}
              onBlur={() => editor.getState().inTransaction && editor.commitTransaction()}
            />
            <small className="tod-label">{hourLabel(hour)}</small>
          </div>
          <div className="f-chips">
            {[
              ['Morning', 8],
              ['Noon', 12],
              ['Evening', 17.5],
              ['Night', 22],
            ].map(([label, h]) => (
              <button key={label} type="button" aria-pressed={Math.abs(hour - Number(h)) < 0.01} onClick={() => editor.execute(setTimeOfDay(Number(h)))}>
                {label}
              </button>
            ))}
          </div>

          <div className="f-chips" role="group" aria-label="Lamps">
            {([
              ['auto', 'Lamps: auto'],
              ['on', 'On'],
              ['off', 'Off'],
            ] as const).map(([id, label]) => (
              <button key={id} type="button" aria-pressed={lights === id} onClick={() => setLights(id)}>
                {label}
              </button>
            ))}
          </div>

          {levelCount > 1 && (
            <>
              <h4 style={{ marginTop: 12 }}>Floors shown in 3D</h4>
              {FLOOR_VIEWS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="radio"
                  aria-checked={floorView === f.id}
                  className="switch-row"
                  onClick={() => setFloorView(f.id)}
                >
                  <div>{f.label}</div>
                  <div className="radio" />
                </button>
              ))}
            </>
          )}

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
