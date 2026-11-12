import type { Vec2 } from '@hd/scene-schema';
import { buildStairMesh, SPIRAL_POLE_R_M, type StairLayout, type Tread } from './stairs';

/**
 * How the flight itself is built:
 *  - `solid`: a block under every step down to the floor (the classic look; the underside is left out);
 *  - `stringer`: open treads resting on a beam along each side;
 *  - `spine`: open treads on one beam down the middle;
 *  - `floating`: treads only, nothing under them (they look cantilevered from the wall).
 */
export type StairBuild = 'solid' | 'stringer' | 'spine' | 'floating';

export interface StairBuildOptions {
  build: StairBuild;
  /** Thickness of a tread of the open builds (m). */
  thickness: number;
  /** How far a tread overhangs the step below (m). */
  nosing: number;
  /** Closed risers between the treads (the solid build is always closed). */
  risers: boolean;
  /** Width of a beam (m). Unset = 6 cm for side beams, 12 cm for the spine. */
  stringerWidth?: number;
  /** Vertical depth of a beam below the steps (m). */
  stringerDepth: number;
}

export const DEFAULT_STAIR_BUILD: StairBuildOptions = { build: 'solid', thickness: 0.05, nosing: 0.03, risers: false, stringerDepth: 0.22 };

/** Material slot per group: the steps, the closed risers, and the frame (beams, posts, pole). */
export type StairSlot = 'tread' | 'riser' | 'frame';

export interface StairBodyMesh {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
  groups: { slot: StairSlot; start: number; count: number }[];
}

type V3 = [number, number, number];

/** Collects faces with an explicit outward normal (the winding is fixed to match it). */
class Faces {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];
  idx: number[] = [];

  quad(a: V3, b: V3, c: V3, d: V3, n: V3, uv: (p: V3) => [number, number]): void {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cr = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!];
    const ps = cr[0]! * n[0] + cr[1]! * n[1] + cr[2]! * n[2] < 0 ? [a, d, c, b] : [a, b, c, d];
    const base = this.pos.length / 3;
    for (const p of ps) {
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(n[0], n[1], n[2]);
      this.uv.push(...uv(p));
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  tri(a: V3, b: V3, c: V3, n: V3, uv: (p: V3) => [number, number]): void {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cr = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!];
    const ps = cr[0]! * n[0] + cr[1]! * n[1] + cr[2]! * n[2] < 0 ? [a, c, b] : [a, b, c];
    const base = this.pos.length / 3;
    for (const p of ps) {
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(n[0], n[1], n[2]);
      this.uv.push(...uv(p));
    }
    this.idx.push(base, base + 1, base + 2);
  }

  /** An axis-aligned box. */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
    const top = (p: V3): [number, number] => [p[0], p[2]];
    const fx = (p: V3): [number, number] => [p[2], p[1]];
    const fz = (p: V3): [number, number] => [p[0], p[1]];
    this.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0], top);
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], top);
    this.quad([x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1], [-1, 0, 0], fx);
    this.quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [1, 0, 0], fx);
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [0, 0, -1], fz);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], fz);
  }

  /** A prism standing on a convex polygon (a wedge step of a spiral stair): a fan on top and below, a wall along every edge. */
  prism(P: readonly Vec2[], y0: number, y1: number): void {
    const cx = P.reduce((a, q) => a + q[0], 0) / P.length;
    const cz = P.reduce((a, q) => a + q[1], 0) / P.length;
    const flat = (p: V3): [number, number] => [p[0], p[2]];
    for (let i = 0; i < P.length; i++) {
      const q0 = P[i]!;
      const q1 = P[(i + 1) % P.length]!;
      this.tri([cx, y1, cz], [q0[0], y1, q0[1]], [q1[0], y1, q1[1]], [0, 1, 0], flat);
      this.tri([cx, y0, cz], [q0[0], y0, q0[1]], [q1[0], y0, q1[1]], [0, -1, 0], flat);
      const ex = q1[0] - q0[0];
      const ez = q1[1] - q0[1];
      const l = Math.hypot(ex, ez) || 1;
      let n: V3 = [ez / l, 0, -ex / l];
      // outward = away from the centre
      if (n[0] * ((q0[0] + q1[0]) / 2 - cx) + n[2] * ((q0[1] + q1[1]) / 2 - cz) < 0) n = [-n[0], 0, -n[2]];
      this.quad([q0[0], y0, q0[1]], [q1[0], y0, q1[1]], [q1[0], y1, q1[1]], [q0[0], y1, q0[1]], n, (p) => [p[0] + p[2], p[1]]);
    }
  }

  column(cx: number, cz: number, r: number, y0: number, y1: number, n = 12): void {
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      const p0: V3 = [cx + r * Math.cos(a0), y0, cz + r * Math.sin(a0)];
      const p1: V3 = [cx + r * Math.cos(a1), y0, cz + r * Math.sin(a1)];
      const nm = (a0 + a1) / 2;
      this.quad(p0, p1, [p1[0], y1, p1[2]], [p0[0], y1, p0[2]], [Math.cos(nm), 0, Math.sin(nm)], (p) => [p[0] + p[2], p[1]]);
      this.tri([cx, y1, cz], [p0[0], y1, p0[2]], [p1[0], y1, p1[2]], [0, 1, 0], (p) => [p[0], p[2]]);
    }
  }
}

/** Frame of a flight: where it starts and ends along its way up, and which way is across. */
interface Flight {
  treads: Tread[];
  /** Local (x, z) from the distance along the flight (s, growing as you climb) and across it (c). */
  at: (s: number, c: number) => Vec2;
  /** Near and far edge (along s) of each tread. */
  near: number[];
  far: number[];
  /** Across range of the flight. */
  c0: number;
  c1: number;
}

function flightsOf(layout: StairLayout): { flights: Flight[]; landings: Tread[] } {
  const flights: Flight[] = [];
  const landings: Tread[] = [];
  let cur: Tread[] = [];
  const close = () => {
    if (cur.length === 0) return;
    const d = cur[0]!.dir;
    const f: Flight =
      d[1]! < -0.5
        ? { treads: cur, at: (s, c) => [c, -s], near: cur.map((t) => -t.rect[3]), far: cur.map((t) => -t.rect[1]), c0: cur[0]!.rect[0], c1: cur[0]!.rect[2] }
        : d[1]! > 0.5
          ? { treads: cur, at: (s, c) => [c, s], near: cur.map((t) => t.rect[1]), far: cur.map((t) => t.rect[3]), c0: cur[0]!.rect[0], c1: cur[0]!.rect[2] }
          : d[0]! < -0.5
            ? { treads: cur, at: (s, c) => [-s, c], near: cur.map((t) => -t.rect[2]), far: cur.map((t) => -t.rect[0]), c0: cur[0]!.rect[1], c1: cur[0]!.rect[3] }
            : { treads: cur, at: (s, c) => [s, c], near: cur.map((t) => t.rect[0]), far: cur.map((t) => t.rect[2]), c0: cur[0]!.rect[1], c1: cur[0]!.rect[3] };
    flights.push(f);
    cur = [];
  };
  for (const t of layout.treads) {
    if (t.landing) {
      close();
      landings.push(t);
    } else if (cur.length && (cur[0]!.dir[0] !== t.dir[0] || cur[0]!.dir[1] !== t.dir[1])) {
      close();
      cur.push(t);
    } else cur.push(t);
  }
  close();
  return { flights, landings };
}

/**
 * The stair as one mesh (local coordinates, like `buildStairMesh`) in three slots: steps, risers and frame.
 * The solid build is the classic block-per-step; the open builds draw each tread as a slab of its own thickness (with a
 * nosing), optional closed risers, and the beams that carry them.
 */
export function buildStairBody(layout: StairLayout, options: Partial<StairBuildOptions> = {}): StairBodyMesh {
  const o: StairBuildOptions = { ...DEFAULT_STAIR_BUILD, ...options };
  if (o.build === 'solid') {
    const m = buildStairMesh(layout);
    return { positions: m.positions, normals: m.normals, uvs: m.uvs, indices: m.indices, groups: [{ slot: 'tread', start: 0, count: m.indices.length }] };
  }
  const th = Math.min(0.2, Math.max(0.02, o.thickness));
  const nose = Math.min(0.08, Math.max(0, o.nosing));
  const depth = Math.min(0.6, Math.max(0.06, o.stringerDepth));
  const sw = Math.min(0.4, Math.max(0.02, o.stringerWidth ?? (o.build === 'spine' ? 0.12 : 0.06)));
  const rh = layout.riserHeight;
  const treadF = new Faces();
  const riserF = new Faces();
  const frameF = new Faces();
  const top = (p: V3): [number, number] => [p[0], p[2]];

  // ---- the steps ----
  const { flights, landings } = flightsOf(layout);
  for (const tr of layout.treads) {
    const h = tr.height;
    if (tr.poly) {
      treadF.prism(tr.poly, h - th, h);
      continue;
    }
    let [x0, z0, x1, z1] = tr.rect;
    // The nosing overhangs the step below: the near edge (the side you come from) moves back.
    if (!tr.landing && nose > 0) {
      if (tr.dir[1]! < -0.5) z1 += nose;
      else if (tr.dir[1]! > 0.5) z0 -= nose;
      else if (tr.dir[0]! < -0.5) x1 += nose;
      else x0 -= nose;
    }
    treadF.box(x0, h - th, z0, x1, h, z1);
    if (o.risers && !tr.poly) {
      // A thin plate on the near edge of the tread, from the step below up to this tread (its own near edge, before the nosing).
      const [rx0, rz0, rx1, rz1] = tr.rect;
      const t2 = 0.02;
      const lo = Math.max(0, h - rh);
      const hi = h - th;
      if (hi > lo + 0.005) {
        if (tr.dir[1]! < -0.5) riserF.box(rx0, lo, rz1 - t2, rx1, hi, rz1);
        else if (tr.dir[1]! > 0.5) riserF.box(rx0, lo, rz0, rx1, hi, rz0 + t2);
        else if (tr.dir[0]! < -0.5) riserF.box(rx1 - t2, lo, rz0, rx1, hi, rz1);
        else riserF.box(rx0, lo, rz0, rx0 + t2, hi, rz1);
      }
    }
  }

  // ---- the frame ----
  if (layout.spiral) {
    // Treads hang on the centre pole.
    frameF.column(0, 0, SPIRAL_POLE_R_M, 0, layout.rise, 14);
  } else if (o.build !== 'floating') {
    const slope = rh / 0.28;
    flights.forEach((f, fi) => {
      if (f.treads.length === 0) return;
      const n = f.treads.length;
      const L = (s: number) => f.treads[0]!.height - th + (s - f.near[0]!) * slope;
      const floorY = fi === 0 ? 0 : -Infinity;
      const bottom = (s: number) => Math.max(floorY, L(s) - rh - depth);
      const cs = o.build === 'spine' ? [(f.c0 + f.c1) / 2] : [f.c0 + sw / 2, f.c1 - sw / 2];
      for (const c of cs) {
        const lo = c - sw / 2;
        const hi = c + sw / 2;
        const P = (s: number, y: number, cc: number): V3 => {
          const q = f.at(s, cc);
          return [q[0], y, q[1]];
        };
        const face = (cc: number, outward: 1 | -1) => {
          // side face: one trapezoid per tread, from the step underside down to the sloped bottom line
          for (let i = 0; i < n; i++) {
            const sa = f.near[i]!;
            const sb = f.far[i]!;
            const yt = f.treads[i]!.height - th;
            // bottom may cross the floor inside the strip: split there
            const ba = bottom(sa);
            const bb = bottom(sb);
            const nv = (() => {
              const a = P(sa, 0, cc);
              const b = P(sa, 0, cc + outward);
              return [b[0] - a[0], 0, b[2] - a[2]] as V3;
            })();
            frameF.quad(P(sa, ba, cc), P(sb, bb, cc), P(sb, yt, cc), P(sa, yt, cc), nv, (p) => [p[0] + p[2], p[1]]);
          }
        };
        face(lo, -1);
        face(hi, 1);
        for (let i = 0; i < n; i++) {
          const sa = f.near[i]!;
          const sb = f.far[i]!;
          const yt = f.treads[i]!.height - th;
          // top (under the tread) and the sloped underside
          frameF.quad(P(sa, yt, lo), P(sb, yt, lo), P(sb, yt, hi), P(sa, yt, hi), [0, 1, 0], top);
          frameF.quad(P(sa, bottom(sa), lo), P(sb, bottom(sb), lo), P(sb, bottom(sb), hi), P(sa, bottom(sa), hi), [0, -1, 0], top);
          if (i + 1 < n) {
            // the step between this tread's underside and the next one's
            const yn = f.treads[i + 1]!.height - th;
            const along = P(sb + 1, 0, lo);
            const base = P(sb, 0, lo);
            frameF.quad(P(sb, yt, lo), P(sb, yn, lo), P(sb, yn, hi), P(sb, yt, hi), [base[0] - along[0], 0, base[2] - along[2]], top);
          }
        }
        // the ends
        const s0 = f.near[0]!;
        const s1 = f.far[n - 1]!;
        const a0 = P(s0 - 1, 0, lo);
        const b0 = P(s0, 0, lo);
        frameF.quad(P(s0, bottom(s0), lo), P(s0, bottom(s0), hi), P(s0, f.treads[0]!.height - th, hi), P(s0, f.treads[0]!.height - th, lo), [a0[0] - b0[0], 0, a0[2] - b0[2]], top);
        const a1 = P(s1 + 1, 0, lo);
        const b1 = P(s1, 0, lo);
        frameF.quad(P(s1, bottom(s1), lo), P(s1, bottom(s1), hi), P(s1, f.treads[n - 1]!.height - th, hi), P(s1, f.treads[n - 1]!.height - th, lo), [a1[0] - b1[0], 0, a1[2] - b1[2]], top);
      }
    });
    // Landings sit on a frame of beams and stand on posts.
    for (const ld of landings) {
      const [x0, z0, x1, z1] = ld.rect;
      const y1 = ld.height - th;
      const y0 = y1 - depth;
      frameF.box(x0, y0, z0, x1, y1, z0 + sw);
      frameF.box(x0, y0, z1 - sw, x1, y1, z1);
      frameF.box(x0, y0, z0 + sw, x0 + sw, y1, z1 - sw);
      frameF.box(x1 - sw, y0, z0 + sw, x1, y1, z1 - sw);
      const p = Math.max(sw, 0.06);
      for (const [px, pz] of [[x0, z0], [x1 - p, z0], [x0, z1 - p], [x1 - p, z1 - p]] as const) frameF.box(px, 0, pz, px + p, y0, pz + p);
    }
  }
  // (Floating: nothing under the treads; a landing is just its slab.)

  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const groups: StairBodyMesh['groups'] = [];
  for (const [slot, f] of [['tread', treadF], ['riser', riserF], ['frame', frameF]] as const) {
    if (f.idx.length === 0) continue;
    const base = pos.length / 3;
    pos.push(...f.pos);
    nor.push(...f.nor);
    uv.push(...f.uv);
    const start = idx.length;
    for (const i of f.idx) idx.push(base + i);
    groups.push({ slot, start, count: f.idx.length });
  }
  return { positions: new Float32Array(pos), normals: new Float32Array(nor), uvs: new Float32Array(uv), indices: Uint32Array.from(idx), groups };
}
