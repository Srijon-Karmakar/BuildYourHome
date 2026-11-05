import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { Environment, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three/examples/jsm/controls/OrbitControls.js';
import { useStore } from 'zustand';
import { computeFootprints } from '@hd/geometry';
import { editor, useUi } from '../plan/session';
import { levelRooms } from '../plan/rooms';
import { FloorMesh } from './FloorMesh';
import { WalkControls } from '../walk/WalkControls';
import { WallMesh } from './WallMesh';

/** Orbit target/camera framing for the whole plan. */
function CameraFit() {
  const fitTick = useUi((s) => s.fitTick);
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const invalidate = useThree((s) => s.invalidate);
  // Re-frame once the canvas has a real size (the aspect ratio is needed for the fit).
  const sized = useThree((s) => s.size.width > 0 && s.size.height > 0);

  useEffect(() => {
    const sc = editor.getState().scene;
    const nodes = Object.values(sc.nodes);
    let cx = 0, cz = 0, radius = 5;
    const height = Math.max(3, ...Object.values(sc.levels).map((l) => l.elevation + l.height));
    if (nodes.length) {
      let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
      for (const n of nodes) {
        minX = Math.min(minX, n.p[0]); maxX = Math.max(maxX, n.p[0]);
        minZ = Math.min(minZ, n.p[1]); maxZ = Math.max(maxZ, n.p[1]);
      }
      cx = (minX + maxX) / 2;
      cz = (minZ + maxZ) / 2;
      radius = Math.max(4, Math.hypot(maxX - minX, maxZ - minZ, height) / 2);
    }
    // Distance at which the bounding sphere fits both the vertical and horizontal field of view.
    const persp = camera as THREE.PerspectiveCamera;
    const vFov = (persp.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * persp.aspect);
    const dist = (radius / Math.sin(Math.min(vFov, hFov) / 2)) * 1.05;
    const dir = new THREE.Vector3(0.45, 1.0, 0.75).normalize();
    const target = new THREE.Vector3(cx, height * 0.4, cz);
    camera.position.copy(target).addScaledVector(dir, dist);
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

function Walls() {
  const scene = useStore(editor.store, (s) => s.scene);
  const { walls, nodes, levels, levelOrder } = scene;

  // Recomputed when walls/nodes change; Immer structural sharing keeps unchanged inputs stable.
  const data = useMemo(
    () =>
      levelOrder.map((lid) => {
        const lw = Object.values(walls).filter((w) => w.levelId === lid);
        return { level: levels[lid]!, walls: lw, fps: computeFootprints(nodes, lw) };
      }),
    [walls, nodes, levels, levelOrder],
  );

  return (
    <>
      {data.flatMap(({ level, walls: lw, fps }) =>
        lw.map((w) => {
          const fp = fps[w.id];
          return fp ? <WallMesh key={w.id} wall={w} fp={fp} elevation={level.elevation} /> : null;
        }),
      )}
    </>
  );
}

function Floors() {
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
          />
        )),
      )}
    </>
  );
}

export function Scene3D() {
  const walk = useUi((s) => s.walk);
  return (
    <Canvas
      shadows
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ position: [8, 7, 10], fov: 50, near: 0.1, far: 500 }}
    >
      <color attach="background" args={['#e6e4e0']} />
      <Environment preset="apartment" background={false} />
      <hemisphereLight args={['#dfe9f5', '#7d7a70', 0.5]} />
      <directionalLight
        position={[10, 16, 6]}
        intensity={1.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-bias={-0.0004}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]} receiveShadow>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color="#d6d2c8" roughness={1} />
      </mesh>
      <Floors />
      <Walls />
      {walk ? (
        <WalkControls />
      ) : (
        <>
          <OrbitControls makeDefault maxPolarAngle={Math.PI / 2 - 0.02} enableDamping={false} />
          <CameraFit />
        </>
      )}
    </Canvas>
  );
}
