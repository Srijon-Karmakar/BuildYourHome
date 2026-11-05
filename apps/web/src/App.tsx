import { PlanCanvas } from './plan/PlanCanvas';
import { useUi } from './plan/session';
import { BottomBar } from './ui/BottomBar';
import { FurniturePanel } from './ui/FurniturePanel';
import { Inspector } from './ui/Inspector';
import { LevelSwitcher } from './ui/LevelSwitcher';
import { PerfPanel } from './ui/PerfPanel';
import { ToolRail } from './ui/ToolRail';
import { TopBar } from './ui/TopBar';
import { Scene3D } from './view3d/Scene3D';
import { WalkOverlay } from './walk/WalkOverlay';

/** Editor shell: plan and/or 3D fill the screen; the chrome floats at the edges (docs/DESIGN.md). */
export function App() {
  const view = useUi((s) => s.view);
  const walk = useUi((s) => s.walk);
  const show2d = view !== '3d';
  const show3d = view !== '2d';
  return (
    <div className={`app panes-${view}`}>
      {show2d && (
        <div className="pane">
          <PlanCanvas />
        </div>
      )}
      {show3d && (
        <div className="pane">
          <Scene3D />
          {walk && <WalkOverlay />}
        </div>
      )}
      <TopBar />
      <ToolRail />
      <BottomBar />
      <Inspector />
      <FurniturePanel />
      <LevelSwitcher />
      <PerfPanel />
    </div>
  );
}
