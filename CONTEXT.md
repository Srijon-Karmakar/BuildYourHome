# CONTEXT — Read this first (model/person handoff)

> Purpose: let any model or developer resume work with **zero chat history**.
> Rule: **update this file whenever a decision, status, or "next step" changes.** Keep it under ~150 lines.

_Last updated: 2026-11-05 by Claude Sonnet 5.5_

## 1. One-paragraph summary
HomeDesigner is a cross-platform (web + Capacitor mobile app) tool to design a home's interior and exterior from a 2D plan, auto-generate it in 3D, and explore it via orbit and first-person walkthrough. Stack: React + TypeScript + Three.js/React Three Fiber, Capacitor for mobile, JSON scene graph as source of truth, glTF assets, Supabase (proposed) backend.

## 2. Current state
- **Phase:** Phase 0 (prototype / spike) in progress.
- **Last completed task:** P0-03 — `@hd/editor-core` (Immer-patch undo/redo, transactions, wall/level commands, postProcess invariants; 14 tests incl. property test). Earlier: P0-02 scene-schema; P0-01 hello-cube (owner: smooth on desktop+phone, "not realistic" yet — expected, see P0-10/P1-12).
- **P0-04 also done in code** (2D plan editor: grid, pan/zoom, wall tool, snapping, select/move/delete, undo/redo UI) but **not yet visually verified by anyone** — awaiting owner's desktop + phone test feedback (note any bugs in progressReport).
- **Next task:** P0-05 — `packages/geometry`: mitered wall meshes + 3D view of the drawn plan. See `docs/PHASES.md`.
- **Commands:** `pnpm dev | typecheck | test | lint | build`.
- **Owner profile:** solo developer, no team; region India first (global later); project name is a placeholder.
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
Status: **created so far:** root workspace config, `apps/web`, `packages/scene-schema`, `packages/editor-core`. Everything else is planned.

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
