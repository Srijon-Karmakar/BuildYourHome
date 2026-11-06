import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { removeViewpoint, renameViewpoint, saveViewpoint } from '@hd/editor-core';
import { editor, useUi } from '../plan/session';
import { flyCameraTo, getCameraPose } from '../view3d/cameraBridge';
import { anyHidden, LAYERS, type LayerId } from '../view3d/layers';

const IconViews = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <path d="M2 10C4 6 7 4.5 10 4.5S16 6 18 10C16 14 13 15.5 10 15.5S4 14 2 10ZM10 12.2A2.2 2.2 0 1 0 10 7.8A2.2 2.2 0 0 0 10 12.2Z" />
  </svg>
);

/**
 * Saved views (remember a 3D camera angle, tap to fly back to it) and layers (hide walls, furniture, roofs…
 * to look at one thing at a time). Lives in the bottom row next to Hide roof / Cutaway, in the 3D view.
 */
export function ViewsMenu() {
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const views = useStore(editor.store, (s) => s.scene.viewpoints);
  const hidden = useUi((s) => s.hiddenLayers);
  const showRoof = useUi((s) => s.showRoof);
  const hasRoof = useStore(editor.store, (s) => Object.keys(s.scene.roofs).length > 0);
  const list = Object.values(views);
  const off = anyHidden(hidden) || !showRoof;

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);

  const save = () => {
    const pose = getCameraPose();
    if (!pose) return setNote('Open the 3D view first.');
    const cmd = saveViewpoint(`View ${list.length + 1}`, pose.position, pose.target, pose.fov);
    editor.execute(cmd);
    setNote(list.length >= 24 ? 'You can keep up to 24 views.' : null);
  };
  const isOn = (id: LayerId) => (id === 'roofs' ? showRoof : !hidden[id]);
  const flip = (id: LayerId) => (id === 'roofs' ? useUi.getState().toggleRoof() : useUi.getState().toggleLayer(id));

  return (
    <>
      <button
        type="button"
        className="pill small"
        aria-pressed={open || off}
        aria-label="Views and layers"
        aria-expanded={open}
        title="Saved views and layers"
        onClick={() => setOpen((o) => !o)}
      >
        <IconViews />
        <span className="lbl">Views</span>
      </button>
      {open && (
        <div className="popover above views-pop" role="group" aria-label="Views and layers">
          <div className="vp-head">
            <strong>Saved views</strong>
            <button type="button" className="pill small solid" onClick={save}>
              + Save this view
            </button>
          </div>
          <ul className="ws-list">
            {list.length === 0 && <li className="fine">Move the 3D view where you like it, then save it.</li>}
            {list.map((v) => (
              <li key={v.id}>
                {renaming === v.id ? (
                  <input
                    className="ws-input"
                    autoFocus
                    defaultValue={v.name}
                    aria-label="View name"
                    onBlur={() => setRenaming(null)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setRenaming(null);
                      if (e.key === 'Enter') {
                        editor.execute(renameViewpoint(v.id, e.currentTarget.value));
                        setRenaming(null);
                      }
                    }}
                  />
                ) : (
                  <button type="button" className="ws-open" title="Go to this view" onClick={() => flyCameraTo({ position: v.position, target: v.target, fov: v.fov })}>
                    {v.name}
                  </button>
                )}
                <button type="button" className="ws-act" title="Rename" aria-label={`Rename ${v.name}`} onClick={() => setRenaming(v.id)}>
                  ✎
                </button>
                <button type="button" className="ws-act" title="Delete" aria-label={`Delete ${v.name}`} onClick={() => editor.execute(removeViewpoint(v.id))}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <div className="vp-head">
            <strong>Layers</strong>
            <button type="button" className="pill small" disabled={!off} onClick={() => useUi.getState().resetLayers()}>
              Show all
            </button>
          </div>
          <div className="layer-grid">
            {LAYERS.filter((l) => l.id !== 'roofs' || hasRoof).map((l) => (
              <button key={l.id} type="button" className="layer" role="switch" aria-checked={isOn(l.id)} onClick={() => flip(l.id)}>
                <span className="layer-eye" aria-hidden="true">
                  {isOn(l.id) ? '●' : '○'}
                </span>
                {l.label}
              </button>
            ))}
          </div>
          {note && <small className="fine">{note}</small>}
        </div>
      )}
    </>
  );
}
