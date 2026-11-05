import { useStore } from 'zustand';
import { PlanCanvas } from './plan/PlanCanvas';
import { editor, useUi } from './plan/session';
import { BottomBar } from './ui/BottomBar';
import { FurniturePanel } from './ui/FurniturePanel';
import { ConflictDialog, RecoveryDialog } from './ui/AccountDialogs';
import { Curtain } from './ui/Curtain';
import { Help } from './ui/Help';
import { Inspector } from './ui/Inspector';
import { LevelSwitcher } from './ui/LevelSwitcher';
import { Tour } from './ui/Tour';
import { Upsell } from './ui/Upsell';
import { Welcome } from './ui/Welcome';
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
  // The edit card gets its own column so it never covers the plan or the 3D view.
  const hasInspector = useStore(editor.store, (s) => s.selection.length > 0) && !walk;
  return (
    <div className={`app${hasInspector ? ' with-inspector' : ''}`}>
      <div className={`panes panes-${view}`}>
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
      </div>
      <TopBar />
      <ToolRail />
      <BottomBar />
      <Inspector />
      <FurniturePanel />
      <LevelSwitcher />
      <Welcome />
      <Help />
      <Upsell />
      <RecoveryDialog />
      <ConflictDialog />
      <PerfPanel />
      <Tour />
      <Curtain />
    </div>
  );
}
