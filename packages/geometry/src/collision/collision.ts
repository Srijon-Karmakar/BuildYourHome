import { DOOR_BLOCKS_BELOW, doorOpenAmount, type Id, type Opening, type Vec2, type Wall, type WallNode } from '@hd/scene-schema';

/** A wall as a thick 2D segment (centre line + half thickness). */
export interface Collider {
  a: Vec2;
  b: Vec2;
  halfThickness: number;
}

/** Player radius in metres (shoulder width ≈ 0.5 m). */
export const PLAYER_RADIUS_M = 0.25;

/** Largest distance moved before a collision check, so thin walls can't be tunnelled through. */
const MAX_STEP_M = 0.1;
const RESOLVE_ITERATIONS = 4;

/**
 * Build colliders for one level's walls. Open doors and arches leave a gap in the wall (you can walk
 * through); a closed door, like a window, stays solid.
 */
export function buildColliders(
  nodes: Readonly<Record<Id, WallNode>>,
  walls: readonly Wall[],
  openings: readonly Opening[] = [],
): Collider[] {
  const out: Collider[] = [];
  for (const w of walls) {
    const a = nodes[w.a];
    const b = nodes[w.b];
    if (!a || !b) continue;
    const len = Math.hypot(b.p[0] - a.p[0], b.p[1] - a.p[1]);
    if (len < 1e-6) continue;
    const ux = (b.p[0] - a.p[0]) / len;
    const uz = (b.p[1] - a.p[1]) / len;
    const gaps = openings
      .filter((o) => o.wallId === w.id && (o.type === 'arch' || (o.type === 'door' && doorOpenAmount(o) >= DOOR_BLOCKS_BELOW)))
      .map((o) => [o.offset - o.width / 2, o.offset + o.width / 2] as const)
      .sort((p, q) => p[0] - q[0]);

    let pos = 0;
    const piece = (s0: number, s1: number) => {
      if (s1 - s0 < 1e-3) return;
      out.push({
        a: [a.p[0] + ux * s0, a.p[1] + uz * s0],
        b: [a.p[0] + ux * s1, a.p[1] + uz * s1],
        halfThickness: w.thickness / 2,
      });
    };
    for (const [g0, g1] of gaps) {
      piece(pos, Math.max(pos, g0));
      pos = Math.max(pos, g1);
    }
    piece(pos, len);
  }
  return out;
}

/** Push `p` out of every collider it penetrates (a circle of `radius`). Mutates and returns `p`. */
function resolve(p: [number, number], colliders: readonly Collider[], radius: number): [number, number] {
  for (let iter = 0; iter < RESOLVE_ITERATIONS; iter++) {
    let moved = false;
    for (const c of colliders) {
      const abx = c.b[0] - c.a[0];
      const abz = c.b[1] - c.a[1];
      const len2 = abx * abx + abz * abz;
      const t = Math.max(0, Math.min(1, ((p[0] - c.a[0]) * abx + (p[1] - c.a[1]) * abz) / len2));
      const cx = c.a[0] + abx * t;
      const cz = c.a[1] + abz * t;
      let vx = p[0] - cx;
      let vz = p[1] - cz;
      const d = Math.hypot(vx, vz);
      const min = radius + c.halfThickness;
      if (d >= min) continue;
      if (d > 1e-9) {
        vx /= d;
        vz /= d;
      } else {
        // Exactly on the centre line: push out along the wall's left normal.
        const l = Math.sqrt(len2);
        vx = -abz / l;
        vz = abx / l;
      }
      p[0] = cx + vx * min;
      p[1] = cz + vz * min;
      moved = true;
    }
    if (!moved) break;
  }
  return p;
}

/**
 * Move a circular player by `delta`, sliding along walls instead of stopping dead.
 * Movement is sub-stepped (≤ 10 cm) so fast motion cannot skip over a wall.
 * Also resolves a start position that is already inside a wall.
 */
export function moveWithCollision(
  pos: Vec2,
  delta: Vec2,
  colliders: readonly Collider[],
  radius: number = PLAYER_RADIUS_M,
): Vec2 {
  const dist = Math.hypot(delta[0], delta[1]);
  const steps = Math.max(1, Math.ceil(dist / MAX_STEP_M));
  const p: [number, number] = [pos[0], pos[1]];
  for (let i = 0; i < steps; i++) {
    p[0] += delta[0] / steps;
    p[1] += delta[1] / steps;
    resolve(p, colliders, radius);
  }
  return [p[0], p[1]];
}
