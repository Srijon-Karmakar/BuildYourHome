import { useStore } from 'zustand';
import { activePlan } from '../plan/PlanCanvas';
import { deleteSelection } from '../plan/PlanController';
import { editor, finishDrawing, useUi } from '../plan/session';

function Btn(props: {
  label: string;
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`btn${props.active ? ' active' : ''}`}
      title={props.title}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {props.label}
    </button>
  );
}

export function Toolbar() {
  const tool = useUi((s) => s.tool);
  const snap = useUi((s) => s.snap);
  const drawing = useUi((s) => s.drawing);
  const setTool = useUi((s) => s.setTool);
  const toggleSnap = useUi((s) => s.toggleSnap);
  const canUndo = useStore(editor.store, (s) => s.canUndo);
  const canRedo = useStore(editor.store, (s) => s.canRedo);
  const hasSel = useStore(editor.store, (s) => s.selection.length > 0);

  return (
    <div className="toolbar">
      <div className="group">
        <Btn label="Select" title="Select / move points (V)" active={tool === 'select'} onClick={() => setTool('select')} />
        <Btn label="Wall" title="Draw walls (W)" active={tool === 'wall'} onClick={() => setTool('wall')} />
      </div>
      <div className="group">
        <Btn label="Undo" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={() => editor.undo()} />
        <Btn label="Redo" title="Redo (Ctrl+Y)" disabled={!canRedo} onClick={() => editor.redo()} />
        <Btn label="Delete" title="Delete selected (Del)" disabled={!hasSel} onClick={deleteSelection} />
      </div>
      <div className="group">
        <Btn label="Grid" title="Snap to grid" active={snap.grid} onClick={() => toggleSnap('grid')} />
        <Btn label="Angle" title="Snap to 45° / 90°" active={snap.angle} onClick={() => toggleSnap('angle')} />
        <Btn label="Points" title="Snap to existing points" active={snap.nodes} onClick={() => toggleSnap('nodes')} />
        <Btn label="Fit" title="Fit plan to screen (F)" onClick={() => activePlan?.fitToPlan()} />
      </div>
      {drawing && (
        <div className="group">
          <Btn label="Done ✓" title="Finish this wall chain (Enter / Esc / double-click)" active onClick={finishDrawing} />
        </div>
      )}
    </div>
  );
}
