import { useMemo } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { useStore } from 'zustand';
import type { Id } from '@hd/scene-schema';
import { editor, useUi } from '../plan/session';

/** Selection colour in 3D (the same brick as on the plan). */
export const SELECT_COLOR = '#7a4236';

/** Pointer moves under this many pixels still count as a click (an orbit drag does not). */
export const CLICK_SLOP_PX = 5;

/** Picking works in the 3D view unless the user is walking around. */
export const canPick = (): boolean => !useUi.getState().walk;

/** Select `id` (or toggle it with Shift / "Add more"), switching to the floor it is on. Tools other than Select stop. */
export function pickObject(id: Id | null, levelId: Id | undefined, additive: boolean): void {
  const ui = useUi.getState();
  if (ui.tool !== 'select') ui.setTool('select');
  const st = editor.getState();
  if (id === null) {
    if (!additive) editor.select([]);
    return;
  }
  if (levelId && levelId !== st.activeLevelId) editor.setActiveLevel(levelId);
  const cur = editor.getState().selection;
  editor.select(additive ? (cur.includes(id) ? cur.filter((i) => i !== id) : [...cur, id]) : [id]);
}

/** Click + hover handlers that make a 3D object selectable. Spread them on a mesh or group. */
export function pickProps(id: Id, levelId: Id | undefined) {
  return {
    onClick: (e: ThreeEvent<MouseEvent>) => {
      if (!canPick() || e.delta > CLICK_SLOP_PX) return;
      e.stopPropagation();
      pickObject(id, levelId, e.nativeEvent.shiftKey || useUi.getState().additive);
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      if (!canPick()) return;
      e.stopPropagation();
      document.body.style.cursor = 'pointer';
    },
    onPointerOut: () => {
      document.body.style.cursor = '';
    },
  };
}

export const useIsSelected = (id: Id): boolean => useStore(editor.store, (s) => s.selection.includes(id));

/** A thin box drawn around a selected object, visible through other objects. Lives in the object's own frame. */
export function SelectionBox({ center, size }: { center: [number, number, number]; size: [number, number, number] }) {
  const geometry = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(size[0], size[1], size[2])), [size[0], size[1], size[2]]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <lineSegments geometry={geometry} position={center} renderOrder={999} raycast={() => null}>
      <lineBasicMaterial color={SELECT_COLOR} depthTest={false} transparent />
    </lineSegments>
  );
}
