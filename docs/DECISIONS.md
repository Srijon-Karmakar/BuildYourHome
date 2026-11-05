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

## Template
```
## ADR-0xx — Title
- Status: Proposed | Accepted | Superseded by ADR-xxx
- Context:
- Decision:
- Consequences:
```
