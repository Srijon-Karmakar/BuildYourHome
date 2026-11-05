import { PlanCanvas } from './plan/PlanCanvas';
import { useUi } from './plan/session';
import { Toolbar } from './ui/Toolbar';

const HINTS = {
  wall: 'Click or tap to place points · Esc / Done to finish · scroll or pinch to zoom · Space+drag to pan',
  select: 'Tap a wall to select · drag a corner point to move it · Del to delete',
} as const;

/** P0-04: 2D plan editor. The 3D view arrives in P0-05. */
export function App() {
  const tool = useUi((s) => s.tool);
  return (
    <div className="app">
      <PlanCanvas />
      <Toolbar />
      <div className="hint">{HINTS[tool]}</div>
    </div>
  );
}
