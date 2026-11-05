import { LEVEL_HEIGHT_M, newId } from '@hd/scene-schema';
import type { Command } from '../types';

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
      d.levels[id] = { id, name: name ?? `Floor ${d.levelOrder.length}`, elevation, height };
      d.levelOrder.push(id);
    },
  };
}
