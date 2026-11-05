import type { Asset } from '@hd/assets';
import type { Entitlements } from './types';

/** How long a rewarded-ad unlock lasts. */
export const REWARDED_UNLOCK_MS = 24 * 60 * 60 * 1000;

export type Access = 'free' | 'subscription' | 'unlocked' | 'locked-premium' | 'locked-rewarded';

/**
 * May the user USE this item (place it, copy it)? Free items always; premium items need an active subscription;
 * rewarded items need a subscription or an unexpired ad unlock. Scenes that already contain locked items must
 * still open and render (FR-806): this only gates adding and copying.
 */
export function accessFor(asset: Pick<Asset, 'id' | 'tier'>, ent: Entitlements, now = Date.now()): Access {
  if (asset.tier === 'free') return 'free';
  if (ent.subscribed || ent.gifted) return 'subscription';
  if (asset.tier === 'rewarded') {
    const exp = ent.unlocks[asset.id];
    if (exp !== undefined && (exp === null || Date.parse(exp) > now)) return 'unlocked';
    return 'locked-rewarded';
  }
  return 'locked-premium';
}

export const canUse = (asset: Pick<Asset, 'id' | 'tier'>, ent: Entitlements, now = Date.now()): boolean => {
  const a = accessFor(asset, ent, now);
  return a !== 'locked-premium' && a !== 'locked-rewarded';
};

/** Ads are for free-tier users only and never for subscribers (ADR-011). */
export const adsEnabled = (ent: Entitlements): boolean => !ent.subscribed && !ent.gifted;

/** Drop expired unlocks. */
export function pruneUnlocks(ent: Entitlements, now = Date.now()): Entitlements {
  const unlocks: Entitlements['unlocks'] = {};
  for (const [id, exp] of Object.entries(ent.unlocks)) if (exp === null || Date.parse(exp) > now) unlocks[id] = exp;
  return { ...ent, unlocks };
}

/** Human text for a lock badge. */
export function lockLabel(access: Access): string | null {
  switch (access) {
    case 'locked-premium':
      return 'Premium';
    case 'locked-rewarded':
      return 'Watch ad';
    case 'unlocked':
      return 'Unlocked';
    default:
      return null;
  }
}
