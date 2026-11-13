import { nearestDoor, setDoorsOpen } from '@hd/editor-core';
import { editor } from '../plan/session';
import { walkPose } from './walkState';

/** Open or close the door the walker is facing (E key / the on-screen button). Returns true when a door changed. */
export function toggleNearbyDoor(): boolean {
  const { x, z, yaw } = walkPose.getState();
  const st = editor.getState();
  const door = nearestDoor(st.scene, st.activeLevelId, [x, z], yaw);
  if (!door) return false;
  if (door.isOpen && door.inDoorway) return false; // never shut a door on yourself
  return editor.execute(setDoorsOpen([door.id], 'toggle'));
}
