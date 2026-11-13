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
- [x] P1-07 Plot boundary + ground plane (plot around house / draw by hand, wall or fence along the edge, ground limited to the plot, out-of-plot warning)
- [x] P1-08 (roofs done; facade materials already covered by per-side wall finishes) Roof generator (gable/hip/flat) + facade materials
- [x] P1-09 Local persistence (IndexedDB autosave), import/export JSON
- [x] P1-10 (guided start done; Pro-mode polish continues in P1-15) UI shell: toolbars, panels, responsive/touch layout, shortcuts, onboarding tooltip
- [x] P1-11 (coverage: geometry 95%, editor-core 98%, assets 93%, schema 98% — `pnpm coverage`) Unit tests ≥ 80% on geometry/editor-core; first Playwright E2E
- [x] P1-12 Realistic rendering baseline (PBR, HDRI lighting, soft shadows, SSAO, tone mapping, color management) — ADR-010
- [x] P1-13 Adaptive quality: FPS governor, progressive rendering, Low/Med/High setting (moved up from P3)
- [x] P1-14 Placeholder asset set (procedural furniture/doors/windows + a few CC0) with `tier` field in catalog — ADR-013
- [x] P1-15 Simple vs Pro mode: numeric inputs, dimension annotations, unit parsing (m / ft-in) — ADR-014
- [x] P1-16 (welcome + templates + next-step tips) Guided start (template or room-by-room) + onboarding tutorial
**Exit criteria:** testers can design a 2-floor house with furniture and roof in < 30 min without help, survive reload, no data loss.

## Phase 2 — Accounts, cloud & sharing (≈ 3–4 weeks)
- [x] P2-01 (SQL + RLS written; not yet run on a live project) Supabase project, schema, RLS, environments
- [x] P2-02 (email/password; Google OAuth + reset still to do) Auth (email + Google), profile
- [x] P2-03 (autosave sync + project list; thumbnails and conflict dialog still to do) Cloud save/sync + conflict handling + project dashboard w/ thumbnails
- [x] P2-04 Share links + read-only viewer
- [x] P2-05 Templates / sample houses: gallery of 9 ready-made homes with plan pictures (ADR-025)
- [x] P2-06 PWA: installable, opens offline after the first visit, offline notice, sync catches up (ADR-025)
- [ ] P2-07 Error tracking + analytics
- [x] P2-08 (client rules + badges + upsell; server tables in SQL) Entitlement service + DB tables (`subscriptions`, `unlocks`), lock badges, upsell sheet (ADR-011)
- [x] P2-09 (demo ads; real network later) `AdProvider` abstraction + mock provider; ad placements rules (free tier only, never mid-edit)
- [x] P2-10 (demo ad → 24 h unlock; server verification pending) Rewarded-ad unlock flow (mock → real network; server-side verification)
- [~] P2-11 demo subscription only; Stripe/RevenueCat not started Subscription billing: Stripe (web) first; RevenueCat wiring prepared for P4
**Exit:** user can sign in on web and phone and see the same project; shared link opens a viewer for anonymous users; free vs premium gating works end-to-end with mock ads/billing.

## Phase 3 — Exterior richness & lighting (≈ 4–5 weeks)
- [x] P3-01 Garden/landscape items, paths, fences, boundary wall (Garden tool: lawn / paving / driveway / gravel / deck areas and drawn paths; Fence option in the wall tool; outdoor catalog items; plot boundary)
- [x] P3-02 Balcony / porch / stairs — stairs (straight / L / U, walkable; ADR-020) and balcony / porch slabs with automatic railing (glass / metal / wall / none)
- [x] P3-03 Time-of-day sun + shadows; interior lights (sky, sun, moon, lamps that glow and light nearby rooms; ADR-021/023)
- [x] P3-04 Realism pass: photo textures, sky, AO, contact shadows, glossy clear-coat floors, glass, ripple water, lamp bloom at night (planar reflections and baked AO lightmaps deliberately left out for phone speed; ADR-021)
- [x] P3-05 Export PNG + scaled PDF plan + DXF; saved viewpoints; layer visibility panel (FR-905)
- [x] P3-06 Catalog growth: 254 items in 13 categories (incl. Appliances, Kids, Trees & nature, Scenery), about 190 materials, 7 door + 5 window styles, 12 ready-made rooms, 5 environments (target was ≈ 250 items; materials target met)
- [x] P3-07 Owner feedback round 4: automatic roofs per floor + roof designer, sunshades, stairs that build their own room, walk field of view / eye height, spot-light fittings, phone speed (ADR-024)
- [x] P3-08 Stair railings (wood / metal / glass), spiral stairs, roof dormer windows
- [x] P3-09 Trees with real crowns, seasons and sizes; exact stair linking and snapping; night scene (ADR-026)
- [x] P3-10 Roads and pavements (draw on the plan, lanes / markings / crossings / kerbs / pavements / street lights and trees), neighbouring buildings (7 new types) with street fill in 5 styles, street life, weather (clear / cloudy / fog / rain), clouds, horizon (hills / city), ground detail (ADR-027)
- [x] P3-11 Environment editor: scenery per side (hills, mountains, forest, sea, desert, city) with height / colour / snow, sky and air, ground detail, ring of trees, 7 one-tap looks; new homes start as open flat land (ADR-028)
- [x] P3-12 Owner feedback: open stair builds (side beams / centre spine / floating, tread and beam options), exact floor-to-floor linking (headroom opening, floor-level guard, walls and furniture checks), balcony designer (railing, slab, supports, cover), roof terrace railing, leaf-card trees (ADR-029)
- [x] P3-13 One-click staircase through several floors (floors stepper + Stair options card), standalone stairs (no room / walls / roof unless asked), flat roof by default (ADR-031)
- [x] P3-14 Stair exit on the roof: roof room (chilekotha / mumty), glass box, hatch; stair opening cut through flat roofs (ADR-032)
- [x] P3-15 Full glass wall (floor-to-ceiling glazing): pane width, frame, colour, tint, low wall under, cross bar; doors in it keep working (ADR-033)
- [x] P3-16 LED screens (8 kinds, any wall / ceiling / stand / billboard; picture, photo, text ticker, colours, size, height, night light) and outdoor AC units (wall bracket, ground, twin, rooftop, window) (ADR-034)
- [x] P3-17 Ground texture and relief: colour patches, grain and fine bumps in the shader; gentle mounds past everything placed; walker follows them (ADR-035)
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
- [x] P3-18 Doors open / close (inspector + walk mode E key, closed doors block), curtain and blind designer (5 styles, size, hem height, openness, fullness, sheer layer, rod), box windows (frame box / glass bay) and wall features (extra / curved / box / extended wall) (ADR-036)
