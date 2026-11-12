import { useEffect, useRef, useState } from 'react';
import { PopClose } from './PopClose';
import { useStore } from 'zustand';
import { createEmptyScene } from '@hd/scene-schema';
import { editor } from '../plan/session';
import { FREE_WORKSPACES, isPremium, useCloud } from '../cloud/store';

/**
 * Top-bar workspace switcher: the open home's name, a list of your saved homes and a + to start a new one.
 * Free accounts keep up to 3; Premium has no limit. Guests keep one home (signing in unlocks the rest).
 */
export function WorkspaceSwitcher() {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [limit, setLimit] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const name = useStore(editor.store, (s) => s.scene.meta.name);
  const session = useCloud((s) => s.session);
  const projects = useCloud((s) => s.projects);
  const projectId = useCloud((s) => s.projectId);
  const ent = useCloud((s) => s.ent);
  const busy = useCloud((s) => s.busy);
  const premium = isPremium(ent);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', away);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', away);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);

  const report = (r: string | null) => {
    setLimit(r === 'limit');
    if (r === 'signin') {
      setOpen(false);
      useCloud.getState().setAccountOpen(true);
      return;
    }
    setNote(r === 'limit' ? null : r);
  };
  const add = async () => {
    setNote(null);
    setLimit(false);
    const r = await useCloud.getState().createWorkspace();
    report(r);
    if (!r) setOpen(false);
  };
  const full = !!session && !premium && projects.length >= FREE_WORKSPACES;

  return (
    <div ref={root} className="menu-anchor ws">
      <button
        type="button"
        className="pill quiet ws-name"
        title="Your homes"
        aria-label="Workspaces"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="ws-label">{name}</span>
        <span aria-hidden="true">▾</span>
      </button>
      <button type="button" className="pill quiet ws-plus" title="New workspace" aria-label="New workspace" disabled={busy} onClick={() => void add()}>
        +
      </button>
      {open && (
        <div className="popover below ws-pop" role="group" aria-label="Workspace list">
          <PopClose onClick={() => setOpen(false)} />
          {!session ? (
            <>
              <p className="fine">This is your home. Sign in to keep several homes and open them on any device.</p>
              <button
                type="button"
                className="pill small solid"
                onClick={() => {
                  setOpen(false);
                  useCloud.getState().setAccountOpen(true);
                }}
              >
                Sign in
              </button>
            </>
          ) : (
            <>
              <ul className="ws-list">
                {projects.length === 0 && <li className="fine">Your home is saved when you edit it.</li>}
                {projects.map((p) => {
                  const active = p.id === projectId;
                  return (
                    <li key={p.id} className={active ? 'active' : ''}>
                      {renaming === p.id ? (
                        <input
                          className="ws-input"
                          autoFocus
                          defaultValue={active ? name : p.name}
                          aria-label="Workspace name"
                          onBlur={() => setRenaming(null)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setRenaming(null);
                            if (e.key === 'Enter') {
                              void useCloud.getState().renameWorkspace(p.id, e.currentTarget.value);
                              setRenaming(null);
                            }
                          }}
                        />
                      ) : (
                        <button type="button" className="ws-open" disabled={active} onClick={() => void useCloud.getState().open(p.id).then(() => setOpen(false))}>
                          {active ? name : p.name}
                        </button>
                      )}
                      <button type="button" className="ws-act" title="Rename" aria-label={`Rename ${p.name}`} onClick={() => setRenaming(p.id)}>
                        ✎
                      </button>
                      <button
                        type="button"
                        className="ws-act"
                        title="Duplicate"
                        aria-label={`Duplicate ${p.name}`}
                        onClick={() => void useCloud.getState().duplicateWorkspace(p.id).then(report)}
                      >
                        ⧉
                      </button>
                      <button
                        type="button"
                        className={`ws-act danger${armed === p.id ? ' armed' : ''}`}
                        title="Delete"
                        aria-label={armed === p.id ? `Tap again to delete ${p.name}` : `Delete ${p.name}`}
                        onBlur={() => setArmed(null)}
                        onClick={async () => {
                          if (armed !== p.id) return setArmed(p.id);
                          setArmed(null);
                          const c = useCloud.getState();
                          await c.remove(p.id);
                          if (active) {
                            const next = useCloud.getState().projects[0];
                            if (next) await c.open(next.id);
                            else editor.loadScene(createEmptyScene());
                          }
                        }}
                      >
                        {armed === p.id ? '?' : '🗑'}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <small className="fine">{premium ? `${projects.length} homes · no limit` : `${projects.length} of ${FREE_WORKSPACES} free homes`}</small>
              {(limit || full) && (
                <div className="ws-limit" role="status">
                  <small className="fine">
                    {limit ? `Free accounts keep ${FREE_WORKSPACES} homes.` : `You have ${FREE_WORKSPACES} homes, the free limit.`} Premium has no limit.
                  </small>
                  <button
                    type="button"
                    className="pill small solid"
                    onClick={() => {
                      setOpen(false);
                      useCloud.getState().setAccountOpen(true);
                    }}
                  >
                    Go Premium
                  </button>
                </div>
              )}
              {note && <small className="fine">{note}</small>}
              <button type="button" className="pill small" disabled={busy} onClick={() => void add()}>
                + New workspace
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
