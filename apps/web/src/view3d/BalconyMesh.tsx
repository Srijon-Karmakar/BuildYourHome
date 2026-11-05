import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Balcony, Scene } from '@hd/scene-schema';
import { balconyRailings } from '@hd/editor-core';
import { BALCONY_RAIL_HEIGHT_M, BALCONY_SLAB_M, buildFloorMesh, type Segment } from '@hd/geometry';
import { FloorMesh } from './FloorMesh';
import type { Tier } from './qualityLogic';
import { pickProps } from './pick';

const METAL = new THREE.MeshStandardMaterial({ color: '#2b2a28', roughness: 0.4, metalness: 0.7 });
const GLASS = new THREE.MeshStandardMaterial({ color: '#bcd4e6', transparent: true, opacity: 0.28, roughness: 0.05, depthWrite: false, envMapIntensity: 1.4 });
const PLASTER = new THREE.MeshStandardMaterial({ color: '#e8e4da', roughness: 0.9 });
const SLAB = new THREE.MeshStandardMaterial({ color: '#cfcac0', roughness: 0.9, side: THREE.DoubleSide });

function Rail({ run, kind }: { run: Segment; kind: Balcony['railing'] }) {
  const dx = run.b[0] - run.a[0];
  const dz = run.b[1] - run.a[1];
  const len = Math.hypot(dx, dz);
  if (len < 0.05) return null;
  const H = BALCONY_RAIL_HEIGHT_M;
  const posts = Math.max(2, Math.round(len / 1.2) + 1);
  const bars = Math.max(2, Math.round(len / 0.13));
  return (
    <group position={[(run.a[0] + run.b[0]) / 2, 0, (run.a[1] + run.b[1]) / 2]} rotation={[0, Math.atan2(-dz, dx), 0]}>
      {kind === 'wall' ? (
        <>
          <mesh position={[0, H / 2, 0]} material={PLASTER} castShadow receiveShadow>
            <boxGeometry args={[len, H, 0.12]} />
          </mesh>
          <mesh position={[0, H + 0.02, 0]} material={SLAB} castShadow>
            <boxGeometry args={[len + 0.02, 0.04, 0.17]} />
          </mesh>
        </>
      ) : (
        <>
          <mesh position={[0, H, 0]} material={METAL} castShadow>
            <boxGeometry args={[len, 0.04, 0.05]} />
          </mesh>
          {Array.from({ length: posts }, (_, i) => (
            <mesh key={i} position={[-len / 2 + (i * len) / (posts - 1), H / 2, 0]} material={METAL} castShadow>
              <boxGeometry args={[0.04, H, 0.04]} />
            </mesh>
          ))}
          {kind === 'glass' ? (
            <mesh position={[0, H / 2 + 0.03, 0]} material={GLASS}>
              <boxGeometry args={[len - 0.04, H - 0.14, 0.012]} />
            </mesh>
          ) : (
            <>
              {[0.12, 0.5].map((y) => (
                <mesh key={y} position={[0, y, 0]} material={METAL}>
                  <boxGeometry args={[len, 0.025, 0.025]} />
                </mesh>
              ))}
              {Array.from({ length: bars }, (_, i) => (
                <mesh key={i} position={[-len / 2 + 0.05 + (i * (len - 0.1)) / (bars - 1), H / 2, 0]} material={METAL}>
                  <boxGeometry args={[0.014, H - 0.04, 0.014]} />
                </mesh>
              ))}
            </>
          )}
        </>
      )}
    </group>
  );
}

/** Underside and edge band of the slab (the top is the floor mesh). */
function SlabBody({ balcony, elevation }: { balcony: Balcony; elevation: number }) {
  const key = balcony.outline.map((p) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`).join(';');
  const geo = useMemo(() => {
    const top = elevation;
    const bot = elevation - BALCONY_SLAB_M;
    const under = buildFloorMesh(balcony.outline, bot, 'down');
    const pos = Array.from(under.positions);
    const idx = Array.from(under.indices);
    const n = balcony.outline.length;
    for (let i = 0; i < n; i++) {
      const a = balcony.outline[i]!;
      const b = balcony.outline[(i + 1) % n]!;
      const base = pos.length / 3;
      pos.push(a[0], bot, a[1], b[0], bot, b[1], b[0], top, b[1], a[0], top, a[1]);
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, elevation]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh geometry={geo} material={SLAB} castShadow receiveShadow {...pickProps(balcony.id, balcony.levelId)} />;
}

/** One balcony / porch: floor on top, slab body below, railings along the open edges. */
export function BalconyMesh({ balcony, scene, elevation, tier }: { balcony: Balcony; scene: Scene; elevation: number; tier: Tier }) {
  const runs = balconyRailings(scene, balcony.id);
  return (
    <group>
      <FloorMesh polygon={balcony.outline} elevation={elevation} materialId={balcony.floorMaterial.id} tier={tier} roomId={balcony.id} levelId={balcony.levelId} />
      <SlabBody balcony={balcony} elevation={elevation} />
      <group position={[0, elevation, 0]}>
        {runs.map((r, i) => (
          <Rail key={i} run={r} kind={balcony.railing} />
        ))}
      </group>
    </group>
  );
}
