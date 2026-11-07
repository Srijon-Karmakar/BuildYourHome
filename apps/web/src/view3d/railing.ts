import type { Stair } from '@hd/scene-schema';
import { DEFAULT_RAIL, type RailInfill, type RailOptions } from '@hd/geometry';

export const RAIL_COLORS: { id: string; name: string }[] = [
  { id: '#8a5a3c', name: 'Oak' },
  { id: '#5a3a26', name: 'Walnut' },
  { id: '#b98a5b', name: 'Teak' },
  { id: '#2b2b2b', name: 'Black' },
  { id: '#f1eee8', name: 'White' },
  { id: '#c9a47a', name: 'Brass' },
  { id: '#c9cbcd', name: 'Chrome' },
  { id: '#6b5a48', name: 'Bronze' },
  { id: '#3f5a47', name: 'Green' },
  { id: '#44546a', name: 'Navy' },
];

export const GLASS_TINTS: Record<NonNullable<NonNullable<Stair['railingOpts']>['tint']>, { name: string; color: string; opacity: number; roughness: number }> = {
  clear: { name: 'Clear', color: '#bcd4e6', opacity: 0.3, roughness: 0.03 },
  blue: { name: 'Blue', color: '#7fb0d8', opacity: 0.42, roughness: 0.03 },
  green: { name: 'Green', color: '#8fcaa8', opacity: 0.42, roughness: 0.03 },
  smoked: { name: 'Smoked', color: '#3c4650', opacity: 0.55, roughness: 0.03 },
  frosted: { name: 'Frosted', color: '#e8eef2', opacity: 0.7, roughness: 0.55 },
};

/** The infill a railing choice gives when nothing else is chosen. */
export const defaultInfill = (railing: Stair['railing']): RailInfill => (railing === 'glass' ? 'glass' : 'balusters');

/** Colour of the posts and handrail: the chosen one, else the usual one for wood / metal / glass railings. */
export function railColor(stair: Pick<Stair, 'railing' | 'railingOpts'>): string {
  return stair.railingOpts?.color ?? (stair.railing === 'wood' ? '#7a4f2e' : stair.railing === 'glass' ? '#c9cbcd' : '#2b2b2b');
}

/** What the railing mesh is built from. */
export function railOptions(stair: Pick<Stair, 'railing' | 'railingOpts'>): RailOptions {
  const o = stair.railingOpts ?? {};
  return {
    infill: o.infill ?? defaultInfill(stair.railing),
    height: o.height ?? DEFAULT_RAIL.height,
    handrail: o.handrail ?? DEFAULT_RAIL.handrail,
    gap: o.gap ?? DEFAULT_RAIL.gap,
    post: o.post ?? DEFAULT_RAIL.post,
    sides: o.sides ?? DEFAULT_RAIL.sides,
  };
}
