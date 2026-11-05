# Architecture Decision Records (ADRs)

Format: Status · Context · Decision · Consequences. Never delete an ADR; mark it **Superseded by ADR-xxx**.

---
## ADR-001 — Web-first with React + Three.js (R3F); Capacitor for mobile
- **Status:** Accepted (owner chose "Option A", 2026-11-05)
- **Context:** Need web + mobile from one team. Alternatives: Unity/Unreal (heavy web builds, poor 2D UI), Flutter (weak 3D), React Native + expo-three (clunkier 3D), Babylon.js (viable alternative to Three).
- **Decision:** React + TypeScript + Three.js via React Three Fiber; Capacitor wraps the web app for iOS/Android; PWA first.
- **Consequences:** + single codebase, huge ecosystem, fast iteration. − WebView GPU/memory limits on low-end phones; mitigate via asset budgets, quality tiers (Phase 0 validates). Revisit if Phase 0 fails the 30 fps phone target.

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
- **Status:** Accepted (revisit if text/dimension rendering is painful)
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

## Template
```
## ADR-0xx — Title
- Status: Proposed | Accepted | Superseded by ADR-xxx
- Context:
- Decision:
- Consequences:
```
