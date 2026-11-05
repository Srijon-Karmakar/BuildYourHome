import { useStore } from 'zustand';
import { editor, finishDrawing, finishPlot, useUi } from '../plan/session';
import { nextTip } from './tipsLogic';

const CAPTION = {
  wall: 'Click to place points · type a length + Enter for an exact wall · Esc to finish',
  door: 'Move over a wall and click to add a door · it opens toward your side',
  window: 'Move over a wall and click to add a window',
  plot: 'Click each corner of your land · click the first corner or press Enter to close · Esc to cancel',
  stair: 'Click to place the stairs · R turns them · they climb to the floor above (one is added if needed) · Esc to stop',
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
  const plotPoints = useUi((s) => s.plotDraft.length);
  const plotError = useUi((s) => s.plotError);
  const kind = useUi((s) => s.newWallKind);
  const setKind = useUi((s) => s.setNewWallKind);
  const hasSelection = useStore(editor.store, (s) => s.selection.length > 0);
  const scene = useStore(editor.store, (s) => s.scene);
  const tipsOn = useUi((s) => s.tipsOn);
  const hasWalked = useUi((s) => s.hasWalked);
  const tip = tipsOn && !walk ? nextTip(scene, hasWalked) : null;
  const touch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

  const caption = walk
    ? touch
      ? CAPTION.walkTouch
      : CAPTION.walk
    : view === '3d'
      ? CAPTION.view3d
      : CAPTION[tool];

  const showDone = drawing && !walk && tool === 'wall';
  const showPlotDone = tool === 'plot' && !walk && view !== '3d';
  const showKind = tool === 'wall' && !walk && view !== '3d';
  const showStairKind = tool === 'stair' && !walk && view !== '3d';
  const newStair = useUi((s) => s.newStair);
  const setNewStair = useUi((s) => s.setNewStair);

  return (
    <div className={`bottom${hasSelection && !walk ? ' with-inspector' : ''}`}>
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
      {showStairKind && (
        <>
          <div className="segmented" role="group" aria-label="Stair shape">
            {(['straight', 'L', 'U'] as const).map((k) => (
              <button key={k} type="button" className="seg" aria-pressed={newStair.kind === k} onClick={() => setNewStair({ kind: k })}>
                {k === 'straight' ? 'Straight' : k === 'L' ? 'L-shape' : 'U-shape'}
              </button>
            ))}
          </div>
          {newStair.kind !== 'straight' && (
            <div className="segmented" role="group" aria-label="Stair turn">
              {([false, true] as const).map((m) => (
                <button key={String(m)} type="button" className="seg" aria-pressed={newStair.mirror === m} onClick={() => setNewStair({ mirror: m })}>
                  {m ? 'Turns right' : 'Turns left'}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {tip && !showDone && !showPlotDone && (
        <div className="tip" role="status">
          <span>
            <b>Next:</b> {tip.text}
          </span>
          {tip.action && (
            <button
              type="button"
              className="pill small solid"
              onClick={() => {
                const ui = useUi.getState();
                if (tip.id === 'wall') ui.setTool('wall');
                else if (tip.id === 'door') ui.setTool('door');
                else if (tip.id === 'furnish') ui.setFurnitureOpen(true);
                else if (tip.id === 'walk') ui.setWalk(true);
              }}
            >
              {tip.action}
            </button>
          )}
          <button type="button" className="ins-close" title="Hide tips" aria-label="Hide tips" onClick={() => useUi.getState().setTipsOn(false)}>
            ×
          </button>
        </div>
      )}
      {showDone && (
        <div className="context">
          <button type="button" className="pill solid" title="Finish this wall (Enter)" onClick={finishDrawing}>
            Done
          </button>
        </div>
      )}
      {showPlotDone && (
        <div className="context">
          {plotError && <span className="fine" role="alert">{plotError}</span>}
          <button type="button" className="pill solid" title="Close the plot (Enter)" disabled={plotPoints < 3} onClick={finishPlot}>
            Done
          </button>
        </div>
      )}
      <p className="caption">{caption}</p>
    </div>
  );
}
