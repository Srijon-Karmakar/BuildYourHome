import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Vec2 } from '@hd/scene-schema';
import { buildFloorMesh } from '@hd/geometry';
import { makeSurface } from './materials';
import type { Tier } from './qualityLogic';

interface Props {
  polygon: readonly Vec2[];
  y: number;
  materialId: string;
  tier: Tier;
}

/** Flat ceiling facing down. Does not cast shadows (the sun is not blocked: there are no windows yet). */
export function CeilingMesh({ polygon, y, materialId, tier }: Props) {
  const key = polygon.map((p) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`).join(';');

  const geometry = useMemo(() => {
    const m = buildFloorMesh(polygon, y - 0.003, 'down');
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(m.uvs, 2));
    g.setIndex(new THREE.BufferAttribute(m.indices, 1));
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, y]);

  const material = useMemo(() => makeSurface(materialId, tier), [materialId, tier]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  return <mesh geometry={geometry} material={material} receiveShadow />;
}
