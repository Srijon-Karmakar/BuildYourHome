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
