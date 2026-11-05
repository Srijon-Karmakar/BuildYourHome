# CONTEXT — Read this first (model/person handoff)

> Purpose: let any model or developer resume work with **zero chat history**.
> Rule: **update this file whenever a decision, status, or "next step" changes.** Keep it under ~150 lines.

_Last updated: 2026-11-05 by Claude Sonnet 5.5_

## 1. One-paragraph summary
HomeDesigner is a cross-platform (web + Capacitor mobile app) tool to design a home's interior and exterior from a 2D plan, auto-generate it in 3D, and explore it via orbit and first-person walkthrough. Stack: React + TypeScript + Three.js/React Three Fiber, Capacitor for mobile, JSON scene graph as source of truth, glTF assets, Supabase (proposed) backend.

## 2. Current state
- **Phase:** Phase 1 (MVP editor) — starting. Phase 0 done.
- **Last completed task:** P0-03 — `@hd/editor-core` (Immer-patch undo/redo, transactions, wall/level commands, postProcess invariants; 14 tests incl. property test). Earlier: P0-02 scene-schema; P0-01 hello-cube (owner: smooth on desktop+phone, "not realistic" yet — expected, see P0-10/P1-12).
- **Done:** P0-04 2D plan editor, P0-05 mitered walls + live 3D + 2D/Split/3D switcher (owner tested: ok), P0-06 room detection + floors (rooms auto-follow wall loops, keep names; 2D labels with m²; 3D floors). 66 unit tests pass. P0-06 visuals awaiting owner test.
- **P0-06b done:** `addWall` auto-splits at T/X junctions and existing nodes; new `wall` snap kind (ray∩wall, wall body). 76 unit tests pass, incl. a no-unjoined-crossings property test. Awaiting owner test.
- **Known gaps:** dragging a corner onto another wall doesn't join/split. (Split halves now re-merge when the junction wall is deleted.)
- **P0-07 done in code:** first-person walkthrough (WASD/Shift + drag-look on desktop; floating touch stick + drag-look on phone), sliding wall collision (`geometry/collision`), "you are here" marker on the plan. 86 unit tests pass. **Needs owner device test** (feel, speed, touch comfort).
- **P0-08 done: design-language pass.** Owner wants a CLEAN, MINIMAL, MOST USER-FRIENDLY UI like the reference in `docs/design/reference-brand-guidelines.png`. **Read `docs/DESIGN.md` before touching any UI** (tokens, Outfit font, floating chrome, one brick accent, text labels, contextual actions, phone bottom rail). ADR-016.
- **Test flags:** `?welcome=1` forces the welcome screen; `?fresh=1` ignores/never writes saved data.
- **Keys:** V select · W wall · D door · N window · F fit · Esc cancel · Del delete · Ctrl+Z/Y undo/redo · Ctrl+A select all walls · Shift+click add to selection.
- **Tip:** open `http://localhost:5173/?demo=1` for a ready sample home (more flags in docs/ENGINEERING.md). Headless Edge screenshots work for visual checks: `msedge --headless=new --enable-unsafe-swiftshader --use-angle=swiftshader --window-size=1440,900 --virtual-time-budget=15000 --screenshot=out.png URL` (the Chrome extension is usually not connected).
- **P0-09/10/11 done in code (ADR-017):** quality tiers (low/medium/high/auto), procedural lighting + textures, AO on high, progressive rendering, auto governor, **Display menu with stats + one-tap benchmark** (`?bench=1`), Playwright smoke test (`pnpm e2e`, 15 checks), 94 unit tests.
- **PHASE 0 COMPLETE — verdict GO (P0-12).** Owner's benchmark: desktop RTX 4060 = 100 fps (display cap) at all tiers; mid-range phone (Mali-G68, Android) = locked 60 fps at medium/low, but high stutters (p99 125 ms). Auto defaults touch devices to medium. Caveat: test scene is tiny — re-benchmark with furniture (P1-06).
- **P1-01 done: doors & windows** (real holes via box-splitting ADR-007, reveals, door leaves/frames/glass in 3D, plan symbols, Door/Window tools with ghost + nearest-free-spot placement, drag to slide, Swing/Hinge/Narrower/Wider/Delete, walkable doorways). 128 unit tests + 25 browser checks pass.
- **P1-02 done: property inspector** (room/wall/opening panels, typed lengths like `350cm` / `12'6"`, multi-select via Shift or "Add more", Ctrl+A, material swatches, merge-on-delete). 144 unit tests + 43 browser checks pass.
- **P1-02b customisation done** (per-side wall paint, brick/stone/slat/tile finishes, ceiling paint, 12 floors, door/window styles + colours, Home menu: name/ground/default wall thickness, Inside/Outside new walls) and **P1-03 multiple floors done** (floor switcher, add/copy/rename/height/delete, plan ghost of the floor below, Cutaway, floors-shown filter). 170 unit tests + 69 browser checks pass.
- **P1-05 + P1-06 done: furniture** — `@hd/assets` catalog (34 placeholder items, tiers, palettes), procedural 3D models + rendered thumbnails, catalog panel with search/categories, placement tool with ghost + wall snapping (items sit back-to-wall; art/mirrors hang on walls; lights on the ceiling), drag/rotate/nudge/duplicate/delete, inspector (colour, rotation, size, lock), furniture blocks the walker. 201 unit tests + 91 browser checks pass.
- **P1-09 done: persistence** — autosave to IndexedDB (restored on start), Saved indicator, Home › File: Save to file / Open file / New home. `?demo`/`?bench`/`?fresh` don't touch saved data. 211 unit tests + 102 browser checks pass.
- **P1-08 done: roofs** (gable/hip/flat/shed over the oriented bounding rectangle, slope/overhang/material/ridge turn in the top floor's menu, Hide roof toggle, roof rides on the top floor). L-shaped houses get a bounding-rectangle roof (known limitation). 224 unit tests + 117 browser checks pass.
- **P1-10 guided start done:** welcome screen (single room by size / studio / family home / furnished sample / blank / open file), template builders, "Next:" tip card (derived from home contents), Help sheet (`?`). 235 unit tests + 136 browser checks pass.
- **WAITING ON OWNER (Phase 1 exit check):** open the app on desktop and phone, load *Furnished sample* from Home › New home, run Display › Run benchmark and paste the reports (scene is now furnished + roofed; first real stress test of ADR-001). Also try the flows and tell me what feels confusing.
- **P1-15 done: Pro tools** — Home › Units (metres / feet & inches, applied everywhere), exact wall length by typing while drawing (`3.5`, `350cm`, `10'6"` + Enter), Home › Pro tools (overall dimensions, room W×D, all wall lengths). 4 more unit tests + 151 browser checks pass.
- **PHASE 2 built (demo backend verified; Supabase untested):** `Backend` interface with `LocalBackend` (default, browser-only) and `SupabaseBackend` (activates with `.env.local` keys); SQL + RLS in `services/supabase/`; Account menu (sign in/up, save, My homes, share link), read-only `?share=` viewer, entitlements (catalog badges, upsell, demo rewarded ad = 24 h unlock, demo subscription, demo banner ads only on calm screens). 249 unit tests + 170 browser checks pass. See ADR-019 and `docs/SUPABASE_SETUP.md`.
- **WAITING ON OWNER:** (a) create a free Supabase project + `.env.local` per `docs/SUPABASE_SETUP.md` so I can verify the live path; (b) the Phase 1 benchmark reports on desktop + phone (Home › New home › Furnished sample › Display › Run benchmark).
- **Next tasks:** live Supabase smoke test, password reset + Google sign-in + account deletion (launch blockers), P1-07 plot/ground, Phase 3 (garden, stairs/balcony, sun lighting, PNG/PDF export). See `docs/PHASES.md`.
- **Dev tip:** if the running app disagrees with the file on disk (stale module), restart `pnpm dev` (Windows watcher can miss rapid double writes).
- **Commands:** `pnpm dev | typecheck | test | lint | build`.
- **Owner profile:** solo developer, no team; region India first (global later); project name is a placeholder.
- **Item convention:** `item.position = [x, y, z]`, y measured from the floor of its level; front = +z (see `@hd/assets` footprint helpers).
- **Run it:** `pnpm install` then `pnpm dev` (http://localhost:5173, also on LAN for phone testing).
- **Owner answers received (2026-11-05):** audience = homeowners→engineers; model = free+ads, monthly subscription (ad-free + premium assets), rewarded-ad unlocks; realism REQUIRED at MVP *and* smooth UX; placeholder assets for now; zero budget, free tiers; Supabase confirmed; team skills unknown.
- **Blockers / awaiting owner:** none for Phase 0. Still open: project name (Q8), region/stores (Q9), web ad network (Q10).

## 3. Decisions made (full detail in docs/DECISIONS.md)
- ADR-001 Web-first (React+TS+R3F), Capacitor for mobile. **Decided by owner.**
- ADR-002 Scene JSON is single source of truth; edits are commands (undo/redo).
- ADR-003 2D-plan-driven authoring; 3D derived.
- ADR-004 Supabase BaaS (**accepted**).
- ADR-005 pnpm monorepo; Zustand + Immer patches for state; Zod for schema.
- ADR-006 Units stored in metres; Y-up; plan lives on XZ plane.
- ADR-010 Realism + smoothness via adaptive quality (PBR/HDRI/shadows/AO; progressive rendering; FPS governor).
- ADR-011 Monetization: catalog `tier` (free/premium/rewarded), server-side entitlements, RevenueCat (mobile) + Stripe (web), AdMob/`AdProvider`; mock providers in demo.
- ADR-012 Zero-budget free-tier infra. ADR-013 Placeholder assets. ADR-014 Simple/Pro modes.

## 4. Repo map (planned — create as phases progress)
```
homeDesigner/
  CONTEXT.md  CLAUDE.md  projectDetails.md  progressReport.md
  docs/                      # all design documents
  apps/web/                  # Vite + React + R3F app (also the Capacitor web layer)
  apps/mobile/               # Capacitor shell (ios/android)
  packages/scene-schema/     # Zod schema, types, migrations
  packages/geometry/         # pure functions: walls, rooms, roofs, CSG helpers
  packages/editor-core/      # commands, history, selection, snapping (no React)
  packages/ui/               # shared UI components
  packages/assets/           # catalog JSON + asset build scripts
  services/                  # Supabase migrations / edge functions
```
Status: **created so far:** root workspace config, `apps/web`, `packages/scene-schema`, `packages/editor-core`, `packages/geometry`. Everything else is planned.

## 5. Conventions that must not be forgotten
- Coordinates: metres, Y-up, plan on X/Z. Angles in radians internally.
- Never mutate scene state directly; dispatch a **Command** via editor-core.
- `geometry` and `editor-core` must stay **React-free and DOM-free** (unit-testable in Node).
- Every GLB must pass the asset budget in `docs/ASSET_PIPELINE.md`.
- IDs are ULID/nanoid strings; no array-index references.
- Scene JSON has `schemaVersion`; any schema change ships with a migration.
- Never hard-block opening a scene because of locked assets; gate edit/export only (entitlements).
- Ads/billing only via `AdProvider` / `BillingProvider` interfaces; never show ads in editor or walkthrough.
- All rendering features must respect the quality tier + progressive rendering rules.
- UI must follow `docs/DESIGN.md`: minimal, light "paper" theme, one accent (brick), text labels on tools, contextual actions only when relevant, touch targets ≥ 44 px, works on mouse + touch + keyboard. New colours/sizes go in CSS tokens first.

## 6. How to update docs after each task (mandatory)
1. Append an entry to `progressReport.md` (template at top of that file).
2. Update "Current state" (section 2) here.
3. If a decision changed → add/modify an ADR in `docs/DECISIONS.md`.
4. If scope/phase status changed → update `docs/PHASES.md` checkboxes.
5. If a new risk appeared → `docs/RISKS.md`.

## 7. Glossary
- **Scene**: the full design document (JSON).
- **Level**: one floor of the building.
- **Wall**: a segment between two nodes with thickness/height; has openings.
- **Opening**: door/window cut in a wall.
- **Room**: closed loop of walls, auto-detected; owns floor/ceiling materials.
- **Item**: placed furniture/fixture referencing a catalog asset.
- **Command**: reversible edit operation.
- **Catalog**: list of available assets/materials with metadata.
