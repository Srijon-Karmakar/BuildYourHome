import { useState } from 'react';
import { create } from 'zustand';
import { useStore } from 'zustand';
import {
  batch,
  deleteRoom,
  rotateItems,
  rotateStairs,
  setItemsProps,
  setItemsSize,
  setOpeningProps,
  updateStairs,
  updateZones,
} from '@hd/editor-core';
import { getAsset } from '@hd/assets';
import { deleteSelection } from '../plan/PlanController';
import { editor, useUi } from '../plan/session';
import { isTree } from './TreeSize';
import { IconMinus, IconPen, IconPlus, IconRotL, IconRotR, IconTrash } from './icons';

/** Screen box (page pixels) of the current selection on the plan, published by the plan canvas while it draws. */
export interface Anchor {
  x: number;
  y: number;
  w: number;
  h: number;
}
export const useAnchor = create<{ box: Anchor | null; set(b: Anchor | null): void }>((set) => ({ box: null, set: (box) => set({ box }) }));

const isPhone = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 699px)').matches;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Big, always-visible buttons for whatever is selected: smaller / bigger, turn, edit and delete.
 * On a computer the bar floats next to the selection on the plan; on a phone (or in the 3D-only view) it sits
 * just above the bottom bar so it is always in thumb reach.
 */
export function ObjectBar() {
  const selection = useStore(editor.store, (s) => s.selection);
  const scene = useStore(editor.store, (s) => s.scene);
  const viewOnly = useUi((s) => s.viewOnly);
  const walk = useUi((s) => s.walk);
  const view = useUi((s) => s.view);
  const box = useAnchor((s) => s.box);
  const [confirmRoom, setConfirmRoom] = useState(false);

  if (selection.length === 0 || viewOnly || walk) return null;

  const items = selection.filter((id) => scene.items[id]);
  const stairs = selection.filter((id) => scene.stairs[id]);
  const openings = selection.filter((id) => scene.openings[id]);
  const paths = selection.filter((id) => scene.zones[id]?.shape === 'path' || scene.zones[id]?.shape === 'road');
  const deletable = selection.filter((id) => !scene.rooms[id]);
  const roomIds = selection.filter((id) => scene.rooms[id]);

  const canTurn = items.length + stairs.length > 0;
  const canSize = items.length + stairs.length + openings.length + paths.length > 0;

  const resize = (dir: 1 | -1) => {
    const cmds = [
      ...items.map((id) => {
        const it = scene.items[id]!;
        const next = Math.round(it.scale[0] * (1 + dir * 0.1) * 100) / 100;
        // Trees can grow past the usual furniture limits (a sapling to a mature tree).
        return isTree(it.assetId) ? setItemsSize([id], { uniform: next }) : setItemsProps([id], { scale: next });
      }),
      ...stairs.map((id) => updateStairs([id], { width: scene.stairs[id]!.width + dir * 0.1 })),
      ...openings.map((id) => setOpeningProps(id, { width: scene.openings[id]!.width + dir * 0.1 })),
      ...paths.map((id) => updateZones([id], { width: (scene.zones[id]!.width ?? (scene.zones[id]!.shape === 'road' ? 6 : 1)) + dir * (scene.zones[id]!.shape === 'road' ? 0.5 : 0.2) })),
    ];
    if (cmds.length) editor.execute(batch(dir > 0 ? 'Make bigger' : 'Make smaller', cmds));
  };
  const turn = (dir: 1 | -1) => {
    const cmds = [...(items.length ? [rotateItems(items, (dir * Math.PI) / 2)] : []), ...(stairs.length ? [rotateStairs(stairs, (dir * Math.PI) / 2)] : [])];
    if (cmds.length) editor.execute(batch('Turn', cmds));
  };
  const lockedAll = items.length > 0 && items.every((id) => scene.items[id]?.locked);
  void getAsset;

  const docked = isPhone() || view === '3d' || !box;
  let style: React.CSSProperties | undefined;
  if (!docked && box) {
    const barW = 6 * 46 + 14;
    const above = box.y - 58 >= 64;
    style = {
      left: clamp(box.x + box.w / 2 - barW / 2, 8, window.innerWidth - barW - 8),
      top: above ? box.y - 58 : Math.min(window.innerHeight - 70, box.y + box.h + 10),
    };
  }

  return (
    <div className={`objbar${docked ? ' docked' : ''}`} style={style} role="toolbar" aria-label="Selected object">
      {canSize && (
        <>
          <button type="button" title="Smaller" aria-label="Smaller" disabled={lockedAll} onClick={() => resize(-1)}>
            <IconMinus />
            <span>Smaller</span>
          </button>
          <button type="button" title="Bigger" aria-label="Bigger" disabled={lockedAll} onClick={() => resize(1)}>
            <IconPlus />
            <span>Bigger</span>
          </button>
        </>
      )}
      {canTurn && (
        <>
          <button type="button" title="Turn left (Shift + R)" aria-label="Turn left" disabled={lockedAll} onClick={() => turn(-1)}>
            <IconRotL />
            <span>Left</span>
          </button>
          <button type="button" title="Turn right (R)" aria-label="Turn right" disabled={lockedAll} onClick={() => turn(1)}>
            <IconRotR />
            <span>Right</span>
          </button>
        </>
      )}
      <button type="button" title="Edit: colours, materials, details" aria-label="Edit" onClick={() => window.dispatchEvent(new Event('hd:edit'))}>
        <IconPen />
        <span>Edit</span>
      </button>
      {roomIds.length > 0 && (
        <button
          type="button"
          className={`danger${confirmRoom ? ' armed' : ''}`}
          title="Delete the whole room: its walls, doors, windows and furniture"
          aria-label={confirmRoom ? 'Tap again to delete the room' : 'Delete room'}
          onClick={() => {
            if (!confirmRoom) return setConfirmRoom(true);
            editor.execute(batch('Delete room', roomIds.map((id) => deleteRoom(id))));
            setConfirmRoom(false);
          }}
          onBlur={() => setConfirmRoom(false)}
        >
          <IconTrash />
          <span>{confirmRoom ? 'Sure?' : 'Room'}</span>
        </button>
      )}
      {deletable.length > 0 && (
        <button type="button" className="danger" title="Delete (Del)" aria-label="Delete" onClick={() => deleteSelection()}>
          <IconTrash />
          <span>Delete</span>
        </button>
      )}
    </div>
  );
}
