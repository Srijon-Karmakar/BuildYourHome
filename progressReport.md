# Progress Report — HomeDesigner

> Living log. **Append a new entry after every completed task** (newest at top of the Log section).
> Also keep `CONTEXT.md` "Current state" in sync.

## Entry template
```
### [YYYY-MM-DD] <TASK-ID> — <title>
- **Model/Author:** 
- **Status:** Done | Partial | Blocked
- **What was done:** 
- **Files changed/created:** 
- **Decisions made:** (link ADR if any)
- **Problems / notes:** 
- **Next step:** 
```

## Dashboard
| Phase | Status | Progress |
|---|---|---|
| Phase 0 — Prototype / spike | Not started | 0% |
| Phase 1 — MVP editor | Not started | 0% |
| Phase 2 — Interior depth + accounts | Not started | 0% |
| Phase 3 — Exterior & lighting | Not started | 0% |
| Phase 4 — Mobile app + polish | Not started | 0% |
| Phase 5 — Growth features | Not started | 0% |

Planning/documentation: **Done** (2026-11-05)

## Log

### [2026-11-05] P0-03 — `@hd/editor-core` (store, commands, undo/redo)
- **Model/Author:** Claude Sonnet 5.5
- **Status:** Done
- **What was done:** Framework-free editing engine. `createEditor(scene)` on a Zustand vanilla store; commands apply to an Immer draft and history stores forward/inverse patches (no hand-written inverses). Transactions (`beginTransaction/preview/commit/cancel`) collapse a drag gesture into ONE undo step. `postProcess` restores invariants after every command (drops degenerate walls, orphan nodes, orphan/out-of-range openings, rooms with broken loops, items on missing levels; clamps openings onto shortened walls). Selection is pruned automatically when entities vanish. Commands: `addWall` (reuses coincident nodes so loops close), `moveNode`, `removeWalls`, `setWallProps`, `addLevel`, `batch`. History capped at 200.
- **Verified:** 14 tests incl. a fast-check property test (200 runs): any random command sequence, undo-all == initial scene, redo-all == final scene (mitigates risk R9). Typecheck, lint pass.
- **Files created:** `packages/editor-core/{package.json,tsconfig.json,src/{types,editor,postProcess,index,editor.test}.ts,src/commands/{walls,levels,batch,index}.ts}`
- **Decisions made:** Commands generate ids at construction (deterministic apply). Used Immer 10 + `produceWithPatches`. `execute()` throws inside a transaction (must use `preview`).
- **Problems / notes:** Not yet implemented here (planned): tools state machine & snapping (P0-04), T-junction wall splitting, room detection (P0-06), openings/items commands (P1). `meta.updatedAt` is not touched by commands — persistence layer will stamp it.
- **Next step:** P0-04 — 2D canvas: grid, pan/zoom, wall tool with snapping (first visual, testable by owner).

### [2026-11-05] P0-02 — `@hd/scene-schema` package
- **Model/Author:** Claude Sonnet 5.5
- **Status:** Done
- **What was done:** New package with Zod 4 schema for scene v1 (matches `docs/DATA_MODEL.md`), inferred TS types, default constants (metres), prefixed id generator with injectable RNG, `createEmptyScene()` (one ground level), and `loadScene(raw)` (version check → migration chain → validation, returns `{ok}`/error with field path). Vitest set up; 8 tests pass. Root `pnpm test` script added.
- **Verified:** typecheck, lint, 8/8 tests pass.
- **Files created:** `packages/scene-schema/{package.json,tsconfig.json,src/{schema,constants,ids,defaults,migrate,index,scene.test}.ts}`
- **Decisions made:** Wall interior thickness default 0.115 m (brick+plaster, common in India), exterior 0.23 m — reflects India-first. Room `type` enum fixed list (extendable via migration).
- **Problems / notes:** Migration table is empty (v1 is the first version). Material/asset ids are placeholder strings (`paint-white`, `floor-wood-oak`…) that the catalog must define.
- **Next step:** P0-03 — `packages/editor-core`: store, command bus, undo/redo (Immer patches).

### [2026-11-05] P0-01 result — device test (owner)
- Owner ran the hello-cube on desktop and phone: **both smooth**. Owner feedback: **not realistic** (expected — only basic lighting on a cube). Realism is handled by P0-10/P1-12 and is best judged on a real house with PBR textures, shadows, AO. Smoothness baseline is OK.

### [2026-11-05] P0-01 — Monorepo scaffold + hello-cube
- **Model/Author:** Claude Sonnet 5.5
- **Status:** Done (not yet eyeballed in a browser by a human — see notes)
- **What was done:** `git init` (branch `main`); pnpm workspace; shared `tsconfig.base.json` (strict); ESLint 9 flat config + Prettier + editorconfig; `apps/web` = Vite 7 + React 19 + R3F 9 + drei 10 + three 0.180 with a lit cube, ground plane, HDRI environment, orbit controls, `frameloop="demand"`.
- **Verified:** `pnpm install`, `pnpm typecheck`, `pnpm build`, `pnpm lint` all pass; dev server returns HTTP 200 and serves the app on LAN (`pnpm dev` → http://<pc-ip>:5173).
- **Files created:** root `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc.json`, `.editorconfig`, `.gitignore`; `apps/web/{package.json,tsconfig.json,vite.config.ts,index.html,src/main.tsx,src/App.tsx}`
- **Decisions made:** Owner: project name stays placeholder "HomeDesigner"; region = India first, global later; owner is a **solo developer** (no team). Package scope `@hd/*`.
- **Problems / notes:** (1) pnpm skipped esbuild's postinstall script — build still works; run `pnpm approve-builds` only if Vite complains. (2) Bundle is 1.18 MB (333 KB gzip), expected for three.js; code-split later. (3) Drei's `Environment preset` fetches the HDRI from a CDN at runtime — needs internet; self-host HDRI before offline/PWA work. (4) CI, tests (Vitest), and the `packages/*` skeletons are not created yet; they come with the tasks that need them. (5) Visual check in a browser/phone not performed by me.
- **Next step:** P0-02 — `packages/scene-schema` (types + Zod + defaults). Owner action: run `pnpm dev`, open http://localhost:5173 and on a phone via the LAN URL to confirm the cube renders and orbit works.


### [2026-11-05] DOC-02 — Docs updated with owner's answers
- **Model/Author:** Claude Sonnet 5.5
- **Status:** Done
- **What was done:** Applied owner answers: wider audience (beginner→engineer), freemium+ads+subscription+rewarded unlocks, realism required at MVP with smooth UX, placeholder assets, zero budget, Supabase confirmed.
- **Files changed:** `projectDetails.md`, `CONTEXT.md`, `docs/DECISIONS.md` (ADR-004 accepted; added ADR-010–014), `docs/REQUIREMENTS.md` (FR-8xx, FR-9xx, NFR-13–17), `docs/PHASES.md` (realism & adaptive quality moved into P0/P1; entitlements/ads/billing in P2; real ads/IAP in P4), `docs/DATA_MODEL.md` (tier, subscriptions, unlocks, entitlement rule), `docs/ASSET_PIPELINE.md` (placeholder phase), `docs/RISKS.md` (R15–R20)
- **Decisions made:** ADR-010 to ADR-014.
- **Problems / notes:** Realism-vs-smoothness is the top technical risk (R15) → validated in Phase 0 tasks P0-10/P0-11. Team skills still unknown. Name, region, web ad network open.
- **Next step:** P0-01 — scaffold pnpm monorepo + Vite/R3F hello-cube.

### [2026-11-05] DOC-01 — Planning documents generated
- **Model/Author:** Claude Sonnet 5.5
- **Status:** Done
- **What was done:** Brainstormed approach; owner chose Option A (web-first React + R3F + Capacitor). Generated project documentation set: project details, context handoff, requirements, HLD, LLD, data model, phases, ADRs, asset pipeline, risks, engineering guide.
- **Files created:** `projectDetails.md`, `CONTEXT.md`, `CLAUDE.md`, `progressReport.md`, `docs/REQUIREMENTS.md`, `docs/HLD.md`, `docs/LLD.md`, `docs/DATA_MODEL.md`, `docs/PHASES.md`, `docs/DECISIONS.md`, `docs/ASSET_PIPELINE.md`, `docs/RISKS.md`, `docs/ENGINEERING.md`
- **Decisions made:** ADR-001 to ADR-006 (ADR-004 Supabase is *proposed*).
- **Problems / notes:** Audience, market, business model, timeline unknown — working assumptions recorded in `projectDetails.md` §8. No code written yet.
- **Next step:** P0-01 — scaffold pnpm monorepo + Vite/R3F hello-cube.
