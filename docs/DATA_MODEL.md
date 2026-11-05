# Data Model

## 1. Conventions
- Units: **metres**. Axes: **Y up**, plan on **X (east) / Z (south)**. Angles: radians.
- IDs: nanoid strings, prefixed by type (`wall_x8f2`, `room_a1b9`).
- Entities stored in **flat maps by id** (normalized), referenced by id — never nested arrays.
- `schemaVersion` integer at root; migrations in `packages/scene-schema/migrations`.

## 2. Scene JSON (v1)
```ts
interface Scene {
  schemaVersion: 1;
  id: string;
  meta: { name: string; createdAt: string; updatedAt: string; units: 'm' | 'ft'; };
  plot?: { boundary: Vec2[]; northAngle: number; };
  levels: Record<Id, Level>;
  levelOrder: Id[];                 // bottom → top
  nodes: Record<Id, WallNode>;      // shared wall endpoints
  walls: Record<Id, Wall>;
  openings: Record<Id, Opening>;
  rooms: Record<Id, Room>;          // derived loops + user props (name, materials)
  items: Record<Id, Item>;
  roofs: Record<Id, Roof>;
  stairs: Record<Id, Stair>;
  terrain: { size: Vec2; groundMaterial: MaterialRef; };
  lighting: { timeOfDay: number; date?: string; };   // phase 3
  viewpoints: Record<Id, Viewpoint>;
}

type Vec2 = [number, number];       // [x, z]
type Vec3 = [number, number, number];

interface Level { id; name; elevation: number; height: number; }

interface WallNode { id; levelId; p: Vec2; }

interface Wall {
  id; levelId;
  a: Id; b: Id;                      // WallNode ids
  thickness: number;                 // default 0.15 (interior) / 0.23 (exterior)
  height: number;                    // default level.height
  kind: 'interior' | 'exterior' | 'boundary';
  materialA: MaterialRef;            // left-side face
  materialB: MaterialRef;            // right-side face
}

interface Opening {
  id; wallId;
  type: 'door' | 'window' | 'arch';
  assetId: string;                   // catalog entry
  offset: number;                    // distance from wall.a along wall (centre)
  width: number; height: number; sill: number;
  flip: { swing: boolean; side: boolean };
}

interface Room {
  id; levelId;
  wallLoop: Id[];                    // ordered wall ids (derived, recomputed on wall edit)
  name: string; type: RoomType;
  floorMaterial: MaterialRef; ceilingMaterial?: MaterialRef; hasCeiling: boolean;
}

interface Item {
  id; levelId;
  assetId: string;                   // catalog entry
  position: Vec3; rotationY: number; scale: Vec3;
  variant?: string;                  // color/finish
  locked?: boolean;
  attach?: { wallId?: Id; roomId?: Id };
}

interface Roof {
  id; levelId;                       // top level
  style: 'gable' | 'hip' | 'flat' | 'shed';
  pitchDeg: number; overhang: number; ridgeAngle?: number;
  material: MaterialRef;
}

interface Stair { id; fromLevel: Id; toLevel: Id; kind: 'straight'|'L'|'U'; origin: Vec3; rotationY: number; width: number; mirror?: boolean; material?: MaterialRef; }
// origin = centre of the first step's bottom edge (y relative to fromLevel's floor); rise is derived from the levels (ADR-020).

type MaterialRef = { id: string; tint?: string; uvScale?: number; uvRotation?: number };
interface Viewpoint { id; name; position: Vec3; target: Vec3; fov: number; }
```

### Derived (not stored, recomputed): wall meshes, mitered corners, room polygons/areas, collision shapes, roof geometry.
> Rooms: store only user-editable props keyed by a **stable loop signature**, so re-detection after edits can re-attach names/materials.

## 3. Catalog entries (separate from scene)
```ts
interface CatalogAsset {
  id: string; name: string; category: string; tags: string[];
  type: 'furniture'|'fixture'|'door'|'window'|'plant'|'vehicle'|'decor';
  glb: string; thumb: string; lodGlb?: string;
  dimensions: Vec3; origin: 'floor'|'wall'|'ceiling';     // placement behaviour
  variants?: { id: string; label: string; materialOverrides: Record<string,string> }[];
  license: string; priceHint?: number; rooms?: RoomType[];
  tier: 'free' | 'premium' | 'rewarded';   // monetization (ADR-011)
  placeholder?: boolean;                    // true = procedural/temporary asset (ADR-013)
  proceduralKey?: string;                   // generator id if glb is built in code
}
interface CatalogMaterial {
  id: string; name: string; category: 'floor'|'wall'|'ceiling'|'roof'|'ground'|'facade';
  baseColor?: string; maps?: { albedo?: string; normal?: string; orm?: string };
  tileSizeM: number; priceHint?: number;
}
```

## 4. Database (Supabase / Postgres) — MVP
| Table | Key columns |
|---|---|
| `profiles` | id (= auth.uid), display_name, avatar_url, created_at |
| `projects` | id, owner_id, name, thumb_url, scene jsonb, schema_version, updated_at, deleted_at |
| `project_versions` | id, project_id, scene jsonb, created_at, label (phase 2+) |
| `shares` | id, project_id, token (unique), mode ('view'), expires_at, revoked_at |
| `subscriptions` | id, user_id, provider ('stripe'\|'revenuecat'), status, plan, current_period_end, updated_at |
| `unlocks` | id, user_id, asset_id, source ('rewarded_ad'\|'purchase'), granted_at, expires_at |
| `ad_events` (optional) | id, user_id, type, nonce, verified, created_at — for SSV/abuse checks |
| `catalog_assets` | mirror of CatalogAsset (or static JSON on CDN for MVP); includes `tier` |
| `catalog_materials` | same |

**RLS:** owner can CRUD own projects; `shares` resolved by edge function that returns scene for valid non-revoked token only.
Large scenes: jsonb in-row is fine at < 1 MB; revisit if exceeded.

**Entitlement rule:** `canUse(asset) = tier=='free' || activeSubscription || unlock(asset, not expired)`. Scenes always store `assetId` regardless of tier; a lapsed entitlement never deletes or breaks items — they render, but moving/duplicating/exporting them prompts an upsell. RLS: users read only their own `subscriptions`/`unlocks`; writes only via service-role edge functions (webhooks / ad verification).

## 5. Local storage (IndexedDB)
- `projects` store: `{id, scene, dirty, lastSyncedAt}`
- `assets-cache`: handled by service worker (Cache API)
- Conflict policy (MVP): last-write-wins with a "keep both" copy prompt when `updatedAt` diverges.

## 6. Versioning & migrations
- `migrate(scene)`: applies `v(n)→v(n+1)` functions sequentially; each has a fixture test.
- Never delete fields without a migration. Unknown fields are preserved on round-trip.

## 7. Export formats
| Format | Source | Phase |
|---|---|---|
| `.homedesign.json` | Scene JSON | 1 |
| PNG | canvas capture | 3 |
| PDF plan | 2D renderer → SVG → PDF | 3 |
| GLB | Three GLTFExporter on merged scene | 4 |
