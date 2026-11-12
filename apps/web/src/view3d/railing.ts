import * as THREE from 'three';
import type { RailingOpts } from '@hd/scene-schema';
import { DEFAULT_RAIL, type RailInfill, type RailMesh, type RailOptions } from '@hd/geometry';

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

export const GLASS_TINTS: Record<NonNullable<RailingOpts['tint']>, { name: string; color: string; opacity: number; roughness: number }> = {
  clear: { name: 'Clear', color: '#bcd4e6', opacity: 0.3, roughness: 0.03 },
  blue: { name: 'Blue', color: '#7fb0d8', opacity: 0.42, roughness: 0.03 },
  green: { name: 'Green', color: '#8fcaa8', opacity: 0.42, roughness: 0.03 },
  smoked: { name: 'Smoked', color: '#3c4650', opacity: 0.55, roughness: 0.03 },
  frosted: { name: 'Frosted', color: '#e8eef2', opacity: 0.7, roughness: 0.55 },
};

/** The railing kinds a stair, balcony or roof can have (balconies also have a plastered `wall` parapet). */
export type RailingKindName = 'none' | 'wood' | 'metal' | 'glass' | 'wall' | undefined;

/** The infill a railing choice gives when nothing else is chosen. */
export const defaultInfillFor = (railing: RailingKindName): RailInfill => (railing === 'glass' ? 'glass' : railing === 'wall' ? 'solid' : 'balusters');

/** Colour of the posts and handrail: the chosen one, else the usual one for wood / metal / glass railings. */
export function railColorFor(railing: RailingKindName, opts: RailingOpts | undefined): string {
  return opts?.color ?? (railing === 'wood' ? '#7a4f2e' : railing === 'glass' ? '#c9cbcd' : railing === 'wall' ? '#e8e4da' : '#2b2b2b');
}

/** What the railing mesh is built from (defaults filled in). */
export function railOptionsFor(railing: RailingKindName, opts: RailingOpts | undefined, base: Partial<RailOptions> = {}): RailOptions {
  const o = opts ?? {};
  return {
    ...DEFAULT_RAIL,
    ...base,
    infill: o.infill ?? defaultInfillFor(railing),
    height: o.height ?? base.height ?? DEFAULT_RAIL.height,
    handrail: o.handrail ?? base.handrail ?? DEFAULT_RAIL.handrail,
    gap: o.gap ?? base.gap ?? DEFAULT_RAIL.gap,
    post: o.post ?? base.post ?? DEFAULT_RAIL.post,
    sides: o.sides ?? DEFAULT_RAIL.sides,
    ...(o.spacing !== undefined ? { spacing: o.spacing } : {}),
    ...(o.thickness !== undefined ? { thickness: o.thickness } : railing === 'wall' ? { thickness: 0.12 } : {}),
  };
}

/** Same, for a stair. */
export const defaultInfill = defaultInfillFor;
export const railColor = (s: { railing?: RailingKindName; railingOpts?: RailingOpts }): string => railColorFor(s.railing, s.railingOpts);
export const railOptions = (s: { railing?: RailingKindName; railingOpts?: RailingOpts }): RailOptions => railOptionsFor(s.railing, s.railingOpts);

/** Three.js geometry for a railing mesh: one group per slot (frame 0, glass 1, panel 2). */
export function railGeometry(m: RailMesh): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(m.uvs, 2));
  g.setIndex(new THREE.BufferAttribute(m.indices, 1));
  for (const grp of m.groups) g.addGroup(grp.start, grp.count, grp.slot === 'frame' ? 0 : grp.slot === 'glass' ? 1 : 2);
  return g;
}

/** The three materials of a railing, in group order: frame (posts, handrail, balusters), glass, solid panel. */
export function railMaterialsFor(railing: RailingKindName, opts: RailingOpts | undefined): THREE.Material[] {
  const color = railColorFor(railing, opts);
  const tint = GLASS_TINTS[opts?.tint ?? 'clear'];
  const wood = railing === 'wood';
  return [
    new THREE.MeshStandardMaterial({ color, roughness: wood ? 0.55 : 0.4, metalness: wood || railing === 'wall' ? 0 : 0.6 }),
    new THREE.MeshPhysicalMaterial({ color: tint.color, transparent: true, opacity: tint.opacity, roughness: tint.roughness, clearcoat: 1, depthWrite: false }),
    new THREE.MeshStandardMaterial({ color: railing === 'wall' ? '#e8e4da' : color, roughness: 0.8, metalness: 0 }),
  ];
}
