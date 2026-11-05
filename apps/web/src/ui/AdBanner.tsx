import { adsEnabled } from '../cloud';
import { useCloud } from '../cloud/store';

/**
 * Demo banner ad for free-plan users. Only ever placed on calm screens (welcome, help) — never over the editor
 * canvas or in the walkthrough (ADR-011). Subscribers never see it.
 */
export function AdBanner() {
  const ent = useCloud((s) => s.ent);
  if (!adsEnabled(ent)) return null;
  return (
    <aside className="ad-banner" aria-label="Advertisement">
      <small>Ad · demo</small>
      <span>Your ad could be here — go ad-free from Account.</span>
    </aside>
  );
}
