import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Scene, Stair } from '@hd/scene-schema';
import { layoutOf } from '@hd/editor-core';
import { buildStairMesh, buildStairRailing } from '@hd/geometry';
import { Outlines } from '@react-three/drei';
import { makeSurface } from './materials';
import { GLASS_TINTS, railColor, railOptions } from './railing';
import { pickProps, SELECT_COLOR, useIsSelected } from './pick';
import type { Tier } from './qualityLogic';

/** One stair: solid steps from the lower floor up to the last step below the upper floor. Rebuilt only when it changes. */
export function StairMesh({ stair, scene, tier }: { stair: Stair; scene: Scene; tier: Tier }) {
  const selected = useIsSelected(stair.id);
  const layout = layoutOf(scene, stair);
  const from = scene.levels[stair.fromLevel];
  const key = layout ? `${layout.kind}|${layout.width}|${layout.rise.toFixed(4)}|${stair.mirror ? 1 : 0}` : '';

  const geometry = useMemo(() => {
    if (!layout) return null;
    const m = buildStairMesh(layout);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(m.uvs, 2));
    g.setIndex(new THREE.BufferAttribute(m.indices, 1));
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const material = useMemo(() => makeSurface(stair.material?.id ?? 'floor-wood-walnut', tier), [stair.material?.id, tier]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  // Handrail, posts and balusters (or glass) on the open sides.
  const railing = stair.railing && stair.railing !== 'none' ? stair.railing : null;
  const railKey = JSON.stringify([stair.railing, stair.railingOpts]);
  const rail = useMemo(() => {
    if (!layout || !railing) return null;
    const m = buildStairRailing(layout, railOptions(stair));
    if (!m) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(m.uvs, 2));
    g.setIndex(new THREE.BufferAttribute(m.indices, 1));
    for (const grp of m.groups) g.addGroup(grp.start, grp.count, grp.slot === 'frame' ? 0 : grp.slot === 'glass' ? 1 : 2);
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, railKey]);
  const railMaterials = useMemo(() => {
    const color = railColor(stair);
    const tint = GLASS_TINTS[stair.railingOpts?.tint ?? 'clear'];
    const wood = stair.railing === 'wood';
    return [
      new THREE.MeshStandardMaterial({ color, roughness: wood ? 0.55 : 0.4, metalness: wood ? 0 : 0.6 }),
      new THREE.MeshPhysicalMaterial({ color: tint.color, transparent: true, opacity: tint.opacity, roughness: tint.roughness, clearcoat: 1, depthWrite: false }),
      new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0 }),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [railKey]);
  useEffect(() => () => rail?.dispose(), [rail]);
  useEffect(() => () => railMaterials.forEach((m) => m.dispose()), [railMaterials]);

  if (!geometry || !from) return null;
  return (
    <mesh geometry={geometry} material={material} position={[stair.origin[0], from.elevation, stair.origin[2]]} rotation={[0, stair.rotationY, 0]} castShadow receiveShadow {...pickProps(stair.id, stair.fromLevel)}>
      {selected && <Outlines thickness={0.03} color={SELECT_COLOR} />}
      {rail && <mesh geometry={rail} material={railMaterials} castShadow receiveShadow raycast={() => null} />}
    </mesh>
  );
}
