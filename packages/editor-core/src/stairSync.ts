import type { Scene, Vec2, Id } from '@hd/scene-schema';
import { isHouseWall } from './commands/walls';
import { levelAbove } from './commands/stairs';

/**
 * Keep every stair joined to the right floors: a stair climbs from its floor to the floor directly above it. If the floor
 * it started on is gone, the stair goes; if the floor above it changed (a floor was removed from between), it follows.
 * Only writes on change.
 */
export function syncStairs(d: Scene): void {
  for (const [id, s] of Object.entries(d.stairs)) {
    if (!d.levels[s.fromLevel]) {
      delete d.stairs[id];
      continue;
    }
    const above = levelAbove(d, s.fromLevel);
    if (!above) delete d.stairs[id];
    else if (s.toLevel !== above) s.toLevel = above;
  }
}

/**
 * How far to move a stair so its sides sit flush against the walls of its floor: each side of its bounding box that is
 * within `tol` of the face of a straight (square) wall is pulled onto that face. Returns the shift [dx, dz] (zero when
 * nothing is close).
 */
export function snapStairToWalls(scene: Scene, levelId: Id, outline: readonly Vec2[], tol = 0.3): Vec2 {
  const xs = outline.map((p) => p[0]);
  const zs = outline.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const z0 = Math.min(...zs);
  const z1 = Math.max(...zs);
  let bestX = 0;
  let bestZ = 0;
  let bx = Infinity;
  let bz = Infinity;
  const consider = (delta: number, axis: 'x' | 'z') => {
    const a = Math.abs(delta);
    if (axis === 'x' && a < bx) {
      bx = a;
      bestX = delta;
    } else if (axis === 'z' && a < bz) {
      bz = a;
      bestZ = delta;
    }
  };
  for (const w of Object.values(scene.walls)) {
    if (w.levelId !== levelId || !isHouseWall(w)) continue;
    const a = scene.nodes[w.a]?.p;
    const b = scene.nodes[w.b]?.p;
    if (!a || !b) continue;
    const h = w.thickness / 2;
    if (Math.abs(a[0] - b[0]) < 1e-3) {
      // A wall running north-south at x = c: it must reach the stair's z-range.
      const c = a[0];
      const lo = Math.min(a[1], b[1]);
      const hi = Math.max(a[1], b[1]);
      if (hi < z0 - tol || lo > z1 + tol) continue;
      if (Math.abs(c + h - x0) <= tol && c < (x0 + x1) / 2) consider(c + h - x0, 'x'); // wall to the left: its right face
      if (Math.abs(c - h - x1) <= tol && c > (x0 + x1) / 2) consider(c - h - x1, 'x'); // wall to the right: its left face
    } else if (Math.abs(a[1] - b[1]) < 1e-3) {
      const c = a[1];
      const lo = Math.min(a[0], b[0]);
      const hi = Math.max(a[0], b[0]);
      if (hi < x0 - tol || lo > x1 + tol) continue;
      if (Math.abs(c + h - z0) <= tol && c < (z0 + z1) / 2) consider(c + h - z0, 'z');
      if (Math.abs(c - h - z1) <= tol && c > (z0 + z1) / 2) consider(c - h - z1, 'z');
    }
  }
  return [bx === Infinity ? 0 : bestX, bz === Infinity ? 0 : bestZ];
}
