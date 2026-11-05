import {
  DEFAULT_MATERIAL_WALL,
  WALL_THICKNESS_EXTERIOR_M,
  WALL_THICKNESS_INTERIOR_M,
  newId,
  type Id,
  type Scene,
  type Vec2,
  type Wall,
} from '@hd/scene-schema';
import type { Command } from '../types';

/** Points closer than this (metres) on the same level are treated as the same node. */
export const NODE_MERGE_EPS_M = 1e-3;

function findNodeAt(d: Scene, levelId: Id, p: Vec2): Id | undefined {
  for (const n of Object.values(d.nodes)) {
    if (n.levelId === levelId && Math.hypot(n.p[0] - p[0], n.p[1] - p[1]) < NODE_MERGE_EPS_M) {
      return n.id;
    }
  }
  return undefined;
}

export interface AddWallParams {
  levelId: Id;
  from: Vec2;
  to: Vec2;
  kind?: Wall['kind'];
  thickness?: number;
  height?: number;
}

/** Adds a wall, reusing existing nodes at coincident points (so loops close automatically). */
export function addWall(params: AddWallParams, rng?: () => number): Command {
  const nodeA = newId('node', rng);
  const nodeB = newId('node', rng);
  const wallId = newId('wall', rng);
  return {
    type: 'AddWall',
    label: 'Add wall',
    apply(d) {
      const level = d.levels[params.levelId];
      if (!level) return;
      if (Math.hypot(params.to[0] - params.from[0], params.to[1] - params.from[1]) < NODE_MERGE_EPS_M) return;

      let a = findNodeAt(d, params.levelId, params.from);
      if (!a) {
        a = nodeA;
        d.nodes[a] = { id: a, levelId: params.levelId, p: [...params.from] };
      }
      let b = findNodeAt(d, params.levelId, params.to);
      if (!b) {
        b = nodeB;
        d.nodes[b] = { id: b, levelId: params.levelId, p: [...params.to] };
      }
      const dup = Object.values(d.walls).some(
        (w) => (w.a === a && w.b === b) || (w.a === b && w.b === a),
      );
      if (dup) return;

      const kind = params.kind ?? 'interior';
      d.walls[wallId] = {
        id: wallId,
        levelId: params.levelId,
        a,
        b,
        kind,
        thickness:
          params.thickness ?? (kind === 'interior' ? WALL_THICKNESS_INTERIOR_M : WALL_THICKNESS_EXTERIOR_M),
        height: params.height ?? level.height,
        materialA: { id: DEFAULT_MATERIAL_WALL },
        materialB: { id: DEFAULT_MATERIAL_WALL },
      };
    },
  };
}

export function moveNode(nodeId: Id, p: Vec2): Command {
  return {
    type: 'MoveNode',
    label: 'Move wall point',
    apply(d) {
      const n = d.nodes[nodeId];
      if (n) n.p = [p[0], p[1]];
    },
  };
}

export function removeWalls(wallIds: Id[]): Command {
  return {
    type: 'RemoveWalls',
    label: wallIds.length > 1 ? 'Delete walls' : 'Delete wall',
    apply(d) {
      for (const id of wallIds) delete d.walls[id];
      // postProcess removes orphan nodes, openings and broken rooms.
    },
  };
}

export type WallProps = Partial<Pick<Wall, 'thickness' | 'height' | 'kind' | 'materialA' | 'materialB'>>;

export function setWallProps(wallId: Id, props: WallProps): Command {
  return {
    type: 'SetWallProps',
    label: 'Edit wall',
    apply(d) {
      const w = d.walls[wallId];
      if (w) Object.assign(w, props);
    },
  };
}
