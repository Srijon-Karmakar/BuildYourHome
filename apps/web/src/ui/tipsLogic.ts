import type { Scene } from '@hd/scene-schema';

export type TipId = 'wall' | 'close' | 'door' | 'furnish' | 'walk';

export interface Tip {
  id: TipId;
  text: string;
  /** Label of the button that does the step for you (none for steps the user must do on the canvas). */
  action?: string;
}

/**
 * The next sensible step for a beginner, derived only from what the home contains — so it is always right,
 * survives reloads, and never needs to be "advanced". Null once the basics are done.
 */
export function nextTip(scene: Scene, hasWalked: boolean): Tip | null {
  const walls = Object.keys(scene.walls).length;
  if (walls === 0) return { id: 'wall', text: 'Draw your walls: click each corner, then Esc.', action: 'Wall tool' };
  if (Object.keys(scene.rooms).length === 0) return { id: 'close', text: 'Click your first corner again to close the room.' };
  if (Object.keys(scene.openings).length === 0) return { id: 'door', text: 'Add a door: pick it, then click a wall.', action: 'Door tool' };
  if (Object.keys(scene.items).length === 0) return { id: 'furnish', text: 'Furnish it: choose a sofa, bed or table.', action: 'Furniture' };
  if (!hasWalked) return { id: 'walk', text: 'Look around your home in first person.', action: 'Walk' };
  return null;
}
