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
  /** Roofs of this floor follow its rooms automatically (see `Roof.auto`). Unset = off (older homes keep their roof as it is). */
  autoRoof: z.boolean().optional(),
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

/** A sunshade over a door or window: a chajja slab, awning, louvre fins or a canopy on columns, on the outside face. */
export const OpeningShade = z.object({
  style: z.enum(['slab', 'awning', 'louvre', 'canopy']),
  /** How far it projects from the wall (m). */
  depth: z.number().min(0.15).max(2),
  /** Colour (hex). */
  color: z.string().optional(),
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
  /** Sunshade over the opening, on the outside face. */
  shade: OpeningShade.optional(),
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
  /** Set on scenery placed by a surroundings preset ('env'), so it can be replaced or cleared as a group. */
  tag: z.string().optional(),
  attach: z.object({ wallId: Id.optional(), roomId: Id.optional() }).optional(),
});

/** The rectangle (wall centre lines) a roof part covers; `length` is the long side, `angle` its direction. */
export const RoofBox = z.object({
  cx: z.number(),
  cz: z.number(),
  angle: z.number(),
  length: z.number().positive(),
  width: z.number().positive(),
});

export const Roof = z.object({
  id: Id,
  levelId: Id,
  style: z.enum(['gable', 'hip', 'flat', 'shed', 'butterfly', 'mansard', 'barrel']),
  pitchDeg: z.number().min(0).max(80),
  overhang: z.number().min(0),
  ridgeAngle: z.number().optional(),
  material: MaterialRef,
  /** One roof part over this rectangle. Unset = an old-style roof over the bounding box of the whole floor. */
  box: RoofBox.optional(),
  /** Created and moved by the app to follow the rooms (settings stay yours); false / unset = made by hand, never moved. */
  auto: z.boolean().optional(),
  /** Thickness of the roof edge (m). */
  thickness: z.number().min(0.05).max(0.4).optional(),
  /** How far the gable ends project (m); unset = same as the overhang. */
  rake: z.number().min(0).max(1.5).optional(),
  /** Cap along the ridge (default on). */
  ridgeCap: z.boolean().optional(),
  gutter: z.boolean().optional(),
  chimney: z.boolean().optional(),
  /** Flat roofs: height of the low wall round the edge (m). */
  parapet: z.number().min(0).max(0.9).optional(),
  /** Colour of the fascia and trim (hex). */
  trim: z.string().optional(),
  /** Material of the gable walls and the parapet. */
  gable: MaterialRef.optional(),
  /** Dormer windows on the long slopes (gable / hip): position along the ridge (-1..1), which slope, width (m). */
  dormers: z.array(z.object({ pos: z.number().min(-1).max(1), side: z.union([z.literal(1), z.literal(-1)]), width: z.number().min(0.6).max(3) })).max(8).optional(),
});

export const Stair = z.object({
  id: Id,
  fromLevel: Id,
  toLevel: Id,
  kind: z.enum(['straight', 'L', 'U', 'spiral']),
  origin: Vec3,
  rotationY: z.number(),
  width: z.number().positive(),
  /** L / U / spiral stairs turn to the left by default; mirrored they turn to the right. */
  mirror: z.boolean().optional(),
  material: MaterialRef.optional(),
  /** Rail along the open sides. Unset = none (homes made before railings keep their look). */
  railing: z.enum(['none', 'wood', 'metal', 'glass']).optional(),
  /** Fine tuning of the railing (all optional; unset = the look the `railing` choice gives). */
  railingOpts: z
    .object({
      infill: z.enum(['balusters', 'cables', 'glass', 'solid', 'none']).optional(),
      /** Colour of the posts, handrail and balusters (hex). */
      color: z.string().optional(),
      /** Height of the handrail (m). */
      height: z.number().min(0.6).max(1.3).optional(),
      handrail: z.enum(['round', 'flat', 'wide']).optional(),
      /** Gap between balusters / cables (m). */
      gap: z.number().min(0.05).max(0.4).optional(),
      /** Size of the posts (m). */
      post: z.number().min(0.02).max(0.15).optional(),
      sides: z.enum(['both', 'left', 'right']).optional(),
      /** Glass colour. */
      tint: z.enum(['clear', 'blue', 'green', 'smoked', 'frosted']).optional(),
    })
    .optional(),
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
export type OpeningShade = z.infer<typeof OpeningShade>;
export type Room = z.infer<typeof Room>;
export type Item = z.infer<typeof Item>;
export type Roof = z.infer<typeof Roof>;
export type RoofBox = z.infer<typeof RoofBox>;
export type Stair = z.infer<typeof Stair>;
export type Balcony = z.infer<typeof Balcony>;
export type Zone = z.infer<typeof Zone>;
export type Viewpoint = z.infer<typeof Viewpoint>;
export type Scene = z.infer<typeof Scene>;
