import { useEffect, useState } from 'react';
import { useCloud } from '../cloud/store';

/** Shown after following a password-reset link: choose a new password. */
export function RecoveryDialog() {
  const open = useCloud((s) => s.recovery);
  const busy = useCloud((s) => s.busy);
  const message = useCloud((s) => s.message);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setPw('');
      setPw2('');
      setErr(null);
    }
  }, [open]);
  if (!open) return null;
  return (
    <div className="welcome" role="dialog" aria-modal="true" aria-labelledby="recovery-title">
      <form
        className="welcome-card upsell"
        onSubmit={(e) => {
          e.preventDefault();
          if (pw !== pw2) return setErr('The two passwords don’t match.');
          setErr(null);
          void useCloud.getState().updatePassword(pw);
        }}
      >
        <h1 id="recovery-title">Choose a new password</h1>
        <p className="welcome-sub">You are signed in. Pick a password you will remember.</p>
        <label className="acct-field">
          New password
          <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        </label>
        <label className="acct-field" style={{ marginTop: 10 }}>
          Confirm new password
          <input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </label>
        {(err ?? message) && (
          <p className="w-error" role="alert">
            {err ?? message}
          </p>
        )}
        <div className="upsell-actions" style={{ marginTop: 16 }}>
          <button type="submit" className="pill solid" disabled={busy}>
            Save password
          </button>
          <button type="button" className="pill quiet" onClick={() => useCloud.getState().dismissRecovery()}>
            Not now
          </button>
        </div>
      </form>
    </div>
  );
}

/** Two devices changed the same home: let the user pick which version wins (nothing is overwritten silently). */
export function ConflictDialog() {
  const conflict = useCloud((s) => s.conflict);
  const busy = useCloud((s) => s.busy);
  const message = useCloud((s) => s.message);
  if (!conflict) return null;
  const c = useCloud.getState();
  return (
    <div className="welcome" role="alertdialog" aria-modal="true" aria-labelledby="conflict-title">
      <div className="welcome-card upsell">
        <h1 id="conflict-title">This home changed somewhere else</h1>
        <p className="welcome-sub">
          Another device saved a newer version. Syncing is paused so nothing gets overwritten. Which version do you want to keep?
        </p>
        <div className="upsell-actions">
          <button type="button" className="pill solid" disabled={busy} onClick={() => void c.resolveConflict(true)}>
            Keep this version (replace the other)
          </button>
          <button type="button" className="pill" disabled={busy} onClick={() => void c.resolveConflict(false)}>
            Use the other version (discard my changes)
          </button>
        </div>
        {message && (
          <p className="w-error" role="alert">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
