import { useStore } from 'zustand';
import { deleteSelection } from '../plan/PlanController';
import { editor, finishDrawing, useUi } from '../plan/session';

const CAPTION = {
  wall: 'Click or tap to place points · Esc to finish',
  select: 'Tap a wall to select · drag a corner to move it',
  view3d: 'Drag to look around · scroll or pinch to zoom',
  walk: 'W A S D to move · Shift to run · drag to look · Esc to exit',
  walkTouch: 'Left thumb moves · drag anywhere else to look',
} as const;

/** Contextual actions (only when relevant) + a one-line caption for the current mode. */
export function BottomBar() {
  const tool = useUi((s) => s.tool);
  const view = useUi((s) => s.view);
  const walk = useUi((s) => s.walk);
  const drawing = useUi((s) => s.drawing);
  const hasSelection = useStore(editor.store, (s) => s.selection.length > 0);
  const touch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

  const caption = walk
    ? touch
      ? CAPTION.walkTouch
      : CAPTION.walk
    : view === '3d'
      ? CAPTION.view3d
      : CAPTION[tool];

  const showDone = drawing && !walk;
  const showDelete = hasSelection && !walk && view !== '3d';

  return (
    <div className="bottom">
      {(showDone || showDelete) && (
        <div className="context">
          {showDone && (
            <button type="button" className="pill solid" title="Finish this wall (Enter)" onClick={finishDrawing}>
              Done
            </button>
          )}
          {showDelete && (
            <button type="button" className="pill" title="Delete selected (Del)" onClick={deleteSelection}>
              Delete
            </button>
          )}
        </div>
      )}
      <p className="caption">{caption}</p>
    </div>
  );
}
