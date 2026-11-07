import { getAsset, itemFootprint } from '@hd/assets';
import { lineLength, nearRoad, pointInPolygon, ROAD_DEFAULT_WIDTH_M, samplePath } from '@hd/geometry';
import { newId, type Id, type Scene, type Vec2 } from '@hd/scene-schema';
import { houseBounds } from '../commands/plot';
import type { Command } from '../types';

/**
 * Neighbours along a road: houses, shops and trees on both sides, facing the road, with people, animals and vehicles
 * in the street. Everything placed is tagged `street:<road id>` so filling again replaces it and Clear removes it.
 */

interface Choice {
  asset: string;
  weight: number;
  /** At most this many on one road. */
  max?: number;
}

export interface StreetStyle {
  id: string;
  name: string;
  description: string;
  /** Distance from the pavement edge (or kerb) to the front of a building. */
  setback: number;
  /** Space between two buildings (min, max). */
  gap: [number, number];
  buildings: Choice[];
  trees: string[];
  /** Chance (0–1) of a tree in the front garden of each building. */
  treeChance: number;
  /** One street-life item about this often along each side (metres). */
  lifeEvery: number;
  life: Array<Choice & { where: 'pavement' | 'lane' | 'verge' }>;
}

export const STREET_STYLES: readonly StreetStyle[] = [
  {
    id: 'suburb',
    name: 'Suburb',
    description: 'Houses with front gardens and trees',
    setback: 5,
    gap: [2, 5],
    buildings: [
      { asset: 'neighbour-modern', weight: 3 },
      { asset: 'neighbour-villa', weight: 3 },
      { asset: 'neighbour-bungalow', weight: 3 },
      { asset: 'neighbour-row', weight: 1 },
    ],
    trees: ['tree-neem', 'tree-gulmohar', 'tree-oak', 'tree-round'],
    treeChance: 0.7,
    lifeEvery: 24,
    life: [
      { asset: 'person-walking', weight: 4, where: 'pavement' },
      { asset: 'dog', weight: 2, where: 'verge' },
      { asset: 'car', weight: 3, where: 'lane' },
      { asset: 'motorbike', weight: 1, where: 'lane' },
    ],
  },
  {
    id: 'village',
    name: 'Village',
    description: 'Tiled huts, farms, a temple, cows and mango trees',
    setback: 3.5,
    gap: [3, 9],
    buildings: [
      { asset: 'neighbour-hut', weight: 6 },
      { asset: 'neighbour-bungalow', weight: 2 },
      { asset: 'neighbour-farm', weight: 1, max: 2 },
      { asset: 'neighbour-temple', weight: 1, max: 1 },
    ],
    trees: ['tree-mango', 'tree-neem', 'tree-banyan', 'tree-palm'],
    treeChance: 0.85,
    lifeEvery: 20,
    life: [
      { asset: 'cow', weight: 4, where: 'verge' },
      { asset: 'dog', weight: 3, where: 'verge' },
      { asset: 'person-walking', weight: 3, where: 'verge' },
      { asset: 'auto-rickshaw', weight: 2, where: 'lane' },
      { asset: 'bicycle', weight: 2, where: 'lane' },
    ],
  },
  {
    id: 'city',
    name: 'City',
    description: 'Shop rows, flats, offices, buses and crowds',
    setback: 1.2,
    gap: [0, 1.5],
    buildings: [
      { asset: 'neighbour-shops', weight: 4 },
      { asset: 'apartment-block', weight: 3 },
      { asset: 'neighbour-row', weight: 2 },
      { asset: 'neighbour-tower', weight: 1, max: 3 },
      { asset: 'neighbour-school', weight: 1, max: 1 },
    ],
    trees: ['bush'],
    treeChance: 0.15,
    lifeEvery: 12,
    life: [
      { asset: 'person-walking', weight: 5, where: 'pavement' },
      { asset: 'person-standing', weight: 3, where: 'pavement' },
      { asset: 'auto-rickshaw', weight: 3, where: 'lane' },
      { asset: 'car', weight: 4, where: 'lane' },
      { asset: 'bus', weight: 1, where: 'lane' },
      { asset: 'motorbike', weight: 2, where: 'lane' },
    ],
  },
  {
    id: 'bungalows',
    name: 'Bungalows',
    description: 'Large villas with deep gardens',
    setback: 7,
    gap: [4, 8],
    buildings: [
      { asset: 'neighbour-bungalow', weight: 4 },
      { asset: 'neighbour-villa', weight: 3 },
      { asset: 'neighbour-modern', weight: 2 },
    ],
    trees: ['tree-neem', 'tree-gulmohar', 'tree-mango', 'tree-cypress', 'tree-palm'],
    treeChance: 0.95,
    lifeEvery: 40,
    life: [
      { asset: 'person-walking', weight: 3, where: 'pavement' },
      { asset: 'dog', weight: 2, where: 'verge' },
      { asset: 'car', weight: 2, where: 'lane' },
    ],
  },
  {
    id: 'apartments',
    name: 'Apartments',
    description: 'Blocks of flats, a tower and a bus stop',
    setback: 4,
    gap: [3, 6],
    buildings: [
      { asset: 'apartment-block', weight: 5 },
      { asset: 'neighbour-tower', weight: 1, max: 2 },
      { asset: 'neighbour-shops', weight: 1, max: 2 },
    ],
    trees: ['tree-round', 'tree-neem', 'bush'],
    treeChance: 0.5,
    lifeEvery: 20,
    life: [
      { asset: 'person-walking', weight: 4, where: 'pavement' },
      { asset: 'bus-shelter', weight: 1, max: 2, where: 'pavement' },
      { asset: 'car', weight: 3, where: 'lane' },
      { asset: 'auto-rickshaw', weight: 1, where: 'lane' },
    ],
  },
];

export const getStreetStyle = (id: string): StreetStyle | undefined => STREET_STYLES.find((s) => s.id === id);

export const MAX_STREET_BUILDINGS = 24;
const MAX_STREET_EXTRAS = 48;

export interface StreetPiece {
  asset: string;
  x: number;
  z: number;
  rot: number;
  scale: number;
  /** Colour override (wall colour, car paint, clothes). Unset = the model's own. */
  variant?: string;
}

export interface StreetOptions {
  /** Trees in the front gardens. Default true. */
  trees?: boolean;
  /** People, animals and vehicles. Default true. */
  life?: boolean;
}

export const streetTag = (roadId: Id): string => `street:${roadId}`;

// ---- small helpers -----------------------------------------------------------------------------------------------

/** A repeatable random stream: the same seed always gives the same street. */
function stream(seed: number): () => number {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted<T extends Choice>(list: readonly T[], rng: () => number, used: Map<string, number>): T | null {
  const open = list.filter((p) => p.max === undefined || (used.get(p.asset) ?? 0) < p.max);
  const total = open.reduce((s, p) => s + p.weight, 0);
  if (total <= 0) return null;
  let r = rng() * total;
  for (const p of open) {
    r -= p.weight;
    if (r <= 0) return p;
  }
  return open[open.length - 1] ?? null;
}

type Poly = readonly Vec2[];

/** Do two convex outlines overlap (closer than `gap`)? Separating-axis test on both outlines' edges. */
function overlaps(a: Poly, b: Poly, gap = 0): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i]!;
      const q = poly[(i + 1) % poly.length]!;
      const ax = q[1] - p[1];
      const az = p[0] - q[0];
      const len = Math.hypot(ax, az) || 1;
      let aMin = Infinity, aMax = -Infinity, bMin = Infinity, bMax = -Infinity;
      for (const v of a) {
        const t = (v[0] * ax + v[1] * az) / len;
        aMin = Math.min(aMin, t);
        aMax = Math.max(aMax, t);
      }
      for (const v of b) {
        const t = (v[0] * ax + v[1] * az) / len;
        bMin = Math.min(bMin, t);
        bMax = Math.max(bMax, t);
      }
      if (aMax + gap < bMin || bMax + gap < aMin) return false;
    }
  }
  return true;
}

const rectOf = (min: Vec2, max: Vec2): Vec2[] => [min, [max[0], min[1]], max, [min[0], max[1]]];

/** Points to test a footprint at: corners, edge middles and the centre. */
function samples(poly: Poly): Vec2[] {
  const out: Vec2[] = [];
  let cx = 0, cz = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % poly.length]!;
    out.push(p, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]);
    cx += p[0];
    cz += p[1];
  }
  out.push([cx / poly.length, cz / poly.length]);
  return out;
}

/** Grow an outline away from its centre by `by` metres (good enough for a plot boundary). */
function grow(poly: Poly, by: number): Vec2[] {
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
  const cz = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  return poly.map((p): Vec2 => {
    const dx = p[0] - cx;
    const dz = p[1] - cz;
    const l = Math.hypot(dx, dz) || 1;
    return [p[0] + (dx / l) * by, p[1] + (dz / l) * by];
  });
}

// ---- the plan ----------------------------------------------------------------------------------------------------

/**
 * Where the neighbours, trees and street life go along one road. Pure: the same scene, road, style and seed give the
 * same pieces. Things already in the scene (your house, plot, items, other roads) are kept clear.
 */
export function planStreet(scene: Scene, roadId: Id, styleId: string, seed = 1, options: StreetOptions = {}): StreetPiece[] {
  const road = scene.zones[roadId];
  const style = getStreetStyle(styleId);
  if (!road || road.shape !== 'road' || !road.road || !style) return [];
  const pts = road.points.map((p): Vec2 => [p[0], p[1]]);
  if (pts.length < 2) return [];
  const rng = stream(seed * 7919 + 13);
  const width = road.width ?? ROAD_DEFAULT_WIDTH_M;
  const length = lineLength(pts);
  const tag = streetTag(roadId);

  // Things to keep clear: the plot, the house, the other roads, and what is already placed (not by this street).
  const house = houseBounds(scene);
  const houseBox = house ? rectOf([house.min[0] - 3, house.min[1] - 3], [house.max[0] + 3, house.max[1] + 3]) : null;
  const plot = scene.plot?.boundary && scene.plot.boundary.length >= 3 ? grow(scene.plot.boundary.map((p): Vec2 => [p[0], p[1]]), 2) : null;
  const others = Object.values(scene.zones).filter((z) => z.shape === 'road' && z.id !== roadId);
  const levelId = scene.levelOrder[0];
  const kept: Poly[] = [];
  for (const it of Object.values(scene.items)) {
    if (it.tag === tag || it.levelId !== levelId) continue;
    const a = getAsset(it.assetId);
    if (!a || a.mount !== 'floor' || Math.max(a.size[0], a.size[1]) < 0.6) continue;
    kept.push(itemFootprint(a, [it.position[0], it.position[2]], it.rotationY, it.scale));
  }
  const placed: Poly[] = [];

  const clearOfRoads = (p: Vec2, margin: number): boolean => {
    if (nearRoad(pts, width, p, Math.max(road.road!.pavLeft, road.road!.pavRight) + margin)) return false;
    return !others.some((o) => nearRoad(o.points, o.width ?? ROAD_DEFAULT_WIDTH_M, p, Math.max(o.road?.pavLeft ?? 0, o.road?.pavRight ?? 0) + margin));
  };
  const fits = (poly: Poly, gap: number): boolean => {
    const probes = samples(poly);
    if (!probes.every((p) => clearOfRoads(p, 0.6))) return false;
    if (houseBox && overlaps(poly, houseBox)) return false;
    if (plot && (probes.some((p) => pointInPolygon(p, plot)) || plot.some((v) => pointInPolygon(v, poly)))) return false;
    if (kept.some((k) => overlaps(poly, k, 0.3))) return false;
    return !placed.some((k) => overlaps(poly, k, gap));
  };

  const pieces: StreetPiece[] = [];
  const used = new Map<string, number>();
  const wantTrees = options.trees !== false;
  const wantLife = options.life !== false;
  const side = (sign: 1 | -1) => ({
    pav: sign === 1 ? road.road!.pavLeft : road.road!.pavRight,
    normal: (dir: Vec2): Vec2 => (sign === 1 ? [-dir[1], dir[0]] : [dir[1], -dir[0]]),
  });

  // 1. Buildings along both sides, one after the other.
  let buildings = 0;
  for (const sign of [1, -1] as const) {
    const sd = side(sign);
    const edge = width / 2 + sd.pav + style.setback;
    let s = rng() * 4;
    let guard = 0;
    while (s < length && buildings < MAX_STREET_BUILDINGS && guard++ < 200) {
      const pick = pickWeighted(style.buildings, rng, used);
      const asset = pick && getAsset(pick.asset);
      if (!pick || !asset) break;
      const k = 0.9 + rng() * 0.25;
      const w = asset.size[0] * k;
      const dp = asset.size[1] * k;
      const mid = Math.min(length, s + w / 2);
      const { p, dir } = samplePath(pts, mid);
      const n = sd.normal(dir);
      const centre: Vec2 = [p[0] + n[0] * (edge + dp / 2), p[1] + n[1] * (edge + dp / 2)];
      const rot = Math.atan2(-n[0], -n[1]); // the front (+z) looks at the road
      const poly = itemFootprint(asset, centre, rot, [k, k, k]);
      if (fits(poly, 0.8)) {
        pieces.push({ asset: pick.asset, x: centre[0], z: centre[1], rot, scale: k, variant: colourFor(pick.asset, rng, true) });
        placed.push(poly);
        used.set(pick.asset, (used.get(pick.asset) ?? 0) + 1);
        buildings++;
        // A tree in the front garden, to one side of the door.
        if (wantTrees && style.trees.length > 0 && rng() < style.treeChance) {
          const tree = style.trees[Math.floor(rng() * style.trees.length)]!;
          const ta = getAsset(tree);
          if (ta) {
            const along = (rng() < 0.5 ? -1 : 1) * (w / 2 - 1 + rng() * 1.2);
            const q: Vec2 = [p[0] + dir[0] * along + n[0] * (edge - style.setback * 0.45), p[1] + dir[1] * along + n[1] * (edge - style.setback * 0.45)];
            const tk = 0.85 + rng() * 0.4;
            const tp = itemFootprint(ta, q, 0, [tk, tk, tk]);
            if (style.setback >= 3 && fits(tp, 0.3)) {
              pieces.push({ asset: tree, x: q[0], z: q[1], rot: rng() * Math.PI * 2, scale: tk });
              placed.push(tp);
            }
          }
        }
        s += w + style.gap[0] + rng() * (style.gap[1] - style.gap[0]);
      } else {
        s += 2; // blocked here (a junction, your plot, ...): try a little further on
      }
    }
  }

  // 2. Street life: people on the pavement, animals at the verge, vehicles in the lanes.
  if (wantLife && style.life.length > 0) {
    let extras = 0;
    for (const sign of [1, -1] as const) {
      const sd = side(sign);
      let s = style.lifeEvery * (0.3 + rng() * 0.7);
      while (s < length && extras < MAX_STREET_EXTRAS) {
        const pick = pickWeighted(style.life, rng, used);
        const asset = pick && getAsset(pick.asset);
        if (pick && asset) {
          const { p, dir } = samplePath(pts, s);
          const n = sd.normal(dir);
          let off: number;
          let heading: Vec2;
          if (pick.where === 'lane') {
            off = width / 4; // the middle of this side's lane(s)
            // Traffic keeps left: on the side `n` points to, vehicles travel against the direction you drew.
            heading = sign === 1 ? [-dir[0], -dir[1]] : [dir[0], dir[1]];
          } else if (pick.where === 'pavement') {
            off = width / 2 + (sd.pav > 0.8 ? sd.pav * (0.35 + rng() * 0.4) : 0.9);
            heading = rng() < 0.5 ? dir : [-dir[0], -dir[1]];
          } else {
            off = width / 2 + sd.pav + 0.6 + rng() * 1.2;
            heading = rng() < 0.6 ? dir : [-dir[0], -dir[1]];
          }
          const jitter = pick.where === 'lane' ? 0 : (rng() - 0.5) * 0.5;
          const pos: Vec2 = [p[0] + n[0] * (off + jitter), p[1] + n[1] * (off + jitter)];
          // Not in a junction, and not on top of a building or a tree.
          const poly = itemFootprint(asset, pos, Math.atan2(heading[0], heading[1]), [1, 1, 1]);
          const inJunction = others.some((o) => nearRoad(o.points, o.width ?? ROAD_DEFAULT_WIDTH_M, pos, 2.5));
          if (!inJunction && !(houseBox && overlaps(poly, houseBox)) && !placed.some((k) => overlaps(poly, k, 0.2)) && !kept.some((k) => overlaps(poly, k, 0.2))) {
            const facingBuilding = pick.where !== 'lane' && asset.id.startsWith('person') && rng() < 0.3;
            const rot = facingBuilding ? Math.atan2(n[0], n[1]) : Math.atan2(heading[0], heading[1]);
            pieces.push({ asset: pick.asset, x: pos[0], z: pos[1], rot, scale: 1, variant: colourFor(pick.asset, rng, false) });
            placed.push(poly);
            used.set(pick.asset, (used.get(pick.asset) ?? 0) + 1);
            extras++;
          }
        }
        s += style.lifeEvery * (0.6 + rng() * 0.8);
      }
    }
  }
  return pieces;
}

/** A colour for one piece: buildings mostly keep their own look; cars, clothes and the like vary every time. */
function colourFor(asset: string, rng: () => number, mostlyOwn: boolean): string | undefined {
  const list = getAsset(asset)?.colors;
  if (!list || list.length < 2) return undefined;
  if (mostlyOwn && rng() < 0.5) return undefined;
  return list[(mostlyOwn ? 1 : 0) + Math.floor(rng() * (list.length - (mostlyOwn ? 1 : 0)))]!.id;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Take away what an earlier fill of this road placed. */
function removeStreet(d: Scene, roadId: Id): void {
  const tag = streetTag(roadId);
  for (const [id, it] of Object.entries(d.items)) if (it.tag === tag) delete d.items[id];
}

/**
 * Fill both sides of a road with neighbours (see `planStreet`). Filling again replaces the earlier fill; try another
 * `seed` for a different street. One undo step.
 */
export function fillStreet(roadId: Id, styleId: string, seed = 1, options: StreetOptions = {}, rng?: () => number): Command {
  const style = getStreetStyle(styleId);
  return {
    type: 'FillStreet',
    label: style ? `Neighbours: ${style.name}` : 'Neighbours',
    apply(d: Scene) {
      const levelId = d.levelOrder[0];
      if (!style || !levelId || d.zones[roadId]?.shape !== 'road') return;
      removeStreet(d, roadId);
      const tag = streetTag(roadId);
      for (const p of planStreet(d, roadId, styleId, seed, options)) {
        const id = newId('item', rng);
        d.items[id] = { id, levelId, assetId: p.asset, position: [r2(p.x), 0, r2(p.z)], rotationY: p.rot, scale: [p.scale, p.scale, p.scale], ...(p.variant ? { variant: p.variant } : {}), tag };
      }
    },
  };
}

/** Remove the neighbours and street life that `fillStreet` placed along a road (anything you placed yourself stays). */
export function clearStreet(roadId: Id): Command {
  return {
    type: 'ClearStreet',
    label: 'Clear neighbours',
    apply(d: Scene) {
      removeStreet(d, roadId);
    },
  };
}

export const streetItemCount = (scene: Scene, roadId: Id): number => {
  const tag = streetTag(roadId);
  return Object.values(scene.items).filter((i) => i.tag === tag).length;
};
