import { useEffect, useRef, useState } from 'react';
import { activePlan } from '../plan/PlanCanvas';
import { useStore } from 'zustand';
import { setUnits } from '@hd/editor-core';
import { editor, useUi } from '../plan/session';
import { defaultInputUnit, parseLength as parseLen } from '../lib/units';
import { buildTemplate, QUICK_ROOM_MAX_M, QUICK_ROOM_MIN_M, type TemplateId } from '../plan/templates';
import { MAX_FILE_BYTES, parseSceneFile } from '../lib/persistence';
import { useCloud } from '../cloud/store';
import { AdBanner } from './AdBanner';

const store = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
};

/** Shows once, on a first visit with an empty home (and again after "New home"). */
export function Welcome() {
  const open = useUi((s) => s.welcomeOpen);
  const setOpen = useUi((s) => s.setWelcomeOpen);
  const [w, setW] = useState('4');
  const [d, setD] = useState('3.5');
  const [tips, setTips] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  const units = useStore(editor.store, (s) => s.scene.meta.units);

  useEffect(() => {
    if (!open) return;
    first.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && finish(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  function finish(start: boolean) {
    store('hd.welcomed', '1');
    useUi.getState().setTipsOn(start && tips);
    setOpen(false);
    const ui = useUi.getState();
    if (ui.tourPending) {
      ui.setTourPending(false);
      window.setTimeout(() => useUi.getState().setTourStep(0), 400);
    }
  }

  const begin = (id: TemplateId, opts?: { width: number; depth: number }) => {
    useCloud.getState().detach();
    const built = buildTemplate(id, opts);
    editor.loadScene({ ...built, meta: { ...built.meta, units } });
    finish(true);
    window.setTimeout(() => {
      activePlan?.fitToPlan();
      useUi.getState().bumpFit();
    }, 50);
  };

  const quickRoom = () => {
    const width = parseLen(w, defaultInputUnit(units));
    const depth = parseLen(d, defaultInputUnit(units));
    if (width === null || depth === null || width < QUICK_ROOM_MIN_M || depth < QUICK_ROOM_MIN_M || width > QUICK_ROOM_MAX_M || depth > QUICK_ROOM_MAX_M) {
      return setError(`Sizes must be between ${QUICK_ROOM_MIN_M} and ${QUICK_ROOM_MAX_M} m. You can type 4, 350cm or 12'6".`);
    }
    setError(null);
    begin('room', { width, depth });
  };

  const openFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) return setError('That file is too large to be a home.');
    const r = parseSceneFile(await f.text());
    if (!r.ok) return setError(r.error);
    editor.loadScene(r.scene);
    finish(false);
    window.setTimeout(() => activePlan?.fitToPlan(), 50);
  };

  return (
    <div className="welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="welcome-card">
        <h1 id="welcome-title">Let’s design your home</h1>
        <p className="welcome-sub">Start with a room, or pick a ready-made layout. You can change everything afterwards.</p>

        <div className="w-units" role="group" aria-label="Units">
          {(['m', 'ft'] as const).map((u) => (
            <button key={u} type="button" aria-pressed={units === u} onClick={() => editor.execute(setUnits(u))}>
              {u === 'm' ? 'Metres' : 'Feet & inches'}
            </button>
          ))}
        </div>

        <div className="w-grid">
          <section className="w-card wide">
            <h3>A single room</h3>
            <p>Tell us the size — we add the walls, a door and windows.</p>
            <div className="w-size">
              <label>
                Width
                <input value={w} onChange={(e) => setW(e.target.value)} inputMode="decimal" aria-label="Room width in metres" />
              </label>
              <span>×</span>
              <label>
                Depth
                <input value={d} onChange={(e) => setD(e.target.value)} inputMode="decimal" aria-label="Room depth in metres" />
              </label>
              <span className="unit">{units === 'ft' ? 'ft' : 'm'}</span>
              <button type="button" ref={first} className="pill solid" onClick={quickRoom}>
                Create room
              </button>
            </div>
          </section>

          <button type="button" className="w-card" onClick={() => begin('studio')}>
            <h3>Studio</h3>
            <p>6 × 5 m · living area and bathroom</p>
          </button>
          <button type="button" className="w-card" onClick={() => begin('home')}>
            <h3>Family home</h3>
            <p>12 × 7 m · living, kitchen, 2 bedrooms, bath</p>
          </button>
          <button type="button" className="w-card" onClick={() => begin('sample')}>
            <h3>Furnished sample</h3>
            <p>See what is possible — then make it yours</p>
          </button>
          <button type="button" className="w-card" onClick={() => begin('blank')}>
            <h3>Start from scratch</h3>
            <p>An empty plan: draw every wall yourself</p>
          </button>
        </div>

        <AdBanner />

        {error && (
          <p className="w-error" role="alert">
            {error}
          </p>
        )}

        <footer>
          <label className="w-check">
            <input type="checkbox" checked={tips} onChange={(e) => setTips(e.target.checked)} />
            Show me the next step as I go
          </label>
          <div className="w-links">
            <button type="button" className="pill quiet" onClick={() => file.current?.click()}>
              Open a saved file
            </button>
            <input
              ref={file}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => {
                void openFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <button type="button" className="pill quiet" onClick={() => finish(false)}>
              Skip
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
