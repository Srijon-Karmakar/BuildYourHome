import { getAsset } from '@hd/assets';
import { lineLength, nearRoad, pointInPolygon, ROAD_DEFAULT_WIDTH_M } from '@hd/geometry';
import type { EnvironmentSettings, Scene, ScenerySide, SceneryKind, Vec2 } from '@hd/scene-schema';
import { stream } from '../random';
import type { Command } from '../types';
import { houseBounds } from './plot';

/**
 * The environment editor: what stands far away on each side of the home, the sky and air, ground detail and a ring of
 * trees. The settings live in `scene.lighting.environment`; every field is optional and unset means the default
 * (open flat land, so no mountains until someone asks for them).
 */

/** The four directions the scenery can stand in (north is up on the plan). */
export const COMPASS_SIDES = ['north', 'east', 'south', 'west'] as const;
export type CompassSide = (typeof COMPASS_SIDES)[number];

export const SCENERY_KINDS: ReadonlyArray<{ id: SceneryKind; label: string }> = [
  { id: 'plains', label: 'Open land' },
  { id: 'hills', label: 'Hills' },
  { id: 'mountains', label: 'Mountains' },
  { id: 'forest', label: 'Forest' },
  { id: 'sea', label: 'Sea' },
  { id: 'desert', label: 'Desert' },
  { id: 'city', label: 'City' },
];

export const SCENERY_TONES: ReadonlyArray<{ id: NonNullable<ScenerySide['tone']>; label: string }> = [
  { id: 'natural', label: 'Natural' },
  { id: 'green', label: 'Green' },
  { id: 'golden', label: 'Golden' },
  { id: 'rocky', label: 'Rocky' },
  { id: 'misty', label: 'Misty' },
];

export const SCENERY_HEIGHTS: ReadonlyArray<{ id: string; label: string; value: number }> = [
  { id: 'low', label: 'Low', value: 0.55 },
  { id: 'normal', label: 'Normal', value: 1 },
  { id: 'tall', label: 'Tall', value: 1.6 },
];

export type Clouds = NonNullable<EnvironmentSettings['clouds']>;
export type Haze = NonNullable<EnvironmentSettings['haze']>;
export type SkyLook = NonNullable<EnvironmentSettings['sky']>;
export type GroundDetailAmount = NonNullable<EnvironmentSettings['detail']>;
export type TreeRing = NonNullable<EnvironmentSettings['trees']>;
export type TreeKind = NonNullable<EnvironmentSettings['treeKind']>;

/** The whole environment with every default filled in. */
export interface ResolvedEnvironment {
  sides: Record<CompassSide, Required<ScenerySide>>;
  /** null = the weather decides how cloudy it is. */
  clouds: Clouds | null;
  haze: Haze;
  sky: SkyLook;
  birds: boolean;
  detail: GroundDetailAmount;
  trees: TreeRing;
  treeKind: TreeKind;
}

const DEFAULT_SIDE: Required<ScenerySide> = { kind: 'plains', height: 1, tone: 'natural', snow: false };
const clampHeight = (h: number) => Math.round(Math.min(1.8, Math.max(0.4, h)) * 100) / 100;

/** Fill in the defaults. Homes from before the editor (a `horizon` and no `environment`) keep what they showed. */
export function resolveEnvironment(lighting: Scene['lighting']): ResolvedEnvironment {
  const e = lighting.environment;
  const legacy: SceneryKind = !e && lighting.horizon === 'hills' ? 'hills' : !e && lighting.horizon === 'city' ? 'city' : 'plains';
  const side = (s: CompassSide): Required<ScenerySide> => {
    const v = e?.sides?.[s];
    return { ...DEFAULT_SIDE, kind: legacy, ...(v ?? {}), height: clampHeight(v?.height ?? 1) } as Required<ScenerySide>;
  };
  return {
    sides: { north: side('north'), east: side('east'), south: side('south'), west: side('west') },
    clouds: e?.clouds ?? null,
    haze: e?.haze ?? 'light',
    sky: e?.sky ?? 'natural',
    birds: e?.birds ?? true,
    detail: e?.detail ?? 'some',
    trees: e?.trees ?? 'none',
    treeKind: e?.treeKind ?? 'mixed',
  };
}

/** The shortest form: only what differs from the defaults is stored. */
export function encodeEnvironment(r: ResolvedEnvironment): EnvironmentSettings | undefined {
  const out: EnvironmentSettings = {};
  const sides: NonNullable<EnvironmentSettings['sides']> = {};
  for (const s of COMPASS_SIDES) {
    const v = r.sides[s];
    if (v.kind === 'plains') continue;
    sides[s] = {
      kind: v.kind,
      ...(v.height !== 1 ? { height: clampHeight(v.height) } : {}),
      ...(v.tone !== 'natural' ? { tone: v.tone } : {}),
      ...(v.snow ? { snow: true } : {}),
    };
  }
  if (Object.keys(sides).length) out.sides = sides;
  if (r.clouds) out.clouds = r.clouds;
  if (r.haze !== 'light') out.haze = r.haze;
  if (r.sky !== 'natural') out.sky = r.sky;
  if (!r.birds) out.birds = false;
  if (r.detail !== 'some') out.detail = r.detail;
  if (r.trees !== 'none') out.trees = r.trees;
  if (r.treeKind !== 'mixed') out.treeKind = r.treeKind;
  return Object.keys(out).length ? out : undefined;
}

function write(d: Scene, r: ResolvedEnvironment): void {
  const enc = encodeEnvironment(r);
  if (enc) d.lighting.environment = enc;
  else delete d.lighting.environment;
  delete d.lighting.horizon; // now carried by `environment`
}

export interface EnvironmentPatch {
  sides?: Partial<Record<CompassSide, Partial<ScenerySide>>>;
  /** null puts a field back to its default (for `clouds`: the weather decides). */
  clouds?: Clouds | null;
  haze?: Haze;
  sky?: SkyLook;
  birds?: boolean;
  detail?: GroundDetailAmount;
  trees?: TreeRing;
  treeKind?: TreeKind;
}

/** Change some of the environment settings, as one undo step. */
export function updateEnvironment(patch: EnvironmentPatch): Command {
  return {
    type: 'UpdateEnvironment',
    label: 'Change environment',
    apply(d) {
      const r = resolveEnvironment(d.lighting);
      for (const s of COMPASS_SIDES) {
        const p = patch.sides?.[s];
        if (!p) continue;
        const next = { ...r.sides[s], ...p };
        if (p.height !== undefined) next.height = clampHeight(p.height);
        r.sides[s] = next;
      }
      if (patch.clouds !== undefined) r.clouds = patch.clouds;
      if (patch.haze !== undefined) r.haze = patch.haze;
      if (patch.sky !== undefined) r.sky = patch.sky;
      if (patch.birds !== undefined) r.birds = patch.birds;
      if (patch.detail !== undefined) r.detail = patch.detail;
      if (patch.trees !== undefined) r.trees = patch.trees;
      if (patch.treeKind !== undefined) r.treeKind = patch.treeKind;
      write(d, r);
    },
  };
}

/** Change the scenery on one side, or on all four at once. */
export function setScenery(side: CompassSide | 'all', patch: Partial<ScenerySide>): Command {
  const sides: NonNullable<EnvironmentPatch['sides']> = {};
  for (const s of side === 'all' ? COMPASS_SIDES : [side]) sides[s] = patch;
  const cmd = updateEnvironment({ sides });
  return { ...cmd, type: 'SetScenery', label: 'Change scenery' };
}

/** Ready-made environments to start from. They change the environment only, never the ground or what you placed. */
export interface EnvironmentLook {
  id: string;
  name: string;
  description: string;
  settings: EnvironmentSettings;
}

const all = (side: ScenerySide): NonNullable<EnvironmentSettings['sides']> => ({ north: side, east: side, south: side, west: side });

export const ENVIRONMENT_LOOKS: readonly EnvironmentLook[] = [
  { id: 'plains', name: 'Open land', description: 'Flat land to the horizon, a few clouds', settings: {} },
  {
    id: 'village',
    name: 'Village',
    description: 'Low green hills behind, woods on one side, neem trees',
    settings: { sides: { north: { kind: 'hills', height: 0.55, tone: 'green' }, west: { kind: 'forest', height: 0.6 } }, clouds: 'few', trees: 'sparse', treeKind: 'neem' },
  },
  {
    id: 'hills',
    name: 'Hill station',
    description: 'Snow mountains to the north, hills round, many clouds and pines',
    settings: { sides: { north: { kind: 'mountains', height: 1.3, snow: true }, east: { kind: 'hills' }, west: { kind: 'hills', tone: 'green' } }, clouds: 'many', sky: 'deep', trees: 'sparse', treeKind: 'pine' },
  },
  {
    id: 'coast',
    name: 'Coast',
    description: 'Sea to the south, low land, coconut palms',
    settings: { sides: { south: { kind: 'sea' }, east: { kind: 'sea' }, west: { kind: 'hills', height: 0.45, tone: 'green' } }, clouds: 'few', sky: 'deep', trees: 'sparse', treeKind: 'palm' },
  },
  {
    id: 'desert',
    name: 'Desert',
    description: 'Dunes all round, distant golden mountains, clear sky',
    settings: { sides: { ...all({ kind: 'desert' }), north: { kind: 'mountains', height: 0.7, tone: 'golden' } }, clouds: 'none', sky: 'pale', birds: false },
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Woods on every side, a thick ring of trees',
    settings: { sides: all({ kind: 'forest' }), clouds: 'few', haze: 'misty', trees: 'dense', detail: 'lots' },
  },
  {
    id: 'city',
    name: 'City',
    description: 'Skyline on every side, hazy air, no birds',
    settings: { sides: all({ kind: 'city' }), clouds: 'few', birds: false },
  },
];

export const getEnvironmentLook = (id: string): EnvironmentLook | undefined => ENVIRONMENT_LOOKS.find((l) => l.id === id);

/** Replace the whole environment with a ready-made look (the weather and time of day stay as they are). */
export function applyEnvironmentLook(id: string): Command {
  const look = getEnvironmentLook(id);
  return {
    type: 'ApplyEnvironmentLook',
    label: look ? `Environment: ${look.name}` : 'Environment',
    apply(d) {
      if (!look) return;
      write(d, resolveEnvironment({ ...d.lighting, horizon: undefined, environment: look.settings }));
    },
  };
}

/** Back to open flat land with the default sky. */
export function resetEnvironment(): Command {
  return {
    type: 'ResetEnvironment',
    label: 'Reset environment',
    apply(d) {
      delete d.lighting.environment;
      delete d.lighting.horizon;
    },
  };
}

// ---- the ring of trees ------------------------------------------------------------------------------------------

export interface TreeSpot {
  asset: string;
  x: number;
  z: number;
  rot: number;
  scale: number;
}

const TREE_KINDS: Record<TreeKind, string[]> = {
  mixed: ['tree-neem', 'tree-gulmohar', 'tree-mango', 'tree-round'],
  palm: ['tree-palm'],
  pine: ['tree-pine', 'tree-cypress'],
  neem: ['tree-neem'],
};
const MAX_RING_TREES = 160;

/**
 * Where the ring of trees stands: just outside the plot (or round the house when there is no plot), spaced and nudged so
 * it looks planted, and never on a road, on a pavement or close to a building. Pure and seeded: the same home gives the
 * same trees.
 */
export function planTreeRing(scene: Scene, env: Pick<ResolvedEnvironment, 'trees' | 'treeKind'>, seed = 7): TreeSpot[] {
  if (env.trees === 'none') return [];
  const rnd = stream(seed * 104729 + 3);
  const house = houseBounds(scene);
  const plot: Vec2[] =
    scene.plot?.boundary && scene.plot.boundary.length >= 3
      ? scene.plot.boundary.map((p): Vec2 => [p[0], p[1]])
      : house
        ? [[house.min[0] - 10, house.min[1] - 8], [house.max[0] + 10, house.min[1] - 8], [house.max[0] + 10, house.max[1] + 8], [house.min[0] - 10, house.max[1] + 8]]
        : [[-12, -9], [12, -9], [12, 9], [-12, 9]];
  const roads = Object.values(scene.zones).filter((z) => z.shape === 'road');
  const level0 = scene.levelOrder[0];
  const big = Object.values(scene.items)
    .filter((it) => it.levelId === level0)
    .map((it) => ({ it, a: getAsset(it.assetId) }))
    .filter((x) => x.a && x.a.mount === 'floor' && Math.max(x.a.size[0], x.a.size[1]) >= 2.5)
    .map((x) => ({ x: x.it.position[0], z: x.it.position[2], r: (Math.max(x.a!.size[0] * x.it.scale[0], x.a!.size[1] * x.it.scale[2]) / 2) * 1.05 }));
  const spacing = env.trees === 'dense' ? 4.5 : 9;
  const kinds = TREE_KINDS[env.treeKind];
  const out: TreeSpot[] = [];
  const blocked = (p: Vec2): boolean => {
    if (roads.some((r) => nearRoad(r.points, r.width ?? ROAD_DEFAULT_WIDTH_M, p, Math.max(r.road?.pavLeft ?? 0, r.road?.pavRight ?? 0) + 2.2))) return true;
    return big.some((b) => Math.hypot(p[0] - b.x, p[1] - b.z) < b.r + 1.6);
  };
  for (let i = 0; i < plot.length && out.length < MAX_RING_TREES; i++) {
    const a = plot[i]!;
    const b = plot[(i + 1) % plot.length]!;
    const len = lineLength([a, b]);
    if (len < 0.5) continue;
    const dx = (b[0] - a[0]) / len;
    const dz = (b[1] - a[1]) / len;
    // The side of the edge that is outside the plot.
    const mid: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let nx = -dz;
    let nz = dx;
    if (pointInPolygon([mid[0] + nx * 0.5, mid[1] + nz * 0.5], plot)) {
      nx = -nx;
      nz = -nz;
    }
    for (let s = spacing * (0.2 + rnd() * 0.5); s < len && out.length < MAX_RING_TREES; s += spacing * (0.75 + rnd() * 0.5)) {
      const off = 1.6 + rnd() * 2.2;
      const p: Vec2 = [a[0] + dx * s + nx * off, a[1] + dz * s + nz * off];
      if (pointInPolygon(p, plot) || blocked(p)) continue;
      out.push({ asset: kinds[Math.floor(rnd() * kinds.length)]!, x: Math.round(p[0] * 100) / 100, z: Math.round(p[1] * 100) / 100, rot: rnd() * Math.PI * 2, scale: Math.round((0.85 + rnd() * 0.5) * 100) / 100 });
    }
  }
  return out;
}
