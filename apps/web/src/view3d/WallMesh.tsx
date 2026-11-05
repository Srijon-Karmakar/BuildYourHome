import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Wall } from '@hd/scene-schema';
import { buildWallMesh, WALL_SLOTS, type WallFootprint } from '@hd/geometry';
import { placeholderMaterial } from './placeholderMaterials';

interface Props {
  wall: Wall;
  fp: WallFootprint;
  elevation: number;
}

const TOP_COLOR = '#d9d5cc';
const END_COLOR = '#e6e2d9';

function makeMaterial(id: string): THREE.MeshStandardMaterial {
  const m = placeholderMaterial(id);
  return new THREE.MeshStandardMaterial({ color: m.color, roughness: m.roughness, metalness: m.metalness ?? 0 });
}

export function WallMesh({ wall, fp, elevation }: Props) {
  // Footprint arrays are recomputed per scene change; key on their values so unchanged walls keep their geometry.
  const key = fp.footprint.flat().map((n) => n.toFixed(5)).join(',') + `|${fp.capA}|${fp.capB}`;

  const geometry = useMemo(() => {
    const m = buildWallMesh(fp, elevation, wall.height);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(m.uvs, 2));
    g.setIndex(new THREE.BufferAttribute(m.indices, 1));
    for (const grp of m.groups) {
      if (grp.count > 0) g.addGroup(grp.start, grp.count, WALL_SLOTS.indexOf(grp.slot));
    }
    g.computeBoundingSphere();
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, elevation, wall.height]);

  const materials = useMemo(
    () => [
      makeMaterial(wall.materialA.id),
      makeMaterial(wall.materialB.id),
      new THREE.MeshStandardMaterial({ color: TOP_COLOR, roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ color: END_COLOR, roughness: 0.9 }),
    ],
    [wall.materialA.id, wall.materialB.id],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);

  return <mesh geometry={geometry} material={materials} castShadow receiveShadow />;
}
