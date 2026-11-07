import { useEffect, useState } from 'react';
import { useUi } from '../plan/session';
import { useCloud } from '../cloud/store';
import { shareUrl } from '../cloud';
import { downloadBlob } from '../export/files';
import { ExportError, makeDxf, makePicture, makePdf, makeProject, needsPremium, shareFile, type ExportKind, type MadeFile } from '../export/make';
import type { Paper } from '../export/pdfPlan';
import { Segmented } from './fields';
import { usePwa } from '../lib/pwa';

const ROWS: { id: ExportKind; title: string; hint: string }[] = [
  { id: 'project', title: 'Home file', hint: 'Everything, to keep or send. Opens again in this app.' },
  { id: 'picture', title: '3D picture', hint: 'A large image of the 3D view.' },
  { id: 'pdf', title: 'Plan (PDF)', hint: 'Scaled floor plans, one page per floor.' },
  { id: 'dxf', title: 'CAD drawing (DXF)', hint: 'For AutoCAD and other CAD programs.' },
];

const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

/** One place to save or send the home: files (save or share sheet) and a link anyone can open. */
export function ShareDialog() {
  const open = useUi((s) => s.shareOpen);
  const setOpen = useUi((s) => s.setShareOpen);
  const ent = useCloud((s) => s.ent);
  const session = useCloud((s) => s.session);
  const token = useCloud((s) => s.shareToken);
  const cloudMessage = useCloud((s) => s.message);
  const [paper, setPaper] = useState<Paper>('A4');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const premium = !!(ent.subscribed || ent.gifted);
  const online = usePwa((s) => s.online);

  useEffect(() => {
    if (!open) return;
    setMessage(null);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open, setOpen]);

  if (!open) return null;

  const make = async (k: ExportKind): Promise<MadeFile> =>
    k === 'project' ? makeProject() : k === 'picture' ? makePicture(premium) : k === 'pdf' ? makePdf(paper) : makeDxf();

  const go = async (k: ExportKind, how: 'save' | 'share') => {
    if (needsPremium(k) && !premium) {
      setOpen(false);
      useCloud.getState().setAccountOpen(true);
      return;
    }
    setBusy(k + how);
    setMessage(null);
    try {
      const f = await make(k);
      if (how === 'save') {
        downloadBlob(f.blob, f.name);
        setMessage(`Saved ${f.name}. ${f.note}`);
      } else {
        const r = await shareFile(f);
        setMessage(r === 'shared' ? 'Shared.' : r === 'saved' ? `Sharing is not available here, so ${f.name} was saved instead.` : null);
      }
    } catch (e) {
      setMessage(e instanceof ExportError ? e.message : 'Could not create the file. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const link = token ? shareUrl(token) : null;
  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setMessage('Link copied.');
    } catch {
      setMessage('Could not copy. Select the link and copy it by hand.');
    }
  };

  return (
    <div className="welcome" role="dialog" aria-modal="true" aria-labelledby="share-title" onPointerDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="welcome-card share">
        <header>
          <h1 id="share-title">Share &amp; export</h1>
          <button type="button" className="ins-close" aria-label="Close" onClick={() => setOpen(false)}>
            ×
          </button>
        </header>
        <Segmented
          label="Paper"
          value={paper}
          options={[
            { id: 'A4', label: 'A4' },
            { id: 'A3', label: 'A3' },
          ]}
          onChange={setPaper}
        />
        <ul className="share-list">
          {ROWS.map((r) => (
            <li key={r.id}>
              <div>
                <strong>
                  {r.title}
                  {needsPremium(r.id) && !premium ? ' 🔒' : ''}
                </strong>
                <small className="fine">{r.hint}</small>
              </div>
              <div className="fa-row">
                <button type="button" className="pill small" data-share={`save-${r.id}`} disabled={!!busy} onClick={() => void go(r.id, 'save')}>
                  Save
                </button>
                {canNativeShare && (
                  <button type="button" className="pill small solid" data-share={`send-${r.id}`} disabled={!!busy} onClick={() => void go(r.id, 'share')}>
                    Share
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        <section className="share-link">
          <strong>Link</strong>
          {!session ? (
            <>
              <small className="fine">{online ? 'Sign in to get a link anyone can open to look around your home.' : 'You are offline. Signing in and links need the internet; the files above work without it.'}</small>
              <button
                type="button"
                className="pill small"
                onClick={() => {
                  setOpen(false);
                  useCloud.getState().setAccountOpen(true);
                }}
              >
                Sign in
              </button>
            </>
          ) : link ? (
            <>
              <input className="share-url" readOnly value={link} aria-label="Share link" onFocus={(e) => e.currentTarget.select()} />
              <div className="fa-row">
                <button type="button" className="pill small solid" data-share="copy" onClick={() => void copy()}>
                  Copy link
                </button>
                {canNativeShare && (
                  <button
                    type="button"
                    className="pill small"
                    onClick={() => void navigator.share({ title: 'My home design', url: link }).catch(() => undefined)}
                  >
                    Share link
                  </button>
                )}
                <button type="button" className="pill small" onClick={() => void useCloud.getState().unshare()}>
                  Stop sharing
                </button>
              </div>
            </>
          ) : (
            <>
              <small className="fine">{online ? 'Saves your home online and makes a link that shows it, view only.' : 'You are offline. A link needs the internet; the files above work without it.'}</small>
              <button type="button" className="pill small solid" data-share="make-link" disabled={!online} onClick={() => void useCloud.getState().share()}>
                Create link
              </button>
            </>
          )}
        </section>
        {(message || cloudMessage) && (
          <small className="fine" role="status">
            {message ?? cloudMessage}
          </small>
        )}
      </div>
    </div>
  );
}
