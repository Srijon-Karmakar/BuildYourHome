import { activePlan } from '../plan/PlanCanvas';
import { useUi, type ViewMode } from '../plan/session';
import { DisplayMenu } from './DisplayMenu';

const VIEWS: Array<{ id: ViewMode; label: string; title: string }> = [
  { id: '2d', label: 'Plan', title: 'Floor plan only' },
  { id: 'split', label: 'Split', title: 'Plan and 3D side by side' },
  { id: '3d', label: '3D', title: '3D view only' },
];

export function TopBar() {
  const view = useUi((s) => s.view);
  const setView = useUi((s) => s.setView);
  const walk = useUi((s) => s.walk);
  const setWalk = useUi((s) => s.setWalk);
  const bumpFit = useUi((s) => s.bumpFit);

  return (
    <header className="topbar">
      <div className="wordmark">Home Designer</div>

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
