import type { Id, Vec2, Wall, WallNode } from '@hd/scene-schema';

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
 * Build colliders for one level's walls.
 * NOTE: doors/windows are not yet cut out (arrives with openings, P1-01): every wall blocks fully.
 */
export function buildColliders(nodes: Readonly<Record<Id, WallNode>>, walls: readonly Wall[]): Collider[] {
  const out: Collider[] = [];
  for (const w of walls) {
    const a = nodes[w.a];
    const b = nodes[w.b];
    if (!a || !b) continue;
    if (Math.hypot(b.p[0] - a.p[0], b.p[1] - a.p[1]) < 1e-6) continue;
    out.push({ a: a.p, b: b.p, halfThickness: w.thickness / 2 });
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
