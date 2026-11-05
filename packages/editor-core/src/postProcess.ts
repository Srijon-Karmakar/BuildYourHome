import type { Scene } from '@hd/scene-schema';
import { syncRooms } from './rooms';

/** Opening must keep at least this distance from a wall end. */
const MIN_END_MARGIN_M = 0.05;

/**
 * Run after every command to restore invariants, so commands stay simple.
 * Order matters: walls → nodes → openings → items → rooms (rooms last: they depend on the walls).
 */
export function postProcess(d: Scene): void {
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

  // 3. Openings: drop orphans, clamp onto the wall, drop if wall is too short.
  for (const [id, o] of Object.entries(d.openings)) {
    const w = d.walls[o.wallId];
    const a = w && d.nodes[w.a];
    const b = w && d.nodes[w.b];
    if (!w || !a || !b) {
      delete d.openings[id];
      continue;
    }
    const len = Math.hypot(b.p[0] - a.p[0], b.p[1] - a.p[1]);
    const half = o.width / 2 + MIN_END_MARGIN_M;
    if (len < 2 * half) {
      delete d.openings[id];
      continue;
    }
    o.offset = Math.min(Math.max(o.offset, half), len - half);
  }

  // 4. Items on missing levels.
  for (const [id, it] of Object.entries(d.items)) {
    if (!d.levels[it.levelId]) delete d.items[id];
  }

  // 5. Rooms are derived from closed wall loops (identity carried across edits).
  syncRooms(d);
}
