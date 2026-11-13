import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { CATEGORIES, searchCatalog, type Asset } from '@hd/assets';
import { accessFor, lockLabel } from '../cloud';
import { requireAccess, useCloud } from '../cloud/store';
import { useUi } from '../plan/session';
import { getThumbnail, requestThumbnails, subscribeThumbnails } from '../view3d/furniture/thumbnails';

function Card({ asset, onPick }: { asset: Asset; onPick: (a: Asset) => void }) {
  const src = useSyncExternalStore(subscribeThumbnails, () => getThumbnail(asset.id));
  const ent = useCloud((s) => s.ent);
  const tag = lockLabel(accessFor(asset, ent));
  return (
    <button type="button" className="card" onClick={() => onPick(asset)} title={`${asset.name} — ${asset.size[0]} × ${asset.size[1]} m`}>
      <span className="card-thumb">{src ? <img src={src} alt="" draggable={false} /> : <span className="card-skel" />}</span>
      <span className="card-name">{asset.name}</span>
      {tag && <span className="card-tag">{tag}</span>}
    </button>
  );
}

/**
 * Furniture catalog: search, categories, thumbnails. Picking an item enters placement mode
 * (premium / rewarded items are placeable in this preview; entitlements arrive in Phase 2).
 */
export function FurniturePanel() {
  const open = useUi((s) => s.furnitureOpen);
  const setOpen = useUi((s) => s.setFurnitureOpen);
  const startPlacing = useUi((s) => s.startPlacing);
  const [query, setQuery] = useState('');
  const category = useUi((s) => s.catalogCategory);
  const setCategory = useUi((s) => s.setCatalogCategory);
  const input = useRef<HTMLInputElement>(null);

  const results = useMemo(() => searchCatalog(query, category), [query, category]);

  useEffect(() => {
    if (!open) return;
    requestThumbnails(results.map((a) => a.id));
  }, [open, results]);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', esc);
    // Don't pop the keyboard up on phones.
    if (!window.matchMedia('(pointer: coarse)').matches) input.current?.focus();
    return () => window.removeEventListener('keydown', esc);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <aside className="furniture" aria-label="Furniture catalog">
      <header>
        <strong>{category === 'features' ? 'Wall decoration' : 'Furniture'}</strong>
        <button type="button" className="ins-close" aria-label="Close" onClick={() => setOpen(false)}>
          ×
        </button>
      </header>
      <div className="fp-search">
        <input
          ref={input}
          type="search"
          placeholder={category === 'features' ? 'Search walls…' : 'Search sofa, bed, lamp…'}
          aria-label="Search furniture"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="fp-cats" role="tablist" aria-label="Categories">
        {[{ id: 'all' as const, name: 'All' }, ...CATEGORIES].map((c) => (
          <button key={c.id} type="button" role="tab" aria-selected={category === c.id} onClick={() => setCategory(c.id)}>
            {c.name}
          </button>
        ))}
      </div>
      <div className="fp-grid">
        {results.map((a) => (
          <Card key={a.id} asset={a} onPick={(x) => requireAccess([x.id], 'place') && startPlacing(x.id)} />
        ))}
        {results.length === 0 && <p className="fp-empty">Nothing matches “{query}”. Try “chair”, “bed” or “light”.</p>}
      </div>
    </aside>
  );
}
