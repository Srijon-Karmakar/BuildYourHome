import { lazy, Suspense, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { AdaptiveDpr, Environment, Lightformer, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three/examples/jsm/controls/OrbitControls.js';
import { useStore } from 'zustand';
import { editor, useUi } from '../plan/session';
import { levelRooms } from '../plan/rooms';
import { levelGeometry } from '../plan/wallGeom';
import { WalkControls } from '../walk/WalkControls';
import { BenchmarkRunner } from './BenchmarkRunner';
import { CeilingMesh } from './CeilingMesh';
import { FloorMesh } from './FloorMesh';
import { computeFraming } from './framing';
import { CUT_HEIGHT_M, levelVisibility, type LevelVis } from './floors';
import { ItemMesh } from './furniture/ItemMesh';
import { OpeningMesh } from './OpeningMesh';
import { PerfProbe } from './PerfProbe';
import { RoofMesh } from './RoofMesh';
import { TIERS, type Tier } from './qualityLogic';
import { catalogMaterial } from './placeholderMaterials';
import { useTier } from './qualityStore';
import { WallMesh } from './WallMesh';

// Post-processing (AO) is only downloaded on devices that reach the high tier.
const Effects = lazy(() => import('./Effects'));

/** Orbit target/camera framing for the whole plan. */
function CameraFit() {
  const fitTick = useUi((s) => s.fitTick);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const invalidate = useThree((s) => s.invalidate);
  // Re-frame once the canvas has a real size (the aspect ratio is needed for the fit).
  const sized = useThree((s) => s.size.width > 0 && s.size.height > 0);

  useEffect(() => {
    const { target, distance } = computeFraming(editor.getState().scene, camera);
    const dir = new THREE.Vector3(0.45, 1.0, 0.75).normalize();
    camera.position.copy(target).addScaledVector(dir, distance);
    if (controls) {
      controls.target.copy(target);
      controls.update();
    } else {
      camera.lookAt(target);
    }
    invalidate();
  }, [fitTick, camera, controls, invalidate, sized]);

  return null;
}

/** Which floors are drawn (and whether the current one is cut low), from the Display / floor-switcher settings. */
function useLevelVis(): Record<string, LevelVis> {
  const levels = useStore(editor.store, (s) => s.scene.levels);
  const order = useStore(editor.store, (s) => s.scene.levelOrder);
  const active = useStore(editor.store, (s) => s.activeLevelId);
  const floorView = useUi((s) => s.floorView);
  const cutaway = useUi((s) => s.cutaway);
  const walk = useUi((s) => s.walk);
  return useMemo(
    () => levelVisibility(order.map((id) => levels[id]!), active, floorView, cutaway, walk),
    [levels, order, active, floorView, cutaway, walk],
  );
}

function Walls({ tier }: { tier: Tier }) {
  const vis = useLevelVis();
  const scene = useStore(editor.store, (s) => s.scene);
  const { walls, nodes, openings, levels, levelOrder } = scene;

  // Shared, memoized geometry (also used by the plan view); recomputed only when walls/nodes/openings change.
  const data = useMemo(
    () =>
      levelOrder.map((lid) => ({
        level: levels[lid]!,
        walls: Object.values(walls).filter((w) => w.levelId === lid),
        geom: levelGeometry(scene, lid),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [walls, nodes, openings, levels, levelOrder],
  );
  const bySide = useMemo(() => Object.values(openings), [openings]);

  return (
    <>
      {data.flatMap(({ level, walls: lw, geom }) =>
        vis[level.id]?.visible === false
          ? []
          : lw.map((w) => {
              const fp = geom.footprints[w.id];
              return fp ? (
                <WallMesh
                  key={w.id}
                  wall={w}
                  fp={fp}
                  cuts={geom.cuts[w.id] ?? []}
                  elevation={level.elevation}
                  tier={tier}
                  maxHeight={vis[level.id]?.cut ? CUT_HEIGHT_M : undefined}
                />
              ) : null;
            }),
      )}
      {bySide.map((o) => {
        const w = walls[o.wallId];
        const level = w && levels[w.levelId];
        const fp = w && data.find((d) => d.level.id === w.levelId)?.geom.footprints[w.id];
        const v = w && vis[w.levelId];
        // Fixtures are hidden on floors that are not drawn and on a cut floor (they would float above the cut walls).
        return fp && level && v && v.visible && !v.cut ? <OpeningMesh key={o.id} opening={o} fp={fp} elevation={level.elevation} /> : null;
      })}
    </>
  );
}

function Floors({ tier }: { tier: Tier }) {
  const scene = useStore(editor.store, (s) => s.scene);
  const vis = useLevelVis();
  return (
    <>
      {scene.levelOrder.flatMap((lid) =>
        (vis[lid]?.visible === false ? [] : levelRooms(scene, lid)).map((r, i) => (
          <FloorMesh
            key={`${lid}:${r.room?.id ?? i}`}
            polygon={r.polygon}
            elevation={scene.levels[lid]!.elevation}
            materialId={r.room?.floorMaterial.id ?? 'floor-wood-oak'}
            tier={tier}
          />
        )),
      )}
    </>
  );
}

/** Furniture on every drawn floor (also on a cut floor, so you can see how rooms are furnished from above). */
function Items() {
  const items = useStore(editor.store, (s) => s.scene.items);
  const levels = useStore(editor.store, (s) => s.scene.levels);
  const vis = useLevelVis();
  return (
    <>
      {Object.values(items).map((it) => {
        const level = levels[it.levelId];
        return level && vis[it.levelId]?.visible ? <ItemMesh key={it.id} item={it} elevation={level.elevation} /> : null;
      })}
    </>
  );
}

/** Roofs: hidden when the floor is not drawn, when it is cut (cutaway) or when the user turned roofs off. */
function Roofs({ tier }: { tier: Tier }) {
  const scene = useStore(editor.store, (s) => s.scene);
  const vis = useLevelVis();
  const showRoof = useUi((s) => s.showRoof);
  if (!showRoof) return null;
  return (
    <>
      {Object.values(scene.roofs).map((r) => {
        const level = scene.levels[r.levelId];
        const v = vis[r.levelId];
        return level && v?.visible && !v.cut ? <RoofMesh key={r.id} roof={r} level={level} scene={scene} tier={tier} /> : null;
      })}
    </>
  );
}

/** Ceilings only exist while walking: from above they would hide the plan. */
function Ceilings({ tier }: { tier: Tier }) {
  const scene = useStore(editor.store, (s) => s.scene);
  const vis = useLevelVis();
  return (
    <>
      {scene.levelOrder.flatMap((lid) => {
        const level = scene.levels[lid]!;
        if (vis[lid]?.visible === false) return [];
        return levelRooms(scene, lid)
          .filter((r) => r.room?.hasCeiling !== false)
          .map((r, i) => (
            <CeilingMesh
              key={`${lid}:${r.room?.id ?? i}`}
              polygon={r.polygon}
              y={level.elevation + level.height}
              materialId={r.room?.ceilingMaterial?.id ?? 'paint-white'}
              tier={tier}
            />
          ));
      })}
    </>
  );
}

/**
 * Light without any downloaded HDRI: a procedural "studio" environment (soft boxes) for image-based lighting,
 * plus one shadow-casting sun. Everything is deterministic and works offline.
 */
function Lighting({ tier }: { tier: Tier }) {
  const cfg = TIERS[tier];
  return (
    <>
      <Environment resolution={cfg.envResolution} background={false} environmentIntensity={0.7}>
        <color attach="background" args={['#c9c4b9']} />
        <Lightformer form="rect" intensity={2.4} position={[0, 7, 0]} rotation-x={Math.PI / 2} scale={[24, 24, 1]} />
        <Lightformer form="rect" intensity={1.4} position={[-9, 3, 0]} rotation-y={Math.PI / 2} scale={[12, 6, 1]} />
        <Lightformer form="rect" intensity={1.0} position={[9, 3, 5]} rotation-y={-Math.PI / 2} scale={[12, 6, 1]} />
        <Lightformer form="rect" intensity={0.7} position={[0, 3, -9]} scale={[14, 6, 1]} />
      </Environment>
      {/* Keyed by shadow-map size: three can't resize an existing shadow map in place. */}
      <directionalLight
        key={`${cfg.shadows}-${cfg.shadowMapSize}`}
        position={[10, 16, 6]}
        intensity={1.3}
        castShadow={cfg.shadows}
        shadow-mapSize={[cfg.shadowMapSize, cfg.shadowMapSize]}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
    </>
  );
}

/** The surface around the house (grass, sand, paving…), chosen in the Home menu. */
function Ground({ tier }: { tier: Tier }) {
  const id = useStore(editor.store, (s) => s.scene.terrain.groundMaterial.id);
  const plot = useStore(editor.store, (s) => s.scene.plot?.boundary);
  const m = catalogMaterial(id);
  if (plot && plot.length >= 3) {
    // The chosen ground covers only the plot; everything around it is a neutral verge.
    return (
      <>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} receiveShadow>
          <planeGeometry args={[300, 300]} />
          <meshStandardMaterial color="#cfccc4" roughness={1} />
        </mesh>
        <FloorMesh polygon={plot} elevation={-0.012} materialId={id} tier={tier} />
      </>
    );
  }
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]} receiveShadow>
      <planeGeometry args={[300, 300]} />
      <meshStandardMaterial color={m.color} roughness={m.roughness} />
    </mesh>
  );
}

export function Scene3D() {
  const walk = useUi((s) => s.walk);
  const tier = useTier();
  const cfg = TIERS[tier];
  return (
    <Canvas
      shadows="soft"
      frameloop="demand"
      dpr={cfg.dpr}
      // Progressive rendering: while the user orbits, R3F "regresses" performance (DPR drops via AdaptiveDpr)
      // and restores full quality ~180 ms after the last movement.
      performance={{ min: 0.6, max: 1, debounce: 180 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ position: [8, 7, 10], fov: 50, near: 0.1, far: 500 }}
    >
      <color attach="background" args={['#e6e4e0']} />
      <Lighting tier={tier} />
      <Ground tier={tier} />
      <Floors tier={tier} />
      <Walls tier={tier} />
      <Items />
      <Roofs tier={tier} />
      {walk && <Ceilings tier={tier} />}
      {walk ? (
        <WalkControls />
      ) : (
        <>
          <OrbitControls makeDefault regress maxPolarAngle={Math.PI / 2 - 0.02} enableDamping={false} />
          <CameraFit />
        </>
      )}
      <AdaptiveDpr pixelated={false} />
      {cfg.ao && (
        <Suspense fallback={null}>
          <Effects msaa={cfg.msaa} />
        </Suspense>
      )}
      <PerfProbe />
      <BenchmarkRunner />
    </Canvas>
  );
}
