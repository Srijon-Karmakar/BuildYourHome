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

### [2026-11-05] P1-01 — Doors & windows (real openings)
- **Model/Author:** Claude Sonnet 5.5
- **Status:** Done; verified in a real browser (Playwright/Edge) incl. screenshots of plan, 3D and walkthrough.
- **What was done:**
  - **Geometry (ADR-007 implemented):** `buildWallMesh` now cuts rectangular holes by splitting each wall face into boxes around them (full-height strips + below-sill and above-lintel pieces, no CSG) and lines every hole with **reveals** (jambs, head, sill). `wallPlanPieces` gives the solid parts of a wall in plan with gaps. `computeFootprints` now also returns each wall's frame (origin, direction, length, thickness). `validCuts` drops openings that don't fit and always leaves a lintel. Tests prove the wall-face area drops by exactly the opening's area, reveals have the right area and face INTO the hole, winding is outward, mitered/elevated walls work.
  - **Collision:** `buildColliders` leaves a **gap for doors and arches** (windows stay solid). A 0.9 m door lets the 0.5 m-wide walker through; a 0.6 m gap does not.
  - **Editing rules (editor-core):** `addOpening`, `moveOpening` (also onto another wall), `setOpeningProps` (width/height/sill, swing & hinge flips), `removeOpenings`. Openings snap to the **nearest free spot** (≥ 0.15 m from wall ends — miter-safe — and ≥ 5 cm from neighbours), never overlap, keep a lintel; resizing may nudge but never hop over a neighbour. `postProcess` re-validates openings after any wall edit (push along / drop when a wall becomes too short); T-junction splits re-parent openings. Helpers: `nearestWallPoint`, `freeOffset`, `defaultSize`.
  - **UI:** new **Door** (D) and **Window** (N) tools: a ghost follows the pointer along the nearest wall, snapped to a free spot; doors swing toward the pointer side; release places (touch-friendly). Select tool: tap an opening to select, **drag to slide it along (or onto another) wall** (one undo step); contextual pills **Swing / Hinge / Narrower / Wider / Delete**. Plan symbols: door leaf + swing arc, window glazing, arch ticks; walls now drawn as mitered pieces with real gaps (replacing stroked lines); wall-length labels sit on the longest solid stretch.
  - **3D:** door frame + hinged leaf (open ~80° toward its swing side), window frame + mullion + transparent glass + projecting sill board; **walkthrough passes through doorways**. Sample home (`?demo=1`) now has a front door, 2 interior doors and 5 windows.
- **Verified:** typecheck, lint, build; **128 unit tests** (8 schema + 47 geometry + 65 editor-core + 8 web) incl. a **property test: after any random mix of wall/opening/node edits no opening overlaps, leaves its wall or loses its lintel, and undo-all/redo-all round-trips (120 runs)**; **25/25 browser checks** (new: Door tool places a door, a second never overlaps, tap selects, Swing flips, Delete removes, walker passes through the doorway at z = 1.75 and is blocked by the wall beside it).
- **Files:** `geometry/src/wall/{openings,mesh,footprint}.ts`, `collision/collision.ts`, `wall/openings.test.ts`; `editor-core/src/{openings.ts,openings.test.ts,commands/openings.ts,postProcess.ts}`; web `plan/{wallGeom,render,PlanController,demo,session}.ts`, `view3d/{OpeningMesh,WallMesh,Scene3D}.tsx`, `ui/{ToolRail,BottomBar,icons}.tsx`, `walk/WalkControls.tsx`, `styles.css`; `e2e/smoke.mjs`.
- **Decisions:** opening end margin 0.15 m (covers miter shift at 0.23 m walls on 90° corners); doors/arches are walkable, windows solid; the door leaf is rendered open (shows door presence; collision ignores the leaf).
- **Known gaps / notes:** no numeric width/height/sill fields yet (P1-02 inspector); arches are plain rectangular openings (no curved head yet); door leaf doesn't animate; no windows-let-sun-in lighting; opening default sizes are metric constants (unit display comes with P1-15); on phones the wall-length labels can crowd small rooms (a "dimensions" toggle belongs to Pro mode).
- **Next step:** P1-02 — property inspector (rename room, change floor material, wall thickness/height, exact opening sizes), multi-select, split/merge walls.

### [2026-11-05] P0-12 — Phase 0 verdict: GO (owner's device benchmark)
- **Model/Author:** Claude Sonnet 5.5
- **Status:** Done. **Phase 0 exit criteria met → ADR-001 (web-first React + R3F + Capacitor) confirmed.**
- **Data (owner, sample/current plan, orbit benchmark, 6 s per tier):**

| Device | Tier | fps | avg ms | p95 ms | p99 ms | worst ms | draw calls |
|---|---|---|---|---|---|---|---|
| Desktop — RTX 4060, 20 cores, 1920×1080 @1x, Chrome 156 | high | 100 | 10.0 | 10.1 | 10.2 | 10.9 | 73 |
| | medium | 100 | 10.0 | 10.1 | 10.2 | 10.3 | 64 |
| | low | 100 | 10.0 | 10.2 | 10.2 | 11.2 | 34 |
| Phone — Mali-G68 MC4 (mid-range Android 10), 8 cores, 384×832 @2.81x | high | 48 | 20.8 | **66.8** | **124.6** | 128.8 | 65 |
| | medium | 60 | 16.7 | 17.4 | 17.9 | 18.2 | 64 |
| | low | 60 | 16.7 | 17.6 | 18.4 | 19.7 | 34 |

- **Reading:** Desktop is capped by the display (100 Hz) at every tier — lots of headroom. On the mid-range phone **medium and low hold a locked 60 fps with tight frame times** (p99 ≈ 18 ms), well above the 30 fps target. **High averages 48 fps but stutters (p95 67 ms, p99 125 ms)** — the post-processing AO + MSAA at 2.8× pixel ratio is too heavy there. That is exactly what the tiers/Auto governor exist for: Auto's first guess for touch devices is **medium**, which is the right tier for this phone.
- **Decisions / follow-ups:**
  - Keep Auto → medium on touch devices (already so). Do NOT default phones to high. Label High as "Most realistic (needs a powerful device)".
  - Phone high-tier cost is dominated by the composer at high DPR: when we revisit (P3-04) try half-res AO, cap composer DPR at 1.5 on touch, or bake AO.
  - **Caveat:** the test scene is tiny (~130 triangles, ~65 draw calls). Real homes (furniture, plants, windows) will be 50–100× heavier. **Re-run the benchmark with a stress scene once the furniture catalog exists (P1-06)** and enforce the asset budgets in docs/ASSET_PIPELINE.md.
  - Phone report said `memory ?` (Chrome doesn't expose deviceMemory over http on LAN) — governor relies on measured fps, not on that value.
- **Next step:** Start Phase 1 — P1-01 doors & windows (real openings in walls + collision gaps).

### [2026-11-05] P0-09 + P0-10 + P0-11 — Performance baseline tooling, realism pass, progressive rendering
- **Model/Author:** Claude Sonnet 5.5
- **Status:** Done in code and **verified in a real browser (Edge via Playwright, software WebGL)**. **Owner still needs to run the benchmark on their desktop and phone** — those numbers are the Phase 0 go/no-go data (software-renderer numbers here only prove the plumbing).
- **What was done:**
  - **Realism (P0-10):** procedural softbox environment lighting (no HDRI download), ACES tone mapping, soft shadows, **N8AO ambient occlusion + MSAA on the high tier**, plank-textured oak floors (canvas-generated, seeded, tileable), plaster normal map on walls, **ceilings while walking**. Everything offline and asset-free (ADR-013/017).
  - **Progressive rendering + governor (P0-11):** `AdaptiveDpr` + R3F performance regress while orbiting (restores ~180 ms after you stop); `PerfProbe` auto-steps the tier down when interaction drops below ~38 fps; initial tier guessed from the device. Walk frame-time cap raised to 100 ms (slow devices no longer walk in slow motion; collision is sub-stepped so it's safe).
  - **Baseline tooling (P0-09):** **Display** menu (Quality: Auto/Low/Medium/High; Show stats; **Run benchmark**); live stats panel (tier, fps, ms, p95, draw calls, triangles, pixel ratio, GPU name); one-tap **benchmark** (fixed orbit, high→medium→low, 6 s each) with a **Copy report** text block; `?bench=1` runs it straight from a link; `?perf=1` shows stats.
  - **Testing infrastructure:** Playwright browser smoke test (`pnpm e2e`, 15 checks) + `window.__hd` dev handle + URL flags; unit tests for tier/governor/statistics logic (8). Added a favicon (was a console 404).
- **Verified:** typecheck, lint, build; **94 unit tests** (8 schema + 33 geometry + 45 editor-core + 8 web); **15/15 browser checks** (draw/closed room/undo/redo/divider split/snap menu/walk/collision distance exact (0.36 m = 0.115 half wall + 0.25 radius)/Esc/benchmark completes with 3 rows/no console errors). Software-GL benchmark showed tiers scale as intended (high 2 fps → medium 12 → low 14 on the CPU renderer).
- **Files:** `apps/web/src/view3d/{qualityLogic,perfStats,qualityStore,textures,materials,framing,PerfProbe,BenchmarkRunner,Effects,CeilingMesh,benchmark}.ts(x)` + tests; `ui/{DisplayMenu,PerfPanel}.tsx`; edits to `Scene3D`, `WallMesh`, `FloorMesh`, `TopBar`, `App`, `main.tsx`, `styles.css`, `WalkControls`; `e2e/smoke.mjs`; deps `@react-three/postprocessing`, `postprocessing`, `vitest` (web), `playwright-core` (root dev).
- **Decisions:** ADR-017.
- **Known gaps / notes:** AO not gated during motion (see ADR-017); wood/plaster are procedural placeholders; no windows yet so the sun shines through ceilings (they don't cast shadows); bundle main chunk 391 KB gz (+101 KB lazy effects) — code-splitting 3D vs plan can wait; Vite dev prints a harmless "Multiple instances of Three.js" warning (single three@0.180.0 installed — dev pre-bundling artefact).
- **Next step:** **Owner:** open the app on desktop and phone → Display → *Run benchmark* (or open `…/?bench=1`), then *Copy report* and paste the text to me (note phone model). Then I record the Phase 0 verdict (go/no-go on ADR-001) and we move to Phase 1.

### [2026-11-05] P0-08 — Design-language pass: minimal "architectural paper" UI + touch layout
- **Model/Author:** Claude Sonnet 5.5
- **Status:** Done; **visually verified by me via headless-Edge screenshots** (desktop 1440×900 and phone-width 500×900, sample home). Interactive behaviour and real-phone feel still need the owner's test.
- **Trigger:** Owner supplied a reference image (architecture-studio brand sheet) and asked for a clean, minimal, most-user-friendly UI. Image saved to `docs/design/reference-brand-guidelines.png`.
- **What was done:**
  - `docs/DESIGN.md` (new, source of truth): principles, tokens (paper `#e6e4e0`, ink `#111`, brick accent `#7a4236`, beige, stone), Outfit typography, layout, component list, rules. **ADR-016** records the decision.
  - UI rebuilt in `apps/web/src/ui/`: **TopBar** (wordmark, Plan / Split / 3D segmented switch, Fit, Walk), **ToolRail** (icon + text label per tool: Select, Wall, Undo, Redo, Snap), **SnapMenu** (one popover with 4 switches and plain-language hints), **BottomBar** (one-line caption; *Done* and *Delete* pills appear only when relevant). Old dense toolbar removed. "2D" renamed "Plan". Phones (<700 px): rail moves to a bottom thumb-zone bar, wordmark hides.
  - Canvas restyled: light paper, solid ink walls (poché), beige room fills, thin Outfit labels with a paper-coloured halo, brick for selection / preview / walker, ink snap markers; crosshair cursor in Wall tool.
  - 3D restyled: paper background, soft stone ground, grid helper removed, higher default camera angle that frames the house by bounding sphere + aspect so interiors are visible.
  - Fixes found by screenshots: plan loaded off-centre (now auto-fits on open, leaving room for the floating chrome); dimension labels overlapped walls (now offset by text size and placed inside rooms when possible).
  - New `?demo=1` URL flag loads a sample 3-room home (built with the real commands) for demos/screenshots.
- **Verified:** typecheck, lint, build; 86 unit tests pass.
- **Files:** `docs/DESIGN.md`, `docs/design/reference-brand-guidelines.png`, `apps/web/src/{styles.css,main.tsx,App.tsx}`, `apps/web/src/ui/{TopBar,ToolRail,SnapMenu,BottomBar,icons}.tsx` (+ removed `Toolbar.tsx`), `plan/{render,PlanController,demo}.ts`, `view3d/{Scene3D.tsx,placeholderMaterials.ts}`; dep `@fontsource-variable/outfit`.
- **Known gaps / notes:** Claude-in-Chrome extension is not connected in this environment, so I used headless Edge for screenshots (it caps the minimum window width at ~500 px and the R3F pane measured a little short in headless only — not seen in the owner's real-browser tests, but worth watching). Canvas colours are duplicated between `styles.css` and `render.ts`. In 3D overview the near walls still hide some interior — a cutaway/“hide near walls” mode (FR-504) would help (Phase 1). No dark theme yet (tokens make it cheap later).
- **Next step:** Owner checks the new look on desktop + phone (`?demo=1` is the quickest way) and the walkthrough feel. Then P0-09 perf baseline, P0-10 realism spike, P0-11 progressive rendering.

### [2026-11-05] P0-07 — First-person walkthrough with wall collision
- **Model/Author:** Claude Sonnet 5.5
- **Status:** Done in code; **not run in a browser/phone by me — the walkthrough *feel* (speed, look sensitivity, stick comfort) can only be judged by the owner.**
- **What was done:**
  - `geometry/collision`: `buildColliders` (walls → thick segments) and `moveWithCollision` — circular player (r = 0.25 m) that **slides** along walls, moves in ≤ 10 cm sub-steps (cannot tunnel through thin walls even with a huge step), rounds wall ends, and is pushed out if a wall is drawn over the player. 10 tests incl. "cannot escape a closed room through any corner/direction".
  - `apps/web/src/walk`: `WalkControls` (inside the R3F canvas): WASD/arrows, Shift = run (1.7 / 3.4 m/s), eye height 1.6 m above the active level, pitch clamped ±80°, frame time clamped at 50 ms, Esc exits, renders every frame only while walking. `WalkOverlay`: touch = floating left-thumb **stick** (left 45% of pane) + drag-to-look elsewhere; mouse/pen = drag to look. Spawns in the centre of the largest room (remembers last position). Walls edited while walking update collision live.
  - 2D plan shows a **"you are here" marker with a view cone** while walking (works in Split view: edit the plan and walk at the same time). Toolbar **Walk / Exit walk** button; Walk switches 2D-only view to Split/3D automatically; leaving walk re-frames the orbit camera. Tool shortcuts (W, V, F) are suspended while walking so WASD doesn't switch tools.
- **Verified:** typecheck, lint, build; **86 tests** pass (8 schema + 33 geometry + 45 editor-core); dev server compiles all walk modules (HTTP 200).
- **Files:** `packages/geometry/src/collision/{collision,collision.test}.ts`; `apps/web/src/walk/{walkState.ts,WalkControls.tsx,WalkOverlay.tsx}`; edits to `session.ts`, `Scene3D.tsx`, `App.tsx`, `Toolbar.tsx`, `PlanController.ts`, `render.ts`, `styles.css`.
- **Known gaps / notes:** doors/windows don't exist yet so every wall blocks (collision will get door gaps with P1-01); no stairs/levels switching while walking; no pointer-lock mouse look (drag-to-look used so mouse and touch behave the same — pointer lock can be added as polish); no head-bob/footsteps (deliberate: comfort); no ceilings yet so the sky is visible indoors; look sign convention is "Minecraft-style" (drag right = turn right, drag down = look down) — tell me if you prefer inverted.
- **Next step:** Owner tests walkthrough on desktop and phone (this is the key Phase 0 device test). Then P0-08 (touch pass + device perf measurements) and P0-09/10/11 (perf baseline, realism spike, progressive rendering).

### [2026-11-05] P0-06b — Wall junctions: auto-split + wall-edge snapping
- **Model/Author:** Claude Sonnet 5.5
- **Status:** Done in code; not seen in a browser by me — owner test needed.
- **What was done:**
  - `addWall` now builds a proper plan: the new wall is cut wherever it touches or crosses the plan — existing nodes on its body become joints; walls it crosses are split (X); walls whose body its endpoints land on are split (T). Split halves keep thickness/height/kind/materials; the **first half keeps the original wall id** (selection stays valid); openings beyond the split move to the second half with a corrected offset. Drawing over an existing wall doesn't duplicate it. All of it is **one undo step**. New ids are derived deterministically from the command's base id.
  - New snap kind **`wall`**: (1) where the 45°/90° ray crosses a wall near the cursor (so perpendicular dividers land exactly on the wall), (2) nearest point on a wall body. Walls that already contain the start point are ignored (building along them), and walls touching a dragged node are ignored. New "Walls" snap toggle + diamond marker in the UI. The wall tool ends its chain when landing on a wall body (like a node).
  - Room identity matching changed from Jaccard to **overlap coefficient** (shared ÷ smaller wall set ≥ 50%, ties → Jaccard → larger room → signature) because splitting a room leaves each half with only ~half of the old walls; before this the room lost its name on a divider. Test found it.
- **Verified:** typecheck, lint, build; **76 tests** pass (8 + 23 + 45). New: T/X junction cases, openings re-parenting, divider splits a room and keeps the name on one half (undo restores), wall-snap cases, and a **property test (150 runs): after any sequence of random wall additions no two walls cross without a joint and no node lies inside a wall body; undo-all/redo-all still round-trips**.
- **Files:** `editor-core/src/commands/walls.ts` (addWall rewritten), `snapping/snap.ts`, `tools/wallTool.ts`, `rooms.ts`, `junctions.test.ts`; web: `PlanController.ts`, `render.ts`, `session.ts`, `Toolbar.tsx`.
- **Known gaps:** dragging an existing corner point onto another wall does not join/split (snap-to-wall is disabled while dragging, to avoid fake joins) — to be done with the Select tool upgrade; crossings created by dragging corners are not split; deleting the middle of a split wall does not re-merge the halves (collinear merge could be added to postProcess later).
- **Next step:** Owner test (draw a room, then a divider ending on a wall → expect two rooms). Then P0-07 — first-person walkthrough camera with wall collision.

### [2026-11-05] P0-06 — Room detection + floors
- **Model/Author:** Claude Sonnet 5.5
- **Status:** Done in code; visuals (room fill/labels, 3D floors) not seen by me — owner test needed. (Owner confirmed P0-04/P0-05 "ok" on their test.)
- **What was done:**
  - `geometry/room/detect.ts` — `detectRooms(nodes, walls)`: prunes dangling walls, builds half-edges sorted by angle, walks faces with the face on the left (interior = positive area; outer face discarded), and takes the floor outline from the **mitered footprint faces that look into the room**, so the area is the true inner floor (inside wall thickness). Canonical, order-independent output (loop starts at smallest wall id; signature = sorted wall ids). Skips slivers < 0.25 m² and self-touching faces (courtyard/island bridges — documented limitation).
  - `geometry/room/floor.ts` — `buildFloorMesh(polygon, y, facing)` using earcut (handles concave outlines, any winding; also usable for ceilings).
  - `editor-core/rooms.ts` — `syncRooms` runs in `postProcess` after every command: rooms follow closed wall loops; identity (name, type, materials) carries across edits by exact wall-set match, then best overlap (Jaccard ≥ 0.5); new rooms get deterministic ids and the next free "Room N"; only writes on real change so no-op commands stay no-ops. New command `setRoomProps`.
  - `apps/web`: 2D room tint + name + area (m²) labels; 3D floor meshes with the room's floor material; shared memoized `levelRooms()` so pan/zoom/orbit never recompute rooms.
- **Verified:** typecheck, lint, build pass; **66 tests** (8 schema, 23 geometry, 29 editor-core, incl. the random-command undo/redo property test now running with room sync). New tests: rectangle inner area = (W−t)(H−t); direction/order independence; two rooms sharing a divider; open U-shape = no room; dangling walls ignored; L-shaped room; room keeps name when a corner is dragged; delete wall removes room and undo restores it with its name; floor triangles face up.
- **Files:** `packages/geometry/src/room/{detect,floor,room.test}.ts`; `packages/editor-core/src/{rooms.ts,rooms.test.ts,commands/rooms.ts}`; `apps/web/src/plan/rooms.ts`, `apps/web/src/view3d/FloorMesh.tsx`; edits to `postProcess.ts`, `render.ts`, `PlanController.ts`, `Scene3D.tsx`; deps: `earcut` (+ types) in geometry, `@hd/geometry` in editor-core.
- **Decisions made:** Room ids are `room_<hash of wall set>` (deterministic; undo/redo-friendly). Room identity threshold 0.5 Jaccard.
- **Known gaps / notes:** a wall that ends mid-wall is still not joined to the wall it touches, so a divider drawn this way does NOT split a room — you must end the divider exactly on an existing corner point, or we add T-junction auto-splitting (**recommend next small task, P0-06b**, because it will confuse users: the snap indicator will say "grid" not "point"); no UI yet to rename a room or change its floor (P1-02/P1-04); no holes/courtyards; label position is the centroid (can fall outside concave rooms).
- **Next step:** Owner test. Then either P0-06b (T-junction splitting) or P0-07 (walkthrough camera with wall collision).

### [2026-11-05] P0-05 — `@hd/geometry` mitered walls + live 3D view
- **Model/Author:** Claude Sonnet 5.5
- **Status:** Done in code; **not visually verified** (browser extension unavailable). Owner test needed (together with P0-04).
- **What was done:**
  - `packages/geometry` (pure TS, no React/Three): `computeFootprints(nodes, walls)` — at every node, incident walls are sorted by angle and each adjacent pair meets at the intersection of their facing offset lines, so L, T, X and any n-way junction join cleanly, including different thicknesses. Parallel/collinear joins stay flush; angles sharper than ≈29° (`MITER_LIMIT`) fall back to a bevel with end caps instead of a long spike. Free ends get square caps. `buildWallMesh(footprint, elevation, height)` extrudes to typed arrays (positions/normals/UVs/indices) with **4 material groups** (sideA, sideB, top, ends); UVs are in world metres so textures tile at real scale; interior end caps are omitted where walls meet.
  - `apps/web`: `Scene3D` (R3F: HDRI + hemisphere + shadow-casting sun, ground, orbit controls, render-on-demand) rebuilds walls live as you draw/drag/undo; unchanged walls keep their geometry (keyed by footprint values). View switcher **2D / Split / 3D** (side by side on wide screens, stacked on narrow); R3F only mounts when 3D is visible (saves phone GPU). "Fit" re-frames both views. Placeholder materials table (ADR-013).
- **Verified:** typecheck, lint, build, 43 unit tests pass (8 schema + 12 geometry + 23 editor-core). Key geometry tests: single wall area = L×t; L-corner gives exact inner/outer miter points; collinear walls share joint exactly; **closed rectangle's 4 footprints tile the wall ring exactly (area = outer − inner)**; T-junction finite & valid; 12° corner bevels; every triangle winds outward matching its normal. Dev server compiles the new modules (HTTP 200).
- **Files:** `packages/geometry/{package.json,tsconfig.json,src/{index.ts,wall/footprint.ts,wall/mesh.ts,wall/wall.test.ts}}`; `apps/web/src/view3d/{Scene3D,WallMesh}.tsx`, `placeholderMaterials.ts`; edits to `App.tsx`, `Toolbar.tsx`, `session.ts`, `styles.css`.
- **Known gaps:** no openings (doors/windows) yet — P1-01 will split walls into boxes around them (ADR-007); no floors/rooms until P0-06; footprints are recomputed for all walls of the scene on any wall/node change (fine at house scale; per-wall dirty tracking later if profiling shows need); bevel wedge at very sharp corners is left open (cosmetic); 3D looks basic — no textures/AO yet (realism spike is P0-10).
- **Next step:** Owner tests 2D + 3D on desktop and phone. Then P0-06 — room detection + floor meshes.

### [2026-11-05] P0-04 — 2D plan editor (grid, pan/zoom, wall tool, snapping)
- **Model/Author:** Claude Sonnet 5.5
- **Status:** Done in code; **NOT visually verified** (Claude-in-Chrome extension was not connected, so I could not drive the UI). Owner test needed.
- **What was done:**
  - `editor-core`: pure `snapPoint` (priority: existing node → 45°/90° angle from last point with length rounded to grid → grid → none; capture radius in metres so feel is zoom-independent), `niceGridStep(zoom)`, and `createWallTool` (chain walls; each wall = one undo step; landing on an existing node closes the chain). 9 new tests.
  - `apps/web`: `PlanController` (Canvas 2D, render-on-demand, DPR ≤ 2): adaptive grid with major lines/axes; walls drawn at real thickness with length labels; node handles; snap markers (square = point, triangle = angle, dot = grid) and dashed angle guide; live length + angle readout while drawing. Input: mouse + touch + pen via Pointer Events — wheel/pinch zoom to cursor, two-finger pan/zoom, middle/right/Space+drag pan, one-finger pan on empty space in Select tool; wall tool places a point on **release** so touch users can slide to the exact spot; Select tool: tap wall to select (Shift = multi), drag corner point to move (single undo step via transaction), Delete removes. Toolbar (44 px targets): Select/Wall, Undo/Redo/Delete, Grid/Angle/Points snap toggles, Fit, Done (appears while drawing). Keys: W, V, F, Esc, Enter, Del, Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z.
- **Verified:** typecheck, lint, production build, 31 unit tests (8 + 23) all pass; dev server serves 200.
- **Files:** `packages/editor-core/src/{snapping/*,tools/wallTool.ts,snapping.test.ts}`; `apps/web/src/{App.tsx,main.tsx,styles.css,plan/*,ui/Toolbar.tsx}`; removed hello-cube.
- **Decisions made:** ADR-015 (Canvas 2D for the plan; supersedes ADR-008).
- **Known gaps / notes:** no typed exact length yet (FR-104; Pro mode P1-15); no wall splitting at T-junctions (a wall ended mid-wall is not topologically joined yet — comes with room detection P0-06); wall corners are drawn with square caps, true mitering arrives with the 3D geometry (P0-05); touch finger hides the preview point (a loupe/offset may be needed — risk R4); the 3D hello-cube is gone for now (3D returns in P0-05).
- **Next step:** Owner tests on desktop + phone (see below). Then P0-05 — `geometry` package: wall mesh with mitered corners and a 3D view of the drawn plan.

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
