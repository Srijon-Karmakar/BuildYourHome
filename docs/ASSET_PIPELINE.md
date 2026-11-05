# Asset Pipeline

## 0. Current phase: PLACEHOLDER ASSETS (owner decision, ADR-013)
- No real asset budget yet. Ship **procedural placeholders**: code-generated compositions of boxes/cylinders/extrusions with PBR materials (bed, sofa, table, chair, wardrobe, door, window, toilet, sink, plant…) via `proceduralKey` in the catalog.
- Plus a handful of CC0 models (Kenney/Quaternius) where trivial to add.
- Mark every such entry `placeholder: true`; assign a mix of `tier` values (free/premium/rewarded) so monetization flows can be tested with fake premium items.
- The pipeline below stays the target; when real assets arrive they replace placeholders by id without code changes.

## 1. Sources (check license before use; record in catalog `license`)
| Source | Use | License |
|---|---|---|
| Kenney, Quaternius | low-poly furniture, plants | CC0 |
| Poly Haven | PBR materials, HDRIs, some models | CC0 |
| ambientCG | PBR textures | CC0 |
| Sketchfab (filtered CC-BY / CC0) | specific items | attribute where required |
| Commissioned / in-house (Blender) | consistent hero style set | owned |
Policy: pick **one visual style** (clean semi-realistic, neutral materials) for consistency; avoid mixing wildly different art styles.

## 2. Budgets (hard limits enforced by script)
| Asset type | Triangles | Textures | File size (GLB) |
|---|---|---|---|
| Small decor | ≤ 2k | ≤ 512² | ≤ 150 KB |
| Furniture | ≤ 8k | ≤ 1024² (max 2 maps) | ≤ 500 KB |
| Large fixture (kitchen set) | ≤ 15k | ≤ 1024² | ≤ 800 KB |
| Tree / plant | ≤ 6k (+ LOD) | atlas 1024² | ≤ 400 KB |
| Tileable material | — | 1024² albedo+normal+ORM (KTX2) | ≤ 1.5 MB total |
Scene-level targets: ≤ 300k visible triangles and ≤ 150 MB GPU texture memory on "mid" tier.

## 3. Modeling conventions
- Real-world scale, units metres, Y-up, origin at **bottom-centre** (floor items) / back-centre (wall items) / top-centre (ceiling items).
- Front faces +Z. Apply transforms; no negative scale.
- Named material slots (`main`, `accent`, `glass`) so variants can swap materials.
- Doors/windows: pivot at hinge or centre; include frame + leaf as separate nodes; opening size in `extras`.

## 4. Processing (`packages/assets/scripts/optimize.ts`, using gltf-transform)
1. `dedup → prune → weld → simplify (if over budget)`
2. Textures → KTX2 (UASTC for normal, ETC1S for albedo), resize to budget
3. Geometry → Meshopt (or Draco) compression
4. Generate LOD1 (≈ 40% tris) for items > 3k tris
5. Validate with `gltf-validator`; fail CI if budget exceeded
6. Render thumbnail (headless Three/Blender) 256×256 transparent PNG/WebP
7. Emit/merge catalog JSON entry (dimensions, tags, placement origin)

## 5. Catalog structure
`packages/assets/catalog/{furniture,fixtures,openings,decor,plants,materials}.json` — schema in DATA_MODEL.md §3. Search index built at build time.

## 6. Delivery
- Hosted on CDN with immutable hashed filenames; service worker caches on first use.
- Catalog metadata shipped early (small); GLBs lazy-loaded when item is previewed/placed.
- Starter pack (walls/floor materials, door/window, 10 basic furniture) preloaded.

## 7. Targets by phase
P1 ≈ 80 items / 40 materials · P3 ≈ 250 items / 150 materials · P5 user uploads (validate, scan, auto-optimize server-side).
