import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Wall } from '@hd/scene-schema';
import { buildGlazing, buildWallMesh, glazingCuts, glazingRun, GLAZING_FRAMES, WALL_SLOTS, type OpeningCut, type WallFootprint } from '@hd/geometry';
import { Outlines } from '@react-three/drei';
import { makeSurface } from './materials';
import { pickProps, SELECT_COLOR, useIsSelected } from './pick';
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
  const selected = useIsSelected(wall.id);
  const shownHeight = maxHeight === undefined ? wall.height : Math.min(wall.height, maxHeight);
  // Footprint arrays are recomputed per scene change; key on their values so unchanged walls keep their geometry.
  const glazed = wall.glazed;
  // A glass wall: one big cut over the glass run (thin top band, optional upstand); the panes are their own mesh.
  const run = glazed ? glazingRun(fp, shownHeight, glazed.sill ?? 0) : null;
  const wallCuts = run ? glazingCuts(run, cuts) : cuts;
  const key =
    fp.footprint.flat().map((n) => n.toFixed(5)).join(',') + `|${fp.capA}|${fp.capB}|` + wallCuts.map((c) => `${c.offset.toFixed(4)},${c.width.toFixed(4)},${c.height.toFixed(4)},${c.sill.toFixed(4)}`).join(';');

  const geometry = useMemo(() => {
    const m = buildWallMesh(fp, elevation, shownHeight, wallCuts);
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

  return (
    <mesh geometry={geometry} material={materials} castShadow receiveShadow {...pickProps(wall.id, wall.levelId)}>
      {selected && <Outlines thickness={0.03} color={SELECT_COLOR} />}
      {glazed && run && <Glazing wall={wall} fp={fp} cuts={cuts} elevation={elevation} run={run} glazedKey={key} />}
    </mesh>
  );
}

export const DEFAULT_GLAZING_FRAME = '#2b2b2b';
const TINTS: Record<string, { color: string; opacity: number; roughness: number }> = {
  clear: { color: '#cfe0ea', opacity: 0.22, roughness: 0.03 },
  blue: { color: '#8fb4d6', opacity: 0.38, roughness: 0.05 },
  green: { color: '#9cc7b4', opacity: 0.38, roughness: 0.05 },
  smoked: { color: '#4a4f55', opacity: 0.55, roughness: 0.05 },
  frosted: { color: '#eef2f4', opacity: 0.7, roughness: 0.6 },
};

/** Glass panes and mullions of a full glass wall (drawn in world space, so the parent wall's transform must be identity). */
function Glazing({ wall, fp, cuts, elevation, run, glazedKey }: { wall: Wall; fp: WallFootprint; cuts: readonly OpeningCut[]; elevation: number; run: NonNullable<ReturnType<typeof glazingRun>>; glazedKey: string }) {
  const g = wall.glazed!;
  const k = `${glazedKey}|${elevation}|${JSON.stringify([g.pane, g.frame, g.transom, run])}|${cuts.map((c) => `${c.offset},${c.width},${c.sill},${c.height}`).join(';')}`;
  const geometry = useMemo(() => {
    const m = buildGlazing(fp.origin, fp.dir, wall.thickness, elevation, run, { pane: g.pane ?? 1.2, frame: GLAZING_FRAMES[g.frame ?? 'standard'], transom: g.transom ?? 0 }, cuts);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(m.uvs, 2));
    geo.setIndex(new THREE.BufferAttribute(m.indices, 1));
    for (const grp of m.groups) geo.addGroup(grp.start, grp.count, grp.slot === 'frame' ? 0 : 1);
    return geo;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k]);
  const t = TINTS[g.tint ?? 'clear']!;
  const materials = useMemo(
    () => [
      new THREE.MeshStandardMaterial({ color: g.color ?? DEFAULT_GLAZING_FRAME, roughness: 0.4, metalness: 0.6 }),
      new THREE.MeshPhysicalMaterial({ color: t.color, transparent: true, opacity: t.opacity, roughness: t.roughness, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide }),
    ],
    [g.color, t],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);
  return <mesh geometry={geometry} material={materials} castShadow receiveShadow />;
}
