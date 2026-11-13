import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { makeSurface } from './materials';
import { addGroundDetail } from './groundShader';
import { TIERS, type Tier } from './qualityLogic';
import { terrainGrid, type FlatRect } from './terrain';

/** Grid cells per side of the 300 m terrain: about 5 m cells on Low, 2.5 m otherwise (the relief is soft, so this is plenty). */
const CELLS: Record<Tier, number> = { low: 60, medium: 120, high: 120 };

/**
 * The land around the home: flat where things are placed, gently rolling further out (see terrain.ts). Drawn with the chosen
 * ground (`materialId`) or a plain verge colour round a plot, plus the shader detail (colour patches; bumps above Low).
 */
export function TerrainMesh({ flat, y, tier, materialId, color }: { flat: FlatRect; y: number; tier: Tier; materialId?: string; color?: string }) {
  const invalidate = useThree((s) => s.invalidate);
  const key = `${flat.join(',')}|${y}|${CELLS[tier]}`;
  const geometry = useMemo(() => {
    const { positions, indices } = terrainGrid(flat, CELLS[tier], y);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    // Plan coordinates as texture coordinates, like the floors (textures tile in metres).
    const uv = new Float32Array((positions.length / 3) * 2);
    for (let i = 0, j = 0; i < positions.length; i += 3, j += 2) {
      uv[j] = positions[i]!;
      uv[j + 1] = positions[i + 2]!;
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(new THREE.BufferAttribute(indices, 1));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const material = useMemo(() => {
    const m = materialId ? makeSurface(materialId, tier) : new THREE.MeshStandardMaterial({ color: color ?? '#cfccc4', roughness: 1 });
    return addGroundDetail(m, { bump: TIERS[tier].normalMaps, patches: materialId ? 1 : 0.5 });
  }, [materialId, color, tier]);
  useEffect(() => invalidate(), [geometry, material, invalidate]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  return <mesh geometry={geometry} material={material} receiveShadow />;
}
