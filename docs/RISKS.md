# Risk Register

Likelihood (L) / Impact (I): H, M, L. Review at the end of each phase.

| ID | Risk | L | I | Mitigation | Owner/Phase |
|---|---|---|---|---|---|
| R1 | Mobile WebView can't hit 30 fps for realistic houses | M | H | Phase 0 device test first; quality tiers; instancing; merged geometry; texture caps; fallback to native 3D (e.g. Filament) only if proven necessary | P0 |
| R2 | Wall corner/opening geometry bugs (T-junctions, acute angles) | H | M | Pure-function geometry + golden tests; box-splitting approach (ADR-007); fuzz tests | P0–P1 |
| R3 | Roof generation fails on complex footprints | H | M | Straight-skeleton lib + fallback to bounding-rect gable; limit supported shapes in MVP; clear user warning | P1 |
| R4 | Touch UX for precision drawing is poor | M | H | Magnifier loupe, snapping-first design, numeric entry, big handles; usability tests in P0/P1 | P0–P4 |
| R5 | Asset supply: not enough consistent, optimized models | H | M | Start with CC0 packs; strict pipeline; budget for artist; style guide | P1–P3 |
| R6 | Asset licensing violations | M | H | Record license per asset; only CC0/CC-BY/owned; audit before release | all |
| R7 | iOS Safari WebGL memory limits / context loss | M | M | Dispose resources, handle `webglcontextlost`, texture caps, memory warnings | P0, P4 |
| R8 | Scope creep (AI, AR, collab, marketplace) | H | M | Phase gates; Phase 5 is backlog only; ADR for scope changes | all |
| R9 | Undo/redo corruption with derived data | M | M | Derived data never stored; property test: random commands + undo-all == original | P0 |
| R10 | Data loss (sync conflicts, crashes) | M | H | Autosave to IndexedDB ≤ 5 s; version snapshots; conflict dialog; schema migrations tested | P1–P2 |
| R11 | Backend lock-in / cost growth | L | M | Scene is plain JSON; thin API layer; ability to self-host Supabase | P2 |
| R12 | App store rejection (webview wrapper apps) | M | M | Add native value (share, file import, offline); follow guidelines; early TestFlight | P4 |
| R13 | Market/audience unclear → features misprioritized | M | M | Resolve Q1–Q2; early user tests with real homeowners | P0–P1 |
| R15 | Realism vs. smoothness conflict, especially on phones | H | H | ADR-010: progressive rendering, FPS governor, tiers; measure in P0-10/11 before committing visual features | P0–P1 |
| R16 | Ad/billing policy issues (Apple/Google, AdMob), ads hurting UX | M | M | Ads only at natural breaks, never in editor/walkthrough; abstraction layer; policy review in P4 | P2, P4 |
| R17 | Rewarded-unlock fraud (client forgery) | M | M | Server-side verification; short-lived signed asset URLs | P2 |
| R18 | Zero budget → free-tier limits (Supabase pause, storage 1 GB) | M | M | Keep assets small; keep alive pings/doc the pause risk; portable API | all |
| R19 | Unknown team skills/size; bus factor | M | M | Mainstream stack, thorough docs (CONTEXT.md protocol), small PRs | all |
| R20 | One UI serving beginners and engineers becomes cluttered | M | M | ADR-014 progressive disclosure; usability tests with both groups | P1 |
| R14 | Accessibility/i18n deferred too long | L | L | Externalize strings from day 1 | P1 |
