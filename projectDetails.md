# Project Details — PlotFramer

> Name: **PlotFramer**. Status: planning. Last updated: 2026-11-05.

## 1. Vision
A cross-platform (web + mobile app) tool where anyone can **design their home — interior and exterior — and then explore it in 3D** (orbit view and first-person walkthrough).

## 2. Core user journey
`Plot → Floor plan (2D) → Auto-built 3D → Interior (furniture, materials) → Exterior (roof, facade, garden) → Walkthrough → Save / Share / Export`

## 3. Target users (confirmed by owner 2026-11-05)
Everyone from **homeowners and beginners to engineers**. This is a UX requirement: **progressive disclosure** — a simple guided mode by default (templates, wizards, big touch targets) and a **Pro mode** (exact numeric input, dimensions, scaled drawings, layers, DXF/PDF export) that reveals itself without cluttering the beginner experience.

## 3a. Business model (confirmed)
- **Free tier:** full core editor + free asset set, with ads.
- **Subscription (monthly):** ad-free + unlocks premium assets/materials (and later HD export/render).
- **Rewarded ads:** watch an ad to temporarily/permanently unlock selected premium assets.
- Impact: needs an **entitlement system** (what a user can use), an **ad abstraction** (AdMob on mobile, web provider), and **billing** (store IAP via RevenueCat on mobile, Stripe on web). Catalog items carry a `tier` (`free` | `premium` | `rewarded`). See ADR-011.

## 3b. Quality bar (confirmed)
**Realism is a must even for the MVP, and so is a smooth experience.** Resolved as: PBR materials + HDRI lighting + soft shadows + AO + tone mapping at the top tier, with an **adaptive quality governor** that keeps interaction smooth (render-on-demand, lower quality while moving/on weak devices, refine when idle). See ADR-010.

## 4. Scope
### In scope (MVP, see `docs/PHASES.md`)
- 2D wall drawing with snapping and live dimensions; rooms auto-detected from closed wall loops
- Doors and windows placed on walls (real openings in 3D)
- Multiple floors
- Furniture and fixture library (drag / rotate / scale, snap to walls and floor)
- Materials for floors, walls, ceilings (paint, tile, wood...)
- Roof, basic facade, plot boundary, simple garden/fence
- 3D orbit view + first-person walkthrough
- Accounts, save / load, share by link
- Web (desktop + mobile browser) and packaged mobile app (Capacitor)

- **Realistic real-time rendering** (PBR, HDRI, shadows, AO) with adaptive quality
- **Free/Premium catalog tiers**, entitlement checks, subscription + rewarded-ad unlock, ad placements (Phase 2)
- Beginner guided flow + Pro numeric/dimension tools
- Placeholder assets (procedural + a few CC0) until real catalog exists

### Out of scope for MVP (later phases)
Offline cloud path-traced renders, AR plot placement, multi-user real-time collaboration, AI layout generation, cost estimation, marketplace, user-uploaded 3D models, building-code / Vastu checks.

## 5. Chosen approach (decided)
**Option A — Web-first, wrapped for mobile.**
- React + TypeScript, **Three.js via React Three Fiber (R3F)**
- Mobile via **Capacitor** (PWA first, native wrap second)
- Designs stored as a **JSON scene graph** (renderer-independent, versionable); 3D assets as **glTF/GLB**
- Backend: BaaS first (Supabase proposed — see `docs/DECISIONS.md` ADR-004)

Rationale: one codebase, fastest iteration, strong 3D ecosystem. Main risk is mobile GPU performance → mitigated by asset budgets, LOD, and a quality setting (see `docs/RISKS.md`).

## 6. Key design principles
1. **Scene JSON is the single source of truth.** 2D view, 3D view, exports are all projections of it.
2. **2D-first authoring, 3D derived.** Users draw plans; 3D is generated. (3D direct-editing of furniture/materials is allowed.)
3. **Every edit is a command** → undo/redo, autosave, and future collaboration come almost free.
4. **Touch and mouse are equal citizens** from day one.
5. **Performance budget is a feature:** target 30+ fps on a mid-range phone.
6. **Units are stored in metres (SI)**; display units (m / ft-in) are a UI concern.

## 7. Document map
| File | Purpose |
|---|---|
| `CONTEXT.md` | **Read first.** Compact handoff so any model/person can resume without losing context |
| `CLAUDE.md` | Pointer for Claude Code to load `CONTEXT.md` + rules for updating docs |
| `progressReport.md` | Living log of completed work; updated after every task |
| `projectDetails.md` | This file — vision, scope, approach |
| `docs/DESIGN.md` | **UI design language** (owner's minimal "architectural paper" brief + reference image in `docs/design/`) |
| `docs/REQUIREMENTS.md` | Functional + non-functional requirements with IDs |
| `docs/HLD.md` | High-level design: architecture, components, data flow |
| `docs/LLD.md` | Low-level design: modules, algorithms, APIs, state |
| `docs/DATA_MODEL.md` | Scene JSON schema, DB tables, versioning |
| `docs/PHASES.md` | Phase-wise division, milestones, exit criteria |
| `docs/DECISIONS.md` | Architecture Decision Records (ADRs) |
| `docs/ASSET_PIPELINE.md` | How 3D models/textures are sourced, optimized, catalogued |
| `docs/RISKS.md` | Risk register |
| `docs/ENGINEERING.md` | Repo layout, conventions, testing, CI/CD, definition of done |

## 8. Open questions (need owner input)
| # | Question | Current assumption |
|---|---|---|
| Q1 | Target audience? | **ANSWERED:** homeowners, beginners → engineers. Region still unspecified: keep units m + ft and i18n-ready |
| Q2 | Business model? | **ANSWERED:** free + free assets with ads; monthly subscription (ad-free + premium assets); rewarded ads unlock some assets |
| Q3 | Team size and skills? | **ANSWERED:** solo developer, no team → keep scope tight, mainstream stack, heavy automation/docs |
| Q4 | Realism bar? | **ANSWERED:** realism required at MVP, plus smooth UX → PBR + adaptive quality (ADR-010) |
| Q5 | 3D asset source? | **ANSWERED:** placeholder assets for now (procedural/primitive + a few CC0); real assets later |
| Q6 | Timeline / budget? | **ANSWERED:** no budget; demo is free-tier only (Supabase free, static hosting free tier). No fixed deadline |
| Q7 | Backend? | **ANSWERED:** Supabase (ADR-004 accepted) |
| Q8 | Project name and branding? | **Deferred by owner:** **Decided: the app is named PlotFramer** |
| Q9 | Region/market and store targets? | **ANSWERED:** India first, global later (INR pricing, UPI via Stripe/Razorpay later, Vastu in Phase 5 becomes more relevant; ad network must serve India) |
| Q10 | Ad network for web? | Open; abstracted behind `AdProvider` (AdMob for mobile) |
