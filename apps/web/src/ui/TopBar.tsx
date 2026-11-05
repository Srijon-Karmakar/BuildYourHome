import { activePlan } from '../plan/PlanCanvas';
import { useUi, type ViewMode } from '../plan/session';
import { AccountMenu } from './AccountMenu';
import { DisplayMenu } from './DisplayMenu';
import { useSaveStatus } from '../lib/persistence';
import { HomeMenu } from './HomeMenu';

const VIEWS: Array<{ id: ViewMode; label: string; title: string }> = [
  { id: '2d', label: 'Plan', title: 'Floor plan only' },
  { id: 'split', label: 'Split', title: 'Plan and 3D side by side' },
  { id: '3d', label: '3D', title: '3D view only' },
];

const SAVE_TEXT = { idle: '', saving: 'Saving…', saved: 'Saved', error: 'Could not save here — use Home › Save to file' } as const;

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

  return (
    <header className="topbar">
      <div className="brand">
        <div className="wordmark">Home Designer</div>
        <SaveState />
      </div>

      <div className="segmented" role="group" aria-label="View">
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
      </div>

      <div className="topbar-right">
        <AccountMenu />
        <HomeMenu />
        <DisplayMenu />
        <button
          type="button"
          className="pill quiet hide-phone"
          title="Fit the whole plan on screen (F)"
          onClick={() => {
            activePlan?.fitToPlan();
            bumpFit();
          }}
        >
          Fit
        </button>
        <button
          type="button"
          className="pill"
          title="Walk through your home in first person (Esc to exit)"
          aria-pressed={walk}
          onClick={() => setWalk(!walk)}
        >
          {walk ? 'Exit walk' : 'Walk'}
        </button>
      </div>
    </header>
  );
}
