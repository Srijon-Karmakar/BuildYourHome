import { Fragment, useEffect, useState } from 'react';
import { activePlan } from '../plan/PlanCanvas';
import { useUi, type ViewMode } from '../plan/session';
import { AccountMenu } from './AccountMenu';
import { DisplayMenu } from './DisplayMenu';
import { useSaveStatus } from '../lib/persistence';
import { HomeMenu } from './HomeMenu';
import { BrandLogo } from './BrandLogo';
import iconUrl from '../assets/plotframer-icon.png?inline';
import { GooGroup } from './Goo';

const VIEWS: Array<{ id: ViewMode; label: string; title: string }> = [
  { id: '2d', label: 'Plan', title: 'Floor plan only' },
  { id: 'split', label: 'Split', title: 'Plan and 3D side by side' },
  { id: '3d', label: '3D', title: '3D view only' },
];

const SAVE_TEXT = {
  idle: '',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Could not save here — use Home › Save to file',
} as const;

function SaveState() {
  const status = useSaveStatus((s) => s.status);
  return (
    <small className={`save-state ${status}`} role="status">
      {SAVE_TEXT[status]}
    </small>
  );
}

export function TopBar() {
  const view = useUi((s) => s.view);
  const setView = useUi((s) => s.setView);
  const walk = useUi((s) => s.walk);
  const setWalk = useUi((s) => s.setWalk);
  const bumpFit = useUi((s) => s.bumpFit);
  // Compact screens (phones, small tablets): Account / Home / Display / Fit / Walk live in a bottom sheet.
  const [menuOpen, setMenuOpen] = useState(false);
  const [sheetKey, setSheetKey] = useState(0);
  // Home lives in the top bar on compact screens (its card is a bottom sheet of its own).
  const [homeOpen, setHomeOpen] = useState(false);
  const [homeKey, setHomeKey] = useState(0);
  const closeMenu = () => {
    setMenuOpen(false);
    setSheetKey((k) => k + 1); // remounts the menus so each one is collapsed next time
  };
  const closeAll = () => {
    closeMenu();
    setHomeKey((k) => k + 1);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [menuOpen]);

  return (
    <header className={`topbar${menuOpen || homeOpen ? ' sheet-open' : ''}`}>
      <div className="brand">
        <div className="wordmark">
          <BrandLogo />
        </div>
        <img
          className="brand-icon"
          src={iconUrl}
          width={128}
          height={105}
          alt="Home Designer"
          decoding="sync"
          draggable={false}
        />
        <SaveState />
      </div>

      <GooGroup className="segmented" role="group" aria-label="View" data-goo-host="">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            className="seg"
            title={v.title}
            aria-pressed={view === v.id}
            onClick={() => setView(v.id)}
          >
            {v.label}
          </button>
        ))}
      </GooGroup>

      <div className="topbar-actions">
        <HomeMenu key={homeKey} onOpenChange={setHomeOpen} />
        <button
          type="button"
          className="pill walk-quick"
          title="Walk through your home in first person (Esc to exit)"
          aria-pressed={walk}
          onClick={() => setWalk(!walk)}
        >
          {walk ? 'Exit walk' : 'Walk'}
        </button>
        <button
          type="button"
          className="pill menu-btn"
          aria-label="Menu"
          aria-haspopup="true"
          aria-expanded={menuOpen}
          onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M3 6H17M3 10H17M3 14H17" />
          </svg>
          <span className="lbl">Menu</span>
        </button>
      </div>

      {(menuOpen || homeOpen) && (
        <button
          type="button"
          className="sheet-backdrop"
          aria-label="Close menu"
          onClick={closeAll}
        />
      )}

      <div className={`topbar-right${menuOpen ? ' open' : ''}`}>
        <div className="sheet-head">
          <span className="sheet-grip" aria-hidden="true" />
          <strong>Menu</strong>
          <button type="button" className="sheet-close" aria-label="Close menu" onClick={closeMenu}>
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M5 5L15 15M15 5L5 15" />
            </svg>
          </button>
        </div>
        <Fragment key={sheetKey}>
          <AccountMenu />
          <div className="hm-desktop">
            <HomeMenu />
          </div>
          <DisplayMenu />
        </Fragment>
        <button
          type="button"
          className="pill quiet fit-btn"
          title="Fit the whole plan on screen (F)"
          onClick={() => {
            activePlan?.fitToPlan();
            bumpFit();
            closeMenu();
          }}
        >
          Fit
        </button>
        <button
          type="button"
          className="pill walk-btn"
          title="Walk through your home in first person (Esc to exit)"
          aria-pressed={walk}
          onClick={() => {
            setWalk(!walk);
            closeMenu();
          }}
        >
          {walk ? 'Exit walk' : 'Walk'}
        </button>
      </div>
    </header>
  );
}
