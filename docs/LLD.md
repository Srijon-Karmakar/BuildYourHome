# Low-Level Design (LLD)

## 1. Monorepo layout
```
apps/web/src/
  main.tsx  App.tsx  routes/
  editor/ (EditorShell, Toolbar, Inspector, CatalogPanel, ViewSwitcher)
  viewer/ (read-only share viewer)
  canvas/ (Canvas3D.tsx, Canvas2D.tsx, cameras/, entities/)
  lib/ (i18n, units, platform)
packages/scene-schema/src/{types.ts, zod.ts, migrations/, defaults.ts}
packages/geometry/src/{wall/, room/, opening/, roof/, collision/, math/}
packages/editor-core/src/{store.ts, history.ts, commands/, tools/, snapping/, selection.ts, validate.ts}
packages/assets/{catalog/*.json, scripts/optimize.ts}
```

## 2. Editor core

### 2.1 Store
```ts
type EditorState = {
  scene: Scene;
  ui: { activeTool: ToolId; activeLevelId: Id; view: '2d'|'3d'|'split'; selection: Id[]; hover?: Id; snap: SnapSettings; };
  history: { past: Patch[][]; future: Patch[][] };
}
```
- Zustand store; scene changes only via `history.execute(command)`.
- Immer `produceWithPatches` → patches + inverse patches stored → undo/redo = apply inverse/forward.
- **Transactions:** a drag gesture = begin → many `preview` updates (not in history) → commit as ONE history entry.

### 2.2 Commands (all implement `{ type, do(draft), params }`)
`AddWall, MoveNode, SplitWall, RemoveWall, SetWallProps, AddOpening, MoveOpening, SetOpeningProps, AddItem, TransformItems, RemoveItems, SetMaterial, SetRoomProps, AddLevel, SetRoofProps, SetPlot, Batch`
After each command: run `postProcess(draft)` → merge coincident nodes, recompute rooms, remove orphan openings, clamp openings to wall length.

### 2.3 Tool state machine
Each tool: `{ id, onPointerDown/Move/Up(e: WorldPointerEvent), onKey, onEnter, onExit, overlay() }`
Tools: `select`, `wall`, `room-rect` (quick rectangle), `door`, `window`, `place-item`, `paint`, `plot`, `measure`, `pan`.
Wall tool: Idle → (click) Drawing(startNode) → (click) commit segment & continue → (dblclick/Esc/close-loop) Idle. Typing digits sets exact length.

### 2.4 Snapping (`snapping/`)
Priority: existing node → wall midpoint → wall perpendicular projection → axis alignment guides (0/45/90 from last point) → grid. Returns `{point, kind, guide?}` for rendering guide lines. Threshold in **screen pixels** (convert via camera zoom). Spatial hash for nodes/walls to stay O(1) on large plans.

## 3. Geometry engine (pure, deterministic, unit-tested)

### 3.1 Wall mesh
1. Build adjacency graph per node (walls incident, sorted by angle).
2. For each wall end: compute **miter points** using neighbouring wall edges (offset lines of thickness/2; intersect). Fallbacks: 1 wall = square cap; collinear = straight join; very acute angle = clamp miter length.
3. Wall footprint polygon = left-edge points + right-edge points.
4. Extrude to `height` → side faces, top cap (earcut), end caps.
5. **Openings:** for each opening, subtract a box from the wall solid. Strategy: *avoid generic CSG where possible* — split wall into segments (left of opening, right of opening, lintel above, sill below) as separate boxes → cheap and robust. Use CSG (three-bvh-csg) only for arch/curved openings.
6. UVs: world-scale (u along wall in metres / tileSize) so textures don't stretch; separate material groups for side A / side B / top / ends.

### 3.2 Room detection
- Planar graph from nodes+walls on a level. Find minimal cycles via **half-edge face traversal** (sort edges by angle at each node, walk next-edge-clockwise). Discard the outer face (largest negative-area / unbounded).
- Room polygon = inner offset of wall loop by thickness/2 (use clipper offset).
- Area via shoelace. Floor mesh via earcut with holes (courtyards).
- Stable room identity: signature = sorted wall ids hash; fuzzy-match (Jaccard ≥ 0.6) to carry over name/material after edits.

### 3.3 Roof generation
- Input: outer boundary polygon of top level (union of rooms inner+walls via clipper).
- **Hip/gable:** straight skeleton → ridges/hips/valleys; each skeleton face → sloped plane at `pitch`; overhang = outward offset before skeleton.
- Gable: straight skeleton then convert hip ends to gables by clipping on ridge axis (MVP: rectangle-only gable; general polygons use hip).
- **Flat:** extruded slab + parapet option.
- Fallback for failure cases: bounding-rect gable and warn user.

### 3.4 Collision (walkthrough)
- Player = vertical capsule (r=0.25, h=1.7).
- Collision world = 2D wall-segment list per level (with opening gaps for doors; windows block). Movement: attempted delta → resolve against segments by sliding (project velocity on segment normal). Floor height from level elevation (+ stairs ramp later).
- Items: optional AABB blockers (large furniture) flag.

### 3.5 Performance in geometry
- Recompute only dirty walls (changed wall + neighbours at shared nodes).
- Heavy ops (room detection, roof) in a Web Worker via Comlink once > 4 ms measured.

## 4. Rendering

### 4.1 3D scene construction (`canvas/entities/`)
- `<WallMesh id>` memoized per wall; geometry from `geometry.buildWall(...)`; subscribes by selector so only changed walls re-render.
- Items: `useGLTF` + clone; **instancing** for ≥ N repeated identical assets (chairs, plants).
- Levels grouped; visibility modes: all / current-and-below / current-only (cutaway).
- Render loop: `frameloop="demand"` in editor; `"always"` in walkthrough.
- Lighting: hemisphere + directional (shadow, one cascade); baked AO via contact-shadow plane under items; sun position from time-of-day (phase 3).
- Post: SSAO/outline only on desktop "high" tier; selection outline for hovered/selected.
- Quality tiers: low (no shadows, DPR 1), med (soft shadow 1024, DPR ≤1.5), high (2048, SSAO, DPR ≤2). Auto-select by device + FPS governor.

### 4.2 2D view
Orthographic Three camera (shares renderer) *or* Canvas2D — **decision: orthographic Three** (one hit-test pipeline, same camera math). Draws: grid, walls (filled polygons), openings symbols, room fills + labels, dimension lines, snap guides, selection handles. Line widths in screen px via shader/Line2.

### 4.3 Camera rigs
- **Orbit:** drei `OrbitControls` w/ damping, polar clamp, zoom-to-cursor.
- **Walkthrough:** custom controller: desktop pointer-lock + WASD; touch virtual joystick (left) + look-drag (right); eye height 1.6 m; head-bob optional.
- Transition: animate between 2D ortho ↔ 3D perspective (lerp position/fov) for polish.

### 4.4 Picking
Raycast against proxy meshes (invisible simplified boxes for items, wall footprints); BVH for large scenes. 2D picking via analytic point-in-polygon / distance-to-segment (no raycast).

## 5. Assets
- Loader: GLTFLoader + DRACOLoader + MeshoptDecoder + KTX2Loader (basis transcoder), shared singletons.
- Cache: LRU of parsed GLTF by assetId; dispose on eviction; refcount for clones.
- Catalog: static JSON from CDN, search via lightweight index (Fuse.js/MiniSearch).
- Placeholder bounding-box shown while GLB loads.

## 6. Persistence & sync
- `persistence.save(scene)` debounced 1 s → IndexedDB (idb).
- Cloud sync: `PUT /projects/:id` with `updatedAt` precondition; on 409 → conflict dialog.
- Thumbnail: render offscreen 512×384 on save (throttled, max 1 / 30 s).

## 7. API (Supabase/PostgREST + Edge)
| Endpoint | Purpose |
|---|---|
| Supabase Auth | signup/login/OAuth |
| `projects` CRUD (RLS) | list/get/save |
| `POST /fn/share` | create token `{projectId, expiresAt?}` |
| `GET /fn/shared/:token` | public read-only scene + signed asset urls |
| `DELETE /fn/share/:id` | revoke |
| (P5) `POST /fn/ai/plan-from-image`, `POST /fn/render` | AI / cloud render jobs |

## 8. Mobile (Capacitor)
- `@capacitor/app, filesystem, share, status-bar, haptics, splash-screen`.
- Platform util `isNative()` gates native-only features (share sheet, file export).
- Touch gestures: 1-finger = tool action, 2-finger = pan/zoom/rotate (always), long-press = context menu. Minimum hit target 44 px; handles scale with DPR.
- Safe areas via CSS env(); landscape-first editor layout; bottom-sheet panels on narrow widths.
- WebView perf: avoid `devicePixelRatio > 2`, cap texture 1K on low tier, memory warnings → drop quality.

## 9. Error handling
- Geometry functions return `Result<T, GeometryError>`; on failure render last-good mesh + non-blocking toast.
- Error boundary per canvas; Sentry capture with scene hash (not content) for repro.
- Scene validation on load; corrupt → offer "recover from last autosave".

## 10. Testing hooks
- Geometry: golden snapshot tests (vertex counts, areas, bounds) for corner cases: T-junction, 3-way, acute angle, closed loop, nested loop, opening at wall end.
- Property tests (fast-check): any sequence of random commands + undo-all = original scene.
- E2E (Playwright): draw house → add door → place sofa → walkthrough smoke → reload → state persists.
- Perf test: scripted 200-wall / 150-item scene, assert frame time budget in CI (headless GPU optional, else geometry-time only).
