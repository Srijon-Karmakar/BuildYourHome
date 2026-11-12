# CONTEXT — Read this first (model/person handoff)

> Purpose: let any model or developer resume work with **zero chat history**.
> Rule: **update this file whenever a decision, status, or "next step" changes.** Keep it under ~150 lines.

_Last updated: 2026-11-05 (end of session) by Claude Sonnet 5.5_

## 1. One-paragraph summary
PlotFramer is a cross-platform (web + Capacitor mobile app) tool to design a home's interior and exterior from a 2D plan, auto-generate it in 3D, and explore it via orbit and first-person walkthrough. Stack: React + TypeScript + Three.js/React Three Fiber, Capacitor for mobile, JSON scene graph as source of truth, glTF assets, Supabase (proposed) backend.

## 2. Current state
- **>>> RESUME HERE (updated 2026-11-06) <<<**
  - **Phase:** Phase 0, 1 and 2 are built; **Phase 3 is in progress** (P3-01 garden, P3-02 stairs + balcony, P3-05 export, P3-03 lamps / night, P3-03 sun/sky and P3-04 realism first slice are done). Phase 4 (mobile / Capacitor / real ads + billing) not started.
  - **UI-01 (2026-11-06):** splash + BYHOME logo + credits (v1.1.1), Render static-site deploy settings, responsive phone/tablet layout (Menu sheet, scrolling bottom tool bar, landscape rail). See progressReport UI-01. Owner to check on a real phone.
  - **Tests at last run:** 455/455 browser checks (`pnpm e2e`, needs `pnpm dev` running on :5173), offline 12/12, unit tests geometry 104 / editor-core 196 / web 157 / assets 10 / schema 8; typecheck, lint, build clean. Coverage `pnpm coverage` (packages 91-98 %).
  - **P3-10 (2026-11-07):** roads (`Zone.shape 'road'` + `RoadStyle`, Road tool, RoadPanel), 7 new neighbour buildings + street life, `fillStreet` / `clearStreet` (items tagged `street:<roadId>`), weather + horizon in `scene.lighting`, `Atmosphere` / `GroundDetail`. See ADR-027.
  - **Splash background (2026-11-12):** glowing red/orange threads behind the curtain (`ui/WebThreads.tsx`); settings in `Curtain.tsx`. Splash has a light/dark switch (dark by default; top-right, remembered in `localStorage hd.splashTheme`; splash only, the app has no dark theme). The earlier dot waves (`ui/PatternWaves.tsx`, `ogl`) are kept unused so the owner can switch back. See progressReport.
  - **Save button (2026-11-12):** one-tap Save in the top bar (desktop pill; icon next to Home on phones) + Ctrl/Cmd+S: saves on the device now, also to the account when signed in; `?demo`/`?fresh` links download the file. `ui/SaveButton.tsx`. See progressReport.
  - **P3-12 (2026-11-12):** open stair builds, headroom stair openings + guard rails, balcony designer, roof terrace railing, leaf-card trees (ADR-029). See progressReport P3-12.
  - **P3-13 (2026-11-12):** Stairs tool builds through N floors in one click (stepper + Stair options card), Room above off by default (standalone stairs: no walls/roof), new roofs are flat concrete by default (ADR-031).
  - **P3-14 (2026-11-12):** stair exit over the top flight (`Stair.exit`: roof room / glass box / hatch), flat roofs get the stair opening, guard stands on flat-roof terraces (ADR-032). Facade UI for ADR-030 is still being built in a parallel session.
  - **P3-15 (2026-11-12):** full glass wall (`Wall.glazed`, wall panel > Full glass wall), ADR-033.
  - **Next task to do:** Phases 0-3 and the Phase 2 leftovers (P2-05 ready-made homes, P2-06 offline app) are **done**. Next is **Phase 4**: Capacitor iOS / Android shells, native share / files, touch polish, real AdMob + RevenueCat, store listings (needs the owner's developer accounts); P2-07 error tracking / analytics is the only open Phase 2 item. Still waiting on the owner: phone benchmark, Supabase migrations + redeem code + live test, Google sign-in client, privacy / terms pages.
  - **WAITING ON OWNER (do not block on these):** (1) run **Display > Run benchmark on the phone at Medium** and paste the report (photo textures + sky are untested on hardware; fallback plan in ADR-021); also Phase 1 benchmark with the furnished sample. (2) Supabase: run `0002_delete_account.sql` and `0003_redeem_codes.sql`, create a redeem code (template at the bottom of 0003), set Auth Site/Redirect URLs, one live sign-up/save/share test with a real email. (3) Google sign-in needs the owner's OAuth client; privacy/terms pages before public launch.
  - **How the owner works:** non-technical product owner, answers short option questions, wants clean minimal UI, asks "what's next" often; ask with options before big or ambiguous work; always update progressReport.md / CONTEXT.md / docs/PHASES.md after each task (CLAUDE.md rule). Reply in plain short language.
- **Tooling gotchas (Windows):** long heredocs with quotes break in Git Bash: write files with the Write tool and run python patch scripts from the scratchpad; the Vite watcher sometimes serves a stale module, restart `pnpm dev`; never `taskkill` all node processes. The splash is always shown (button needed) except in test links; owner rebranded the wordmark to BYHOME (`ui/BrandLogo.tsx`). Test links skip the curtain / tour; the e2e harness sets `localStorage hd.nocurtain=1` and `hd.backend=local` (dev builds only).
- **Feature map (where things live):** plan tools in `apps/web/src/plan/PlanController.ts` (+ `session.ts`, `render.ts`); 3D in `apps/web/src/view3d/` (Scene3D, *Mesh, materials, photoTextures, sun, pick); walker in `walk/`; ready-made rooms + surroundings in `packages/editor-core/src/presets/`; editor commands in `packages/editor-core/src/commands/` (walls, openings, items, levels, roof, plot, stairs, balconies, zones, scene); export code in `apps/web/src/export/`; pure geometry in `packages/geometry/src/` (wall, room, roof, stairs, balcony, zone, collision); catalog in `packages/assets`; accounts/cloud in `apps/web/src/cloud/` + `services/supabase/migrations/`. Tools/keys: V select, W wall, D door, N window, S stairs, B balcony, G garden, F fit, R rotate, Esc cancel.
- **Done:** P0-04 2D plan editor, P0-05 mitered walls + live 3D + 2D/Split/3D switcher (owner tested: ok), P0-06 room detection + floors (rooms auto-follow wall loops, keep names; 2D labels with m²; 3D floors). 66 unit tests pass. P0-06 visuals awaiting owner test.
- **P0-06b done:** `addWall` auto-splits at T/X junctions and existing nodes; new `wall` snap kind (ray∩wall, wall body). 76 unit tests pass, incl. a no-unjoined-crossings property test. Awaiting owner test.
- **Known gaps:** dragging a corner onto another wall doesn't join/split. (Split halves now re-merge when the junction wall is deleted.)
- **P0-07 done in code:** first-person walkthrough (WASD/Shift + drag-look on desktop; floating touch stick + drag-look on phone), sliding wall collision (`geometry/collision`), "you are here" marker on the plan. 86 unit tests pass. **Needs owner device test** (feel, speed, touch comfort).
- **P0-08 done: design-language pass.** Owner wants a CLEAN, MINIMAL, MOST USER-FRIENDLY UI like the reference in `docs/design/reference-brand-guidelines.png`. **Read `docs/DESIGN.md` before touching any UI** (tokens, Outfit font, floating chrome, one brick accent, text labels, contextual actions, phone bottom rail). ADR-016.
- **Test flags:** `?welcome=1` forces the welcome screen; `?fresh=1` ignores/never writes saved data.
- **Keys:** V select · W wall · D door · N window · S stairs · S stairs · F fit · Esc cancel · Del delete · Ctrl+Z/Y undo/redo · Ctrl+A select all walls · Shift+click add to selection.
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
- **Supabase is configured** (owner's `.env.local` present; tables + RLS + share function verified by a read-only probe). **WAITING ON OWNER:** (a) one live run: sign up with a real email → confirm link → sign in → Save → Create link → open in a private window (or disable "Confirm email" in Supabase Auth for testing) and report; (b) the Phase 1 benchmark reports on desktop + phone (Home › New home › Furnished sample › Display › Run benchmark).
- **Account features done:** forgot/change password, delete account, cross-device sync conflict dialog (demo backend verified; owner must run `0002_delete_account.sql` + set Site/Redirect URL in Supabase). 258 unit tests + 187 browser checks pass.
- **P1-07 + redeem codes done; PHASE 1 code complete.** Plot & site in the Home menu (plot around house / draw by hand, wall/fence boundary as `kind: 'boundary'` walls that never make rooms), ground limited to the plot in 3D. **Redeem codes:** Account › Redeem a code unlocks everything + no ads for that account (`Entitlements.gifted`); server in `0003_redeem_codes.sql` (**owner must run it and create a code**); demo code `HOME-DEMO`. `pnpm coverage` (all packages ≥ 93%). 271 unit tests + 205 browser checks pass.
- **P3-02 part 1 done: stairs** (straight / L / U; Stairs tool key `S`; stairwell opening in floor + ceiling; walker climbs and switches floor; ADR-020). Balcony / porch still open. 284 unit tests + 223 browser checks pass.
- **Owner feedback round done:** click-to-select + drag furniture in 3D (selection outline, Select works in the 3D view), edit card in its own column so it never covers the views, catalog 34 → 102 items (new Outdoor & garden category, India-specific pooja unit / jhula / tulsi / water tank), 7 door + 5 window styles, 46 more materials. 297 unit tests + 247 browser checks pass.
- **Curtain + quick tour done:** first visit = animated curtain with "Start designing" → chooser → 7-step coach-mark tour; returning = brief loader. Flags `?curtain=1|full`, `?tour=1`; test links skip them. 262 browser checks pass.
- **Balcony + realism pass done (ADR-021):** Balcony tool (B), railings automatic on open edges; CC0 photo textures on Medium/High (lazy, none on Low), sky + Time of day (Display), contact shadows, light AO on desktop Medium, rounded furniture. **WAITING ON OWNER: phone benchmark at Medium.** 285 browser checks pass.
- **Next tasks:** live Supabase smoke test with a real email, Google sign-in (needs owner's Google OAuth client), privacy/terms pages, Phase 3 (garden, stairs/balcony, sun lighting, PNG/PDF export). See `docs/PHASES.md`.
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
