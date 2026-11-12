import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Scene, Stair } from '@hd/scene-schema';
import { layoutOf, stairExitBase, stairRailSkip } from '@hd/editor-core';
import { buildStairBody, buildStairExit, buildStairRailing, STAIR_EXIT_SLOTS, type StairBuildOptions, type StairLayout } from '@hd/geometry';
import { Outlines } from '@react-three/drei';
import { makeSurface } from './materials';
import { railGeometry, railMaterialsFor, railOptions } from './railing';
import { pickProps, SELECT_COLOR, useIsSelected } from './pick';
import type { Tier } from './qualityLogic';

export const DEFAULT_FRAME_COLOR = '#2b2b2b';

/** How a stair is built, from what the owner chose (unset fields take the defaults of the geometry package). */
export function buildOptionsOf(stair: Pick<Stair, 'build' | 'steps' | 'stringer'>): Partial<StairBuildOptions> {
  const o: Partial<StairBuildOptions> = { build: stair.build ?? 'solid' };
  if (stair.steps?.thickness !== undefined) o.thickness = stair.steps.thickness;
  if (stair.steps?.nosing !== undefined) o.nosing = stair.steps.nosing;
  if (stair.steps?.risers !== undefined) o.risers = stair.steps.risers;
  if (stair.stringer?.width !== undefined) o.stringerWidth = stair.stringer.width;
  if (stair.stringer?.depth !== undefined) o.stringerDepth = stair.stringer.depth;
  return o;
}

/** A signature of the walls that can touch a stair's rail, so the rail is rebuilt when one moves. */
function wallSignature(scene: Scene, stair: Stair): string {
  const out: string[] = [];
  for (const w of Object.values(scene.walls)) {
    if (w.levelId !== stair.fromLevel && w.levelId !== stair.toLevel) continue;
    const a = scene.nodes[w.a]?.p;
    const b = scene.nodes[w.b]?.p;
    if (a && b) out.push(`${a[0].toFixed(3)},${a[1].toFixed(3)},${b[0].toFixed(3)},${b[1].toFixed(3)},${w.thickness}`);
  }
  return out.join(';');
}

function geometryOf(m: { positions: Float32Array; normals: Float32Array; uvs: Float32Array; indices: Uint32Array; groups: Array<{ slot: string; start: number; count: number }> }): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(m.uvs, 2));
  g.setIndex(new THREE.BufferAttribute(m.indices, 1));
  for (const grp of m.groups) g.addGroup(grp.start, grp.count, grp.slot === 'tread' ? 0 : grp.slot === 'riser' ? 1 : 2);
  return g;
}

/** One stair: steps (solid blocks, or open treads on beams / a spine / floating) from the lower floor up to the last step below the upper floor. Rebuilt only when it changes. */
export function StairMesh({ stair, scene, tier, upperVisible = true }: { stair: Stair; scene: Scene; tier: Tier; /** The floor the stair arrives on is drawn (the guard rail round the opening belongs to it). */ upperVisible?: boolean }) {
  const selected = useIsSelected(stair.id);
  const layout = layoutOf(scene, stair);
  const from = scene.levels[stair.fromLevel];
  const build = stair.build ?? 'solid';
  const key = layout ? `${layout.kind}|${layout.width}|${layout.rise.toFixed(4)}|${stair.mirror ? 1 : 0}|${JSON.stringify([stair.build, stair.steps, stair.stringer])}` : '';

  const geometry = useMemo(() => {
    if (!layout) return null;
    return geometryOf(buildStairBody(layout, buildOptionsOf(stair)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const frameColor = stair.stringer?.color ?? DEFAULT_FRAME_COLOR;
  const riserColor = stair.steps?.riserColor ?? frameColor;
  // tread (the step material), riser, frame (beams, posts, pole)
  const materials = useMemo(
    () => [
      makeSurface(stair.material?.id ?? 'floor-wood-walnut', tier),
      new THREE.MeshStandardMaterial({ color: riserColor, roughness: 0.6, metalness: 0.1 }),
      new THREE.MeshStandardMaterial({ color: frameColor, roughness: 0.4, metalness: 0.65 }),
    ],
    [stair.material?.id, tier, frameColor, riserColor],
  );
  useEffect(() => () => geometry?.dispose(), [geometry]);
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);

  // Handrail, posts and balusters (or glass) on the open sides; left out where a side stands against a wall.
  const railing = stair.railing && stair.railing !== 'none' ? stair.railing : null;
  const flatRoofBelow = Object.values(scene.roofs).some((r) => r.levelId === stair.fromLevel && r.style === 'flat');
  const railKey = JSON.stringify([stair.railing, stair.railingOpts, build, flatRoofBelow]) + '|' + (railing ? wallSignature(scene, stair) : '');
  // An exit (roof room / glass box / hatch) closes the opening itself: no guard rail round it.
  const guardOn = stair.railingOpts?.guard !== false && upperVisible && !stair.exit;
  const rail = useMemo(() => {
    if (!layout || !railing) return null;
    const skip = stairRailSkip(scene, stair);
    const m = buildStairRailing(layout, { ...railOptions(stair), pole: build === 'solid' }, { skip: (a, b, k) => skip(a, b, k), parts: 'flight' });
    return m ? railGeometry(m) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, railKey]);
  const guard = useMemo(() => {
    if (!layout || !railing || !guardOn) return null;
    const skip = stairRailSkip(scene, stair);
    const m = buildStairRailing(layout, { ...railOptions(stair), pole: false }, { skip: (a, b, k) => skip(a, b, k), parts: 'guard' });
    return m ? railGeometry(m) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, railKey, guardOn]);
  const railMaterials = useMemo(
    () => railMaterialsFor(stair.railing, stair.railingOpts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stair.railing, JSON.stringify(stair.railingOpts)],
  );
  useEffect(() => () => rail?.dispose(), [rail]);
  useEffect(() => () => guard?.dispose(), [guard]);
  useEffect(() => () => railMaterials.forEach((m) => m.dispose()), [railMaterials]);

  if (!geometry || !from) return null;
  return (
    <mesh geometry={geometry} material={materials} position={[stair.origin[0], from.elevation, stair.origin[2]]} rotation={[0, stair.rotationY, 0]} castShadow receiveShadow {...pickProps(stair.id, stair.fromLevel)}>
      {selected && <Outlines thickness={0.03} color={SELECT_COLOR} />}
      {rail && <mesh geometry={rail} material={railMaterials} castShadow receiveShadow raycast={() => null} />}
      {guard && <mesh geometry={guard} material={railMaterials} castShadow receiveShadow raycast={() => null} />}
      {stair.exit && upperVisible && layout && <StairExit stair={stair} layout={layout} tier={tier} base={stairExitBase(scene, stair) - from.elevation} />}
    </mesh>
  );
}

export const DEFAULT_EXIT_WALL = '#ece6da';
export const DEFAULT_EXIT_FRAME = '#2b2b2b';
/** A roof room's door and frame default to wood. */
export const DEFAULT_EXIT_DOOR = '#7a5236';
export const defaultExitFrame = (kind: string): string => (kind === 'room' ? DEFAULT_EXIT_DOOR : DEFAULT_EXIT_FRAME);

/** The roof room / glass box / hatch over the top of a stair, in the stair's frame, standing at `base` above its lower floor. */
function StairExit({ stair, layout, tier, base }: { stair: Stair; layout: StairLayout; tier: Tier; base: number }) {
  const exit = stair.exit!;
  const key = `${layout.kind}|${layout.width}|${layout.rise.toFixed(4)}|${stair.mirror ? 1 : 0}|${exit.kind}|${exit.height ?? ''}`;
  const geometry = useMemo(() => {
    const m = buildStairExit(layout, exit.kind, exit.height);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(m.uvs, 2));
    g.setIndex(new THREE.BufferAttribute(m.indices, 1));
    for (const grp of m.groups) g.addGroup(grp.start, grp.count, STAIR_EXIT_SLOTS.indexOf(grp.slot));
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const wall = exit.color ?? DEFAULT_EXIT_WALL;
  const frame = exit.frame ?? defaultExitFrame(exit.kind);
  // wall, roof, frame, glass (STAIR_EXIT_SLOTS order)
  const materials = useMemo(
    () => [
      new THREE.MeshStandardMaterial({ color: wall, roughness: 0.85 }),
      makeSurface('roof-concrete', tier),
      new THREE.MeshStandardMaterial({ color: frame, roughness: 0.4, metalness: 0.6 }),
      new THREE.MeshPhysicalMaterial({ color: '#bcd4e6', transparent: true, opacity: 0.3, roughness: 0.05, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide }),
    ],
    [wall, frame, tier],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);
  return <mesh geometry={geometry} material={materials} position={[0, base, 0]} castShadow receiveShadow raycast={() => null} />;
}
