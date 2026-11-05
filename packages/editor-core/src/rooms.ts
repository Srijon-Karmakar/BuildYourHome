import { detectRooms, type DetectedRoom } from '@hd/geometry';
import { DEFAULT_MATERIAL_FLOOR, type Id, type Room, type Scene } from '@hd/scene-schema';

/** Deterministic short hash → stable ids for new rooms (same loop ⇒ same id, so undo/redo is predictable). */
function hashId(sig: string): string {
  let h = 5381;
  for (let i = 0; i < sig.length; i++) h = ((h << 5) + h + sig.charCodeAt(i)) >>> 0;
  return `room_${h.toString(36)}`;
}

const sameLoop = (a: readonly Id[], b: readonly Id[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * How much two wall sets overlap. `coef` = shared / smaller set (robust when a room is split in two and
 * both halves keep only part of the old walls); `jaccard` = shared / union (used to break ties).
 */
function overlap(a: readonly Id[], b: readonly Id[]): { coef: number; jaccard: number } {
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  for (const x of sb) if (sa.has(x)) inter++;
  const union = sa.size + sb.size - inter;
  const smaller = Math.min(sa.size, sb.size);
  return { coef: smaller === 0 ? 0 : inter / smaller, jaccard: union === 0 ? 0 : inter / union };
}

/** Minimum overlap coefficient for a changed loop to inherit an old room's name/materials. */
const MATCH_MIN_OVERLAP = 0.5;

/**
 * Keep `scene.rooms` in sync with the wall graph.
 * Rooms are derived from closed wall loops, but users give them names/materials, so identity is
 * carried across edits: exact wall-set match first, then best overlap (≥ 50% of the smaller wall set;
 * ties go to the higher Jaccard score, then the larger room, then the signature — so splitting a room
 * in two keeps the name on one half, deterministically).
 * Only writes when something actually changes, so no-op commands stay no-ops (no history entry).
 */
export function syncRooms(d: Scene): void {
  // Rooms on levels that no longer exist.
  for (const [id, r] of Object.entries(d.rooms)) if (!d.levels[r.levelId]) delete d.rooms[id];

  for (const levelId of d.levelOrder) {
    // Compound walls / fences enclose the plot, not a room.
    const levelWalls = Object.values(d.walls).filter((w) => w.levelId === levelId && w.kind !== 'boundary');
    const detected = detectRooms(d.nodes, levelWalls);
    const existing = Object.values(d.rooms).filter((r) => r.levelId === levelId);

    const sig = (loop: readonly Id[]) => [...loop].sort().join('|');
    const pairedExisting = new Set<Id>();
    const pairedDetected = new Set<number>();
    const pairs: Array<[Room, DetectedRoom]> = [];

    // 1. Exact signature matches.
    const bySig = new Map(existing.map((r) => [sig(r.wallLoop), r]));
    detected.forEach((dr, i) => {
      const r = bySig.get(dr.signature);
      if (r && !pairedExisting.has(r.id)) {
        pairs.push([r, dr]);
        pairedExisting.add(r.id);
        pairedDetected.add(i);
      }
    });

    // 2. Best-overlap matches for the rest (greedy, highest score first).
    const cands: Array<{ r: Room; i: number; s: number; j: number; area: number }> = [];
    for (const r of existing) {
      if (pairedExisting.has(r.id)) continue;
      detected.forEach((dr, i) => {
        if (pairedDetected.has(i)) return;
        const { coef, jaccard } = overlap(r.wallLoop, dr.wallLoop);
        if (coef >= MATCH_MIN_OVERLAP) cands.push({ r, i, s: coef, j: jaccard, area: dr.area });
      });
    }
    cands.sort(
      (a, b) =>
        b.s - a.s ||
        b.j - a.j ||
        b.area - a.area ||
        (detected[a.i]!.signature < detected[b.i]!.signature ? -1 : 1) ||
        (a.r.id < b.r.id ? -1 : 1),
    );
    for (const c of cands) {
      if (pairedExisting.has(c.r.id) || pairedDetected.has(c.i)) continue;
      pairs.push([c.r, detected[c.i]!]);
      pairedExisting.add(c.r.id);
      pairedDetected.add(c.i);
    }

    // Apply: update matched, delete unmatched, create new.
    for (const [r, dr] of pairs) {
      const live = d.rooms[r.id];
      if (live && !sameLoop(live.wallLoop, dr.wallLoop)) live.wallLoop = [...dr.wallLoop];
    }
    for (const r of existing) if (!pairedExisting.has(r.id)) delete d.rooms[r.id];

    const usedNames = new Set(Object.values(d.rooms).filter((r) => r.levelId === levelId).map((r) => r.name));
    let n = 1;
    detected.forEach((dr, i) => {
      if (pairedDetected.has(i)) return;
      while (usedNames.has(`Room ${n}`)) n++;
      const name = `Room ${n}`;
      usedNames.add(name);
      let id = hashId(dr.signature);
      while (d.rooms[id]) id += '_';
      d.rooms[id] = {
        id,
        levelId,
        wallLoop: [...dr.wallLoop],
        name,
        type: 'other',
        floorMaterial: { id: DEFAULT_MATERIAL_FLOOR },
        hasCeiling: true,
      };
    });
  }
}
