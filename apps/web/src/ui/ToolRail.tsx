import { useStore } from 'zustand';
import { addOrSelectRoof, editor, useUi } from '../plan/session';
import {
  IconHand,
  IconRoof,
  IconRooms,
  IconPen,
  IconGarden,
  IconBalcony,
  IconDoor,
  IconFurniture,
  IconStairs,
  IconRedo,
  IconSelect,
  IconUndo,
  IconWall,
  IconWindow,
} from './icons';
import { SnapMenu } from './SnapMenu';
import { GooGroup } from './Goo';

export function ToolRail() {
  const tool = useUi((s) => s.tool);
  const setTool = useUi((s) => s.setTool);
  const view = useUi((s) => s.view);
  const canUndo = useStore(editor.store, (s) => s.canUndo);
  const canRedo = useStore(editor.store, (s) => s.canRedo);
  const editable = view !== '3d';
  const furnitureOpen = useUi((s) => s.furnitureOpen);
  const setFurnitureOpen = useUi((s) => s.setFurnitureOpen);
  const viewOnly = useUi((s) => s.viewOnly);
  const roomsOpen = useUi((s) => s.roomsOpen);
  const setRoomsOpen = useUi((s) => s.setRoomsOpen);
  const setViewOnly = useUi((s) => s.setViewOnly);

  return (
    <div className="rail-wrap" data-goo-host="">
      <GooGroup as="nav" className="rail" aria-label="Tools">
        <GooGroup className="mode-pair">
          <button type="button" className="tool" title="Edit your design" aria-label="Edit" aria-pressed={!viewOnly} onClick={() => setViewOnly(false)}>
            <IconPen />
            <span>Edit</span>
          </button>
          <button type="button" className="tool" title="Hand: look around without changing anything" aria-label="Hand" aria-pressed={viewOnly} onClick={() => setViewOnly(true)}>
            <IconHand />
            <span>Hand</span>
          </button>
        </GooGroup>
        <div className="rail-sep" />
        <button
          type="button"
          className="tool"
          title="Select and move (V)"
          aria-pressed={!viewOnly && tool === 'select'}
          disabled={viewOnly}
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
          disabled={!editable || viewOnly}
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
          disabled={!editable || viewOnly}
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
          disabled={!editable || viewOnly}
          onClick={() => setTool('window')}
        >
          <IconWindow />
          <span>Window</span>
        </button>

        <button
          type="button"
          className="tool"
          title="Add stairs (S)"
          aria-pressed={editable && tool === 'stair'}
          disabled={!editable || viewOnly}
          onClick={() => setTool('stair')}
        >
          <IconStairs />
          <span>Stairs</span>
        </button>

        <button
          type="button"
          className="tool"
          title="Add a roof to the top floor (or edit it)"
          aria-pressed={false}
          disabled={viewOnly}
          onClick={addOrSelectRoof}
        >
          <IconRoof />
          <span>Roof</span>
        </button>

        <button
          type="button"
          className="tool"
          title="Add a balcony or porch (B)"
          aria-pressed={editable && tool === 'balcony'}
          disabled={!editable || viewOnly}
          onClick={() => setTool('balcony')}
        >
          <IconBalcony />
          <span>Balcony</span>
        </button>

        <button
          type="button"
          className="tool"
          title="Lay a lawn, paving, driveway or path (G)"
          aria-pressed={editable && tool === 'garden'}
          disabled={!editable || viewOnly}
          onClick={() => setTool('garden')}
        >
          <IconGarden />
          <span>Garden</span>
        </button>

        <button
          type="button"
          className="tool"
          title="Ready-made furnished rooms"
          aria-pressed={roomsOpen || tool === 'room'}
          disabled={!editable || viewOnly}
          onClick={() => setRoomsOpen(!roomsOpen)}
        >
          <IconRooms />
          <span>Rooms</span>
        </button>

        <button
          type="button"
          className="tool"
          title="Furniture catalog"
          aria-pressed={editable && (furnitureOpen || tool === 'place')}
          disabled={!editable || viewOnly}
          onClick={() => setFurnitureOpen(!furnitureOpen)}
        >
          <IconFurniture />
          <span>Furniture</span>
        </button>

        <div className="rail-sep" />
        <SnapMenu />
      </GooGroup>

      <div className="rail-pin">
        <div className="rail-sep" />

        <button
          type="button"
          className="tool"
          title="Undo (Ctrl+Z)"
          disabled={!canUndo}
          onClick={() => editor.undo()}
        >
          <IconUndo />
          <span>Undo</span>
        </button>
        <button
          type="button"
          className="tool"
          title="Redo (Ctrl+Y)"
          disabled={!canRedo}
          onClick={() => editor.redo()}
        >
          <IconRedo />
          <span>Redo</span>
        </button>
      </div>
    </div>
  );
}
