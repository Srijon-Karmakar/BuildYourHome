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
  /** Mortar / grout / joint colour (hex) for brick, stone, tile and cladding finishes; unset = the finish's own. */
  joint: z.string().optional(),
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

/** Two-tone wall face: a second finish from the floor up to `height`, with an optional band on top (ADR-030). */
export const WallLower = z.object({
  material: MaterialRef,
  height: z.number().min(0.1).max(10),
  /** Colour of a slim band along the top of the lower finish (hex); unset = no band. */
  band: z.string().optional(),
});

/** A feature panel: a rectangle of cladding on one face of a wall, cut round the openings (ADR-030). */
export const WallPanel = z.object({
  id: Id,
  /** Which face: A = materialA's side, B = materialB's. */
  side: z.enum(['A', 'B']),
  /** Centre along the wall, measured from node a (m). */
  offset: z.number(),
  width: z.number().min(0.1),
  /** Bottom edge above the floor (m). */
  bottom: z.number().min(0),
  height: z.number().min(0.1),
  material: MaterialRef,
  /** How far it stands proud of the wall (m). */
  depth: z.number().min(0.005).max(0.15).optional(),
});

/** Mouldings on the outside face of a wall (ADR-030). */
export const WallTrim = z.object({
  cornice: z.boolean().optional(),
  plinth: z.boolean().optional(),
  /** Heights (m above the floor) of horizontal bands. */
  bands: z.array(z.number().min(0.1).max(10)).max(4).optional(),
  pilasters: z.boolean().optional(),
  color: z.string().optional(),
  /** Overall size of the mouldings (1 = standard). */
  size: z.number().min(0.5).max(2).optional(),
});

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
  lowerA: WallLower.optional(),
  lowerB: WallLower.optional(),
  panels: z.array(WallPanel).max(24).optional(),
  trim: WallTrim.optional(),
  /**
   * Full glass wall (floor-to-ceiling glazing). The wall stays a wall (rooms, corners, collisions); in 3D everything but a thin
   * top band (and an optional upstand) is glass panes in a frame. Unset = a solid wall.
   */
  glazed: z
    .object({
      /** Target pane width (m). */
      pane: z.number().min(0.4).max(3).optional(),
      frame: z.enum(['slim', 'standard', 'bold']).optional(),
      /** Frame colour (hex). */
      color: z.string().optional(),
      tint: z.enum(['clear', 'blue', 'green', 'smoked', 'frosted']).optional(),
      /** Solid wall under the glass (m). */
      sill: z.number().min(0).max(1.2).optional(),
      /** A horizontal bar across the panes at this height (m); unset / 0 = none. */
      transom: z.number().min(0).max(3).optional(),
    })
    .optional(),
});

/** A sunshade over a door or window: a chajja slab, awning, louvre fins or a canopy on columns, on the outside face. */
export const OpeningShade = z.object({
  style: z.enum(['slab', 'awning', 'louvre', 'canopy']),
  /** How far it projects from the wall (m). */
  depth: z.number().min(0.15).max(2),
  /** Colour (hex). */
  color: z.string().optional(),
});

/** Box window (ADR-030): a projecting frame box round the window, or the window pushed out as a glass bay. */
export const OpeningBox = z.object({
  kind: z.enum(['frame', 'bay']),
  /** How far it projects from the outside face (m). */
  depth: z.number().min(0.05).max(1.2),
  /** Frame: thickness of the boards (m). Bay: thickness of the top and bottom slabs. */
  thickness: z.number().min(0.03).max(0.4).optional(),
  /** Frame: which sides have a board. */
  sides: z.enum(['all', 'top-sides', 'top', 'left', 'right']).optional(),
  color: z.string().optional(),
  /** Bay: a window seat inside. */
  seat: z.boolean().optional(),
});

export const OpeningGrill = z.object({
  pattern: z.enum(['bars', 'grid', 'diamond', 'ornate']),
  color: z.string().optional(),
});

export const OpeningSurround = z.object({
  style: z.enum(['band', 'stone', 'moulded']),
  width: z.number().min(0.04).max(0.5),
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
  /** Windows: box frame or bay (ADR-030). */
  box: OpeningBox.optional(),
  /** Windows: safety grill on the outside. */
  grill: OpeningGrill.optional(),
  /** Glass look (windows and glazed doors). */
  glass: z.enum(['clear', 'frosted', 'tinted', 'reflective']).optional(),
  /** Glazing bars dividing the glass. */
  panes: z.enum(['none', 'top', '2x2', '3x2', '3x3']).optional(),
  /** Shape of the head: the hole stays rectangular, the corners are filled (ADR-030). */
  head: z.enum(['flat', 'arch', 'segment']).optional(),
  /** Frame bar width (m) and finish. */
  frame: z
    .object({ width: z.number().min(0.03).max(0.15).optional(), finish: z.enum(['paint', 'wood', 'metal', 'upvc']).optional() })
    .optional(),
  /** Trim round the opening on the outside face. */
  surround: OpeningSurround.optional(),
  /** Doors: how far open, 0 (closed) to 1 (fully open). Unset = open, the way every door used to be drawn. */
  open: z.number().min(0).max(1).optional(),
  /** Doors: handle type. */
  handle: z.enum(['lever', 'knob', 'pull', 'none']).optional(),
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

/** What an LED screen shows. */
export const SCREEN_SHOWS = ['off', 'color', 'gradient', 'demo', 'text', 'image'] as const;
/** Built-in pictures for `show: 'demo'` (drawn in code, no downloads). */
export const SCREEN_DEMOS = ['landscape', 'city', 'sports', 'news', 'bars', 'stage'] as const;
const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

/** Settings of an LED screen item (catalog assets with a `screen` face). All optional: unset = the default look. */
export const ScreenOpts = z.object({
  show: z.enum(SCREEN_SHOWS).optional(),
  /** Background colour (colour / gradient / text), and the second colour of a gradient. */
  color: Hex.optional(),
  color2: Hex.optional(),
  demo: z.enum(SCREEN_DEMOS).optional(),
  text: z.string().max(80).optional(),
  textColor: Hex.optional(),
  /** Text runs across the screen like a news ticker. */
  scroll: z.boolean().optional(),
  /** The user's own picture, already shrunk by the app (JPEG data URL, ≤ ~300 KB). */
  image: z.string().max(400_000).regex(/^data:image\/(jpeg|png|webp);base64,/).optional(),
  fit: z.enum(['cover', 'contain', 'stretch']).optional(),
  /** Bend of a wall screen in degrees: + bulges out (round a building corner), - curves in; 0 = flat. */
  curve: z.number().min(-180).max(180).optional(),
  /** 0.2 (dim) – 2 (very bright); 1 = normal. */
  brightness: z.number().min(0.2).max(2).optional(),
  /** Frame round the picture (m); 0 = frameless. Its colour is the item's colour (`variant`). */
  bezel: z.number().min(0).max(0.15).optional(),
  /** At night the screen also lights up what is in front of it (default on). */
  castLight: z.boolean().optional(),
});
export type ScreenOpts = z.infer<typeof ScreenOpts>;

export const CURTAIN_STYLES = ['pleated', 'eyelet', 'sheer', 'roman', 'venetian'] as const;
export const CURTAIN_RODS = ['rod', 'track', 'none'] as const;

/** Settings of a curtain or blind item (catalog assets with a `curtain` face). All optional: unset = the default look. */
export const CurtainOpts = z.object({
  style: z.enum(CURTAIN_STYLES).optional(),
  /** Curtains: 0 drawn closed .. 1 pulled right open to the sides. Blinds: 0 fully down .. 1 fully raised. */
  open: z.number().min(0).max(1).optional(),
  /** Fabric gathered into the width: 1.2 (flat) - 3 (very full). */
  fullness: z.number().min(1.2).max(3).optional(),
  rod: z.enum(CURTAIN_RODS).optional(),
  rodColor: Hex.optional(),
  /** A sheer curtain behind the main one, and its colour. */
  sheer: z.boolean().optional(),
  sheerColor: Hex.optional(),
});
export type CurtainOpts = z.infer<typeof CurtainOpts>;

/** Settings of a wall feature item (extra / curved / box / extended wall). All optional: unset = the asset's own look. */
export const FeatureOpts = z.object({
  /** Wall finish (a material id of the wall catalog). */
  material: z.string().max(64).optional(),
  /** Curved walls: bend in degrees, + bulges toward the front, - curves in; 0 = straight. */
  curve: z.number().min(-180).max(180).optional(),
  /** A cap (coping) along the top edge. */
  cap: z.boolean().optional(),
});
export type FeatureOpts = z.infer<typeof FeatureOpts>;

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
  /** Text shown on the item (name plate, house number). */
  text: z.string().max(40).optional(),
  /** LED screens: what the screen shows and how it looks. */
  screen: ScreenOpts.optional(),
  /** Curtains and blinds: style, how open, fullness, rod, sheer layer. */
  curtain: CurtainOpts.optional(),
  /** Wall features: finish, bend, cap. */
  feature: FeatureOpts.optional(),
});

/** Fine tuning of a railing (all optional; unset = the look the railing choice gives). Shared by stairs, balconies and roofs. */
export const RailingOpts = z.object({
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
  /** Stairs only: which side of the flight gets a rail. */
  sides: z.enum(['both', 'left', 'right']).optional(),
  /** Stairs only: a railing round the opening on the floor above (default on). */
  guard: z.boolean().optional(),
  /** Glass colour. */
  tint: z.enum(['clear', 'blue', 'green', 'smoked', 'frosted']).optional(),
  /** Balconies and roofs: distance between posts along a straight run (m). */
  spacing: z.number().min(0.6).max(3).optional(),
  /** Roofs: how far the railing stands in from the roof edge (m). */
  inset: z.number().min(0).max(1).optional(),
  /** Roofs: sides left open, counted from the first corner of the roof (0-3). */
  skip: z.array(z.number().int().min(0).max(3)).max(4).optional(),
  /** Solid infill: thickness of the wall (m). */
  thickness: z.number().min(0.03).max(0.3).optional(),
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
  /** Flat roofs: a terrace railing round the edge (or on top of the parapet). Unset / 'none' = no railing. */
  railing: z.enum(['none', 'wood', 'metal', 'glass']).optional(),
  railingOpts: RailingOpts.optional(),
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
  railingOpts: RailingOpts.optional(),
  /**
   * How the flight is built. Unset = solid (a block under every step, as before). `stringer` = open treads on two side beams,
   * `spine` = open treads on one central beam, `floating` = treads only, nothing under them.
   */
  build: z.enum(['solid', 'stringer', 'spine', 'floating']).optional(),
  /** The steps themselves (open builds use the thickness and nosing; risers can be added to any build). */
  steps: z
    .object({
      /** Thickness of a tread (m). */
      thickness: z.number().min(0.02).max(0.2).optional(),
      /** How far a tread overhangs the step below (m). */
      nosing: z.number().min(0).max(0.08).optional(),
      /** Closed risers between the treads (open builds default to open). */
      risers: z.boolean().optional(),
      /** Colour of the risers (hex); unset = the frame colour. */
      riserColor: z.string().optional(),
    })
    .optional(),
  /** The beams of the `stringer` / `spine` builds (also the landing frame and the spiral pole). */
  stringer: z
    .object({
      color: z.string().optional(),
      /** Width of a beam (m). */
      width: z.number().min(0.02).max(0.4).optional(),
      /** Vertical depth of a beam (m). */
      depth: z.number().min(0.06).max(0.6).optional(),
    })
    .optional(),
  /**
   * What covers the top where the stair comes out on a roof or an empty floor: a roof room (chilekotha / mumty), a glass box
   * or a hatch. Unset = open (just the guard rail).
   */
  exit: z
    .object({
      kind: z.enum(['room', 'glass', 'hatch']),
      /** Height of the walls (room / glass) or the kerb (hatch), m. */
      height: z.number().min(0.15).max(3.5).optional(),
      /** Wall colour of a room, kerb colour of a hatch (hex). */
      color: z.string().optional(),
      /** Frame colour (door frame, glass frame, lid frame; hex). */
      frame: z.string().optional(),
    })
    .optional(),
});

/** A balcony / porch slab attached to a floor. Railings run along the edges that are not against a house wall. */
export const Balcony = z.object({
  id: Id,
  levelId: Id,
  outline: z.array(Vec2),
  railing: z.enum(['glass', 'metal', 'wood', 'wall', 'none']),
  floorMaterial: MaterialRef,
  /** Fine tuning of the railing (same choices as stair railings). */
  railingOpts: RailingOpts.optional(),
  /** The slab: thickness below the floor (m), colour of the edge band (hex), and a raised lip round the open edges (m). */
  slab: z
    .object({
      thickness: z.number().min(0.08).max(0.6).optional(),
      edgeColor: z.string().optional(),
      lip: z.number().min(0).max(0.15).optional(),
    })
    .optional(),
  /** What holds the balcony up: nothing (a cantilever), columns at the open corners, brackets under the open edges, or a wall under it. */
  supports: z
    .object({
      kind: z.enum(['none', 'columns', 'brackets', 'wall']).optional(),
      color: z.string().optional(),
      /** Column size / bracket depth (m). */
      size: z.number().min(0.05).max(0.6).optional(),
    })
    .optional(),
  /** A cover over the balcony: a flat roof slab or open pergola slats. */
  canopy: z
    .object({
      kind: z.enum(['none', 'flat', 'pergola']).optional(),
      /** Height of the underside above the balcony floor (m). */
      height: z.number().min(2).max(4).optional(),
      color: z.string().optional(),
    })
    .optional(),
});

/** Something placed along a road: street lights, trees, benches, bins or bollards, at a spacing, on one or both sides. */
export const RoadExtra = z.object({
  kind: z.enum(['light', 'tree', 'bench', 'bin', 'bollard']),
  side: z.enum(['both', 'left', 'right', 'alternate']),
  spacing: z.number().min(3).max(80),
  /** Trees: which tree of the catalog. */
  asset: z.string().optional(),
});

/** The look of a road: lanes, markings, kerb, pavements, crossings, bumps, parking and what stands along it. */
export const RoadStyle = z.object({
  lanes: z.number().int().min(1).max(6),
  oneWay: z.boolean().optional(),
  centre: z.enum(['none', 'dashed', 'solid', 'double']),
  /** Edge lines near the kerbs. */
  edges: z.boolean(),
  /** Kerb height in metres (0 = pavement level with the road). */
  kerb: z.number().min(0).max(0.25),
  /** Pavement widths on the left and right of the direction you drew the road in (m; 0 = none). */
  pavLeft: z.number().min(0).max(6),
  pavRight: z.number().min(0).max(6),
  pavMaterial: MaterialRef,
  parking: z.enum(['none', 'left', 'right', 'both']),
  /** Zebra crossings and speed bumps: where along the road (0 = start, 1 = end). */
  crossings: z.array(z.number().min(0).max(1)).max(8),
  bumps: z.array(z.number().min(0).max(1)).max(8),
  extras: z.array(RoadExtra).max(6),
});

/** A garden surface on the ground: a lawn / paving / driveway area (outline), a path (centre line + width) or a road. */
export const Zone = z.object({
  id: Id,
  shape: z.enum(['area', 'path', 'road']),
  /** Area outline, or the path's centre line. */
  points: z.array(Vec2),
  /** Path width in metres (paths and roads; for a road, the carriageway). */
  width: z.number().positive().optional(),
  /** A road's surface, or a path's / area's material. */
  material: MaterialRef,
  /** Roads only. */
  road: RoadStyle.optional(),
});

export const Viewpoint = z.object({
  id: Id,
  name: z.string(),
  position: Vec3,
  target: Vec3,
  fov: z.number().positive(),
});

/** What stands far away on one side of the home (the environment editor). */
export const SceneryKind = z.enum(['plains', 'hills', 'mountains', 'forest', 'sea', 'desert', 'city']);
export const ScenerySide = z.object({
  kind: SceneryKind,
  /** 0.4 low … 1 normal … 1.8 tall. Unset = 1. */
  height: z.number().min(0.4).max(1.8).optional(),
  /** Colour of the hills / mountains / forest. Unset = natural. */
  tone: z.enum(['natural', 'green', 'golden', 'rocky', 'misty']).optional(),
  /** Snow on the mountain tops. */
  snow: z.boolean().optional(),
});

/**
 * The look of the place around the home in 3D: scenery on each side, sky, haze, birds, ground detail and a ring of trees.
 * Every field is optional; unset means the default (open flat land, a few clouds, a little haze, birds, some ground detail).
 */
export const EnvironmentSettings = z.object({
  /** North is up on the plan (−z); the sides are the four directions the scenery stands in. */
  sides: z.object({ north: ScenerySide.optional(), east: ScenerySide.optional(), south: ScenerySide.optional(), west: ScenerySide.optional() }).optional(),
  /** Unset = the weather decides. */
  clouds: z.enum(['none', 'few', 'many']).optional(),
  haze: z.enum(['none', 'light', 'misty']).optional(),
  sky: z.enum(['natural', 'deep', 'pale', 'dusty']).optional(),
  birds: z.boolean().optional(),
  /** Grass tufts, pebbles, leaves and puddles on the ground. Unset = some. */
  detail: z.enum(['none', 'some', 'lots']).optional(),
  /** A ring of trees round the plot. Unset = none. */
  trees: z.enum(['none', 'sparse', 'dense']).optional(),
  treeKind: z.enum(['mixed', 'palm', 'pine', 'neem']).optional(),
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
  lighting: z.object({
    timeOfDay: z.number().min(0).max(24),
    date: z.string().optional(),
    /** The weather in the 3D view. Unset = clear. */
    weather: z.enum(['clear', 'cloudy', 'fog', 'rain']).optional(),
    /** Older homes: what stood on the horizon. Read once to fill `environment`; no longer written. */
    horizon: z.enum(['none', 'hills', 'city']).optional(),
    /** The environment editor's settings. Unset = open flat land. */
    environment: EnvironmentSettings.optional(),
  }),
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
export type OpeningBox = z.infer<typeof OpeningBox>;
export type OpeningGrill = z.infer<typeof OpeningGrill>;
export type OpeningSurround = z.infer<typeof OpeningSurround>;
export type WallLower = z.infer<typeof WallLower>;
export type WallPanel = z.infer<typeof WallPanel>;
export type WallTrim = z.infer<typeof WallTrim>;
export type Room = z.infer<typeof Room>;
export type Item = z.infer<typeof Item>;
export type RailingOpts = z.infer<typeof RailingOpts>;
export type Roof = z.infer<typeof Roof>;
export type RoofBox = z.infer<typeof RoofBox>;
export type Stair = z.infer<typeof Stair>;
export type Balcony = z.infer<typeof Balcony>;
export type Zone = z.infer<typeof Zone>;
export type RoadStyle = z.infer<typeof RoadStyle>;
export type RoadExtra = z.infer<typeof RoadExtra>;
export type SceneryKind = z.infer<typeof SceneryKind>;
export type ScenerySide = z.infer<typeof ScenerySide>;
export type EnvironmentSettings = z.infer<typeof EnvironmentSettings>;
export type Viewpoint = z.infer<typeof Viewpoint>;
export type Scene = z.infer<typeof Scene>;
