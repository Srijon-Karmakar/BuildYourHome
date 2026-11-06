import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Level, Roof, Scene } from '@hd/scene-schema';
import { buildRoofMesh } from '@hd/geometry';
import { isHouseWall } from '@hd/editor-core';
import { makeSurface } from './materials';
import type { Tier } from './qualityLogic';

/** Wall centre-line points of a floor (outside walls only when there are any) and half the wall thickness. */
export function roofFootprint(scene: Scene, levelId: string): { points: [number, number][]; wallHalf: number } {
  const walls = Object.values(scene.walls).filter((w) => w.levelId === levelId && isHouseWall(w));
  const outer = walls.filter((w) => w.kind === 'exterior');
  const use = outer.length >= 3 ? outer : walls;
  const ids = new Set<string>();
  for (const w of use) {
    ids.add(w.a);
    ids.add(w.b);
  }
  const points: [number, number][] = [];
  for (const id of ids) {
    const n = scene.nodes[id];
    if (n) points.push([n.p[0], n.p[1]]);
  }
  return { points, wallHalf: use.length ? Math.max(...use.map((w) => w.thickness)) / 2 : 0.115 };
}

/** The roof of one floor, rebuilt only when its settings or the floor's outer walls change. */
export function RoofMesh({ roof, level, scene, tier }: { roof: Roof; level: Level; scene: Scene; tier: Tier }) {
  const fp = roofFootprint(scene, level.id);
  const key = `${roof.style}|${roof.pitchDeg}|${roof.overhang}|${roof.ridgeAngle ?? 0}|${level.elevation + level.height}|${fp.wallHalf}|${fp.points.map((p) => p.map((v) => v.toFixed(3)).join(',')).join(';')}`;

  const geometry = useMemo(() => {
    const m = buildRoofMesh(fp.points, level.elevation + level.height, { style: roof.style, pitchDeg: roof.pitchDeg, overhang: roof.overhang, swap: !!roof.ridgeAngle }, fp.wallHalf);
    if (!m) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(m.uvs, 2));
    g.setIndex(new THREE.BufferAttribute(m.indices, 1));
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const material = useMemo(() => makeSurface(roof.material.id, tier), [roof.material.id, tier]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  return geometry ? <mesh geometry={geometry} material={material} castShadow receiveShadow /> : null;
}
