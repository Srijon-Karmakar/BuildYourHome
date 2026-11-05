import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Vec2 } from '@hd/scene-schema';
import { buildFloorMesh } from '@hd/geometry';
import { Edges } from '@react-three/drei';
import { makeSurface } from './materials';
import { pickProps, SELECT_COLOR, useIsSelected } from './pick';
import type { Tier } from './qualityLogic';

interface Props {
  polygon: readonly Vec2[];
  elevation: number;
  materialId: string;
  tier: Tier;
  /** Openings cut out of the floor (a stairwell). */
  holes?: readonly (readonly Vec2[])[];
  /** The room this floor belongs to (clicking the floor selects it) and the floor it is on. */
  roomId?: string;
  levelId?: string;
}

export function FloorMesh({ polygon, elevation, materialId, tier, holes = [], roomId, levelId }: Props) {
  const selected = useIsSelected(roomId ?? '');
  const key = polygon.map((p) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`).join(';') + '|' + holes.map((h) => h.map((p) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`).join(';')).join('/');

  const geometry = useMemo(() => {
    const m = buildFloorMesh(polygon, elevation + 0.002, 'up', holes);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(m.uvs, 2));
    g.setIndex(new THREE.BufferAttribute(m.indices, 1));
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, elevation]);

  const material = useMemo(() => makeSurface(materialId, tier), [materialId, tier]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh geometry={geometry} material={material} receiveShadow {...(roomId ? pickProps(roomId, levelId) : {})}>
      {selected && roomId && <Edges color={SELECT_COLOR} threshold={1} />}
    </mesh>
  );
}
