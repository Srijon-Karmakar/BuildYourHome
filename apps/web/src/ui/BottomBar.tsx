import { useStore } from 'zustand';
import { deleteSelection } from '../plan/PlanController';
import { setOpeningProps } from '@hd/editor-core';
import { editor, finishDrawing, useUi } from '../plan/session';

const CAPTION = {
  wall: 'Click or tap to place points · Esc to finish',
  door: 'Move over a wall and click to add a door · it opens toward your side',
  window: 'Move over a wall and click to add a window',
  select: 'Tap a wall or door to select · drag to move it',
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
  const opening = useStore(editor.store, (s) =>
    s.selection.length === 1 ? s.scene.openings[s.selection[0]!] : undefined,
  );
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
  const showOpening = !!opening && !walk && view !== '3d';
  const resize = (dw: number) => opening && editor.execute(setOpeningProps(opening.id, { width: Math.max(0.4, +(opening.width + dw).toFixed(2)) }));

  return (
    <div className="bottom">
      {(showDone || showDelete || showOpening) && (
        <div className="context">
          {showOpening && opening && (
            <>
              {opening.type === 'door' && (
                <>
                  <button type="button" className="pill" title="Open the door to the other side" onClick={() => editor.execute(setOpeningProps(opening.id, { flip: { swing: !opening.flip.swing } }))}>
                    Swing
                  </button>
                  <button type="button" className="pill" title="Move the hinge to the other side" onClick={() => editor.execute(setOpeningProps(opening.id, { flip: { side: !opening.flip.side } }))}>
                    Hinge
                  </button>
                </>
              )}
              <button type="button" className="pill" title="Make it 10 cm narrower" onClick={() => resize(-0.1)}>
                Narrower
              </button>
              <button type="button" className="pill" title="Make it 10 cm wider" onClick={() => resize(0.1)}>
                Wider
              </button>
            </>
          )}
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
