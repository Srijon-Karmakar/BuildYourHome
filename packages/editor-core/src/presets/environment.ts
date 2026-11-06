import { getAsset } from '@hd/assets';
import { newId, type Id, type Scene, type Vec2 } from '@hd/scene-schema';
import { houseBounds } from '../commands/plot';
import type { Command } from '../types';

/** The one-tap surroundings: ground, neighbours, roads, trees, water. */
export interface Environment {
  id: string;
  name: string;
  description: string;
  ground: string;
}

export const ENVIRONMENTS: readonly Environment[] = [
  { id: 'suburb', name: 'Suburb', description: 'Lawn, a street with pavement, two neighbours, trees', ground: 'ground-grass' },
  { id: 'village', name: 'Village', description: 'Earth, village houses, mango and neem trees, a pond', ground: 'ground-soil' },
  { id: 'hills', name: 'Hills', description: 'Green hills behind the house, trees, a pond', ground: 'ground-lawn-light' },
  { id: 'beach', name: 'Beach', description: 'Sand, coconut palms, water in front', ground: 'ground-sand' },
  { id: 'city', name: 'City edge', description: 'Paving, a road, apartment blocks, street lights', ground: 'ground-paving' },
];

export const getEnvironment = (id: string): Environment | undefined => ENVIRONMENTS.find((e) => e.id === id);

/** What one environment puts where, in metres relative to the house box (x east, z south). */
export interface Piece {
  asset: string;
  x: number;
  z: number;
  rot?: number;
  scale?: number;
}

/**
 * The scenery around a house whose outer walls span `min`..`max`.
 * North is up (−z), the street (when there is one) runs along the south.
 */
export function environmentPieces(id: string, min: Vec2, max: Vec2): Piece[] {
  const cx = (min[0] + max[0]) / 2;
  const cz = (min[1] + max[1]) / 2;
  const w = max[0] - min[0];
  const d = max[1] - min[1];
  const W = min[0] - 5; // west edge of the area
  const E = max[0] + 5;
  const N = min[1] - 5;
  const S = max[1] + 5;
  const out: Piece[] = [];
  const row = (asset: string, x0: number, x1: number, z: number, step: number, rot = 0, jitter = 0) => {
    for (let x = x0, i = 0; x <= x1 + 1e-6; x += step, i++) out.push({ asset, x, z: z + (i % 2 ? jitter : 0), rot });
  };
  switch (id) {
    case 'suburb': {
      out.push({ asset: 'road-straight', x: cx, z: S + 4.2, rot: Math.PI / 2, scale: 1 }, { asset: 'pavement', x: cx, z: S + 0.6, rot: Math.PI / 2 });
      out.push({ asset: 'neighbour-modern', x: W - 6, z: cz }, { asset: 'neighbour-villa', x: E + 7, z: cz });
      out.push({ asset: 'tree-neem', x: W + 0.5, z: S - 0.5 }, { asset: 'tree-gulmohar', x: E - 0.5, z: N + 1 }, { asset: 'tree-oak', x: cx + w * 0.4, z: N - 1.5 });
      out.push({ asset: 'hedge', x: cx - 3, z: S - 1 }, { asset: 'hedge', x: cx + 3, z: S - 1 }, { asset: 'street-light', x: cx - 6, z: S + 1.4 });
      break;
    }
    case 'village': {
      out.push({ asset: 'neighbour-hut', x: W - 4, z: cz - 2 }, { asset: 'neighbour-hut', x: E + 5, z: cz + 1 }, { asset: 'neighbour-hut', x: E + 4, z: N - 4 });
      out.push({ asset: 'tree-mango', x: W + 1, z: N + 1 }, { asset: 'tree-neem', x: E - 1, z: S - 1 }, { asset: 'tree-banyan', x: cx - w, z: N - 7 });
      out.push({ asset: 'pond-small', x: cx + w * 0.7, z: S + 3 }, { asset: 'lotus', x: cx + w * 0.7, z: S + 3 }, { asset: 'well', x: W + 1, z: S + 1 });
      out.push({ asset: 'tree-fruit', x: cx - w * 0.6, z: S + 0.5 }, { asset: 'tall-grass', x: E + 1, z: N + 3 }, { asset: 'water-tank', x: E - 1, z: N + 2 });
      break;
    }
    case 'hills': {
      out.push({ asset: 'hill', x: cx - 6, z: N - 11 }, { asset: 'hill', x: cx + 10, z: N - 9, scale: 1.3 }, { asset: 'mound', x: E + 3, z: cz });
      out.push({ asset: 'pond-round', x: cx - w * 0.6, z: S + 4 }, { asset: 'tree-cypress', x: W + 1, z: N + 1 }, { asset: 'tree-cypress', x: W + 1, z: cz });
      row('tree-birch', W - 2, E + 6, N - 3, 5, 0, 1.6);
      out.push({ asset: 'rock-cluster', x: E - 1, z: S + 1 }, { asset: 'fern', x: W + 2, z: S }, { asset: 'tree-willow', x: cx - w * 0.6 - 3.5, z: S + 4 });
      break;
    }
    case 'beach': {
      out.push({ asset: 'pond-large', x: cx - 8, z: S + 9, scale: 2 }, { asset: 'pond-large', x: cx + 8, z: S + 9, scale: 2 });
      row('tree-palm', W - 1, E + 3, S + 0.5, 6, 0, 1.8);
      out.push({ asset: 'tree-palm', x: W + 0.5, z: N + 1 }, { asset: 'sun-lounger', x: cx + 2, z: S + 2.5 }, { asset: 'sun-lounger', x: cx + 3.2, z: S + 2.5 }, { asset: 'patio-umbrella', x: cx + 2.6, z: S + 2.2 }, { asset: 'boulder', x: E, z: S + 3 });
      break;
    }
    case 'city': {
      out.push({ asset: 'road-straight', x: cx, z: S + 4.2, rot: Math.PI / 2 }, { asset: 'pavement', x: cx, z: S + 0.6, rot: Math.PI / 2 });
      out.push({ asset: 'apartment-block', x: W - 8, z: cz - 3 }, { asset: 'apartment-block', x: E + 9, z: cz + 2 }, { asset: 'neighbour-row', x: cx, z: N - 8 });
      row('street-light', cx - 12, cx + 12, S + 1.5, 8, Math.PI);
      out.push({ asset: 'bike-rack', x: cx - 4, z: S - 0.5 }, { asset: 'bush', x: W + 1, z: S - 0.5 }, { asset: 'bush', x: E - 1, z: S - 0.5 });
      break;
    }
    default:
  }
  void d;
  return out.filter((p) => getAsset(p.asset));
}

const ENV_TAG = 'env';

/**
 * Apply a surroundings preset: set the ground, remove the scenery of any earlier preset, and place the new one on the
 * ground floor around the house (or around the origin when nothing is drawn yet). One undo step.
 */
export function applyEnvironment(envId: string, rng?: () => number): Command {
  const env = getEnvironment(envId);
  return {
    type: 'ApplyEnvironment',
    label: env ? `Surroundings: ${env.name}` : 'Surroundings',
    apply(d: Scene) {
      const levelId: Id | undefined = d.levelOrder[0];
      if (!env || !levelId) return;
      for (const [id, it] of Object.entries(d.items)) if (it.tag === ENV_TAG) delete d.items[id];
      d.terrain.groundMaterial = { id: env.ground };
      const b = houseBounds(d) ?? { min: [-4, -3] as Vec2, max: [4, 3] as Vec2 };
      for (const p of environmentPieces(env.id, b.min, b.max)) {
        const id = newId('item', rng);
        const s = p.scale ?? 1;
        d.items[id] = {
          id,
          levelId,
          assetId: p.asset,
          position: [Math.round(p.x * 100) / 100, 0, Math.round(p.z * 100) / 100],
          rotationY: p.rot ?? 0,
          scale: [s, s, s],
          tag: ENV_TAG,
        };
      }
    },
  };
}

/** Remove the scenery that a surroundings preset placed (everything you placed yourself stays). */
export function clearEnvironment(): Command {
  return {
    type: 'ClearEnvironment',
    label: 'Clear surroundings',
    apply(d: Scene) {
      for (const [id, it] of Object.entries(d.items)) if (it.tag === ENV_TAG) delete d.items[id];
    },
  };
}

export const hasEnvironment = (scene: Scene): boolean => Object.values(scene.items).some((i) => i.tag === ENV_TAG);
