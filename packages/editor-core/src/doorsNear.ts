import { doorOpenAmount, DOOR_BLOCKS_BELOW, type Id, type Scene } from '@hd/scene-schema';

/** How far the walker can reach a door (metres from the door's opening). */
export const DOOR_REACH_M = 1.7;
/** Closing a door on someone standing in the doorway is refused: this much clear space is needed each side. */
const DOORWAY_CLEARANCE_M = 0.4;

export interface NearDoor {
  id: Id;
  /** The door is open (so the next press closes it). */
  isOpen: boolean;
  distance: number;
  /** The walker stands in the doorway, so the door cannot be closed now. */
  inDoorway: boolean;
}

/**
 * The door a walker at `p` (x, z) looking along `yaw` would operate: the nearest door on the level within reach and in
 * front of them (or right beside them). `yaw` is the walk-mode yaw: 0 looks toward -z, forward = (-sin, -cos).
 */
export function nearestDoor(scene: Scene, levelId: Id, p: readonly [number, number], yaw: number, reach = DOOR_REACH_M): NearDoor | null {
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  let best: NearDoor | null = null;
  for (const o of Object.values(scene.openings)) {
    if (o.type !== 'door') continue;
    const w = scene.walls[o.wallId];
    if (!w || w.levelId !== levelId) continue;
    const a = scene.nodes[w.a]?.p;
    const b = scene.nodes[w.b]?.p;
    if (!a || !b) continue;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-6) continue;
    const ux = (b[0] - a[0]) / len;
    const uz = (b[1] - a[1]) / len;
    // Along the wall from the door's centre, and across it (both in metres).
    const rx = p[0] - (a[0] + ux * o.offset);
    const rz = p[1] - (a[1] + uz * o.offset);
    const along = rx * ux + rz * uz;
    const across = -rx * uz + rz * ux;
    const outside = Math.max(0, Math.abs(along) - o.width / 2);
    const distance = Math.hypot(outside, across);
    if (distance > reach) continue;
    const toDoor = Math.hypot(rx, rz);
    const facing = toDoor < 0.7 ? 1 : (-rx * fx - rz * fz) / toDoor; // cos of the angle between the view and the door
    if (facing < 0.25) continue;
    const inDoorway = Math.abs(along) < o.width / 2 + 0.1 && Math.abs(across) < w.thickness / 2 + DOORWAY_CLEARANCE_M;
    if (!best || distance < best.distance) best = { id: o.id, isOpen: doorOpenAmount(o) >= DOOR_BLOCKS_BELOW, distance, inDoorway };
  }
  return best;
}
