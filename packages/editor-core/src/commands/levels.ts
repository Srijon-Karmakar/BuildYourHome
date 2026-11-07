import { getAsset } from '@hd/assets';
import { LEVEL_HEIGHT_M, newId, type Id, type Scene } from '@hd/scene-schema';
import type { Command } from '../types';

export const MIN_LEVEL_HEIGHT_M = 2;
export const MAX_LEVEL_HEIGHT_M = 6;

/** A roof always sits on the top floor: when a floor is added above, the roof moves up with the new top. */
function moveRoofsUp(d: Scene, oldTop: Id | undefined, newTop: Id): void {
  if (!oldTop) return;
  for (const r of Object.values(d.roofs)) {
    if (r.levelId !== oldTop || r.box) continue; // roofs over a part of the plan stay where they are
    delete d.roofs[r.id];
    const id = `roof_${newTop}`;
    d.roofs[id] = { ...r, id, levelId: newTop };
  }
}

/** Adds a level on top of the current highest one. */
export function addLevel(name?: string, height: number = LEVEL_HEIGHT_M, rng?: () => number): Command {
  const id = newId('level', rng);
  return {
    type: 'AddLevel',
    label: 'Add floor',
    apply(d) {
      const topId = d.levelOrder[d.levelOrder.length - 1];
      const top = topId ? d.levels[topId] : undefined;
      const elevation = top ? top.elevation + top.height : 0;
      d.levels[id] = { id, name: name ?? `Floor ${d.levelOrder.length}`, elevation, height, autoRoof: true };
      d.levelOrder.push(id);
      moveRoofsUp(d, topId, id);
    },
  };
}

/** Make every level start where the one below ends (levels are stacked without gaps). Only writes on change. */
export function restackLevels(d: Scene): void {
  let elevation = 0;
  for (const id of d.levelOrder) {
    const lv = d.levels[id];
    if (!lv) continue;
    if (Math.abs(lv.elevation - elevation) > 1e-9) lv.elevation = elevation;
    elevation += lv.height;
  }
}

export interface LevelProps {
  name?: string;
  /** Floor-to-floor height in metres. Walls that followed the old height follow the new one. */
  height?: number;
}

export function setLevelProps(levelId: Id, props: LevelProps): Command {
  return {
    type: 'SetLevelProps',
    label: 'Edit floor',
    apply(d) {
      const lv = d.levels[levelId];
      if (!lv) return;
      if (props.name !== undefined) {
        const n = props.name.trim().slice(0, 40);
        if (n) lv.name = n;
      }
      if (props.height !== undefined) {
        const h = Math.min(MAX_LEVEL_HEIGHT_M, Math.max(MIN_LEVEL_HEIGHT_M, props.height));
        if (Math.abs(h - lv.height) > 1e-9) {
          const old = lv.height;
          lv.height = h;
          for (const w of Object.values(d.walls)) {
            if (w.levelId === levelId && Math.abs(w.height - old) < 1e-9) w.height = h;
          }
          // Lights hanging from the ceiling stay on the ceiling.
          for (const it of Object.values(d.items)) {
            if (it.levelId === levelId && getAsset(it.assetId)?.mount === 'ceiling') it.position = [it.position[0], h, it.position[2]];
          }
        }
      }
      // elevations of levels above are re-stacked by postProcess
    },
  };
}

/** Delete a floor and everything on it. The last remaining floor cannot be deleted. */
export function removeLevel(levelId: Id): Command {
  return {
    type: 'RemoveLevel',
    label: 'Delete floor',
    apply(d) {
      if (!d.levels[levelId] || d.levelOrder.length <= 1) return;
      const wallIds = new Set(Object.values(d.walls).filter((w) => w.levelId === levelId).map((w) => w.id));
      for (const id of wallIds) delete d.walls[id];
      for (const [id, n] of Object.entries(d.nodes)) if (n.levelId === levelId) delete d.nodes[id];
      for (const [id, o] of Object.entries(d.openings)) if (wallIds.has(o.wallId)) delete d.openings[id];
      for (const [id, r] of Object.entries(d.rooms)) if (r.levelId === levelId) delete d.rooms[id];
      for (const [id, it] of Object.entries(d.items)) if (it.levelId === levelId) delete d.items[id];
      for (const [id, r] of Object.entries(d.roofs)) if (r.levelId === levelId) delete d.roofs[id];
      for (const [id, s] of Object.entries(d.stairs)) if (s.fromLevel === levelId || s.toLevel === levelId) delete d.stairs[id];
      for (const [id, b] of Object.entries(d.balconies)) if (b.levelId === levelId) delete d.balconies[id];
      delete d.levels[levelId];
      d.levelOrder = d.levelOrder.filter((id) => id !== levelId);
    },
  };
}

/**
 * Duplicate a floor (walls, doors/windows, room names and materials) as a new floor on top of the building.
 * Ids are derived from one base id so the command stays deterministic.
 */
export function copyLevel(sourceId: Id, rng?: () => number): Command {
  const base = newId('level', rng);
  return {
    type: 'CopyLevel',
    label: 'Copy floor',
    apply(d) {
      const src = d.levels[sourceId];
      if (!src) return;
      const topId = d.levelOrder[d.levelOrder.length - 1];
      const top = topId ? d.levels[topId] : undefined;
      d.levels[base] = {
        id: base,
        name: `Floor ${d.levelOrder.length}`,
        elevation: top ? top.elevation + top.height : 0,
        height: src.height,
        autoRoof: true,
      };
      d.levelOrder.push(base);
      moveRoofsUp(d, topId, base);

      const nodeMap = new Map<Id, Id>();
      for (const n of Object.values(d.nodes)) {
        if (n.levelId !== sourceId) continue;
        const id = `${base}.n${nodeMap.size}`;
        nodeMap.set(n.id, id);
        d.nodes[id] = { id, levelId: base, p: [n.p[0], n.p[1]] };
      }
      const wallMap = new Map<Id, Id>();
      for (const w of Object.values(d.walls)) {
        if (w.levelId !== sourceId) continue;
        const a = nodeMap.get(w.a);
        const b = nodeMap.get(w.b);
        if (!a || !b) continue;
        const id = `${base}.w${wallMap.size}`;
        wallMap.set(w.id, id);
        d.walls[id] = { ...w, id, levelId: base, a, b, materialA: { ...w.materialA }, materialB: { ...w.materialB } };
      }
      let k = 0;
      for (const o of Object.values(d.openings)) {
        const wid = wallMap.get(o.wallId);
        if (!wid) continue;
        const id = `${base}.o${k++}`;
        d.openings[id] = { ...o, id, wallId: wid, flip: { ...o.flip } };
      }
      k = 0;
      for (const it of Object.values(d.items)) {
        if (it.levelId !== sourceId) continue;
        const id = `${base}.i${k++}`;
        d.items[id] = { ...it, id, levelId: base, position: [it.position[0], it.position[1], it.position[2]], scale: [it.scale[0], it.scale[1], it.scale[2]] };
      }
      // Rooms are re-detected from the copied walls; copying them first keeps names and floor materials.
      k = 0;
      for (const r of Object.values(d.rooms)) {
        if (r.levelId !== sourceId) continue;
        const loop = r.wallLoop.map((id) => wallMap.get(id));
        if (loop.some((id) => !id)) continue;
        const id = `${base}.r${k++}`;
        d.rooms[id] = {
          ...r,
          id,
          levelId: base,
          wallLoop: loop as Id[],
          floorMaterial: { ...r.floorMaterial },
          ceilingMaterial: r.ceilingMaterial ? { ...r.ceilingMaterial } : undefined,
        };
      }
    },
  };
}
