# Phase-wise Division

Estimates assume a small team (2–3 devs + part-time designer); scale as needed. Tick boxes as tasks finish and mirror in `progressReport.md`.

## Phase 0 — Prototype / Technical spike (≈ 2–3 weeks)
**Goal:** prove the riskiest parts: draw → 3D → walk, on desktop and a real phone.
- [x] P0-01 Scaffold pnpm monorepo, Vite + React + TS + R3F, hello-cube; lint/format/CI skeleton
- [x] P0-02 `scene-schema` v1 types + Zod + defaults
- [x] P0-03 `editor-core`: store, command bus, undo/redo (Immer patches)
- [x] P0-04 (code done; awaiting owner device test) 2D canvas: grid, pan/zoom, wall tool with snapping
- [x] P0-05 (code done; awaiting owner device test) `geometry`: wall mesh with mitered corners → 3D view
- [x] P0-06 Room detection + floor mesh (code done; awaiting owner device test)
- [x] P0-06b T-junction auto-split: ending/starting a wall on the body of another wall splits it and joins them (needed so dividers create rooms) (code done; awaiting owner test)
- [x] P0-07 (code done; awaiting owner device test) Orbit camera + FPS walkthrough with wall collision (desktop)
- [x] P0-08 (done as a design-language + touch-layout pass, see ADR-016; real-device test still pending) Touch controls (pinch/pan, joystick) + test on mid-range Android + iPhone via LAN/PWA
- [x] P0-09 (tooling done: Display menu, stats, one-tap benchmark; **owner's device numbers pending**) Perf baseline measurements recorded in `progressReport.md`
- [x] P0-10 (done: procedural IBL, AO, textures, ceilings) Realism spike: PBR + HDRI + shadows + AO + tone mapping on the sample house; measure each quality tier on phone & desktop
- [x] P0-11 (done: AdaptiveDpr regress + auto governor) Progressive-rendering spike (degrade while moving, refine on idle) — validate it feels smooth
**Exit criteria:** can draw a 3-room house, see it in 3D, walk through it at ≥ 30 fps on a mid-range phone. Go/no-go on stack decision (ADR-001).
**RESULT (2026-11-05): MET — GO.** Mid-range phone (Mali-G68) holds 60 fps at medium/low; desktop 100 fps (display cap). See progressReport P0-12.

## Phase 1 — MVP editor (≈ 6–8 weeks)
**Goal:** a complete single-user local design tool.
- [x] P1-01 Doors/windows: placement, wall cutting, resize, swing
- [x] P1-02 Wall/room property inspector; delete/split/merge; multi-select
- [x] P1-03 Multi-level support + level switcher + cutaway modes
- [x] P1-04 (largely delivered via the inspector: 7 paints + 7 finishes + 12 floors + per-side paint) Materials: library, paint floors/walls/ceilings, per-face walls
- [x] P1-05 (34 placeholder items + models + thumbnails; real asset budget pipeline comes with real GLBs) Asset pipeline v1 + catalog (≈ 80 items) + loader/cache
- [x] P1-06 Furniture placement: drag, rotate, scale, snap to floor/walls, duplicate
- [ ] P1-07 Plot boundary + ground plane
- [x] P1-08 (roofs done; facade materials already covered by per-side wall finishes) Roof generator (gable/hip/flat) + facade materials
- [x] P1-09 Local persistence (IndexedDB autosave), import/export JSON
- [ ] P1-10 UI shell: toolbars, panels, responsive/touch layout, shortcuts, onboarding tooltip
- [ ] P1-11 Unit tests ≥ 80% on geometry/editor-core; first Playwright E2E
- [ ] P1-12 Realistic rendering baseline (PBR, HDRI lighting, soft shadows, SSAO, tone mapping, color management) — ADR-010
- [ ] P1-13 Adaptive quality: FPS governor, progressive rendering, Low/Med/High setting (moved up from P3)
- [ ] P1-14 Placeholder asset set (procedural furniture/doors/windows + a few CC0) with `tier` field in catalog — ADR-013
- [ ] P1-15 Simple vs Pro mode: numeric inputs, dimension annotations, unit parsing (m / ft-in) — ADR-014
- [ ] P1-16 Guided start (template or room-by-room) + onboarding tutorial
**Exit criteria:** testers can design a 2-floor house with furniture and roof in < 30 min without help, survive reload, no data loss.

## Phase 2 — Accounts, cloud & sharing (≈ 3–4 weeks)
- [ ] P2-01 Supabase project, schema, RLS, environments
- [ ] P2-02 Auth (email + Google), profile
- [ ] P2-03 Cloud save/sync + conflict handling + project dashboard w/ thumbnails
- [ ] P2-04 Share links + read-only viewer
- [ ] P2-05 Templates / sample houses
- [ ] P2-06 PWA (offline shell, install prompt)
- [ ] P2-07 Error tracking + analytics
- [ ] P2-08 Entitlement service + DB tables (`subscriptions`, `unlocks`), lock badges, upsell sheet (ADR-011)
- [ ] P2-09 `AdProvider` abstraction + mock provider; ad placements rules (free tier only, never mid-edit)
- [ ] P2-10 Rewarded-ad unlock flow (mock → real network; server-side verification)
- [ ] P2-11 Subscription billing: Stripe (web) first; RevenueCat wiring prepared for P4
**Exit:** user can sign in on web and phone and see the same project; shared link opens a viewer for anonymous users; free vs premium gating works end-to-end with mock ads/billing.

## Phase 3 — Exterior richness & lighting (≈ 4–5 weeks)
- [ ] P3-01 Garden/landscape items, paths, fences, boundary wall
- [ ] P3-02 Balcony / porch / stairs
- [ ] P3-03 Time-of-day sun + shadows; interior lights
- [ ] P3-04 Advanced realism: reflections/probes, baked AO lightmaps, better glass/water, bloom — tuned per tier
- [ ] P3-05 Export PNG + scaled PDF plan + DXF; saved viewpoints; layers (FR-905)
- [ ] P3-06 Catalog growth (≈ 250 items), material set ≈ 150
**Exit:** an exterior "hero view" looks good on high tier and runs on low tier.

## Phase 4 — Mobile app & polish (≈ 3–4 weeks)
- [ ] P4-01 Capacitor iOS + Android shells, icons/splash
- [ ] P4-02 Native share/export, haptics, file import
- [ ] P4-03 Touch UX pass (gestures, bottom sheets, safe areas)
- [ ] P4-04 Performance + memory tuning on devices; crash-free ≥ 99%
- [ ] P4-05 Store listings, privacy policy, TestFlight / internal testing
- [ ] P4-06 Accessibility + i18n pass
- [ ] P4-07 Real AdMob (banner/interstitial/rewarded) + RevenueCat IAP subscriptions; store-policy compliance review
- [ ] P4-08 Replace placeholder assets with real catalog (as supplied)
**Exit:** apps in TestFlight and Play internal track; beta feedback loop running.

## Phase 5 — Growth features (backlog, prioritize by user feedback)
- [ ] Cost estimation (quantity takeoff)
- [ ] AI: floor-plan image → scene; AI layout suggestions
- [ ] AR walkthrough / place on real plot
- [ ] Real-time collaboration
- [ ] Cloud photoreal render + video tour export
- [ ] User-uploaded GLB models
- [ ] Vastu / building-code checks
- [ ] Marketplace (vendors, contractors, product catalog)
- [ ] Version history

## Dependency graph (high level)
`P0 → P1 → P2 → P4`  and  `P1 → P3 → P4`. Phase 5 items branch off after P2.

## Rules
- Each phase ends with a demo build + retro note in `progressReport.md`.
- Scope cuts allowed within a phase; moving items **between** phases requires an update here.
