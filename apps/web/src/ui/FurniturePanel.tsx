import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { CATEGORIES, searchCatalog, type Asset, type AssetCategory } from '@hd/assets';
import { accessFor, lockLabel } from '../cloud';
import { requireAccess, useCloud } from '../cloud/store';
import { useUi } from '../plan/session';
import { getThumbnail, requestThumbnails, subscribeThumbnails } from '../view3d/furniture/thumbnails';

/**
 * One row of category chips that scrolls sideways (swipe, wheel or the arrows), with soft fades at the ends so it is
 * clear there is more, and the chosen chip kept in view. One row keeps the space for the items themselves.
 */
function CategoryBar({ category, onPick }: { category: string; onPick: (id: AssetCategory | 'all') => void }) {
  const row = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ left: false, right: true });
  const measure = () => {
    const el = row.current;
    if (el) setEdge({ left: el.scrollLeft > 2, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
  };
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    measure();
    const chip = el.querySelector<HTMLElement>('[aria-selected="true"]');
    if (chip) el.scrollLeft = Math.max(0, chip.offsetLeft - (el.clientWidth - chip.offsetWidth) / 2); // centre the chosen chip
    measure();
  }, [category]);
  const by = (dir: 1 | -1) => row.current?.scrollBy({ left: dir * row.current.clientWidth * 0.7, behavior: 'smooth' });
  return (
    <div className="fp-cats-wrap">
      <button type="button" className="fp-arrow left" aria-label="Earlier categories" tabIndex={-1} hidden={!edge.left} onClick={() => by(-1)}>
        ‹
      </button>
      <div
        ref={row}
        className={`fp-cats${edge.left ? ' fade-left' : ''}${edge.right ? ' fade-right' : ''}`}
        role="tablist"
        aria-label="Categories"
        onScroll={measure}
        onWheel={(e) => {
          // a mouse wheel over the row scrolls it sideways
          if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && row.current) row.current.scrollLeft += e.deltaY;
        }}
      >
        {[{ id: 'all' as const, name: 'All' }, ...CATEGORIES].map((c) => (
          <button key={c.id} type="button" role="tab" aria-selected={category === c.id} onClick={() => onPick(c.id)}>
            {c.name}
          </button>
        ))}
      </div>
      <button type="button" className="fp-arrow right" aria-label="More categories" tabIndex={-1} hidden={!edge.right} onClick={() => by(1)}>
        ›
      </button>
    </div>
  );
}

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
        <strong>
          {category === 'features' ? 'Wall decoration' : 'Furniture'}
          <small>{results.length} {results.length === 1 ? 'item' : 'items'}</small>
        </strong>
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
      <CategoryBar category={category} onPick={setCategory} />
      <div className="fp-grid">
        {results.map((a) => (
          <Card key={a.id} asset={a} onPick={(x) => requireAccess([x.id], 'place') && startPlacing(x.id)} />
        ))}
        {results.length === 0 && <p className="fp-empty">Nothing matches “{query}”. Try “chair”, “bed” or “light”.</p>}
      </div>
    </aside>
  );
}
