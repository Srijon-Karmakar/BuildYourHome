import { newId, type Id, type Vec3 } from '@hd/scene-schema';
import type { Command } from '../types';

export const MAX_VIEWPOINTS = 24;

/** Remember a 3D camera angle. Returns the command; the new viewpoint's id is `command.viewId`. */
export function saveViewpoint(name: string, position: Vec3, target: Vec3, fov: number, rng?: () => number): Command & { viewId: Id } {
  const id = newId('view', rng);
  return {
    type: 'SaveViewpoint',
    label: 'Save view',
    viewId: id,
    apply(d) {
      if (Object.keys(d.viewpoints).length >= MAX_VIEWPOINTS) return;
      if (![...position, ...target, fov].every(Number.isFinite)) return;
      d.viewpoints[id] = {
        id,
        name: name.trim().slice(0, 40) || `View ${Object.keys(d.viewpoints).length + 1}`,
        position: [...position] as Vec3,
        target: [...target] as Vec3,
        fov: Math.min(120, Math.max(10, fov)),
      };
    },
  };
}

export function renameViewpoint(id: Id, name: string): Command {
  return {
    type: 'RenameViewpoint',
    label: 'Rename view',
    apply(d) {
      const v = d.viewpoints[id];
      const n = name.trim().slice(0, 40);
      if (v && n) v.name = n;
    },
  };
}

export function removeViewpoint(id: Id): Command {
  return {
    type: 'RemoveViewpoint',
    label: 'Delete view',
    apply(d) {
      delete d.viewpoints[id];
    },
  };
}
