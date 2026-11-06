import { getAsset, localToPlan } from '@hd/assets';
import type { Scene } from '@hd/scene-schema';
import type { SunState } from './sun';

/** One light source in the home: where it sits in the world and how strong it is. */
export interface Lamp {
  id: string;
  pos: [number, number, number];
  /** Relative strength (a bedside lamp 5, a ceiling light 12, a chandelier 18). */
  power: number;
  levelId: string;
}

type Spec = { at: 'floor' | 'ceiling' | 'wall'; /** Height above the floor (floor / wall lights) or drop from the ceiling (ceiling lights), metres or × item height. */ h: number; relative?: boolean; forward?: number; power: number };

const SPECS: Record<string, Spec> = {
  'floor-lamp': { at: 'floor', h: 0.9, relative: true, power: 9 },
  'arc-lamp': { at: 'floor', h: 0.93, relative: true, power: 10 },
  'table-lamp': { at: 'floor', h: 0.85, relative: true, power: 5 },
  'ceiling-light': { at: 'ceiling', h: 0.14, power: 12 },
  pendant: { at: 'ceiling', h: 0.75, relative: true, power: 12 },
  chandelier: { at: 'ceiling', h: 0.8, relative: true, power: 18 },
  'ceiling-fan': { at: 'ceiling', h: 0.4, power: 8 },
  'wall-sconce': { at: 'wall', h: 0, forward: 0.2, power: 5 },
  'lamp-post': { at: 'floor', h: 0.88, relative: true, power: 14 },
  lantern: { at: 'floor', h: 0.6, relative: true, power: 4 },
  'track-light': { at: 'ceiling', h: 0.12, power: 10 },
  uplight: { at: 'floor', h: 0.95, relative: true, power: 8 },
  'stone-lantern': { at: 'floor', h: 0.7, relative: true, power: 4 },
  'stake-light': { at: 'floor', h: 0.8, relative: true, power: 2 },
  'street-light': { at: 'floor', h: 0.95, relative: true, power: 16 },
};

/** Every light-giving item of the home, in world coordinates. */
export function lampsOf(scene: Scene): Lamp[] {
  const out: Lamp[] = [];
  for (const it of Object.values(scene.items)) {
    const spec = SPECS[it.assetId];
    const level = scene.levels[it.levelId];
    const asset = getAsset(it.assetId);
    if (!spec || !level || !asset) continue;
    const base = level.elevation + it.position[1];
    const y = spec.at === 'floor' ? base + (spec.relative ? asset.size[2] * it.scale[1] * spec.h : spec.h) : spec.at === 'ceiling' ? base - (spec.relative ? asset.size[2] * spec.h : spec.h) : base;
    const [x, z] = spec.forward ? localToPlan([it.position[0], it.position[2]], it.rotationY, 0, spec.forward) : [it.position[0], it.position[2]];
    out.push({ id: it.id, pos: [x, y, z], power: spec.power, levelId: it.levelId });
  }
  return out;
}

/** The `n` lamps closest to a point (the ones that get a real light; the rest only glow). */
export function nearestLamps(lamps: readonly Lamp[], p: readonly [number, number, number], n: number): Lamp[] {
  if (n <= 0) return [];
  return [...lamps]
    .map((l) => ({ l, d: (l.pos[0] - p[0]) ** 2 + (l.pos[1] - p[1]) ** 2 + (l.pos[2] - p[2]) ** 2 }))
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
    .map((x) => x.l);
}

export type LightsMode = 'auto' | 'on' | 'off';

/** 0..1: how much the lamps are on. Auto switches them on as the daylight fades. */
export function lampLevel(mode: LightsMode, sun: Pick<SunState, 'intensity'>): number {
  if (mode === 'on') return 1;
  if (mode === 'off') return 0;
  return Math.min(1, Math.max(0, 1 - sun.intensity / 0.9));
}
