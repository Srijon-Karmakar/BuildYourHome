import { pointInPolygon } from '@hd/geometry';
import type { Id, Scene } from '@hd/scene-schema';
import type { Command } from '../types';

type Draft = Scene;

function removeWhere<T>(rec: Record<string, T>, pred: (v: T) => boolean): void {
  for (const k of Object.keys(rec)) if (pred(rec[k]!)) delete rec[k];
}

/**
 * Empty a floor (levelId) or the whole home (null): walls, doors/windows, rooms, furniture, roofs, stairs and balconies.
 * Floors themselves, the plot and the ground stay. Garden surfaces are only cleared with the whole home.
 */
export function clearHome(levelId: Id | null): Command {
  return {
    type: 'ClearHome',
    label: levelId ? 'Clear floor' : 'Clear everything',
    apply(d: Draft) {
      const on = (l: Id) => levelId === null || l === levelId;
      removeWhere(d.walls, (w) => on(w.levelId));
      removeWhere(d.openings, (o) => !d.walls[o.wallId]);
      removeWhere(d.nodes, (n) => on(n.levelId));
      removeWhere(d.rooms, (r) => on(r.levelId));
      removeWhere(d.items, (i) => on(i.levelId));
      removeWhere(d.roofs, (r) => on(r.levelId));
      removeWhere(d.stairs, (s) => on(s.fromLevel) || on(s.toLevel));
      removeWhere(d.balconies, (b) => on(b.levelId));
      if (levelId === null) removeWhere(d.zones, () => true);
    },
  };
}

/** Delete a room with its contents: its furniture, and the walls (with doors / windows) that no other room uses. */
export function deleteRoom(roomId: Id): Command {
  return {
    type: 'DeleteRoom',
    label: 'Delete room',
    apply(d: Draft) {
      const room = d.rooms[roomId];
      if (!room) return;
      // Outline from the room's walls, in order around the loop.
      const pts: [number, number][] = [];
      let prev: Id | null = null;
      for (const wid of room.wallLoop) {
        const w = d.walls[wid];
        if (!w) continue;
        const start: Id = prev === null || prev === w.a ? w.a : w.b;
        const n = d.nodes[start];
        if (n) pts.push([n.p[0], n.p[1]]);
        prev = start === w.a ? w.b : w.a;
      }
      if (pts.length >= 3) {
        removeWhere(d.items, (i) => i.levelId === room.levelId && pointInPolygon([i.position[0], i.position[2]], pts));
      }
      const shared = new Set<Id>();
      for (const r of Object.values(d.rooms)) if (r.id !== roomId) for (const w of r.wallLoop) shared.add(w);
      for (const wid of room.wallLoop) if (!shared.has(wid)) delete d.walls[wid];
      removeWhere(d.openings, (o) => !d.walls[o.wallId]);
      delete d.rooms[roomId];
    },
  };
}
