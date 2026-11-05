# Engineering Guide

## 1. Setup (target)
- Node 20+ LTS, pnpm 9+, Git. Android Studio / Xcode only for Phase 4.
- `pnpm install` · `pnpm dev` (apps/web) · `pnpm test` · `pnpm lint` · `pnpm typecheck` · `pnpm build`
- Test on phone during dev: `pnpm dev --host`, open LAN URL (HTTPS via local cert if sensors/pointer-lock required).

### Browser smoke test (Playwright + Edge/Chrome, software WebGL)
`pnpm dev` in one terminal, `pnpm e2e` in another (`E2E_URL`, `E2E_CHANNEL=msedge|chrome` to override). It draws a room with the mouse, undo/redo, splits it with a divider, opens menus, walks into walls, and runs the benchmark; screenshots go to `e2e/out/`. In dev builds the app exposes `window.__hd` (`editor`, `useUi`, `walkPose`) for such tests. URL flags: `?demo=1` sample home, `?view=2d|split|3d`, `?walk=1`, `?perf=1` live stats, `?bench=1` auto-run benchmark.

## 2. Code conventions
- TypeScript `strict`, no `any` without comment. ESLint + Prettier + `eslint-plugin-boundaries` to enforce package dependency direction:
  `scene-schema ← geometry ← editor-core ← apps/*` (and `ui`, `assets`). Packages never import from apps.
- `geometry`/`editor-core`: no React, no DOM, no `window`; pure + deterministic (inject RNG/clock).
- File naming: `kebab-case.ts`, React components `PascalCase.tsx`. One exported concept per file where practical.
- Commands are named `VerbNoun` (e.g. `AddWall`) and have a unit test for do/undo.
- No magic numbers: constants in `constants.ts` with units in the name (`WALL_DEFAULT_THICKNESS_M`).
- Comments explain *why*; geometry algorithms get a short derivation note.
- Strings via i18n keys, never literal in components.

## 3. Git workflow
- Trunk-based with short-lived branches: `feat/P1-01-doors`, `fix/...`, `docs/...`.
- Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
- PRs must: pass CI, include tests, update docs if behavior/decision changed, update `progressReport.md`.

## 4. Testing strategy
| Level | Tool | Scope |
|---|---|---|
| Unit | Vitest | geometry, commands, snapping, schema migrations (≥ 80% cov.) |
| Property | fast-check | undo-all invariant, room detection stability |
| Component | Testing Library | panels, inspector |
| E2E | Playwright | critical flows (draw → furnish → persist → share) |
| Visual | Playwright screenshots of fixed scenes (tolerance) | regressions in 2D/3D |
| Perf | scripted heavy scene | frame/geometry-time budgets |
| Device | manual matrix | 1 low Android, 1 mid Android, 1 iPhone, 1 iPad, desktop browsers |

## 5. CI/CD (GitHub Actions)
`install → typecheck → lint → unit → build → e2e (headless) → asset budget check`. Preview deploys per PR. `main` → staging; tagged release → production. Mobile builds via Fastlane on tags.

## 6. Definition of Done (per task)
- [ ] Acceptance criteria from `docs/PHASES.md`/requirements met
- [ ] Unit/E2E tests added and passing; no type or lint errors
- [ ] Works with mouse **and** touch (if UI)
- [ ] Perf sanity check (no regression in baseline scene)
- [ ] Docs updated: `progressReport.md`, `CONTEXT.md` current state, ADR/PHASES/RISKS if relevant
- [ ] No leftover TODOs without a tracked item

## 7. Performance rules of thumb
Avoid per-frame allocations; reuse vectors; dispose geometries/materials/textures on removal; instancing for repeats; `frameloop="demand"` when idle; no React re-render on pointer-move (use refs/store subscriptions); measure before optimizing (r3f-perf, Chrome performance panel, Spector.js).

## 8. Security & privacy
RLS on every table; secrets only in env/CI, never in repo; validate imported JSON/GLB (size caps, Zod); share tokens ≥128-bit; no PII in analytics; privacy policy + data deletion flow before public launch.

## 9. Context-keeping protocol (for humans and AI models)
1. Start every session: read `CONTEXT.md` → latest `progressReport.md` entries → relevant doc.
2. End every task: update `progressReport.md` + `CONTEXT.md` §2 + checkboxes in `docs/PHASES.md`.
3. Decisions go to ADRs the moment they're made; nothing important lives only in chat.
4. When switching models/people mid-task, write a "Partial" entry in `progressReport.md` with exact next step and any uncommitted assumptions.


## First-run flags
`?curtain=1` (force curtain), `?curtain=full` (first-visit version), `?tour=1` (force the tour after the chooser). Links with `view/walk/perf/persist/demo/bench/fresh/welcome` skip the curtain. Dev builds honour `localStorage hd.nocurtain=1` (set by `pnpm e2e`).
