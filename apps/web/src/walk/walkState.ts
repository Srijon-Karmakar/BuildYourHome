import { createStore } from 'zustand/vanilla';
import type { Id, Scene } from '@hd/scene-schema';
import { levelRooms } from '../plan/rooms';

/** Walker pose, published every frame while walking (the 2D plan draws a "you are here" marker from it). */
export interface WalkPose {
  active: boolean;
  x: number;
  z: number;
  /** Radians. 0 looks toward −z (north on the plan); increases counter-clockwise seen from above. */
  yaw: number;
  /** Eye height above the ground (metres); follows the steps on stairs. */
  y: number;
}

export const walkPose = createStore<WalkPose>(() => ({ active: false, x: 0, z: 0, yaw: 0, y: 0 }));

/** Mutable input shared between the touch/mouse overlay and the frame loop (no React re-renders). */
export const walkInput = {
  /** Analog stick, −1..1. joyY > 0 = forward. */
  joyX: 0,
  joyY: 0,
  /** Look deltas in radians, accumulated by the overlay and consumed each frame. */
  lookYaw: 0,
  lookPitch: 0,
};

export function resetWalkInput(): void {
  walkInput.joyX = walkInput.joyY = walkInput.lookYaw = walkInput.lookPitch = 0;
}

let remembered: { x: number; z: number; yaw: number } | null = null;
export const rememberPose = (p: { x: number; z: number; yaw: number }) => {
  remembered = { ...p };
};

/** Where to start: last position if we have one, else the centre of the biggest room, else the plan centre. */
export function spawnPose(scene: Scene, levelId: Id): { x: number; z: number; yaw: number } {
  if (remembered) return remembered;
  const rooms = levelRooms(scene, levelId);
  let best: (typeof rooms)[number] | undefined;
  for (const r of rooms) if (!best || r.area > best.area) best = r;
  if (best) return { x: best.centroid[0], z: best.centroid[1], yaw: 0 };
  const nodes = Object.values(scene.nodes).filter((n) => n.levelId === levelId);
  if (nodes.length) {
    const x = nodes.reduce((s, n) => s + n.p[0], 0) / nodes.length;
    const z = nodes.reduce((s, n) => s + n.p[1], 0) / nodes.length;
    return { x, z, yaw: 0 };
  }
  return { x: 0, z: 0, yaw: 0 };
}
