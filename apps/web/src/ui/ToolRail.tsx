import { useStore } from 'zustand';
import { editor, useUi } from '../plan/session';
import { IconDoor, IconFurniture, IconRedo, IconSelect, IconUndo, IconWall, IconWindow } from './icons';
import { SnapMenu } from './SnapMenu';

export function ToolRail() {
  const tool = useUi((s) => s.tool);
  const setTool = useUi((s) => s.setTool);
  const view = useUi((s) => s.view);
  const canUndo = useStore(editor.store, (s) => s.canUndo);
  const canRedo = useStore(editor.store, (s) => s.canRedo);
  const editable = view !== '3d';
  const furnitureOpen = useUi((s) => s.furnitureOpen);
  const setFurnitureOpen = useUi((s) => s.setFurnitureOpen);

  return (
    <nav className="rail" aria-label="Tools">
      <button
        type="button"
        className="tool"
        title="Select and move (V)"
        aria-pressed={editable && tool === 'select'}
        disabled={!editable}
        onClick={() => setTool('select')}
      >
        <IconSelect />
        <span>Select</span>
      </button>
      <button
        type="button"
        className="tool"
        title="Draw walls (W)"
        aria-pressed={editable && tool === 'wall'}
        disabled={!editable}
        onClick={() => setTool('wall')}
      >
        <IconWall />
        <span>Wall</span>
      </button>

      <button
        type="button"
        className="tool"
        title="Add doors (D)"
        aria-pressed={editable && tool === 'door'}
        disabled={!editable}
        onClick={() => setTool('door')}
      >
        <IconDoor />
        <span>Door</span>
      </button>
      <button
        type="button"
        className="tool"
        title="Add windows (N)"
        aria-pressed={editable && tool === 'window'}
        disabled={!editable}
        onClick={() => setTool('window')}
      >
        <IconWindow />
        <span>Window</span>
      </button>

      <button
        type="button"
        className="tool"
        title="Furniture catalog"
        aria-pressed={editable && (furnitureOpen || tool === 'place')}
        disabled={!editable}
        onClick={() => setFurnitureOpen(!furnitureOpen)}
      >
        <IconFurniture />
        <span>Furniture</span>
      </button>

      <div className="rail-sep" />

      <button type="button" className="tool" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={() => editor.undo()}>
        <IconUndo />
        <span>Undo</span>
      </button>
      <button type="button" className="tool" title="Redo (Ctrl+Y)" disabled={!canRedo} onClick={() => editor.redo()}>
        <IconRedo />
        <span>Redo</span>
      </button>

      <div className="rail-sep" />

      <SnapMenu />
    </nav>
  );
}
