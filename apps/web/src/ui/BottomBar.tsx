import { useStore } from 'zustand';
import { editor, finishDrawing, useUi } from '../plan/session';

const CAPTION = {
  wall: 'Click or tap to place points · Esc to finish',
  door: 'Move over a wall and click to add a door · it opens toward your side',
  window: 'Move over a wall and click to add a window',
  place: 'Click to place · R turns it · Esc to stop',
  select: 'Tap a wall, room, door or furniture to edit it · drag to move',
  view3d: 'Drag to look around · scroll or pinch to zoom',
  walk: 'W A S D to move · Shift to run · drag to look · Esc to exit',
  walkTouch: 'Left thumb moves · drag anywhere else to look',
} as const;

/** Contextual "Done" while drawing + a one-line caption for the current mode. Item actions live in the Inspector. */
export function BottomBar() {
  const tool = useUi((s) => s.tool);
  const view = useUi((s) => s.view);
  const walk = useUi((s) => s.walk);
  const drawing = useUi((s) => s.drawing);
  const kind = useUi((s) => s.newWallKind);
  const setKind = useUi((s) => s.setNewWallKind);
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
  const showKind = tool === 'wall' && !walk && view !== '3d';

  return (
    <div className={`bottom${hasSelection && !walk && view !== '3d' ? ' with-inspector' : ''}`}>
      {showKind && (
        <div className="segmented" role="group" aria-label="New wall type">
          {(['interior', 'exterior'] as const).map((k) => (
            <button
              key={k}
              type="button"
              className="seg"
              title={k === 'interior' ? 'Inside walls: thinner partitions' : 'Outside walls: thicker, load-bearing'}
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
            >
              {k === 'interior' ? 'Inside wall' : 'Outside wall'}
            </button>
          ))}
        </div>
      )}
      {showDone && (
        <div className="context">
          <button type="button" className="pill solid" title="Finish this wall (Enter)" onClick={finishDrawing}>
            Done
          </button>
        </div>
      )}
      <p className="caption">{caption}</p>
    </div>
  );
}
