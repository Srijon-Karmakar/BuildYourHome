import * as THREE from 'three';
import type { Scene } from '@hd/scene-schema';

export interface Framing {
  target: THREE.Vector3;
  /** Camera distance that fits the whole building in view (vertical and horizontal FOV). */
  distance: number;
}

/** Frame the building by its bounding sphere so any aspect ratio shows all of it. */
export function computeFraming(scene: Scene, camera: THREE.PerspectiveCamera): Framing {
  const nodes = [...Object.values(scene.nodes), ...(scene.plot?.boundary ?? []).map((p) => ({ p })), ...Object.values(scene.balconies).flatMap((b) => b.outline.map((p) => ({ p })))];
  const height = Math.max(3, ...Object.values(scene.levels).map((l) => l.elevation + l.height));
  let cx = 0, cz = 0, radius = 5;
  if (nodes.length) {
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.p[0]); maxX = Math.max(maxX, n.p[0]);
      minZ = Math.min(minZ, n.p[1]); maxZ = Math.max(maxZ, n.p[1]);
    }
    cx = (minX + maxX) / 2;
    cz = (minZ + maxZ) / 2;
    radius = Math.max(4, Math.hypot(maxX - minX, maxZ - minZ, height) / 2);
  }
  const vFov = (camera.fov * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  return {
    target: new THREE.Vector3(cx, height * 0.4, cz),
    distance: (radius / Math.sin(Math.min(vFov, hFov) / 2)) * 1.05,
  };
}
