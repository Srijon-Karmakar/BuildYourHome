# Design Language

> Source of truth for how PlotFramer looks and behaves. Reference: [`design/reference-brand-guidelines.png`](design/reference-brand-guidelines.png)
> (owner-supplied, 2026-11-05: an architecture-studio brand sheet). Read this before building ANY UI.

## 1. Owner's brief
**Clean, minimal, and as user-friendly as possible.** The product is for everyone from first-time home owners to engineers, so the interface must feel calm and obvious, never like CAD software.

## 2. What the reference tells us
- Warm light-grey "paper" backgrounds, near-black ink, ONE earthy accent (brick/terracotta), supporting beige and stone.
- Large, light-weight geometric sans-serif for headings; tiny, quiet captions for everything secondary.
- Lots of empty space; content is framed by whitespace, not boxes and borders.
- Solid blocks of colour instead of gradients or shadows. Numbered sections, thin hairlines.
- Photography/3D is the hero; chrome stays out of the way.

## 3. Principles
1. **The drawing is the hero.** UI floats at the edges; the centre belongs to the plan/3D.
2. **Show only what matters now (progressive disclosure).** Delete / Done appear only when relevant; snap options live behind one "Snap" control; Pro features arrive later without crowding Simple mode (ADR-014).
3. **Words beat mystery icons.** Every tool has a text label (small, under or beside its icon). Tooltips add the shortcut.
4. **One accent.** Brick marks "this is active / this is yours" (active tool, selection, walker). Everything else is ink on paper.
5. **Quiet motion.** 150 ms ease for state changes; no bouncing, no parallax.
6. **Touch-first sizes.** Targets ≥ 44 px; the toolbar moves to the bottom thumb zone on phones.
7. **Instant feedback, calm language.** Plain words ("Plan", "Walk"), no jargon, hints written as short captions.
8. **Light theme first.** All colours are tokens (`:root` CSS variables + `theme.ts` for canvas) so a dark theme can be added without touching components.

## 4. Tokens
| Token | Value | Use |
|---|---|---|
| `--paper` | `#e6e4e0` | App/canvas background |
| `--paper-2` | `#f1f0ed` | Floating panels (92 % opacity + blur) |
| `--white` | `#ffffff` | Inputs, active surfaces |
| `--ink` | `#111111` | Text, walls, primary buttons |
| `--ink-2` | `#5b5852` | Secondary text |
| `--ink-3` | `#8d8a83` | Hints, disabled |
| `--line` | `rgba(17,17,17,.14)` | Hairlines |
| `--brick` | `#7a4236` | Accent: active/selected/walker |
| `--beige` | `#c9bfa0` | Room fills, subtle highlights |
| `--stone` | `#c8c3bd` | Dividers, ground plane |
Radii: 10 px controls, 16 px panels. Spacing scale: 4 / 8 / 12 / 16 / 24 / 40.

## 5. Typography
- **Outfit** (variable, bundled via `@fontsource-variable/outfit`; free substitute for the reference's commercial ABC Visby CF — same geometric, round-forms feel).
- Weights: 300 (large/quiet), 400 (UI), 500 (emphasis). Sizes: wordmark 20, UI 13–14, captions 12, micro-labels 10–11. Slight positive letter-spacing on small caps/labels.
- Canvas text (plan labels) uses the same family; redraw after `document.fonts.ready`.

## 6. Layout (editor)
```
┌──────────────────────────────────────────────────────────────┐
│ PlotFramer                [ Plan | Split | 3D ]   Walk  Fit │  top bar, no background
│ ┌────┐                                                         │
│ │Select                  (plan / 3D fills everything)          │
│ │Wall │                                                        │
│ │ ── │                                                         │
│ │Undo │                                                        │
│ │Redo │                                                        │
│ │ ── │                                              [ Delete ] │  contextual actions
│ │Snap │                                                        │
│ └────┘            Click to place points · Esc to finish         │  caption
└──────────────────────────────────────────────────────────────┘
```
Compact (< 900 px wide or <= 500 px tall): top bar = small logo, view switch, **Home**, **Walk**, **Menu** (Home and Menu open bottom sheets; Menu holds Account / Display / Fit). Phones (< 700 px): one slim sideways-scrolling tool bar at the bottom (Undo / Redo pinned), floors as a slim vertical selector on the right edge, no hint line; cards open above the bar. Short landscape: vertical scrolling tool bar on the left, floors along the bottom.

## 7. Components (implemented in `apps/web/src/ui/`)
- **TopBar** — wordmark, segmented view switch (text, underline/ink-fill for active), Walk (outlined pill → brick fill when active), Fit.
- **ToolRail** — vertical floating panel; icon + label per tool; active = ink fill/white text; includes Snap popover.
- **SnapMenu** — popover with switch rows: Grid, Angle, Points, Walls.
- **ContextBar** — pill(s) that appear only when needed: *Done* while drawing, *Delete* when something is selected.
- **Caption** — one-line plain-text hint for the current tool.

## 8. Rules for future screens
- No drop shadows heavier than `0 1px 0 var(--line)`; separate with whitespace and hairlines.
- No more than ONE accent-coloured element per region.
- Prefer text buttons / segmented controls over icon-only. Icon-only is allowed only for universal actions (undo, redo, delete, close) and always has a label in the tooltip.
- Modal dialogs only for destructive/irreversible actions; everything else is inline or a popover.
- Every new control must work with mouse, touch and keyboard.
- 3D scenes: paper-coloured background, no harsh skies; materials stay natural (wood, plaster, stone) — colour comes from the home, not the UI.


## Edit card layout (added after owner feedback)
The property card never floats over the views: when something is selected the app reserves a column for it (`--ins-col`, 320 px; 292 px under 1100 px) and the plan / 3D panes share the remaining width. Under 1200 px a Split view stacks the two panes. On phones (< 700 px) the card is a bottom sheet over the views. The plan keeps its position when the pane narrows (no recentering), so taps and drags stay where the user left them.
