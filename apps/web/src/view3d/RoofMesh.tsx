import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Level, Roof, Scene } from '@hd/scene-schema';
import { buildRoofMesh, buildRoofPart, ROOF_SLOTS, type RoofParams } from '@hd/geometry';
import { isHouseWall } from '@hd/editor-core';
import { Outlines } from '@react-three/drei';
import { makeSurface } from './materials';
import { pickProps, SELECT_COLOR, useIsSelected } from './pick';
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

export const DEFAULT_TRIM = '#f1eee8';
export const DEFAULT_GABLE = 'paint-white';

/** One roof (a part of the plan, or an old-style roof over the whole floor), rebuilt only when it or the walls under it change. */
export function RoofMesh({ roof, level, scene, tier }: { roof: Roof; level: Level; scene: Scene; tier: Tier }) {
  const selected = useIsSelected(roof.id);
  const fp = roof.box ? { points: [] as [number, number][], wallHalf: roofFootprint(scene, level.id).wallHalf } : roofFootprint(scene, level.id);
  const params: RoofParams = {
    style: roof.style,
    pitchDeg: roof.pitchDeg,
    overhang: roof.overhang,
    swap: !!roof.ridgeAngle,
    rake: roof.rake,
    thickness: roof.thickness,
    ridgeCap: roof.ridgeCap,
    gutter: roof.gutter,
    chimney: roof.chimney,
    parapet: roof.parapet,
    dormers: roof.dormers,
  };
  const top = level.elevation + level.height;
  const where = roof.box ? `${roof.box.cx.toFixed(3)},${roof.box.cz.toFixed(3)},${roof.box.angle.toFixed(4)},${roof.box.length.toFixed(3)},${roof.box.width.toFixed(3)}` : fp.points.map((p) => p.map((v) => v.toFixed(3)).join(',')).join(';');
  const key = `${JSON.stringify(params)}|${top}|${fp.wallHalf}|${where}`;

  const geometry = useMemo(() => {
    const m = roof.box ? buildRoofPart(roof.box, top, params, fp.wallHalf) : buildRoofMesh(fp.points, top, params, fp.wallHalf);
    if (!m) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(m.uvs, 2));
    g.setIndex(new THREE.BufferAttribute(m.indices, 1));
    for (const grp of m.groups) g.addGroup(grp.start, grp.count, ROOF_SLOTS.indexOf(grp.slot));
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // One material per slot (roof surface, gable walls, painted trim, gutters, chimney), in ROOF_SLOTS order.
  const materials = useMemo(
    () => [
      makeSurface(roof.material.id, tier),
      makeSurface(roof.gable?.id ?? DEFAULT_GABLE, tier),
      new THREE.MeshStandardMaterial({ color: roof.trim ?? DEFAULT_TRIM, roughness: 0.6 }),
      new THREE.MeshStandardMaterial({ color: '#8d9296', roughness: 0.4, metalness: 0.6 }),
      makeSurface('wall-brick-red', tier),
      new THREE.MeshPhysicalMaterial({ color: '#bcd4e6', transparent: true, opacity: 0.32, roughness: 0.03, clearcoat: 1, depthWrite: false }),
    ],
    [roof.material.id, roof.gable?.id, roof.trim, tier],
  );
  useEffect(() => () => geometry?.dispose(), [geometry]);
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);

  return geometry ? (
    <mesh geometry={geometry} material={materials} castShadow receiveShadow {...pickProps(roof.id, level.id)}>
      {selected && <Outlines thickness={0.05} color={SELECT_COLOR} />}
    </mesh>
  ) : null;
}
