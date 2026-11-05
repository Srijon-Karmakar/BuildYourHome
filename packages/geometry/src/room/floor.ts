import earcut from 'earcut';
import type { Vec2 } from '@hd/scene-schema';
import type { MeshData } from '../wall/mesh';

/**
 * Flat floor (or ceiling) mesh from a room outline, at height `y`.
 * Normal faces +Y (floor, seen from above); pass `facing: 'down'` for a ceiling.
 * UVs are world metres (x, z).
 */
export function buildFloorMesh(polygon: readonly Vec2[], y: number, facing: 'up' | 'down' = 'up'): MeshData {
  const flat = polygon.flatMap((p) => [p[0], p[1]]);
  const tri = earcut(flat);
  const n = polygon.length;
  const sign = facing === 'up' ? 1 : -1;

  const positions = new Float32Array(n * 3);
  const normals = new Float32Array(n * 3);
  const uvs = new Float32Array(n * 2);
  polygon.forEach((p, i) => {
    positions.set([p[0], y, p[1]], i * 3);
    normals.set([0, sign, 0], i * 3);
    uvs.set([p[0], p[1]], i * 2);
  });

  const indices: number[] = [];
  for (let t = 0; t < tri.length; t += 3) {
    const a = tri[t]!;
    let b = tri[t + 1]!;
    let c = tri[t + 2]!;
    const pa = polygon[a]!, pb = polygon[b]!, pc = polygon[c]!;
    // Normal.y of (a,b,c) in (x, y, z) space = (b-a)_z*(c-a)_x - (b-a)_x*(c-a)_z.
    const ny = (pb[1] - pa[1]) * (pc[0] - pa[0]) - (pb[0] - pa[0]) * (pc[1] - pa[1]);
    if (ny * sign < 0) [b, c] = [c, b];
    indices.push(a, b, c);
  }

  return {
    positions,
    normals,
    uvs,
    indices: new Uint32Array(indices),
    groups: [{ slot: 'top', start: 0, count: indices.length }],
  };
}
