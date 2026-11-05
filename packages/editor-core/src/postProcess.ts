import type { Scene } from '@hd/scene-schema';
import { OPENING_END_MARGIN_M } from '@hd/geometry';
import { OPENING_GAP_M, OPENING_HEAD_CLEARANCE_M, wallLength } from './openings';
import { restackLevels } from './commands/levels';
import { syncRooms } from './rooms';

/**
 * Run after every command to restore invariants, so commands stay simple.
 * Order matters: walls → nodes → openings → items → rooms (rooms last: they depend on the walls).
 */
export function postProcess(d: Scene): void {
  // 0. Floors are stacked without gaps (changing a floor's height moves the ones above).
  restackLevels(d);

  // 1. Walls with missing/identical endpoints.
  for (const [id, w] of Object.entries(d.walls)) {
    if (w.a === w.b || !d.nodes[w.a] || !d.nodes[w.b]) delete d.walls[id];
  }

  // 2. Nodes not used by any wall.
  const used = new Set<string>();
  for (const w of Object.values(d.walls)) {
    used.add(w.a);
    used.add(w.b);
  }
  for (const id of Object.keys(d.nodes)) if (!used.has(id)) delete d.nodes[id];

  // 3. Openings: drop orphans; per wall, sweep left → right keeping each one clear of the wall ends and of
  //    its neighbour (pushing it along, or dropping it when the wall has become too short).
  const perWall = new Map<string, Array<(typeof d.openings)[string]>>();
  for (const [id, o] of Object.entries(d.openings)) {
    if (!d.walls[o.wallId]) {
      delete d.openings[id];
      continue;
    }
    const list = perWall.get(o.wallId) ?? [];
    list.push(o);
    perWall.set(o.wallId, list);
  }
  for (const [wallId, list] of perWall) {
    const wall = d.walls[wallId]!;
    const len = wallLength(d, wall);
    list.sort((p, q) => p.offset - q.offset || (p.id < q.id ? -1 : 1));
    let prevEnd = -Infinity;
    for (const o of list) {
      const half = o.width / 2;
      const lo = Math.max(OPENING_END_MARGIN_M + half, prevEnd + OPENING_GAP_M + half);
      const hi = len === null ? -Infinity : len - OPENING_END_MARGIN_M - half;
      if (lo > hi + 1e-9) {
        delete d.openings[o.id];
        continue;
      }
      const c = Math.min(hi, Math.max(lo, o.offset));
      if (Math.abs(c - o.offset) > 1e-9) o.offset = c;
      prevEnd = c + half;
      // A lintel must remain above the opening (wall height may have changed).
      const maxTop = wall.height - OPENING_HEAD_CLEARANCE_M;
      if (o.sill + o.height > maxTop + 1e-9) o.height = Math.max(0.2, maxTop - o.sill);
    }
  }

  // 4. Items on missing levels.
  for (const [id, it] of Object.entries(d.items)) {
    if (!d.levels[it.levelId]) delete d.items[id];
  }

  // 4b. Roofs on missing floors.
  for (const [id, r] of Object.entries(d.roofs)) if (!d.levels[r.levelId]) delete d.roofs[id];

  // 4c. Stairs must connect two existing floors, the second one above the first.
  for (const [id, s] of Object.entries(d.stairs)) {
    const from = d.levelOrder.indexOf(s.fromLevel);
    const to = d.levelOrder.indexOf(s.toLevel);
    if (!d.levels[s.fromLevel] || !d.levels[s.toLevel] || from < 0 || to <= from) delete d.stairs[id];
  }

  // 4d. Balconies on missing floors.
  for (const [id, b] of Object.entries(d.balconies)) if (!d.levels[b.levelId]) delete d.balconies[id];

  // 5. Rooms are derived from closed wall loops (identity carried across edits).
  syncRooms(d);
}
