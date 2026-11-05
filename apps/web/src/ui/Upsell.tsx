import { useEffect, useRef, useState } from 'react';
import { getAsset } from '@hd/assets';
import { useCloud } from '../cloud/store';

const AD_SECONDS = 3;

/** Stand-in for a rewarded video ad (real AdMob / web ads plug in behind the same flow, ADR-011). */
function MockAd({ onDone }: { onDone: () => void }) {
  const [left, setLeft] = useState(AD_SECONDS);
  // Keep the latest callback in a ref so re-renders of the parent can never restart the countdown.
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (left <= 0) return void done.current();
    const t = window.setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => window.clearTimeout(t);
  }, [left]);
  return (
    <div className="welcome" role="dialog" aria-modal="true" aria-label="Advertisement">
      <div className="welcome-card ad-card">
        <small className="fine">Advertisement · demo</small>
        <div className="ad-art" aria-hidden="true">
          Your ad could be here
        </div>
        <p className="welcome-sub">
          Your item unlocks in <b>{left}</b> s…
        </p>
      </div>
    </div>
  );
}

/** "This item is premium / rewarded" sheet, shown when a locked catalog item is picked or copied. */
export function Upsell() {
  const upsell = useCloud((s) => s.upsell);
  const adPlaying = useCloud((s) => s.adPlaying);
  const ent = useCloud((s) => s.ent);
  const session = useCloud((s) => s.session);
  const mode = useCloud((s) => s.mode);
  const message = useCloud((s) => s.message);
  const c = useCloud.getState();

  useEffect(() => {
    if (!upsell) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && !useCloud.getState().adPlaying && useCloud.getState().closeUpsell();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [upsell]);

  if (!upsell) return null;
  if (adPlaying) return <MockAd onDone={() => void useCloud.getState().finishAd()} />;

  const asset = getAsset(upsell.assetId);
  if (!asset) return null;
  const rewarded = asset.tier === 'rewarded';
  const demoBilling = mode === 'local';

  return (
    <div className="welcome" role="dialog" aria-modal="true" aria-labelledby="upsell-title" onPointerDown={(e) => e.target === e.currentTarget && c.closeUpsell()}>
      <div className="welcome-card upsell">
        <h1 id="upsell-title">{asset.name}</h1>
        <p className="welcome-sub">
          {rewarded ? 'A bonus item. Watch a short ad to use it for 24 hours — or go ad-free and unlock everything.' : 'A premium item, included with the ad-free plan.'}
        </p>

        <div className="upsell-actions">
          {rewarded && (
            <button type="button" className="pill solid" onClick={() => c.startAd()}>
              Watch an ad · unlock for 24 h
            </button>
          )}
          {!session ? (
            <button
              type="button"
              className={`pill${rewarded ? '' : ' solid'}`}
              onClick={() => {
                c.closeUpsell();
                c.setAccountOpen(true);
              }}
            >
              Create a free account to go ad-free
            </button>
          ) : demoBilling ? (
            <button type="button" className={`pill${rewarded ? '' : ' solid'}`} onClick={() => void c.subscribe(true)}>
              Go ad-free + unlock all (demo)
            </button>
          ) : (
            <button type="button" className="pill" disabled>
              Subscriptions coming soon
            </button>
          )}
          <button type="button" className="pill quiet" onClick={() => c.closeUpsell()}>
            Not now
          </button>
        </div>
        {message && (
          <p className="w-error" role="alert">
            {message}
          </p>
        )}
        {ent.subscribed && <p className="fine">You are already subscribed.</p>}
        {demoBilling && <small className="fine">Demo mode: no payment is taken.</small>}
      </div>
    </div>
  );
}
