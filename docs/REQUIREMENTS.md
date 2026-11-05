# Requirements

Priority: **M** = MVP (Phase 1–2), **S** = Should (Phase 3–4), **C** = Could (Phase 5+).

## Functional

### Plot & plan (FR-1xx)
| ID | Requirement | Pri |
|---|---|---|
| FR-101 | Define plot boundary (polygon) with dimensions | M |
| FR-102 | Draw walls by click/tap; chain walls; close loops | M |
| FR-103 | Snap to grid, endpoints, angles (0/45/90), and other walls; toggleable | M |
| FR-104 | Live length/angle labels while drawing; type exact length | M |
| FR-105 | Edit wall: move endpoints, thickness, height; split / merge | M |
| FR-106 | Auto-detect rooms from closed wall loops; name/type rooms; show area | M |
| FR-107 | Multiple levels (floors), copy level, per-level visibility | M |
| FR-108 | Reference image underlay (scan/trace) with scale calibration | S |
| FR-109 | Curved walls | C |

### Openings (FR-2xx)
| ID | Requirement | Pri |
|---|---|---|
| FR-201 | Place doors/windows on walls (slide along, snap to center) | M |
| FR-202 | 3D wall is actually cut (real hole), frame + glass/leaf rendered | M |
| FR-203 | Resize opening; door swing direction | M |
| FR-204 | Stairs between levels with auto floor hole | S |

### Interior (FR-3xx)
| ID | Requirement | Pri |
|---|---|---|
| FR-301 | Browse/search/filter furniture catalog by category/room | M |
| FR-302 | Place, move, rotate, scale, duplicate, delete items | M |
| FR-303 | Item snapping to floor, wall faces, other items; collision hint | M |
| FR-304 | Apply materials to floors, walls (per side), ceilings | M |
| FR-305 | Color picker + material presets | M |
| FR-306 | Ceiling toggle, basic ceiling lights | S |
| FR-307 | Item variants (color/finish) | S |

### Exterior (FR-4xx)
| ID | Requirement | Pri |
|---|---|---|
| FR-401 | Auto-generate roof (gable, hip, flat) from outer wall loop; adjustable pitch/overhang | M |
| FR-402 | Facade materials per wall; exterior door/window styles | M |
| FR-403 | Ground/terrain plane, grass/paving, boundary wall/fence | M |
| FR-404 | Garden items (trees, plants, paths, car, etc.) | S |
| FR-405 | Balcony, porch, parapet | S |

### Exploration (FR-5xx)
| ID | Requirement | Pri |
|---|---|---|
| FR-501 | 2D plan view and 3D view, switchable and/or split | M |
| FR-502 | Orbit camera (rotate/pan/zoom) | M |
| FR-503 | First-person walkthrough (WASD/mouse; virtual joystick on touch) with wall collision | M |
| FR-504 | Cutaway / hide upper floors / hide roof to see inside | M |
| FR-505 | Time-of-day sun lighting | S |
| FR-506 | Saved camera viewpoints; auto-tour video export | C |
| FR-507 | AR walk-through on device | C |

### Project management (FR-6xx)
| ID | Requirement | Pri |
|---|---|---|
| FR-601 | Undo/redo unlimited within session | M |
| FR-602 | Autosave locally (offline-safe) | M |
| FR-603 | Accounts (email + OAuth), cloud save, project list | M |
| FR-604 | Share read-only link (3D viewer) | M |
| FR-605 | Export: PNG screenshot, PDF plan, glTF | S |
| FR-606 | Templates / sample houses | S |
| FR-607 | Version history | C |
| FR-608 | Real-time collaboration | C |

### Growth (FR-7xx)
| ID | Requirement | Pri |
|---|---|---|
| FR-701 | Cost estimate (quantity takeoff × price list) | S |
| FR-702 | AI floor-plan image → scene | C |
| FR-703 | AI layout/style suggestion | C |
| FR-704 | Region rule checks (Vastu / setbacks) | C |
| FR-705 | User-uploaded GLB models | C |
| FR-706 | Cloud photoreal render | C |

### Monetization & access (FR-8xx)
| ID | Requirement | Pri |
|---|---|---|
| FR-801 | Catalog items have tier (free / premium / rewarded); lock badge in UI | M |
| FR-802 | Entitlement service: `canUse(assetId)`; server-authoritative | M |
| FR-803 | Monthly subscription: ad-free + unlock premium (web via Stripe, mobile via RevenueCat/IAP) | M |
| FR-804 | Rewarded ad unlocks a specific asset (server-verified; optional expiry) | M |
| FR-805 | Ads on free tier only: banner in non-editing screens, interstitial at natural breaks, never during editing/walkthrough | M |
| FR-806 | Scenes containing locked assets still open and render; edit/export of locked items is gated with upsell | M |
| FR-807 | Restore purchases; manage/cancel subscription link | M |
| FR-808 | Ads/billing run behind mock providers in demo builds | M |

### Beginner ↔ Pro experience (FR-9xx)
| ID | Requirement | Pri |
|---|---|---|
| FR-901 | Simple mode default: guided start (template or "draw room by room"), contextual hints | M |
| FR-902 | Pro mode toggle: numeric inputs for all geometry, coordinate display | M |
| FR-903 | Dimension annotations (aligned/linear/area) placed on the plan | M |
| FR-904 | Scale-accurate PDF plan export; DXF export | S |
| FR-905 | Layers (structure / furniture / annotations) with lock + visibility | S |
| FR-906 | Imperial and metric input parsing (e.g. `12'6"`, `3.8m`) | M — **input done (P1-02)**; display units pending P1-15 |
| FR-907 | Interactive tutorial / onboarding for first-time users | M |

## Non-functional (NFR)
| ID | Requirement | Target |
|---|---|---|
| NFR-01 | 3D frame rate | ≥ 60 fps desktop, ≥ 30 fps mid-range phone (e.g. Snapdragon 7-series) on a 3-bed house with ~60 items |
| NFR-02 | Initial load | < 3 s to interactive on 4G for editor shell (assets lazy-loaded) |
| NFR-03 | Edit latency | wall drag → 3D update < 50 ms |
| NFR-04 | Scene size | typical project JSON < 500 KB |
| NFR-05 | Offline | editor works offline after first load (PWA); sync when online |
| NFR-06 | Browser support | latest 2 versions Chrome, Edge, Safari, Firefox; iOS 16+, Android 10+ |
| NFR-07 | WebGL | WebGL2 required; WebGPU optional later |
| NFR-08 | Accessibility | keyboard operable in 2D editor; labels on controls; reduced-motion respected |
| NFR-09 | i18n | all strings externalized; unit system switchable |
| NFR-10 | Data safety | user data private by default; shared links opt-in and revocable |
| NFR-11 | Reliability | no data loss on crash — autosave interval ≤ 5 s after change |
| NFR-12 | Testability | geometry + editor-core ≥ 80% unit-test coverage |
| NFR-13 | Realism (MVP) | High tier: PBR + HDRI + soft shadows + AO + tone mapping; looks "architectural visualization lite" |
| NFR-14 | Smooth interaction | Input→frame latency feels instant: camera/drag stays ≥ 50 fps on desktop, ≥ 30 fps mid phone even on High tier via progressive rendering (degrade while moving, refine on idle) |
| NFR-15 | Refinement time | Full-quality frame within 300 ms of interaction stop (desktop) |
| NFR-16 | Zero-cost demo | Runs entirely on free tiers (Supabase free, static hosting) |
| NFR-17 | Ad/Billing compliance | Follow Apple/Google/AdMob policies; kids-directed content not targeted |
