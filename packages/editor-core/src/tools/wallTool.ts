import type { Vec2 } from '@hd/scene-schema';
import { addWall, NODE_MERGE_EPS_M } from '../commands/walls';
import type { Editor } from '../editor';
import type { SnapKind } from '../snapping/snap';

export type WallClickResult = 'started' | 'added' | 'closed' | 'ignored';

export interface WallTool {
  /** Last placed point of the chain being drawn, or null when idle. */
  readonly last: Vec2 | null;
  /**
   * Place a point. First click starts a chain; each further click adds a wall (one undo step each).
   * Landing on an existing node ends the chain (that is how loops close).
   */
  click(p: Vec2, snapKind: SnapKind): WallClickResult;
  /** End the current chain (Esc / double-click / Done). */
  finish(): void;
}

export function createWallTool(editor: Editor): WallTool {
  let last: Vec2 | null = null;
  return {
    get last() {
      return last;
    },
    click(p, snapKind) {
      if (!last) {
        last = [p[0], p[1]];
        return 'started';
      }
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) < NODE_MERGE_EPS_M) return 'ignored';
      editor.execute(addWall({ levelId: editor.getState().activeLevelId, from: last, to: p }));
      if (snapKind === 'node') {
        last = null;
        return 'closed';
      }
      last = [p[0], p[1]];
      return 'added';
    },
    finish() {
      last = null;
    },
  };
}
