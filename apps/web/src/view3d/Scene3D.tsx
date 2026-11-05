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
import { OpeningMesh } from './OpeningMesh';
import { PerfProbe } from './PerfProbe';
import { TIERS, type Tier } from './qualityLogic';
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

function Walls({ tier }: { tier: Tier }) {
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
        lw.map((w) => {
          const fp = geom.footprints[w.id];
          return fp ? (
            <WallMesh key={w.id} wall={w} fp={fp} cuts={geom.cuts[w.id] ?? []} elevation={level.elevation} tier={tier} />
          ) : null;
        }),
      )}
      {bySide.map((o) => {
        const w = walls[o.wallId];
        const level = w && levels[w.levelId];
        const fp = w && data.find((d) => d.level.id === w.levelId)?.geom.footprints[w.id];
        return fp && level ? <OpeningMesh key={o.id} opening={o} fp={fp} elevation={level.elevation} /> : null;
      })}
    </>
  );
}

function Floors({ tier }: { tier: Tier }) {
  const scene = useStore(editor.store, (s) => s.scene);
  return (
    <>
      {scene.levelOrder.flatMap((lid) =>
        levelRooms(scene, lid).map((r, i) => (
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

/** Ceilings only exist while walking: from above they would hide the plan. */
function Ceilings({ tier }: { tier: Tier }) {
  const scene = useStore(editor.store, (s) => s.scene);
  return (
    <>
      {scene.levelOrder.flatMap((lid) => {
        const level = scene.levels[lid]!;
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
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]} receiveShadow>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color="#d6d2c8" roughness={1} />
      </mesh>
      <Floors tier={tier} />
      <Walls tier={tier} />
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
