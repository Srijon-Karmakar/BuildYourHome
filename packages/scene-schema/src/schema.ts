import { z } from 'zod';

/**
 * Scene schema v1 — see docs/DATA_MODEL.md.
 * Units: metres. Axes: Y-up, plan on X (east) / Z (south). Angles: radians.
 */
export const SCHEMA_VERSION = 1 as const;

export const Id = z.string().min(1);
export const Vec2 = z.tuple([z.number(), z.number()]);
export const Vec3 = z.tuple([z.number(), z.number(), z.number()]);

export const MaterialRef = z.object({
  id: z.string(),
  tint: z.string().optional(),
  uvScale: z.number().positive().optional(),
  uvRotation: z.number().optional(),
});

export const RoomType = z.enum([
  'living',
  'bedroom',
  'kitchen',
  'bathroom',
  'dining',
  'study',
  'balcony',
  'hall',
  'utility',
  'garage',
  'other',
]);

export const Level = z.object({
  id: Id,
  name: z.string(),
  elevation: z.number(),
  height: z.number().positive(),
});

export const WallNode = z.object({ id: Id, levelId: Id, p: Vec2 });

export const Wall = z.object({
  id: Id,
  levelId: Id,
  a: Id,
  b: Id,
  thickness: z.number().positive(),
  height: z.number().positive(),
  kind: z.enum(['interior', 'exterior', 'boundary', 'fence']),
  materialA: MaterialRef,
  materialB: MaterialRef,
});

export const Opening = z.object({
  id: Id,
  wallId: Id,
  type: z.enum(['door', 'window', 'arch']),
  assetId: z.string(),
  offset: z.number().min(0),
  width: z.number().positive(),
  height: z.number().positive(),
  sill: z.number().min(0),
  flip: z.object({ swing: z.boolean(), side: z.boolean() }),
  /** Look of the fixture (see DOOR_STYLES / WINDOW_STYLES); unset = the type's default. */
  style: z.string().optional(),
  /** Frame colour (hex). */
  frameColor: z.string().optional(),
  /** Door leaf colour (hex). */
  leafColor: z.string().optional(),
});

export const Room = z.object({
  id: Id,
  levelId: Id,
  wallLoop: z.array(Id),
  name: z.string(),
  type: RoomType,
  floorMaterial: MaterialRef,
  ceilingMaterial: MaterialRef.optional(),
  hasCeiling: z.boolean(),
});

export const Item = z.object({
  id: Id,
  levelId: Id,
  assetId: z.string(),
  position: Vec3,
  rotationY: z.number(),
  scale: Vec3,
  variant: z.string().optional(),
  locked: z.boolean().optional(),
  attach: z.object({ wallId: Id.optional(), roomId: Id.optional() }).optional(),
});

export const Roof = z.object({
  id: Id,
  levelId: Id,
  style: z.enum(['gable', 'hip', 'flat', 'shed']),
  pitchDeg: z.number().min(0).max(80),
  overhang: z.number().min(0),
  ridgeAngle: z.number().optional(),
  material: MaterialRef,
});

export const Stair = z.object({
  id: Id,
  fromLevel: Id,
  toLevel: Id,
  kind: z.enum(['straight', 'L', 'U']),
  origin: Vec3,
  rotationY: z.number(),
  width: z.number().positive(),
  /** L / U stairs turn to the left by default; mirrored they turn to the right. */
  mirror: z.boolean().optional(),
  material: MaterialRef.optional(),
});

/** A balcony / porch slab attached to a floor. Railings run along the edges that are not against a house wall. */
export const Balcony = z.object({
  id: Id,
  levelId: Id,
  outline: z.array(Vec2),
  railing: z.enum(['glass', 'metal', 'wall', 'none']),
  floorMaterial: MaterialRef,
});

/** A garden surface on the ground: a lawn / paving / driveway area (outline) or a path (centre line + width). */
export const Zone = z.object({
  id: Id,
  shape: z.enum(['area', 'path']),
  /** Area outline, or the path's centre line. */
  points: z.array(Vec2),
  /** Path width in metres (paths only). */
  width: z.number().positive().optional(),
  material: MaterialRef,
});

export const Viewpoint = z.object({
  id: Id,
  name: z.string(),
  position: Vec3,
  target: Vec3,
  fov: z.number().positive(),
});

export const Scene = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: Id,
  meta: z.object({
    name: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    units: z.enum(['m', 'ft']),
  }),
  plot: z.object({ boundary: z.array(Vec2), northAngle: z.number() }).optional(),
  levels: z.record(z.string(), Level),
  levelOrder: z.array(Id),
  nodes: z.record(z.string(), WallNode),
  walls: z.record(z.string(), Wall),
  openings: z.record(z.string(), Opening),
  rooms: z.record(z.string(), Room),
  items: z.record(z.string(), Item),
  roofs: z.record(z.string(), Roof),
  stairs: z.record(z.string(), Stair),
  balconies: z.record(z.string(), Balcony).default({}),
  zones: z.record(z.string(), Zone).default({}),
  terrain: z.object({ size: Vec2, groundMaterial: MaterialRef }),
  /** Project preferences used when creating new things. */
  defaults: z
    .object({
      interiorThickness: z.number().positive().optional(),
      exteriorThickness: z.number().positive().optional(),
    })
    .optional(),
  lighting: z.object({ timeOfDay: z.number().min(0).max(24), date: z.string().optional() }),
  viewpoints: z.record(z.string(), Viewpoint),
});

export type Id = z.infer<typeof Id>;
export type Vec2 = z.infer<typeof Vec2>;
export type Vec3 = z.infer<typeof Vec3>;
export type MaterialRef = z.infer<typeof MaterialRef>;
export type RoomType = z.infer<typeof RoomType>;
export type Level = z.infer<typeof Level>;
export type WallNode = z.infer<typeof WallNode>;
export type Wall = z.infer<typeof Wall>;
export type Opening = z.infer<typeof Opening>;
export type Room = z.infer<typeof Room>;
export type Item = z.infer<typeof Item>;
export type Roof = z.infer<typeof Roof>;
export type Stair = z.infer<typeof Stair>;
export type Balcony = z.infer<typeof Balcony>;
export type Zone = z.infer<typeof Zone>;
export type Viewpoint = z.infer<typeof Viewpoint>;
export type Scene = z.infer<typeof Scene>;
