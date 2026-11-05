# High-Level Design (HLD)

## 1. Architecture overview

```
┌────────────────────────── Client (web app = also Capacitor webview) ──────────────────────────┐
│                                                                                                 │
│  UI Layer (React)         Editor Core (pure TS)          Render Layer (R3F / Three.js)          │
│  ─ toolbars, panels  ───▶ ─ Scene Store (Zustand)  ◀───▶ ─ 3D scene builder (from scene JSON)  │
│  ─ catalog browser        ─ Command bus + History        ─ 2D plan renderer (canvas/SVG or     │
│  ─ property inspector     ─ Tools (draw, select, ...)       orthographic Three)                 │
│  ─ project list           ─ Snapping / selection         ─ Camera rigs (orbit, FPS)             │
│                           ─ Validation                   ─ Asset loader (GLB/KTX2/Draco)        │
│                                  │                                                              │
│                                  ▼                                                              │
│                          Geometry Engine (pure TS, worker-capable)                              │
│                          walls · rooms · openings(CSG) · roofs · collision                      │
│                                                                                                 │
│  Persistence: IndexedDB (autosave, offline)  ◀──sync──▶  API client                              │
└──────────────────────────────────────────────┬──────────────────────────────────────────────────┘
                                               │ HTTPS
┌──────────────────────────────────────────────▼──────────────────────────────────────────────────┐
│ Backend (Supabase proposed)                                                                      │
│  Auth · Postgres (projects, versions, shares, catalog) · Storage (thumbnails, GLB) · CDN         │
│  Edge functions: share-link resolver, thumbnail/export jobs, (later) AI + render jobs            │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## 2. Components

| Component | Responsibility | Depends on |
|---|---|---|
| **scene-schema** | Types + Zod validation + migrations for scene JSON | — |
| **geometry** | Pure functions: wall mitering, room detection, opening cutting, roof generation, collision shapes | scene-schema |
| **editor-core** | Store, commands, undo/redo, tools state machine, snapping, selection | scene-schema, geometry |
| **render-3d** | Converts scene → Three objects, incremental updates, materials, lighting, camera rigs | editor-core, geometry |
| **render-2d** | Plan view drawing, hit-testing, dimension labels | editor-core |
| **ui** | React components, panels, i18n | editor-core |
| **persistence** | IndexedDB autosave, import/export, cloud sync | scene-schema |
| **assets** | Catalog, loader, LOD, texture/material library | — |
| **api/backend** | Auth, storage, sharing | — |
| **mobile shell** | Capacitor config, native plugins (files, share, haptics, status bar) | web app |

## 3. Key data flows

**Edit flow:** user input → Tool → creates `Command` → `history.execute(cmd)` → Immer patch applied to Scene Store → subscribers (render-2d, render-3d, inspector) update → autosave debounced → (if signed in) sync.

**Render flow (3D):** Scene Store change → diff by entity id → only affected entities rebuilt (wall meshes via geometry engine) → Three scene graph mutated. Unchanged meshes are untouched.

**Load flow:** open project → fetch/IndexedDB → validate+migrate → store → build scene → lazy-load GLBs by need.

**Share flow:** owner creates share token → viewer URL → read-only viewer bundle loads scene JSON via public endpoint → renders without editor tools.

## 4. Technology stack
| Concern | Choice |
|---|---|
| Language | TypeScript (strict) |
| UI | React 18+, Tailwind (or CSS modules), Radix UI primitives |
| 3D | Three.js + @react-three/fiber + @react-three/drei |
| State | Zustand + Immer (patches for undo) |
| Validation | Zod |
| Geometry libs | earcut (triangulation), clipper2 / polygon-clipping (2D booleans), three-bvh-csg or manifold-3d (3D CSG), straight-skeleton lib for roofs |
| Physics/collision | Custom capsule-vs-wall-segments for walkthrough (no full physics engine in MVP) |
| Build | Vite, pnpm workspaces, Turborepo (optional) |
| Mobile | Capacitor 6+ (iOS, Android), PWA |
| Backend | Supabase (Auth, Postgres, Storage); Edge Functions (Deno) |
| Assets | glTF 2.0, Draco/Meshopt geometry, KTX2 textures, gltf-transform pipeline |
| Testing | Vitest, Playwright, Testing Library |
| CI/CD | GitHub Actions; Vercel/Cloudflare Pages for web; Fastlane/Play Console for stores |

## 5. Cross-cutting concerns
- **Performance:** instancing for repeated items, merged static geometry per level, frustum culling, texture atlas/KTX2, quality tiers (low/med/high), render-on-demand in editor (don't loop when idle), geometry in Web Worker when heavy.
- **Offline:** PWA service worker caches shell + catalog; IndexedDB stores projects.
- **Security:** Row-level security on all tables; signed URLs for private assets; share tokens are random + revocable; sanitize any imported file.
- **Observability:** Sentry (errors), privacy-respecting analytics (PostHog), perf marks for scene build time and FPS.
- **i18n/units:** i18next; unit formatter util; stored data always metres.
- **Extensibility:** command + schema design allows later collaboration (CRDT/OT over command stream) without rewrite.

## 6. Deployment view
- Web: static build on CDN; API on Supabase.
- Mobile: same build bundled into Capacitor shell; OTA web updates optional (Capgo/Appflow).
- Environments: `dev` (local), `staging`, `prod`.

## 7. Alternatives considered
See `docs/DECISIONS.md` (Unity, Flutter, React Native, Babylon.js).
