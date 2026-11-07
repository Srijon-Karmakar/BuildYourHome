import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Zone } from '@hd/scene-schema';
import { buildRoadMesh, ROAD_SLOTS, roadsideSpots, type RoadSpot } from '@hd/geometry';
import { roadCoverage } from '@hd/editor-core';
import { editor, useUi } from '../plan/session';
import { useStore } from 'zustand';
import { buildFurniture } from './furniture/builders';
import { makeSurface } from './materials';
import { pickProps, SELECT_COLOR, useIsSelected } from './pick';
import type { Tier } from './qualityLogic';
import { Outlines } from '@react-three/drei';

const WHITE = '#f4f2ec';
const YELLOW = '#e6b800';
const KERB = '#b3afa6';

/** One road: surface, paint, pavements and kerbs, rebuilt only when the road or the roads crossing it change. */
export function RoadMesh({ zone, layer, tier }: { zone: Zone; layer: number; tier: Tier }) {
  const selected = useIsSelected(zone.id);
  const scene = useStore(editor.store, (s) => s.scene);
  const weather = useStore(editor.store, (s) => s.scene.lighting.weather);
  const road = zone.road;
  const others = Object.values(scene.zones).filter((z) => z.shape === 'road' && z.id !== zone.id);
  const key = JSON.stringify([zone.points, zone.width, road]) + '|' + others.map((o) => JSON.stringify([o.points, o.width])).join('/');
  const wet = weather === 'rain';

  const geometry = useMemo(() => {
    if (!road) return null;
    const m = buildRoadMesh(zone.points, zone.width ?? 6, road, roadCoverage(editor.getState().scene, zone.id));
    if (!m) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(m.uvs, 2));
    g.setIndex(new THREE.BufferAttribute(m.indices, 1));
    for (const grp of m.groups) g.addGroup(grp.start, grp.count, ROAD_SLOTS.indexOf(grp.slot));
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const materials = useMemo(() => {
    const asphalt = makeSurface(zone.material.id, tier);
    const pav = makeSurface(road?.pavMaterial.id ?? 'ground-paving', tier);
    const paint = (c: string) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 });
    const list = [asphalt, paint(WHITE), paint(YELLOW), pav, new THREE.MeshStandardMaterial({ color: KERB, roughness: 0.85 })];
    // Everything on the road gets pushed slightly toward the camera by its layer, so crossing roads do not flicker.
    for (const m of list) {
      m.polygonOffset = true;
      m.polygonOffsetFactor = -(layer + 1);
      m.polygonOffsetUnits = -(layer + 1);
    }
    // Wet road: smoother, so it mirrors the sky and the lights.
    if (wet) {
      asphalt.roughness = 0.22;
      asphalt.metalness = 0.15;
      pav.roughness = 0.4;
    }
    return list;
  }, [zone.material.id, road?.pavMaterial.id, tier, layer, wet]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);
  if (!geometry) return null;
  return (
    <mesh geometry={geometry} material={materials} receiveShadow {...pickProps(zone.id, undefined)}>
      {selected && <Outlines thickness={0.06} color={SELECT_COLOR} />}
    </mesh>
  );
}

/** One instanced model: draw calls stay the same however many lights or trees stand along the road. */
function Instances({ asset, spots }: { asset: string; spots: RoadSpot[] }) {
  const parts = useMemo(() => {
    const model = buildFurniture(asset);
    if (!model) return [];
    const out: Array<{ geometry: THREE.BufferGeometry; material: THREE.Material }> = [];
    model.updateMatrixWorld(true);
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !Array.isArray(m.material)) out.push({ geometry: m.geometry, material: m.material });
    });
    return out;
  }, [asset]);
  const matrices = useMemo(() => {
    const dummy = new THREE.Object3D();
    return spots.map((s) => {
      dummy.position.set(s.x, 0, s.z);
      dummy.rotation.set(0, s.rot, 0);
      dummy.updateMatrix();
      return dummy.matrix.clone();
    });
  }, [spots]);
  return (
    <>
      {parts.map((p, i) => (
        <instancedMesh
          key={`${asset}-${i}-${matrices.length}`}
          args={[p.geometry, p.material, matrices.length]}
          castShadow
          receiveShadow
          frustumCulled={false}
          ref={(mesh) => {
            if (!mesh) return;
            matrices.forEach((m, k) => mesh.setMatrixAt(k, m));
            mesh.instanceMatrix.needsUpdate = true;
          }}
        />
      ))}
    </>
  );
}

/** Street lights, trees, benches, bins and bollards along every road, as instanced models. */
export function RoadExtras() {
  const zones = useStore(editor.store, (s) => s.scene.zones);
  const hidden = useUi((s) => s.hiddenLayers);
  const byAsset = useMemo(() => {
    const scene = editor.getState().scene;
    const map = new Map<string, RoadSpot[]>();
    for (const z of Object.values(zones)) {
      if (z.shape !== 'road' || !z.road || z.road.extras.length === 0) continue;
      for (const s of roadsideSpots(z.points, z.width ?? 6, z.road, roadCoverage(scene, z.id))) {
        const list = map.get(s.asset) ?? [];
        list.push(s);
        map.set(s.asset, list);
      }
    }
    return [...map.entries()];
  }, [zones]);
  if (hidden.garden) return null;
  return (
    <>
      {byAsset.map(([asset, spots]) => (
        <Instances key={asset} asset={asset} spots={spots} />
      ))}
    </>
  );
}
