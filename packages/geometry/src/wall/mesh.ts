import type { WallFootprint } from './footprint';
import { axialOf, facePoint, validCuts, type OpeningCut } from './openings';

/** Material slot per triangle group; apps map these to materials (sideA = wall.materialA, …). */
export type WallSlot = 'sideA' | 'sideB' | 'top' | 'ends';
export const WALL_SLOTS: readonly WallSlot[] = ['sideA', 'sideB', 'top', 'ends'];

export interface MeshGroup {
  slot: WallSlot;
  start: number; // index offset
  count: number; // index count
}

/** Plain typed arrays — no Three.js dependency; wrap in BufferGeometry in the renderer. */
export interface MeshData {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
  /** One group per slot in WALL_SLOTS order (count may be 0). */
  groups: MeshGroup[];
}

type V3 = [number, number, number];

class Builder {
  positions: number[] = [];
  normals: number[] = [];
  uvs: number[] = [];
  indices: number[] = [];

  /** Adds a quad (p0..p3 in loop order) with a flat normal; triangle winding is auto-oriented to `n`. */
  quad(p: [V3, V3, V3, V3], uv: [number, number][], n: V3): void {
    const base = this.positions.length / 3;
    for (let i = 0; i < 4; i++) {
      this.positions.push(...p[i]!);
      this.normals.push(...n);
      this.uvs.push(...uv[i]!);
    }
    for (const [a, b, c] of [
      [0, 1, 2],
      [0, 2, 3],
    ] as const) {
      const pa = p[a]!, pb = p[b]!, pc = p[c]!;
      const e1: V3 = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]];
      const e2: V3 = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]];
      const cx = e1[1] * e2[2] - e1[2] * e2[1];
      const cy = e1[2] * e2[0] - e1[0] * e2[2];
      const cz = e1[0] * e2[1] - e1[1] * e2[0];
      const facing = cx * n[0] + cy * n[1] + cz * n[2] >= 0;
      this.indices.push(base + a, base + (facing ? b : c), base + (facing ? c : b));
    }
  }
}

/** A rectangle on a wall face in (axial s, height y) coordinates. */
interface Strip {
  s0: number;
  s1: number;
  y0: number;
  y1: number;
}

/**
 * Wall face = full rectangle minus the openings, as axis-aligned strips (ADR-007: boxes around the
 * holes, no CSG). Walks left → right: a full-height strip before each opening, then the pieces below
 * (window sill) and above (lintel) the opening itself.
 */
function faceStrips(sStart: number, sEnd: number, cuts: readonly OpeningCut[], H: number): Strip[] {
  const out: Strip[] = [];
  let pos = sStart;
  for (const c of cuts) {
    const s0 = c.offset - c.width / 2;
    const s1 = c.offset + c.width / 2;
    if (s0 > pos + 1e-9) out.push({ s0: pos, s1: s0, y0: 0, y1: H });
    if (c.sill > 1e-9) out.push({ s0, s1, y0: 0, y1: c.sill });
    if (c.sill + c.height < H - 1e-9) out.push({ s0, s1, y0: c.sill + c.height, y1: H });
    pos = s1;
  }
  if (sEnd > pos + 1e-9) out.push({ s0: pos, s1: sEnd, y0: 0, y1: H });
  return out;
}

/**
 * Extrude a wall footprint into a solid from y = elevation to elevation + height, with rectangular
 * openings cut through it (and the reveals — jambs, head, sill — that line each hole).
 * UVs are world metres (u along the wall, v up) so materials tile at real-world scale.
 * Bottom face omitted (never seen). Openings that cannot be built (outside the wall, overlapping) are skipped.
 */
export function buildWallMesh(
  fp: WallFootprint,
  elevation: number,
  height: number,
  openings: readonly OpeningCut[] = [],
): MeshData {
  const [aL, bL, bR, aR] = fp.footprint;
  const cuts = validCuts(fp, openings, height);
  const v = (p: readonly [number, number], y: number): V3 => [p[0], elevation + y, p[1]];
  // 3D point on a face at axial s, height y.
  const at = (s: number, y: number, side: 1 | -1): V3 => v(facePoint(fp, s, side), y);

  const ux = bL[0] - aL[0];
  const uz = bL[1] - aL[1];
  const lenL = Math.hypot(ux, uz) || 1;
  const u: [number, number] = [ux / lenL, uz / lenL]; // wall direction a → b
  const nL: V3 = [-u[1], 0, u[0]];

  const per = { sideA: new Builder(), sideB: new Builder(), top: new Builder(), ends: new Builder() };

  // Side A (L face), read from outside: u runs a → b. Edge points are the mitered footprint ends.
  const sL0 = axialOf(fp, aL);
  const sL1 = axialOf(fp, bL);
  for (const st of faceStrips(sL0, sL1, cuts, height)) {
    const p0 = st.s0 === sL0 ? v(aL, st.y0) : at(st.s0, st.y0, 1);
    const p3 = st.s0 === sL0 ? v(aL, st.y1) : at(st.s0, st.y1, 1);
    const p1 = st.s1 === sL1 ? v(bL, st.y0) : at(st.s1, st.y0, 1);
    const p2 = st.s1 === sL1 ? v(bL, st.y1) : at(st.s1, st.y1, 1);
    per.sideA.quad([p0, p1, p2, p3], [[st.s0, st.y0], [st.s1, st.y0], [st.s1, st.y1], [st.s0, st.y1]], nL);
  }

  // Side B (R face), read from outside: u runs b → a.
  const sR0 = axialOf(fp, aR);
  const sR1 = axialOf(fp, bR);
  for (const st of faceStrips(sR0, sR1, cuts, height)) {
    const p0 = st.s0 === sR0 ? v(aR, st.y0) : at(st.s0, st.y0, -1);
    const p3 = st.s0 === sR0 ? v(aR, st.y1) : at(st.s0, st.y1, -1);
    const p1 = st.s1 === sR1 ? v(bR, st.y0) : at(st.s1, st.y0, -1);
    const p2 = st.s1 === sR1 ? v(bR, st.y1) : at(st.s1, st.y1, -1);
    per.sideB.quad(
      [p0, p1, p2, p3],
      [[sR1 - st.s0, st.y0], [sR1 - st.s1, st.y0], [sR1 - st.s1, st.y1], [sR1 - st.s0, st.y1]],
      [-nL[0], 0, -nL[2]],
    );
  }

  // Top (continuous: a lintel always remains above every opening).
  per.top.quad(
    [v(aL, height), v(bL, height), v(bR, height), v(aR, height)],
    [aL, bL, bR, aR].map((p) => [p[0], p[1]] as [number, number]),
    [0, 1, 0],
  );

  // Reveals lining each hole, facing into the opening.
  const t = fp.thickness;
  for (const c of cuts) {
    const s0 = c.offset - c.width / 2;
    const s1 = c.offset + c.width / 2;
    const y0 = c.sill;
    const y1 = c.sill + c.height;
    const dir: V3 = [u[0], 0, u[1]];
    // Left jamb (faces +s) and right jamb (faces −s).
    per.ends.quad([at(s0, y0, 1), at(s0, y0, -1), at(s0, y1, -1), at(s0, y1, 1)], [[0, y0], [t, y0], [t, y1], [0, y1]], dir);
    per.ends.quad([at(s1, y0, 1), at(s1, y0, -1), at(s1, y1, -1), at(s1, y1, 1)], [[0, y0], [t, y0], [t, y1], [0, y1]], [-dir[0], 0, -dir[2]]);
    // Head (underside of the lintel).
    per.ends.quad([at(s0, y1, 1), at(s1, y1, 1), at(s1, y1, -1), at(s0, y1, -1)], [[s0, 0], [s1, 0], [s1, t], [s0, t]], [0, -1, 0]);
    // Sill (top of the lower wall) — windows only.
    if (y0 > 1e-9) {
      per.ends.quad([at(s0, y0, 1), at(s1, y0, 1), at(s1, y0, -1), at(s0, y0, -1)], [[s0, 0], [s1, 0], [s1, t], [s0, t]], [0, 1, 0]);
    }
  }

  // End caps (only where the wall end is exposed).
  const cap = (p: readonly [number, number], q: readonly [number, number], dirSign: 1 | -1) => {
    const ex = q[0] - p[0];
    const ez = q[1] - p[1];
    const w = Math.hypot(ex, ez);
    if (w < 1e-9) return;
    let n: V3 = [-ez / w, 0, ex / w];
    if (n[0] * u[0] * dirSign + n[2] * u[1] * dirSign < 0) n = [-n[0], 0, -n[2]];
    per.ends.quad([v(p, 0), v(q, 0), v(q, height), v(p, height)], [[0, 0], [w, 0], [w, height], [0, height]], n);
  };
  if (fp.capA) cap(aR, aL, -1);
  if (fp.capB) cap(bL, bR, 1);

  // Concatenate in slot order with groups.
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const groups: MeshGroup[] = [];
  for (const slot of WALL_SLOTS) {
    const b = per[slot];
    const offset = positions.length / 3;
    groups.push({ slot, start: indices.length, count: b.indices.length });
    positions.push(...b.positions);
    normals.push(...b.normals);
    uvs.push(...b.uvs);
    for (const i of b.indices) indices.push(i + offset);
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices),
    groups,
  };
}
