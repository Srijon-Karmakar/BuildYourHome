# Architecture Decision Records (ADRs)

Format: Status · Context · Decision · Consequences. Never delete an ADR; mark it **Superseded by ADR-xxx**.

---
## ADR-001 — Web-first with React + Three.js (R3F); Capacitor for mobile
- **Status:** Accepted (owner chose "Option A", 2026-11-05)
- **Context:** Need web + mobile from one team. Alternatives: Unity/Unreal (heavy web builds, poor 2D UI), Flutter (weak 3D), React Native + expo-three (clunkier 3D), Babylon.js (viable alternative to Three).
- **Decision:** React + TypeScript + Three.js via React Three Fiber; Capacitor wraps the web app for iOS/Android; PWA first.
- **Consequences:** + single codebase, huge ecosystem, fast iteration. − WebView GPU/memory limits on low-end phones; mitigate via asset budgets, quality tiers (Phase 0 validates). Revisit if Phase 0 fails the 30 fps phone target.
- **Validation (2026-11-05):** Phase 0 benchmark passed — 60 fps on a mid-range Mali-G68 Android phone at medium/low quality, 100 fps desktop. Decision stands. (Test was in Chrome on the phone, not yet inside the Capacitor WebView — re-measure in Phase 4.)

## ADR-002 — Scene JSON is the single source of truth; all edits are commands
- **Status:** Accepted
- **Decision:** Normalized JSON scene graph (see DATA_MODEL). Renderers, exports, and sharing derive from it. Mutations only through reversible commands (Immer patches).
- **Consequences:** + undo/redo, autosave, versioning, future collab, renderer independence. − discipline needed; derived data must never be persisted.

## ADR-003 — 2D-plan-driven authoring; 3D is derived
- **Status:** Accepted
- **Decision:** Structure (walls, openings, rooms, roofs) is authored in 2D and generated in 3D. Items/materials can be edited in both views.
- **Consequences:** + low learning curve, robust geometry. − no free-form sculpting (acceptable for target users).

## ADR-004 — Supabase as MVP backend
- **Status:** **Accepted** (owner confirmed 2026-11-05; free tier for the demo)
- **Context:** Need auth, relational storage, file storage, RLS fast. Alternatives: Firebase (NoSQL, vendor lock-in), custom NestJS + Postgres (more control, more work).
- **Decision:** Supabase (Postgres + Auth + Storage + Edge Functions).
- **Consequences:** + fastest to ship, SQL, self-hostable. − less control for complex jobs; heavy jobs (render/AI) go to separate workers later.

## ADR-005 — Tooling: pnpm monorepo, Zustand+Immer, Zod, Vite
- **Status:** Accepted
- **Decision:** Packages separated so `geometry` and `editor-core` are framework-free and testable in Node. Zod gives runtime validation of loaded/imported scenes.

## ADR-006 — Coordinate system and units
- **Status:** Accepted
- **Decision:** Metres, Y-up (Three default), plan on XZ. Display units converted at UI edge. Angles radians internally, degrees in UI.

## ADR-007 — Walls as boxes-around-openings instead of general CSG
- **Status:** Accepted
- **Context:** CSG is slow and flaky for realtime editing of many walls.
- **Decision:** Split wall solid into sub-boxes around rectangular openings; use CSG only for non-rectangular openings.
- **Consequences:** + fast, robust. − more bespoke code and UV handling.

## ADR-008 — 2D view rendered with orthographic Three camera
- **Status:** **Superseded by ADR-015** (kept for history)
- **Decision:** Reuse Three renderer for 2D; text via SDF (troika-three-text) or HTML overlay.

## ADR-009 — Assets: glTF only, Draco/Meshopt + KTX2, hard budgets
- **Status:** Accepted. See ASSET_PIPELINE.md.

---
## ADR-010 — Realism + smoothness via adaptive quality
- **Status:** Accepted (owner: realism is mandatory at MVP, smooth UX also mandatory)
- **Context:** Realism (shadows, AO, PBR, reflections) and smooth interaction (esp. on phones) conflict.
- **Decision:**
  - Realism baseline in MVP: PBR (MeshStandard/Physical) materials, HDRI image-based lighting, ACES/AgX tone mapping, sRGB color management, soft shadows, SSAO/GTAO on high tier, contact shadows, optional baked lightmap AO for walls/floors later.
  - Smoothness: `frameloop="demand"`; **progressive rendering** — low quality (no AO, reduced DPR/shadows) while the camera/pointer is moving, refine to full quality ~150 ms after idle; FPS governor adjusts DPR and effect set automatically; manual Low/Med/High override.
  - Perceived smoothness: optimistic UI, no blocking loads (placeholder boxes), debounced heavy geometry in workers, 60 fps input handling.
  - Realism is the **ceiling** on capable devices; the **floor** is a flat-shaded-but-clean look on weak phones.
- **Consequences:** + best look per device. − more render code and testing across tiers; Phase 0 must measure each tier on real devices. "Photoreal path-traced" renders stay out of MVP.

## ADR-011 — Monetization: entitlements, billing, ads
- **Status:** Accepted (model confirmed by owner); vendors Proposed
- **Decision:**
  - Catalog assets/materials have `tier: free | premium | rewarded`.
  - A single **Entitlement service** answers `canUse(assetId)` from: active subscription, rewarded-unlock records (with optional expiry), or free tier. UI shows lock badges; placing a locked asset triggers upsell sheet (subscribe / watch ad).
  - Entitlements are authoritative **server-side** (Supabase tables + RLS); client caches. Locked assets' GLB URLs are served only via signed URLs for entitled users (premium downloads gated).
  - Billing (proposed): **RevenueCat** for iOS/Android subscriptions (store rules require native IAP on mobile); **Stripe** for web. Webhooks → Supabase edge function updates `subscriptions`.
  - Ads (proposed): `AdProvider` interface; **AdMob** (Capacitor plugin) on mobile with banner + interstitial (at natural breaks only, never mid-edit) + rewarded video; a web provider (AdSense / Ad Manager) behind the same interface. Ads are never shown to subscribers and never inside the walkthrough.
  - Rewarded unlock must be verified with server-side verification (SSV) callbacks where the network supports it, to avoid client forgery.
- **Consequences:** + flexible freemium. − store-policy and ad-policy compliance work; a scene using premium assets and then lapsing subscription must still **open** (items render, but editing/export of them is gated) — see DATA_MODEL.
- **Demo note:** in the zero-budget demo, billing/ads are stubbed behind interfaces (mock provider) — real vendors integrated in Phase 2/4.

## ADR-012 — Zero-budget infrastructure for the demo
- **Status:** Accepted
- **Decision:** Supabase free tier; static hosting on Cloudflare Pages / Vercel / GitHub Pages free tier; GitHub Actions free minutes; Sentry/PostHog free tiers; no paid services until demo validates. Keep the app vendor-portable (thin API layer).
- **Consequences:** Free-tier limits (DB 500 MB, storage 1 GB, project pausing after inactivity) — keep assets small, store heavy files on CDN/static hosting, document pause risk.

## ADR-013 — Placeholder assets first
- **Status:** Accepted
- **Decision:** MVP ships with placeholder assets: procedurally generated primitives (boxes/cylinders composed into recognizable beds, sofas, tables, doors, windows) with PBR materials, plus a few CC0 models. The catalog format and pipeline are final; swapping in real assets is a data change, not a code change.

## ADR-014 — Progressive disclosure for beginner → engineer
- **Status:** Accepted
- **Decision:** One editor, two modes: **Simple** (default; templates, room-by-room wizard, snapping-first, minimal panels) and **Pro** (numeric fields, dimension tools, layers, scale, grid options, scaled PDF/DXF export). Same data model; Pro only exposes more controls.

---
## ADR-015 — 2D plan view uses the HTML Canvas 2D API (supersedes ADR-008)
- **Status:** Accepted (P0-04)
- **Context:** ADR-008 planned an orthographic Three camera. In practice the plan needs crisp 1-px lines, text labels, dashed guides and dimension annotations (Pro mode, PDF export) — all trivial in Canvas 2D, awkward in WebGL. Hit-testing is analytic (distance to segment), so no shared raycast pipeline is needed. Solo developer: simpler wins.
- **Decision:** `PlanController` draws the plan with Canvas 2D (DPR capped at 2, redraw on demand via rAF). The 3D view stays Three/R3F. Both read the same editor store.
- **Consequences:** + crisp text, easy SVG/PDF export later, cheap on mobile. − two renderers to maintain; the 2D↔3D camera transition (polish) must be faked with a cross-fade.

---
## ADR-016 — Design language: minimal "architectural paper" UI (see docs/DESIGN.md)
- **Status:** Accepted (owner brief + reference image, 2026-11-05)
- **Context:** Owner wants a clean, minimal, maximally user-friendly UI in the style of an architecture-studio brand sheet (warm greys, black type, brick accent, light geometric sans, lots of whitespace). Audience spans beginners to engineers (ADR-014).
- **Decision:** Light theme with CSS-variable tokens + mirrored canvas colours; Outfit variable font (bundled, free stand-in for ABC Visby CF); floating chrome at the edges (top bar, left tool rail that becomes a bottom bar on phones, contextual pills, one-line caption); text labels on every tool; one accent colour (brick). Snap options hidden behind one popover; Delete/Done only appear when relevant.
- **Consequences:** + calm, consistent, themeable (dark theme later = new token values). − less discoverability for advanced options (mitigated by tooltips + Pro mode later); canvas colours are duplicated in `render.ts` and must be kept in sync with `styles.css` (move to a shared `theme.ts` when a second canvas needs them).

---
## ADR-017 — Quality tiers, procedural lighting/textures, auto-governor and built-in benchmark (implements ADR-010)
- **Status:** Accepted (P0-09/10/11)
- **Decision:**
  - Three tiers (`low` / `medium` / `high`) defined as data in `view3d/qualityLogic.ts` (DPR cap, sun shadows + map size, environment resolution, AO + MSAA, texture size, normal maps). Setting = Auto | Low | Medium | High (persisted).
  - **No downloaded assets for lighting**: image-based lighting comes from a procedural softbox environment (`Lightformer`s), so the app is offline-safe and ADR-012-friendly. Wood-plank and plaster-relief textures are generated on a canvas (seeded, tileable, cached) — placeholders per ADR-013.
  - High tier adds **N8AO ambient occlusion + MSAA + ACES tone mapping** through the post-processing composer, lazy-loaded (separate 101 KB gz chunk).
  - **Progressive rendering**: render-on-demand; while orbiting R3F "regresses" performance and `AdaptiveDpr` lowers pixel ratio, restoring ~180 ms after the last move. (AO is *not* gated during motion: toggling the composer risks a visible tone-mapping flash; revisit in P3-04.)
  - **Auto governor** (`PerfProbe`): samples frame times only while interacting; if the last 45 frames average < 38 fps it steps the tier DOWN (3 s cooldown). It never steps up on its own (no oscillation); user can re-select.
  - **Initial tier guess**: desktop → high; touch devices → medium; touch with ≤ 2 GB or ≤ 4 cores → low.
  - **Benchmark**: one tap (or `?bench=1`) orbits the home on a fixed route for 6 s per tier (1.5 s warm-up), reports fps / p95 / p99 / draw calls / triangles + a copyable text report, so numbers are comparable across devices.
  - Ceilings are rendered in walk mode only.
- **Consequences:** + measurable, tunable, offline. − three code paths to keep visually consistent; procedural wood looks good but generic; draw-call counts include post passes.

---
## ADR-018 — Furniture: data-only catalog package, code-built placeholder models, snap-aware placement solver
- **Status:** Accepted (P1-05/06)
- **Decision:** The catalog is plain data in `@hd/assets` (no Three.js) so editor-core can place items and compute footprints/colliders in Node. Placeholder models are procedural (ADR-013), cloned from per-(asset, colour) templates. All snapping logic (grid, back-to-wall, wall mounting, ceiling) lives in one pure function `solvePlacement`, used by the placement tool, dragging and the demo scene, and unit tested. Item position y is relative to the floor of its level.
- **Consequences:** + testable, swap-in-GLB friendly, single source of truth for "where does this go". − Models are generic; collision uses footprint edges only; placement doesn't avoid other furniture.

---
## ADR-019 — Backend behind an interface; demo LocalBackend first, Supabase when configured
- **Status:** Accepted (Phase 2)
- **Context:** The owner has no Supabase project yet and keys must never be pasted into chat or committed; the product still has to be built and tested end to end.
- **Decision:** All account / storage / sharing / entitlement access goes through `Backend` (`apps/web/src/cloud/types.ts`). `LocalBackend` (browser storage; hashed passwords; no sync) is the default; `SupabaseBackend` is selected by `VITE_SUPABASE_*` env vars and loaded lazily. Entitlements are enforced server-side by RLS (users can only read subscription/unlock rows; only the service role writes them), so on Supabase the browser cannot grant itself access: `unlockWithAd`/`setSubscription` are refused until webhook / ad-verification functions exist. Shared links resolve through a `security definer` function that needs a valid, non-revoked token.
- **Consequences:** + every flow is testable offline; swapping providers is contained; − two implementations to keep in step (the interface and shared tests guard it); the real path needs a live smoke test before launch.

## ADR-020 — Stairs: parametric solid steps, derived rise, stairwell opening, walker follows them
- **Status:** Accepted (Phase 3, P3-02)
- **Context:** Multi-storey homes need a way to connect floors in plan, 3D and the walkthrough. `Stair` already exists in the schema.
- **Decision:** A stair is `{ fromLevel, toLevel, kind: straight|L|U, origin, rotationY, width, mirror?, material? }`. `origin` is the centre of the bottom edge of the first step (y relative to the `fromLevel` floor). The run climbs toward local −z; `mirror` turns L/U stairs the other way. The **rise is never stored**: it is `toLevel.elevation − fromLevel.elevation`, split into risers of ≈ 17.5 cm, so changing a floor height re-fits the stairs. Treads are 28 cm; L/U stairs get a square landing in the middle. Steps are solid blocks (no stringers), built as pure geometry in `@hd/geometry/stairs` (layout, outline, `heightAt`, mesh). The stair's outline is cut out of the floor above (and the ceiling below) when it lies inside a room. The walker follows `heightAt` while inside the outline and switches its active floor at the half-way height; stairs are removed with either of their floors; the tool adds the floor above when there is none.
- **Consequences:** + one source of truth, no stale heights; + walking between floors works without special levels; − floor openings only cut when the whole outline is inside one room (otherwise the floor stays and the inspector warns); − no railings, winders or spiral stairs yet.

## ADR-021 — Realism within the frame budget: lazy CC0 photo textures, light AO, sky + time of day
- **Status:** Accepted (Phase 3, P3-04 first slice)
- **Context:** The owner wants realism and photographic textures but 60 fps on a mid-range phone at Medium (ADR-010 and the Phase 0 benchmark).
- **Decision:** (1) Procedural materials stay the instant, offline baseline. On **Medium and High only**, matching **CC0 ambientCG** sets (512 px colour + normal + roughness, about 3 MB for all 17, fetched per set on first use) replace the procedural maps when loaded; **Low downloads nothing**. Colour maps are brightness-normalised so a material's tint still works. (2) **Ambient occlusion** (N8AO, half-res, "performance" quality) now also runs on Medium **but only on devices without a coarse pointer**; phones keep Medium free of post-processing. Every floor item gets a cheap soft contact-shadow blob instead (two triangles). (3) A **sky shader** (Medium/High) and a sun driven by `scene.lighting.timeOfDay` (pure `sunAt(hour)`); Display > Time of day with presets. (4) Furniture boxes get a small bevel; glass reflects the environment.
- **Consequences:** + big visual step with no new cost on Low and no post-processing on phone Medium, only texture sampling; + licences are clean (docs/ASSET_LICENSES.md); - Medium on a phone is untested on hardware: **re-run Display > Run benchmark on the phone**; if Medium drops under 60 fps, lower `TIERS.medium` texture use; - contact blobs are hidden when AO is on (AO replaces them).

## ADR-022 — Export: one drawing model, our own tiny PDF writer, ASCII DXF R12, canvas PNG
- **Status:** Accepted (Phase 3, P3-05)
- **Context:** Owner needs to take plans away: a picture, a printable scaled plan and a CAD file. Zero budget, offline-capable, small bundle.
- **Decision:** `export/drawing.ts` turns a floor into plain primitives (polygons + text on named layers: WALLS, DOORS, WINDOWS, ROOMS, FURNITURE, STAIRS, BALCONY, GARDEN, PLOT, DIMENSIONS). `export/pdf.ts` is a ~150-line vector PDF writer (built-in Helvetica, Latin-1) used by `pdfPlan.ts` (A4 / A3, one page per floor, standard scale 1:20…1:1000 picked to fit, title block, scale bar, north arrow, overall dimensions). `export/dxf.ts` writes AutoCAD R12 ASCII (POLYLINE / TEXT, millimetres, north up, layers prefixed by floor name). The 3D PNG re-renders one frame of the live canvas at up to 2.5x (max 4096 px) via `export/capture3d.ts`; it omits the screen-space AO pass.
- **Consequences:** + no dependency, deterministic, unit-tested file structure (xref offsets, balanced DXF sections); - text is Latin-1 only (other scripts become "?" in the PDF), no hatch patterns, DXF has no blocks / dimensions entities (plain lines and text); - saved viewpoints and layer toggles from FR-905 are still open.

## ADR-023 — Lamps: free glow everywhere, a fixed pool of real lights on Medium / High
- **Status:** Accepted (Phase 3, P3-03)
- **Context:** Night view needs lit rooms, but real lights multiply shader cost and changing their count recompiles shaders (a visible hitch on phones).
- **Decision:** All light items (floor / table / arc lamps, ceiling light, pendant, chandelier, fan, wall light, garden lamp post) have a spec in `view3d/lights.ts`. Their shades are emissive materials registered in `furniture/kit.ts`; one call `setLampGlow(level)` scales them (cheap, every tier). On Medium (3) and High (6) a **fixed pool** of unshadowed PointLights is moved each rendered frame onto the lamps nearest the camera (pool size never changes, so no shader rebuilds); Low has none. `Display > Lamps: auto / on / off` (auto = on as daylight fades; remembered in localStorage). A dim blue directional "moon" light is added at night, ambient environment never drops below 0.2.
- **Consequences:** + night looks lit with predictable cost; - lights have no shadows and do not respect walls (a lamp can faintly light the next room, limited by a 9 m range); - at most 3 / 6 lamps cast real light at once.

## Template
```
## ADR-0xx — Title
- Status: Proposed | Accepted | Superseded by ADR-xxx
- Context:
- Decision:
- Consequences:
```

## ADR-024 — Roofs are parts that follow the rooms; stairs build their own room; sunshades live on the opening
**Status:** accepted (2026-11-07). Owner feedback: roofs only covered a bounding box and had to be added by hand; stairs left the floor above empty; no sunshades; walk mode felt tiny; phones lagged.
- **Roof model.** A floor can have several roofs. Each `Roof` may carry a `box` (the oriented rectangle of wall centre lines it covers) and `auto`. A floor with `Level.autoRoof` has its roofs created, moved and removed by `syncRoofs` in `postProcess` after rooms: the floor's rooms minus what any higher floor covers minus what a hand-made roof claims, cut into rectangles on a grid of the rooms' own edges when the plan is square to its longest wall (an L-house = 2 parts), else one box per room. A part that is still the same part keeps its id and every user setting (matched by overlap). Hand-made roofs (`auto` false, e.g. "Own roof for this room") are never moved. Deleting an automatic roof turns the floor to hand-made so it does not grow back; "Make automatic" / "Rebuild roofs" undo that. Old homes (no `autoRoof`) and old whole-floor roofs (no `box`) are untouched. New floors and new homes have `autoRoof` on.
- **Roof shape.** Pitched, flat and shed roofs are a plate of real thickness (fascia, recessed wall-colour gable, rake overhang, optional ridge cap, gutters, chimney, flat-roof parapet); butterfly, mansard, barrel stay solid shapes. The mesh has material slots (roof, gable, trim, gutter, chimney); UVs are laid on the face in metres so tile rows and ribs follow the slope.
- **Stairs.** `addStairAssembly` builds the floor above, the flight, the room round the top (walls, landing, door) and optionally a flight on every floor; `connectStairHall` and `continueStairUp` repair / extend an existing stair.
- **Sunshades.** `Opening.shade` (slab / awning / louvre / canopy, depth, colour) on the outside face (`exteriorSide`), drawn dashed on the plan.
- **Phone speed.** Furniture models are merged to one mesh per material (draw calls 291 → 30 on the sample home); the sun's shadow map is redrawn only when something that casts a shadow changes; fewer real lights and a lower pixel ratio on touch screens.
- **Walk.** Field of view (default 80°) and eye height are user settings, remembered.
- **Why not** a straight-skeleton roof for any outline: far more code and edge cases; rectangles cover the houses people draw, and the rest can be hand-made.

## ADR-025 — Ready-made homes are built by the editor; the app is an offline-first PWA with a hand-made service worker
**Status:** accepted (2026-11-07). P2-05 and P2-06.
- **Sample homes** (`apps/web/src/plan/samples.ts`): 9 homes (1/2/3 BHK flats, duplex, 2 BHK house, 4 BHK two-floor house, villa with pool, shop, office) built with the real editor commands, so walls, rooms, doors, roofs and stairs obey the same rules as hand-drawn ones. Rooms are furnished from the ready-made room presets (`layoutItems`, stretched to fit); a plan is "double loaded" (a passage with a row of rooms each side, rooms north face south, rooms south face north) with a U-stair room repeated on every floor; houses get a plot, compound wall, lawn, path, gate and trees. Unit tests check every home saves and opens, every room has a door, no furniture overlaps and indoor furniture stands inside a room. The gallery draws a plan picture from the built scene itself (nothing to keep in step with the models).
- **Offline.** `public/manifest.webmanifest` + `sw.js` generated at build (`offlineApp` plugin in `vite.config.ts` from `sw.template.js`; no new dependency). The shell (page, scripts, styles, fonts, icons) is stored on install; photo textures and other same-site files are stored when first used; the page is network-first with the stored page as the fallback; other sites (the cloud) are never touched. `localStorage` already holds the home, so editing works offline; cloud sync is skipped offline and catches up on `online`; sign-in and share links say they need the internet. `pnpm e2e:offline` builds nothing itself: run `pnpm build` first; it serves the built app, goes offline in the browser and checks the app, gallery, 3D and share dialog.
- **Install.** `beforeinstallprompt` is captured and offered as **Install the app** (Home menu); iPhone users add it from Share. The service worker is registered in production builds only (dev servers would otherwise serve stale files).
- **Trade-off:** the very first visit still needs internet (the app has to be fetched once); texture photos that were never opened online are missing offline, and the scene falls back to the simple textures.

## ADR-026 — Stairs stay exact; trees are built from shaded clusters; the night scene is a sky object
**Status:** accepted (2026-11-07). Owner feedback: trees looked wrong and could not be sized, stair linking was not accurate, no night mode.
- **Stairs.** `syncStairs` (in `postProcess`) keeps every stair joined to the floor directly above its own, and removes a stair whose floor is gone. `stairOpenings` cuts the stairwell hole from the stairs' own outline; when the stairs only partly lie in a (square-cornered) room it cuts the part inside (`clipToConvex`, Sutherland–Hodgman, pulled in 1 cm) instead of leaving the floor closed. `stairNeedsRoom` now asks whether there is floor where the climber steps off (a point 45 cm past the top step), not whether the whole outline fits one room. Stairs snap flush to wall faces while placing and dragging (`snapStairToWalls`, honours "Join onto walls"). Spiral stairs turn at most 300° so there is a gap to walk in through (the steps are solid blocks to the floor, so the part of the circle under the top steps is blocked). A browser test walks up every kind of stair and down one, driving the real walker.
- **Trees.** Foliage is lumpy, softly shaded clusters (darker underneath) with the colour in the vertices, on a tapered trunk with a root flare and limbs; all foliage of a tree shares one material, so a crown is one draw call (`mergeByMaterial` keeps vertex colours). The catalog colour list is the season: Natural, Spring, Deep green, Autumn gold, Autumn red, Blossom, Winter. Trees can be sized freely: growth stages (sapling 30 %, young 55 %, grown 100 %, mature 135 %), and height and crown width on their own (`setItemsSize`, limits 0.2–3 ×).
- **Night.** `SunState.darkness` (0 by day, 1 at night, ramping over 1.5 h at dusk and dawn) drives a dark sky dome, 1,500 stars, a moon and its glow (`NightSky`, centred on the eye every frame), a faint haze (exponential fog), cool moonlight and warm glowing windows (`setWindowGlow`, tied to the lamp level). One tap on **Night** (bottom row) sets 9:30 pm and remembers the hour you had; Day puts it back. Low tier keeps a plain dark background (no sky, stars or moon).

## ADR-027 — Roads are zones with their own geometry; neighbours are tagged items; the environment is a sky-side layer
**Status:** accepted (2026-11-07). Owner request: roads and pavements with full customisation, neighbouring buildings, and an environment that feels real.
- **Roads.** A road is a `Zone` with `shape: 'road'` and a `road: RoadStyle` (lanes, one-way, centre / edge lines, parking bays, kerb height, pavement width and material per side, zebra crossings, speed bumps, roadside extras). It reuses everything a garden path already had: the Road tool is the path tool, selection, move and delete are the zone ones, and the outline you select includes the pavements. The geometry lives in `packages/geometry/src/road` (`roadLayout` for the plan and the paint, `buildRoadMesh` for the 3D surface, `roadsideSpots` for lights / trees / benches / bins / bollards). Where roads cross, paint and pavement are left out inside the other road's carriageway (`roadCoverage`), and each road sits on its own polygon-offset layer so crossings never flicker.
- **Roadside extras** are drawn as instanced meshes (one draw call per kind however many stand along the road); they are not items, so they cannot be dragged one by one, only changed by spacing, side and kind.
- **Neighbours.** `fillStreet(roadId, style, seed)` places houses, shops, a temple, farms, flats and towers on both sides, facing the road, outside the pavement plus a setback, with seeded variation (building, colour, size, gaps), trees in front gardens, and people, animals and vehicles in the street. It keeps clear of the plot, the house, other roads and anything already placed, and it never overlaps. The same seed gives the same street. Everything it adds is an ordinary item tagged `street:<roadId>`: filling again replaces it, Clear removes it, deleting the road removes it, and what you place yourself is never touched. The 3D "Trees & scenery" layer covers them.
- **Environment** (`Atmosphere`, `GroundDetail`, `weather.ts`): clouds, hills or a city skyline on the horizon, a few birds and rain are drawn around the eye and never come nearer; weather (`lighting.weather`: clear / cloudy / fog / rain) changes sun strength, sky colour, haze and shadows through one table (`WEATHER_LOOK`); rain is a GPU-animated streak field that asks for a new frame every frame (so it costs battery, the Display menu says so), is hidden while walking inside the house, and makes roads wet and adds puddles. Ground detail (grass tufts, pebbles, soil patches, leaves, puddles) is instanced and seeded, off on Low and switchable in Display. the horizon and ground-detail settings described here were replaced by the environment editor (ADR-028).
- **Limits.** Cars, people and animals stand still (no animation); birds are a still picture; the street fill is not live (move the road and fill again); a road must not fold back on itself.
- **Why not** real roads as walls / floors: roads are long and curved, have markings and cross each other, none of which the wall and room model handles. **Why not** simulated traffic and crowds: a moving crowd costs a lot of battery and the owner's goal is a convincing still view.

## ADR-028 — The environment is a scene setting with four sides; flat land is the default
**Status:** accepted (2026-11-07). Owner feedback: hills showed on every horizon and could not be changed; asked for an environment editor.
- **Where it lives.** `scene.lighting.environment` (`EnvironmentSettings`): scenery per side (`north` is up on the plan, −z), clouds, haze, sky look, birds, ground detail amount, a ring of trees and its kind. Every field is optional and **unset means the default: open flat land**, a little haze, a few clouds, birds, some ground detail. Only what differs from the default is stored (`encodeEnvironment`), so an untouched home stores nothing. `resolveEnvironment` fills the defaults in one place.
- **Older homes.** The short-lived `lighting.horizon` ('hills' / 'city' / 'none') is read once: a home that has it and no `environment` keeps what it showed (hills or city on all four sides); the first edit in the editor writes the full setting and drops `horizon`. `setHorizon` is gone.
- **Scenery.** Seven kinds per side: open land, hills, mountains, forest, sea, desert, city; each with a height (low / normal / tall) and colour (natural, green, golden, rocky, misty); mountains can have snow. The horizon is a ring seen from the middle, and the four sides blend into each other over about 40° (`view3d/scenery.ts`, pure maths, tested): relief is a far and a near wall with four colour rows (foot, low, high, top; the snow line is a fixed height), a city is instanced buildings only where a side is a city, and sea / desert / woods / paving tint the flat land beyond the plot. Mountains, hills and woods are drawn lit by slope so the ridges read as solid.
- **Ring of trees** (`planTreeRing`, pure and seeded): trees just outside the plot (or round the house), spaced like planting, never on roads, pavements or near buildings; drawn instanced (a few draw calls whatever the count). Kinds: mixed, palms, pines, neem.
- **Looks.** Seven ready-made environments (open land, village, hill station, coast, desert, forest, city) replace the environment settings only: the ground, the weather, the time of day and anything placed stay.
- **The editor** is a panel (`EnvironmentPanel`) that takes the properties panel's place while open (the properties panel is hidden, the selection is cleared when it opens), opened from an **Environment** button in the 3D bottom row. It stays open while you look around. On phones it is the same bottom sheet as the properties panel.
- **Moved.** Display's "In the distance" and "Ground detail" rows are gone; ground detail is now a scene setting (none / some / lots) instead of a per-device toggle. Weather and time of day stay in Display and are repeated in the editor.
- **Why not** a per-device setting for the environment: a shared home should look the same on every device; low-end phones are already protected by the quality tiers (grass and clouds are off on Low).
- **Limits.** Scenery is a backdrop on a ring: it never gets closer or farther and casts no shadow; the sea starts beyond the plot's verge (about 90 m out), so from ground level it is a thin band.

## ADR-029 — Stairs open only where there is no headroom; one railing engine for stairs, balconies and roof terraces; trees from leaf cards
**Status:** accepted (2026-11-12). Owner feedback: stairs needed open builds (steps only, nothing under them), the link between floors overlapped and did not line up, balconies and roofs needed designers like the stairs', trees looked fake.
- **The opening above a stair** (`stairHole`) is no longer the whole footprint. The floor above only opens where the steps are closer to it than 2.05 m (`STAIR_HEADROOM_M`); the lower steps pass under the floor, which keeps its area. This is what lets a flight stacked on another start on solid floor (it used to start over a hole), and it matches how houses are built. A spiral, and a stair too short to pass under, still open in full. Floors and ceilings, the 2D plan (solid opening, dotted run under the floor) and the walker (on the floor above only the opening leads down) all use it. The room built round the top (`stairHallCorners`) still wraps the whole footprint so a stacked flight stays inside a room, and a straight flight gets a 0.9 m walkway beside it (the climber has to walk back along the opening to the next flight). A spiral that continues upward starts at the angle where the last one arrived (`nextFlightRotation`).
- **Guard at floor level.** The upper floor gets a railing round its opening (the cut edge where the steps pass under, and the sides as far as the stair's own rail is lower than 0.3 m below the floor), not across the exit. Rails that stand flush against a house wall are left out (`stairRailSkip`), so no rail runs inside a wall.
- **Stairs and walls.** The placement ghost is pushed clear of any wall it would cross (`stairPushOut`, separating-axis test, at most 0.8 m), the inspector reports a wall in the way, a wall through the opening and furniture on the stairs (`stairProblems`).
- **Builds** (`Stair.build`: solid / stringer / spine / floating; `steps`: thickness, nosing, closed risers + colour; `stringer`: width, depth, colour). Unset = solid, so every saved home looks the same. `buildStairBody` returns three slots (tread, riser, frame); open treads are slabs with a nosing, the side / centre beams follow the steps as a saw-tooth under them, landings sit on a frame with posts, a spiral hangs its wedges on a pole. The walking surface (`StairLayout`) does not change, so walking, hole and rails are the same for every build.
- **One railing engine.** `buildRailFromPaths` (geometry) takes any runs of points with a height and builds posts, handrail and infill (balusters, cables, glass, solid, none) in three material slots. Stairs, balconies (`Balcony.railingOpts`, kinds glass / metal / wood / wall) and flat-roof terraces (`Roof.railing`, `railingOpts`: inset, sides left open, spacing) all use it, with one inspector panel (`RailingPanel`). `RailingOpts` is one zod object shared by the three.
- **Balconies** also get a slab (thickness, edge colour, kerb), supports (none / columns / brackets / wall below) and a cover (flat roof or pergola), all optional.
- **Trees** (`realTrees.ts`) replace the blob crowns: a curved tapered trunk with bark texture, limbs that fork twice, and hundreds of alpha-cut leaf cards (a drawn spray of leaves) sampled over the crown outline, tinted dark inside to light outside, with soft crown-wide normals, in one mesh per tree. Pine and cypress use needle sprays on tiered cones, willow hangs long strands, the palm has arched leaflet fronds, the banyan hangs roots. Textures are drawn on a canvas once; in plain Node (tests) there is no canvas and the cards are flat colour. Touch screens get about 55 % of the cards. `trees.ts` (the old cluster trees) is still there as the fallback layer under it.
- **Why not** a lower hole as a setting: the headroom rule is the one right answer and it is what the owner expects from a real stair. **Why not** real alpha-blended foliage: cut-out cards (alpha test) need no sorting and cast correct shadows.
- **Limits.** The saw-tooth beam of an open stair is straight-cut (no stringer notches for the nosing); a stacked straight flight needs the walkway on its right side; brackets under a balcony only go on the edges against the house wall; trees of one species are identical (turned and scaled by the item).

## ADR-030 — Facade design: opening extras and wall dressing live on the opening / wall; facade decorations are wall-hung catalog items
**Status:** accepted (2026-11-12). Owner request: box windows (frame box and bay), grills, glass, panes, arched heads, frame and trim, more door styles and handles; new wall finishes, finish controls, two-tone walls, feature panels; facade fins / louvres / jaali, wall lights, name plate and house number, wall planters / creepers / green wall, mouldings.
- **Openings** get optional fields (unset = today's look, so saved homes are unchanged and no migration is needed): `box` (`frame`: a projecting box round the window on the outside face, depth / board thickness / which sides / colour; `bay`: the window pushed out as a glass box with glass sides, optional seat inside), `grill`, `glass`, `panes`, `head` (flat / arch / segment: the hole stays rectangular, ADR-007; the corners above the springing line are filled with wall-coloured spandrels and a curved frame), `frame` (bar width, finish), `surround` (band / stone / moulded trim on the outside face), `handle`. New door styles: carved, pivot, barn, glazed. Extras that sit outside are built on the exterior face (`exteriorSide`, like sunshades).
- **Walls** get optional `lowerA` / `lowerB` (two-tone: a second finish from the floor up to a height, with an optional band), `panels` (feature panels: rectangles of cladding on one face, cut round the openings), `trim` (mouldings on the outside face: cornice, plinth, bands, pilasters). `MaterialRef` gains `joint` (mortar / grout colour); its existing `tint`, `uvScale`, `uvRotation` are now honoured by the renderer (colour, pattern size, pattern direction).
- **Two-tone** is a split in the wall mesh itself (`buildWallMesh(..., splits)`, extra slots `lowerA` / `lowerB` appended to `WALL_SLOTS`), so corners stay mitered and holes stay exact. **Panels and mouldings** are thin solids proud of the face, cut round the openings with the same strip logic (`rectMinusCuts`). Wall split / merge carry panels with their offsets (and swap sides when a wall is reversed); walls only merge when their dressing matches.
- **Decorations** are catalog items in a new `facade` category with `mount: 'wall'` (they already snap to the outside face of any wall). Items gain an optional `text` (name plate, house number) that is part of the model cache key. Wall lights join the lamp list (they glow at night).
- **Joint colour** recolours the procedural texture (joints are drawn in a marker colour, then faces take the finish colour and joints the joint colour) and keeps the procedural map on Medium / High instead of the photo albedo (the photo normal / roughness still apply).
- **Why not** CSG for arched holes: ADR-007 keeps holes as boxes; spandrels look the same from both faces and cost nothing. **Why not** decorations as wall properties: items can be moved, copied and deleted like furniture, which the owner already knows.

## ADR-031 — One-click staircase through several floors; stairs may stand on their own; new roofs are flat
**Status:** accepted (2026-11-12). Owner request: build stairs connecting all floors in one step with options (how many floors, stair customisation); stairs without any room built round them; flat roof by default.
- **Several floors at once.** `addStairAssembly` takes `flights` (1-12): one flight per floor, stacked, adding every missing floor above (`floorHeight` sets the height of added floors, default = the floor below), all in one undo step. It also carries `build`, `steps`, `stringer`, `railingOpts` onto every flight. `toTop` still works as before (up to the existing top floor). The Stairs tool's bottom bar has an **Up N floors** stepper, a **Room above** switch and a **Stair options** card (room, width, build, railing, new floor height).
- **Stairs on their own.** **Room above** is now off by default: the tool adds only the stairs (and the floors), no walls, door or roof. The inspector no longer warns when the floor above is empty; it notes the stairs stand on their own and offers **Build a room above**. The warning stays when the floor above has walls but none round the top of the stairs. `continueStairUp(id, rng, { hall: false })` keeps a standalone stair standalone.
- **Flat roofs by default.** `DEFAULT_ROOF_STYLE = 'flat'` (scene-schema) is used by automatic roofs, `setRoof`, `addRoofOverRooms` and the Roof button; the default roof material is now the concrete slab (`roof-concrete`) since tiles on a flat roof look wrong. Saved homes keep their roofs (style and material are stored).
- **Why** the room off by default: the owner wants plain stairs first (outdoor stairs, stairs drawn before the rooms); the room is one tap away.
