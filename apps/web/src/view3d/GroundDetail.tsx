import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useStore } from 'zustand';
import { getAsset } from '@hd/assets';
import { houseBounds, resolveEnvironment, zonePolygon } from '@hd/editor-core';
import { lineLength, pointInPolygon, samplePath } from '@hd/geometry';
import type { Vec2 } from '@hd/scene-schema';
import { editor, useUi } from '../plan/session';
import type { Tier } from './qualityLogic';

/**
 * Small things that make the ground look lived in: grass tufts on lawns, pebbles on bare ground, soil patches, fallen
 * leaves under trees and, when it rains, puddles. Each kind is one instanced mesh (a handful of draw calls in all).
 */

function stream(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GRASSY = (id: string) => /grass|lawn|meadow|moss/.test(id);
const BARE = (id: string) => /soil|gravel|sand|earth|clay|pebbles|mulch/.test(id);
const AUTUMN = new Set(['#c98a2b', '#b5502c']);

export interface DetailPlan {
  tufts: Array<[number, number, number, number]>; // x, z, scale, rotation
  pebbles: Array<[number, number, number, number]>;
  soil: Array<[number, number, number, number]>;
  leaves: Array<{ x: number; z: number; rot: number; color: string }>;
  puddles: Array<[number, number, number]>; // x, z, radius
}

/** Where the details go (pure and seeded, so it can be tested and never flickers between renders). */
export function planGroundDetail(
  ground: string,
  plot: readonly Vec2[] | undefined,
  zones: ReadonlyArray<{ shape: string; points: readonly Vec2[]; width?: number; materialId: string; pavLeft?: number; pavRight?: number }>,
  house: { min: Vec2; max: Vec2 } | null,
  trees: ReadonlyArray<{ x: number; z: number; color?: string }>,
  budget: { tufts: number; pebbles: number },
  rainy: boolean,
): DetailPlan {
  const rnd = stream(2024);
  const out: DetailPlan = { tufts: [], pebbles: [], soil: [], leaves: [], puddles: [] };
  const poly: Vec2[] = plot && plot.length >= 3 ? plot.map((p): Vec2 => [p[0], p[1]]) : house ? [[house.min[0] - 9, house.min[1] - 9], [house.max[0] + 9, house.min[1] - 9], [house.max[0] + 9, house.max[1] + 9], [house.min[0] - 9, house.max[1] + 9]] : [[-12, -9], [12, -9], [12, 9], [-12, 9]];
  const xs = poly.map((p) => p[0]);
  const zs = poly.map((p) => p[1]);
  const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  // Covered ground: the house, and every zone that is not itself grass.
  const covers = zones
    .filter((z) => !GRASSY(z.materialId))
    .map((z) => zonePolygon({ shape: z.shape as 'area' | 'path' | 'road', points: z.points as Vec2[], width: z.width, road: z.shape === 'road' ? { pavLeft: z.pavLeft ?? 0, pavRight: z.pavRight ?? 0 } : undefined }))
    .filter((p) => p.length >= 3);
  const houseBox: Vec2[] | null = house ? [[house.min[0] - 0.4, house.min[1] - 0.4], [house.max[0] + 0.4, house.min[1] - 0.4], [house.max[0] + 0.4, house.max[1] + 0.4], [house.min[0] - 0.4, house.max[1] + 0.4]] : null;
  const free = (x: number, z: number): boolean => {
    const p: Vec2 = [x, z];
    if (!pointInPolygon(p, poly)) return false;
    if (houseBox && pointInPolygon(p, houseBox)) return false;
    return !covers.some((c) => pointInPolygon(p, c));
  };

  const grass = GRASSY(ground);
  const bare = BARE(ground);
  const tries = (budget.tufts + budget.pebbles) * 3;
  for (let i = 0; i < tries && (out.tufts.length < budget.tufts || out.pebbles.length < budget.pebbles); i++) {
    const x = x0 + rnd() * (x1 - x0);
    const z = z0 + rnd() * (z1 - z0);
    if (!free(x, z)) continue;
    if (grass && out.tufts.length < budget.tufts) out.tufts.push([x, z, 0.7 + rnd() * 0.9, rnd() * Math.PI]);
    else if (bare && out.pebbles.length < budget.pebbles) out.pebbles.push([x, z, 0.6 + rnd() * 1.2, rnd() * Math.PI]);
    else if (grass && out.pebbles.length < budget.pebbles / 4) out.pebbles.push([x, z, 0.5 + rnd() * 0.8, rnd() * Math.PI]); // the odd stone in a lawn
  }
  // A few bare patches in a lawn.
  if (grass) for (let i = 0; i < 40 && out.soil.length < 7; i++) {
    const x = x0 + rnd() * (x1 - x0);
    const z = z0 + rnd() * (z1 - z0);
    if (free(x, z)) out.soil.push([x, z, 0.35 + rnd() * 0.7, rnd() * Math.PI]);
  }
  // Fallen leaves under trees (the tree's own colour in autumn).
  for (const t of trees) {
    const autumn = !!t.color && AUTUMN.has(t.color);
    const n = autumn ? 14 : 5;
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 0.4 + rnd() * 1.6;
      const x = t.x + Math.cos(a) * r;
      const z = t.z + Math.sin(a) * r;
      if (free(x, z) || covers.some((c) => pointInPolygon([x, z], c))) out.leaves.push({ x, z, rot: rnd() * Math.PI * 2, color: autumn ? t.color! : ['#8a6a3a', '#7a6a38', '#9a7a42'][Math.floor(rnd() * 3)]! });
    }
  }
  // Puddles on the ground, and on the roads.
  if (rainy) {
    for (let i = 0; i < 60 && out.puddles.length < 9; i++) {
      const x = x0 + rnd() * (x1 - x0);
      const z = z0 + rnd() * (z1 - z0);
      if (free(x, z)) out.puddles.push([x, z, 0.35 + rnd() * 0.7]);
    }
    for (const z of zones) {
      if (z.shape !== 'road') continue;
      const pts = z.points as Vec2[];
      const len = lineLength(pts);
      const w = z.width ?? 6;
      for (let i = 0; i < Math.min(6, Math.ceil(len / 14)); i++) {
        const { p, dir } = samplePath(pts, rnd() * len);
        const off = (rnd() - 0.5) * w * 0.7;
        out.puddles.push([p[0] - dir[1] * off, p[1] + dir[0] * off, 0.5 + rnd() * 0.9]);
      }
    }
  }
  return out;
}

function Blades(): THREE.BufferGeometry {
  // Five thin blades fanning out of one point, dark at the root and light at the tip.
  const pos: number[] = [];
  const col: number[] = [];
  const root = new THREE.Color('#3b5e2d');
  const tip = new THREE.Color('#9bbd66');
  const rnd = stream(5);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rnd();
    const lean = 0.07 + rnd() * 0.08;
    const h = 0.16 + rnd() * 0.12;
    const cx = Math.cos(a);
    const cz = Math.sin(a);
    const px = -cz * 0.012;
    const pz = cx * 0.012;
    pos.push(-px, 0, -pz, px, 0, pz, cx * lean, h, cz * lean);
    col.push(root.r, root.g, root.b, root.r, root.g, root.b, tip.r, tip.g, tip.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/** More grass and pebbles when the environment asks for lots. */
function scaled(tier: Tier, amount: 'some' | 'lots'): { tufts: number; pebbles: number } {
  const base = tier === 'high' ? { tufts: 1300, pebbles: 160 } : { tufts: 600, pebbles: 90 };
  const k = amount === 'lots' ? 2.2 : 1;
  return { tufts: Math.round(base.tufts * k), pebbles: Math.round(base.pebbles * k) };
}

export default function GroundDetail({ tier }: { tier: Tier }) {
  const invalidate = useThree((s) => s.invalidate);
  const scene = useStore(editor.store, (s) => s.scene);
  const weather = scene.lighting.weather;
  const amount = resolveEnvironment(scene.lighting).detail;
  const ground = scene.terrain.groundMaterial.id;
  const hidden = useUi((s) => s.hiddenLayers.garden);
  const plan = useMemo(() => {
    if (amount === 'none' || tier === 'low') return null;
    const level0 = scene.levelOrder[0];
    const trees = Object.values(scene.items)
      .filter((it) => it.levelId === level0 && getAsset(it.assetId)?.tags.includes('tree'))
      .map((it) => ({ x: it.position[0], z: it.position[2], color: it.variant }));
    const zones = Object.values(scene.zones).map((z) => ({ shape: z.shape, points: z.points, width: z.width, materialId: z.material.id, pavLeft: z.road?.pavLeft, pavRight: z.road?.pavRight }));
    return planGroundDetail(ground, scene.plot?.boundary, zones, houseBounds(scene), trees, scaled(tier, amount), weather === 'rain');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, tier, ground, weather, JSON.stringify([scene.plot?.boundary, Object.values(scene.zones).map((z) => [z.points, z.width, z.material.id]), Object.values(scene.walls).length, Object.values(scene.items).filter((it) => getAsset(it.assetId)?.tags.includes('tree')).map((it) => [it.position, it.variant])])]);

  const blades = useMemo(() => Blades(), []);
  const bladeMat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 1 }), []);
  const stone = useMemo(() => new THREE.IcosahedronGeometry(0.1, 0), []);
  const stoneMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#a29c92', roughness: 1, flatShading: true }), []);
  const disc = useMemo(() => new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2), []);
  const soilMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#76644c', roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), []);
  const leaf = useMemo(() => new THREE.PlaneGeometry(0.11, 0.07).rotateX(-Math.PI / 2), []);
  const leafMat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), []);
  const puddleMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#33414e', roughness: 0.04, metalness: 0.65, transparent: true, opacity: 0.72, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8 }), []);
  useEffect(
    () => () => {
      for (const d of [blades, bladeMat, stone, stoneMat, disc, soilMat, leaf, leafMat, puddleMat]) d.dispose();
    },
    [blades, bladeMat, stone, stoneMat, disc, soilMat, leaf, leafMat, puddleMat],
  );
  useEffect(() => invalidate(), [plan, invalidate]);

  if (!plan || hidden) return null;
  const o = new THREE.Object3D();
  const put = (mesh: THREE.InstancedMesh, list: Array<[number, number, number, number]>, y: number, vary?: (i: number) => THREE.Color) => {
    list.forEach(([x, z, s, r], i) => {
      o.position.set(x, y, z);
      o.rotation.set(0, r, 0);
      o.scale.set(s, s, s);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      if (vary) mesh.setColorAt(i, vary(i));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };
  const shade = (i: number, base: string, spread: number) => new THREE.Color(base).offsetHSL((((i * 37) % 10) - 5) * 0.004, 0, (((i * 53) % 10) - 5) * spread);
  return (
    <group>
      {plan.tufts.length > 0 && (
        <instancedMesh key={`t${plan.tufts.length}`} args={[blades, bladeMat, plan.tufts.length]} frustumCulled={false} receiveShadow ref={(m) => m && put(m, plan.tufts, -0.004, (i) => shade(i, '#ffffff', 0.025))} />
      )}
      {plan.pebbles.length > 0 && (
        <instancedMesh key={`p${plan.pebbles.length}`} args={[stone, stoneMat, plan.pebbles.length]} frustumCulled={false} castShadow receiveShadow ref={(m) => m && put(m, plan.pebbles, 0.012, (i) => shade(i, '#b8b2a6', 0.03))} />
      )}
      {plan.soil.length > 0 && (
        <instancedMesh key={`s${plan.soil.length}`} args={[disc, soilMat, plan.soil.length]} frustumCulled={false} receiveShadow ref={(m) => m && put(m, plan.soil, 0.0, undefined)} />
      )}
      {plan.leaves.length > 0 && (
        <instancedMesh
          key={`l${plan.leaves.length}`}
          args={[leaf, leafMat, plan.leaves.length]}
          frustumCulled={false}
          ref={(m) => {
            if (!m) return;
            plan.leaves.forEach((l, i) => {
              o.position.set(l.x, 0.004, l.z);
              o.rotation.set(0, l.rot, 0);
              o.scale.set(1, 1, 1);
              o.updateMatrix();
              m.setMatrixAt(i, o.matrix);
              m.setColorAt(i, new THREE.Color(l.color));
            });
            m.instanceMatrix.needsUpdate = true;
            if (m.instanceColor) m.instanceColor.needsUpdate = true;
          }}
        />
      )}
      {plan.puddles.length > 0 && (
        <instancedMesh
          key={`w${plan.puddles.length}`}
          args={[disc, puddleMat, plan.puddles.length]}
          frustumCulled={false}
          ref={(m) => {
            if (!m) return;
            plan.puddles.forEach(([x, z, r], i) => {
              o.position.set(x, 0.02, z);
              o.rotation.set(0, 0, 0);
              o.scale.set(r, 1, r * 0.75);
              o.updateMatrix();
              m.setMatrixAt(i, o.matrix);
            });
            m.instanceMatrix.needsUpdate = true;
          }}
        />
      )}
    </group>
  );
}
