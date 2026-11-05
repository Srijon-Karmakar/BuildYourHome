import type { Id } from '@hd/scene-schema';

/** Which floors are drawn in 3D. */
export type FloorView = 'all' | 'below' | 'single';

/** Height (m) at which walls are cut in cutaway mode — low enough to look into every room from above. */
export const CUT_HEIGHT_M = 1.1;

export interface LevelVis {
  visible: boolean;
  /** Walls of this floor are drawn only up to CUT_HEIGHT_M and fixtures are hidden. */
  cut: boolean;
}

/**
 * Pure visibility rules for the 3D view.
 *  - all: every floor · below: this floor and the ones under it · single: only this floor.
 *  - Cutaway also hides every floor above the current one and cuts the current floor's walls low.
 *  - While walking cutaway is ignored (you are inside).
 */
export function levelVisibility(
  levels: ReadonlyArray<{ id: Id; elevation: number }>,
  activeId: Id,
  mode: FloorView,
  cutaway: boolean,
  walking: boolean,
): Record<Id, LevelVis> {
  const activeElev = levels.find((l) => l.id === activeId)?.elevation ?? 0;
  const cutting = cutaway && !walking;
  const out: Record<Id, LevelVis> = {};
  for (const l of levels) {
    let visible = mode === 'all' ? true : mode === 'below' ? l.elevation <= activeElev + 1e-9 : l.id === activeId;
    if (cutting && l.elevation > activeElev + 1e-9) visible = false;
    out[l.id] = { visible, cut: cutting && l.id === activeId };
  }
  return out;
}
