import type { WallFootprint } from './footprint';

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

/**
 * Extrude a wall footprint into a prism from y = elevation to elevation + height.
 * UVs are in world metres (u along the wall, v up) so materials tile at real-world scale.
 * Bottom face omitted (never seen).
 */
export function buildWallMesh(fp: WallFootprint, elevation: number, height: number): MeshData {
  const [aL, bL, bR, aR] = fp.footprint;
  const y0 = elevation;
  const y1 = elevation + height;
  const v = (p: readonly [number, number], y: number): V3 => [p[0], y, p[1]];

  const ux = bL[0] - aL[0];
  const uz = bL[1] - aL[1];
  const lenL = Math.hypot(ux, uz) || 1;
  const u: [number, number] = [ux / lenL, uz / lenL]; // wall direction a → b
  const nL: V3 = [-u[1], 0, u[0]];

  const per = { sideA: new Builder(), sideB: new Builder(), top: new Builder(), ends: new Builder() };

  // Side A (L face), read from outside: u runs a → b.
  per.sideA.quad(
    [v(aL, y0), v(bL, y0), v(bL, y1), v(aL, y1)],
    [[0, 0], [lenL, 0], [lenL, height], [0, height]],
    nL,
  );
  // Side B (R face), read from outside: u runs b → a.
  const lenR = Math.hypot(aR[0] - bR[0], aR[1] - bR[1]) || 1;
  per.sideB.quad(
    [v(bR, y0), v(aR, y0), v(aR, y1), v(bR, y1)],
    [[0, 0], [lenR, 0], [lenR, height], [0, height]],
    [-nL[0], 0, -nL[2]],
  );
  // Top.
  per.top.quad([v(aL, y1), v(bL, y1), v(bR, y1), v(aR, y1)], [aL, bL, bR, aR].map((p) => [p[0], p[1]] as [number, number]), [0, 1, 0]);

  // End caps (only where the wall end is exposed).
  const cap = (p: readonly [number, number], q: readonly [number, number], dirSign: 1 | -1) => {
    const ex = q[0] - p[0];
    const ez = q[1] - p[1];
    const w = Math.hypot(ex, ez);
    if (w < 1e-9) return;
    let n: V3 = [-ez / w, 0, ex / w];
    if (n[0] * u[0] * dirSign + n[2] * u[1] * dirSign < 0) n = [-n[0], 0, -n[2]];
    per.ends.quad([v(p, y0), v(q, y0), v(q, y1), v(p, y1)], [[0, 0], [w, 0], [w, height], [0, height]], n);
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
