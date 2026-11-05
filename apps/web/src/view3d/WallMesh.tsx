import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Wall } from '@hd/scene-schema';
import { buildWallMesh, WALL_SLOTS, type OpeningCut, type WallFootprint } from '@hd/geometry';
import { makeSurface } from './materials';
import type { Tier } from './qualityLogic';

interface Props {
  wall: Wall;
  fp: WallFootprint;
  cuts: readonly OpeningCut[];
  elevation: number;
  tier: Tier;
  /** Draw the wall only up to this height (cutaway mode). */
  maxHeight?: number;
}

const TOP_COLOR = '#d9d5cc';
const END_COLOR = '#e6e2d9';

export function WallMesh({ wall, fp, cuts, elevation, tier, maxHeight }: Props) {
  const shownHeight = maxHeight === undefined ? wall.height : Math.min(wall.height, maxHeight);
  // Footprint arrays are recomputed per scene change; key on their values so unchanged walls keep their geometry.
  const key = fp.footprint.flat().map((n) => n.toFixed(5)).join(',') + `|${fp.capA}|${fp.capB}|` + cuts.map((c) => `${c.offset.toFixed(4)},${c.width.toFixed(4)},${c.height.toFixed(4)},${c.sill.toFixed(4)}`).join(';');

  const geometry = useMemo(() => {
    const m = buildWallMesh(fp, elevation, shownHeight, cuts);
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
  }, [key, elevation, shownHeight]);

  const materials = useMemo(
    () => [
      makeSurface(wall.materialA.id, tier),
      makeSurface(wall.materialB.id, tier),
      new THREE.MeshStandardMaterial({ color: TOP_COLOR, roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ color: END_COLOR, roughness: 0.9 }),
    ],
    [wall.materialA.id, wall.materialB.id, tier],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);

  return <mesh geometry={geometry} material={materials} castShadow receiveShadow />;
}
