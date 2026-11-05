import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { adsEnabled, shareUrl } from '../cloud';
import { useCloud } from '../cloud/store';
import { editor } from '../plan/session';
import { copyText } from '../view3d/benchmark';

const ago = (iso: string): string => {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
};

function SignIn() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const busy = useCloud((s) => s.busy);
  const message = useCloud((s) => s.message);
  const backend = useCloud((s) => s.mode);
  const notice = useCloud((s) => s.notice);
  const submit = () => {
    setLocalError(null);
    if (mode === 'up' && password !== confirm) return setLocalError('The two passwords don’t match.');
    void (mode === 'in' ? useCloud.getState().signIn(email, password) : useCloud.getState().signUp(email, password));
  };
  return (
    <form
      className="acct-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <p className="acct-lead">Save your homes, open them on any device and share a link.</p>
      <div className="f-seg wide" role="group" aria-label="Account">
        <button type="button" aria-pressed={mode === 'in'} onClick={() => { setMode('in'); setLocalError(null); }}>
          Sign in
        </button>
        <button type="button" aria-pressed={mode === 'up'} onClick={() => { setMode('up'); setLocalError(null); }}>
          Create account
        </button>
      </div>
      <label className="acct-field">
        Email
        <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="acct-field">
        Password
        <input type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {mode === 'up' && (
        <label className="acct-field">
          Confirm password
          <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
      )}
      {notice && (
        <p className="fine" role="status">
          {notice}
        </p>
      )}
      {(localError ?? message) && (
        <p className="w-error" role="alert">
          {localError ?? message}
        </p>
      )}
      <button type="submit" className="pill solid wide" disabled={busy}>
        {mode === 'in' ? 'Sign in' : 'Create account'}
      </button>
      {mode === 'in' && (
        <button
          type="button"
          className="pill quiet small"
          disabled={busy}
          onClick={() => {
            setLocalError(email.trim() ? null : 'Enter your email above first.');
            if (email.trim()) void useCloud.getState().resetPassword(email);
          }}
        >
          Forgot password?
        </button>
      )}
      {backend === 'local' && <small className="fine">Demo mode: accounts live in this browser only. Connect Supabase to sync across devices.</small>}
    </form>
  );
}

function Account() {
  const session = useCloud((s) => s.session)!;
  const projects = useCloud((s) => s.projects);
  const projectId = useCloud((s) => s.projectId);
  const shareToken = useCloud((s) => s.shareToken);
  const ent = useCloud((s) => s.ent);
  const mode = useCloud((s) => s.mode);
  const busy = useCloud((s) => s.busy);
  const message = useCloud((s) => s.message);
  const syncedAt = useCloud((s) => s.syncedAt);
  const [copied, setCopied] = useState(false);
  const notice = useCloud((s) => s.notice);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const c = useCloud.getState();
  const link = shareToken ? shareUrl(shareToken) : null;

  return (
    <div className="acct">
      <div className="acct-head">
        <div>
          <strong>{session.email}</strong>
          <small>{ent.subscribed ? 'Ad-free · all items unlocked' : 'Free plan'}</small>
        </div>
        <button type="button" className="pill small" onClick={() => void c.signOut()}>
          Sign out
        </button>
      </div>

      <h4>This home</h4>
      <button type="button" className="pill small solid wide" disabled={busy} onClick={() => void c.saveNow()}>
        {projectId ? 'Save to my account now' : 'Save to my account'}
      </button>
      <small className="fine" role="status">
        {projectId ? `Saved automatically${syncedAt ? ' · last sync ' + new Date(syncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}` : 'Not saved to your account yet.'}
      </small>

      <h4>Share</h4>
      {link ? (
        <>
          <input className="acct-link" readOnly value={link} aria-label="Share link" onFocus={(e) => e.currentTarget.select()} />
          <div className="fa-row">
            <button
              type="button"
              className="pill small"
              onClick={async () => {
                setCopied(await copyText(link));
                window.setTimeout(() => setCopied(false), 1800);
              }}
            >
              {copied ? 'Copied' : 'Copy link'}
            </button>
            <button type="button" className="pill small" onClick={() => void c.unshare()}>
              Stop sharing
            </button>
          </div>
        </>
      ) : (
        <button type="button" className="pill small wide" disabled={busy} onClick={() => void c.share()}>
          Create a view-only link
        </button>
      )}

      <h4>My homes</h4>
      {projects.length === 0 && <small className="fine">Nothing saved yet.</small>}
      <ul className="acct-list">
        {projects.map((p) => (
          <li key={p.id} aria-current={p.id === projectId}>
            <button type="button" className="acct-open" onClick={() => void c.open(p.id)}>
              <span>{p.name}</span>
              <small>{ago(p.updatedAt)}</small>
            </button>
            <button type="button" className="ins-close" aria-label={`Delete ${p.name}`} title="Delete" onClick={() => void c.remove(p.id)}>
              ×
            </button>
          </li>
        ))}
      </ul>

      <h4>Plan</h4>
      {mode === 'local' ? (
        <>
          <button type="button" className="pill small wide" onClick={() => void c.subscribe(!ent.subscribed)}>
            {ent.subscribed ? 'Cancel demo subscription' : 'Go ad-free (demo)'}
          </button>
          <small className="fine">Demo billing: no payment is taken. Real subscriptions arrive with billing.</small>
        </>
      ) : (
        <small className="fine">{ent.subscribed ? 'Subscription active.' : 'Subscriptions are coming soon.'}</small>
      )}
      <h4>Security</h4>
      {pwOpen ? (
        <form
          className="acct-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (pw !== pw2) return setPwError('The two passwords don’t match.');
            setPwError(null);
            if (await c.updatePassword(pw)) {
              setPwOpen(false);
              setPw('');
              setPw2('');
            }
          }}
        >
          <label className="acct-field">
            New password
            <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </label>
          <label className="acct-field">
            Confirm new password
            <input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </label>
          <div className="fa-row">
            <button type="submit" className="pill small solid" disabled={busy}>
              Save password
            </button>
            <button type="button" className="pill small" onClick={() => setPwOpen(false)}>
              Cancel
            </button>
          </div>
          {pwError && (
            <p className="w-error" role="alert">
              {pwError}
            </p>
          )}
        </form>
      ) : (
        <button type="button" className="pill small wide" onClick={() => setPwOpen(true)}>
          Change password
        </button>
      )}
      <button
        type="button"
        className={`pill small wide${confirmDelete ? ' solid' : ''}`}
        onClick={() => (confirmDelete ? void c.deleteAccount() : setConfirmDelete(true))}
        onBlur={() => setConfirmDelete(false)}
      >
        {confirmDelete ? 'Tap again: delete my account and all saved homes' : 'Delete my account'}
      </button>
      {notice && (
        <p className="fine" role="status">
          {notice}
        </p>
      )}
      {message && (
        <p className="w-error" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}

/** Sign in / account popover in the top bar. */
export function AccountMenu() {
  const open = useCloud((s) => s.accountOpen);
  const setOpen = useCloud((s) => s.setAccountOpen);
  const session = useCloud((s) => s.session);
  const ready = useCloud((s) => s.ready);
  const root = useRef<HTMLDivElement>(null);
  useStore(editor.store, (s) => s.scene.meta.name); // keep the label fresh when the home is renamed

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
  }, [open, setOpen]);

  if (!ready) return null;
  return (
    <div ref={root} className="menu-anchor">
      <button type="button" className="pill quiet" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(!open)}>
        {session ? 'Account' : 'Sign in'}
      </button>
      {open && (
        <div className="popover below acct-pop" role="group" aria-label="Account">
          {session ? <Account /> : <SignIn />}
        </div>
      )}
    </div>
  );
}

export { adsEnabled };
