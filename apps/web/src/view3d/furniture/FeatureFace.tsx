import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Asset } from '@hd/assets';
import type { Item } from '@hd/scene-schema';
import { capGeometry, curvedSlabGeometry, featureLook, slabGeometry } from '../featureGeo';
import { makeSurface } from '../materials';
import { useTier } from '../qualityStore';

/**
 * An extra / curved / box / extended wall. Like ScreenFace it undoes the item's scale, so the finish keeps its real
 * pattern size: width and height come from the scale, the thickness (or how far a box projects) from the depth axis.
 */
export function FeatureFace({ item, asset }: { item: Item; asset: Asset }) {
  const face = asset.feature!;
  const [sx, sy, sz] = item.scale;
  const W = face.w * sx;
  const H = face.h * sy;
  const D = face.depth * sz;
  const look = useMemo(() => featureLook(item, asset), [item, asset]);
  const tier = useTier();
  const tint = item.variant;

  const geo = useMemo(() => (look.shape === 'curved' ? curvedSlabGeometry(W, H, D, look.curve) : slabGeometry(W, H, D)), [look.shape, look.curve, W, H, D]);
  const cap = useMemo(() => (look.cap ? capGeometry(W, H, D) : null), [look.cap, W, H, D]);
  useEffect(() => () => geo.dispose(), [geo]);
  useEffect(() => () => cap?.dispose(), [cap]);

  const mat = useMemo(() => {
    const m = makeSurface(look.material, tier);
    m.side = THREE.DoubleSide;
    if (tint) m.color.set(tint);
    return m;
  }, [look.material, tier, tint]);
  useEffect(() => () => mat.dispose(), [mat]);
  const capMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d9d5cc', roughness: 0.8 }), []);
  useEffect(() => () => capMat.dispose(), [capMat]);

  return (
    <group scale={[1 / sx, 1 / sy, 1 / sz]}>
      <mesh geometry={geo} material={mat} castShadow receiveShadow />
      {cap && <mesh geometry={cap} material={capMat} castShadow receiveShadow />}
    </group>
  );
}
