import { lazy, Suspense, useEffect, useMemo, useRef, type ComponentType } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { AdaptiveDpr, Environment, Lightformer, OrbitControls, Sky } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three/examples/jsm/controls/OrbitControls.js';
import { useStore } from 'zustand';
import { stairOpenings } from '@hd/editor-core';
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
import { registerCapture } from '../export/capture3d';
import { setTextureRedraw } from './photoTextures';
import { lampLevel, lampsOf, nearestLamps } from './lights';
import { setLampGlow } from './furniture/kit';
import { moonDirection, sunAt } from './sun';
import { itemLayer } from './layers';
import { registerCamera } from './cameraBridge';
import NightSky from './NightSky';
import { setWindowGlow } from './OpeningMesh';
import { canPick, CLICK_SLOP_PX, pickObject } from './pick';
import { RoofMesh } from './RoofMesh';
import { BalconyMesh } from './BalconyMesh';
import { zonePolygon } from '@hd/editor-core';
import { StairMesh } from './StairMesh';
import { TIERS, type Tier } from './qualityLogic';
import { useTier } from './qualityStore';
import { WallMesh } from './WallMesh';

// Post-processing (AO) is only downloaded on devices that reach the high tier.
// If the effects code cannot be fetched (no connection and not stored yet) the scene simply draws without them.
type EffectsProps = { msaa: number; quality: 'performance' | 'medium'; bloom: boolean };
const Effects = lazy<ComponentType<EffectsProps>>(() => import('./Effects').catch(() => ({ default: () => null })));

/** Lets Home › Export take a high-resolution picture of this canvas. */
function CaptureBridge() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(
    () =>
      registerCapture(async () => {
        const el = gl.domElement;
        const prev = gl.getPixelRatio();
        const k = Math.max(1, Math.min(2.5, 4096 / Math.max(el.width, el.height)));
        gl.setPixelRatio(prev * k);
        gl.render(scene, camera); // the picture is drawn without the screen-space AO pass; everything else is the same
        const blob = await new Promise<Blob | null>((res) => el.toBlob(res, 'image/png'));
        gl.setPixelRatio(prev);
        invalidate();
        return blob;
      }),
    [gl, scene, camera, invalidate],
  );
  return null;
}

/**
 * Lamps. Their shades glow with the lamp level (all tiers, free); on Medium / High a small pool of real point lights
 * is moved onto the lamps nearest the camera. The pool never changes size, so no shaders are rebuilt while you edit.
 */
function InteriorLights({ tier }: { tier: Tier }) {
  // Phones keep the number of real lights low: every light is paid for on every pixel of every frame.
  const nPoint = COARSE_POINTER ? Math.min(TIERS[tier].lamps, 2) : TIERS[tier].lamps;
  const nSpot = COARSE_POINTER ? Math.min(TIERS[tier].spots, 2) : TIERS[tier].spots;
  const hour = useStore(editor.store, (s) => s.scene.lighting.timeOfDay);
  const items = useStore(editor.store, (s) => s.scene.items);
  const mode = useUi((s) => s.lights);
  const invalidate = useThree((s) => s.invalidate);
  const level = lampLevel(mode, sunAt(hour));
  const lamps = useMemo(() => lampsOf(editor.getState().scene), [items]); // eslint-disable-line react-hooks/exhaustive-deps
  const points = useRef<Array<THREE.PointLight | null>>([]);
  const spots = useRef<Array<THREE.SpotLight | null>>([]);
  const targets = useRef<Array<THREE.Object3D | null>>([]);

  useEffect(() => {
    setLampGlow(level);
    setWindowGlow(level);
    invalidate();
  }, [level, invalidate]);

  useFrame(({ camera }) => {
    const p: [number, number, number] = [camera.position.x, camera.position.y, camera.position.z];
    const on = level > 0.02;
    const nearPoint = on ? nearestLamps(lamps, p, nPoint, 'point') : [];
    points.current.forEach((light, i) => {
      if (!light) return;
      const lamp = nearPoint[i];
      if (lamp) {
        light.position.set(...lamp.pos);
        light.color.set(lamp.color);
        light.intensity = lamp.power * 0.75 * level;
      } else light.intensity = 0;
    });
    const nearSpot = on ? nearestLamps(lamps, p, nSpot, 'spot') : [];
    spots.current.forEach((light, i) => {
      if (!light) return;
      const lamp = nearSpot[i];
      if (lamp) {
        light.position.set(...lamp.pos);
        light.color.set(lamp.color);
        light.angle = lamp.angle;
        light.penumbra = lamp.penumbra;
        light.intensity = lamp.power * 1.1 * level;
        targets.current[i]?.position.set(...lamp.dir); // the target is a child of the light: a direction is enough
      } else light.intensity = 0;
    });
  });

  return (
    <>
      {Array.from({ length: nPoint }, (_, i) => (
        <pointLight key={`p${i}`} ref={(l) => { points.current[i] = l; }} color="#ffd9a0" intensity={0} distance={9} decay={2} />
      ))}
      {Array.from({ length: nSpot }, (_, i) => (
        <spotLight key={`s${i}`} ref={(l) => { spots.current[i] = l; }} color="#ffe8c8" intensity={0} distance={10} decay={2} angle={0.7} penumbra={0.6}>
          <object3D ref={(o) => { targets.current[i] = o; }} attach="target" position={[0, -1, 0]} />
        </spotLight>
      ))}
    </>
  );
}

/** Photo textures arrive after first paint; the demand-driven canvas needs a nudge to show them. */
function TextureRedraw() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    setTextureRedraw(invalidate);
    return () => setTextureRedraw(() => {});
  }, [invalidate]);
  return null;
}

/** Orbit target/camera framing for the whole plan. */
function CameraFit() {
  const fitTick = useUi((s) => s.fitTick);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const invalidate = useThree((s) => s.invalidate);
  // Re-frame once the canvas has a real size (the aspect ratio is needed for the fit).
  const sized = useThree((s) => s.size.width > 0 && s.size.height > 0);

  // Test hook (dev builds only): where a world point appears on the page, so the browser tests can click 3D objects.
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const hd = (window as unknown as { __hd?: Record<string, unknown> }).__hd;
    if (!hd) return;
    hd.project = (x: number, y: number, z: number): [number, number] => {
      camera.updateMatrixWorld();
      const v = new THREE.Vector3(x, y, z).project(camera);
      const r = gl.domElement.getBoundingClientRect();
      return [r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height];
    };
    return () => {
      delete hd.project;
    };
  }, [camera, gl]);

  // Saved views: let the Views panel read the camera and fly it somewhere (a short eased move).
  useEffect(() => {
    let raf = 0;
    return registerCamera({
      get: () => ({
        position: camera.position.toArray() as [number, number, number],
        target: (controls ? controls.target : new THREE.Vector3()).toArray() as [number, number, number],
        fov: camera.fov,
      }),
      fly: (to) => {
        cancelAnimationFrame(raf);
        const p0 = camera.position.clone();
        const t0 = controls ? controls.target.clone() : new THREE.Vector3();
        const p1 = new THREE.Vector3(...to.position);
        const t1 = new THREE.Vector3(...to.target);
        const start = performance.now();
        const step = (now: number) => {
          const k = Math.min(1, (now - start) / 650);
          const e = k * k * (3 - 2 * k);
          camera.position.lerpVectors(p0, p1, e);
          if (controls) {
            controls.target.lerpVectors(t0, t1, e);
            controls.update();
          } else camera.lookAt(new THREE.Vector3().lerpVectors(t0, t1, e));
          invalidate();
          if (k < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      },
    });
  }, [camera, controls, invalidate]);

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
  const hidden = useUi((st) => st.hiddenLayers);

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
        vis[level.id]?.visible === false || hidden.walls
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
      {(hidden.openings ? [] : bySide).map((o) => {
        const w = walls[o.wallId];
        const level = w && levels[w.levelId];
        const fp = w && data.find((d) => d.level.id === w.levelId)?.geom.footprints[w.id];
        const v = w && vis[w.levelId];
        // Fixtures are hidden on floors that are not drawn and on a cut floor (they would float above the cut walls).
        return fp && level && v && v.visible && !v.cut ? <OpeningMesh key={o.id} opening={o} fp={fp} elevation={level.elevation} levelId={w.levelId} /> : null;
      })}
    </>
  );
}

function Floors({ tier }: { tier: Tier }) {
  const scene = useStore(editor.store, (s) => s.scene);
  const vis = useLevelVis();
  if (useUi((st) => st.hiddenLayers.floors)) return null;
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
            holes={stairOpenings(scene, lid, 'floor', r.polygon)}
            roomId={r.room?.id}
            levelId={lid}
          />
        )),
      )}
    </>
  );
}

/** Stairs are drawn when the floor they start on is drawn. */
function Stairs({ tier }: { tier: Tier }) {
  const scene = useStore(editor.store, (s) => s.scene);
  const vis = useLevelVis();
  if (useUi((st) => st.hiddenLayers.stairs)) return null;
  return (
    <>
      {Object.values(scene.stairs).map((s) => (vis[s.fromLevel]?.visible ? <StairMesh key={s.id} stair={s} scene={scene} tier={tier} /> : null))}
    </>
  );
}

/** Garden surfaces (lawn, paving, driveway, paths) lie just above the ground. */
function Zones({ tier }: { tier: Tier }) {
  const zones = useStore(editor.store, (s) => s.scene.zones);
  if (useUi((st) => st.hiddenLayers.garden)) return null;
  return (
    <>
      {Object.values(zones).map((z, i) => (
        <FloorMesh key={z.id} polygon={zonePolygon(z)} elevation={-0.0025 + Math.min(i, 12) * 0.0004} materialId={z.material.id} tier={tier} roomId={z.id} layer={i + 1} />
      ))}
    </>
  );
}

/** Balconies and porches are drawn with the floor they are attached to. */
function Balconies({ tier }: { tier: Tier }) {
  const scene = useStore(editor.store, (s) => s.scene);
  const vis = useLevelVis();
  if (useUi((st) => st.hiddenLayers.balconies)) return null;
  return (
    <>
      {Object.values(scene.balconies).map((b) => {
        const level = scene.levels[b.levelId];
        return level && vis[b.levelId]?.visible ? <BalconyMesh key={b.id} balcony={b} scene={scene} elevation={level.elevation} tier={tier} /> : null;
      })}
    </>
  );
}

/** Furniture on every drawn floor (also on a cut floor, so you can see how rooms are furnished from above). */
function Items() {
  const items = useStore(editor.store, (s) => s.scene.items);
  const levels = useStore(editor.store, (s) => s.scene.levels);
  const vis = useLevelVis();
  const hidden = useUi((st) => st.hiddenLayers);
  return (
    <>
      {Object.values(items).map((it) => {
        const level = levels[it.levelId];
        if (hidden[itemLayer(it.assetId, it.tag)]) return null;
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
              holes={stairOpenings(scene, lid, 'ceiling', r.polygon)}
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
  const hour = useStore(editor.store, (s) => s.scene.lighting.timeOfDay);
  const sun = useMemo(() => sunAt(hour), [hour]);
  const invalidate = useThree((s) => s.invalidate);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    // Flat background (Low tier, and behind the sky); the sky shader draws over it on Medium / High.
    scene.background = new THREE.Color(sun.background);
    // A little night haze: far things sink into the dark blue instead of ending in a hard edge.
    scene.fog = sun.darkness > 0.05 ? new THREE.FogExp2(new THREE.Color('#0c1426'), 0.011 * sun.darkness) : null;
    invalidate();
  }, [sun, scene, invalidate]);
  const moon = useMemo(() => moonDirection(sun.hour), [sun.hour]);
  return (
    <>
      {cfg.sky && sun.darkness < 1 && (
        <Sky
          distance={450}
          sunPosition={sun.dir.map((v) => v * 100) as [number, number, number]}
          turbidity={sun.night ? 20 : 6}
          rayleigh={sun.night ? 0.05 : 1.6}
          mieCoefficient={0.004}
          mieDirectionalG={0.85}
        />
      )}
      <Environment resolution={cfg.envResolution} background={false} environmentIntensity={sun.env}>
        <color attach="background" args={['#c9c4b9']} />
        <Lightformer form="rect" intensity={2.4} position={[0, 7, 0]} rotation-x={Math.PI / 2} scale={[24, 24, 1]} />
        <Lightformer form="rect" intensity={1.4} position={[-9, 3, 0]} rotation-y={Math.PI / 2} scale={[12, 6, 1]} />
        <Lightformer form="rect" intensity={1.0} position={[9, 3, 5]} rotation-y={-Math.PI / 2} scale={[12, 6, 1]} />
        <Lightformer form="rect" intensity={0.7} position={[0, 3, -9]} scale={[14, 6, 1]} />
      </Environment>
      {cfg.sky && <NightSky sun={sun} />}
      {/* Moonlight: a cool, soft light from where the moon is (stronger the darker it is). */}
      {sun.night && <directionalLight position={moon.map((v) => v * 20) as [number, number, number]} intensity={0.08 + 0.22 * sun.darkness} color="#a9bcff" />}
      {/* Keyed by shadow-map size: three can't resize an existing shadow map in place. */}
      <directionalLight
        key={`${cfg.shadows}-${cfg.shadowMapSize}`}
        position={sun.dir.map((v) => v * 22) as [number, number, number]}
        intensity={sun.intensity}
        color={sun.color}
        castShadow={cfg.shadows && sun.intensity > 0.02}
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

/** Phones keep Medium free of post-processing (the 60 fps rule); desktops get the light AO pass. */
const COARSE_POINTER = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

const BIG_GROUND: [number, number][] = [[-150, -150], [150, -150], [150, 150], [-150, 150]];

/** The surface around the house (grass, sand, paving…), chosen in the Home menu. */
function Ground({ tier }: { tier: Tier }) {
  const id = useStore(editor.store, (s) => s.scene.terrain.groundMaterial.id);
  const plot = useStore(editor.store, (s) => s.scene.plot?.boundary);
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
  return <FloorMesh polygon={BIG_GROUND} elevation={-0.004} materialId={id} tier={tier} />;
}

/** Where the last pointer press happened (to tell a click from an orbit drag). */
const downAt = { x: 0, y: 0 };
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', (e) => {
    downAt.x = e.clientX;
    downAt.y = e.clientY;
  }, true);
}

/**
 * The sun's shadow map is only redrawn when something that casts a shadow changes (an edit, the time of day, a layer,
 * the active floor), not on every frame. While walking or orbiting the shadows are then free, which is the biggest
 * single saving on phones (the whole scene used to be drawn a second time every frame just for the shadow map).
 */
function ShadowGate({ tier }: { tier: Tier }) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const scene = useStore(editor.store, (s) => s.scene);
  const active = useStore(editor.store, (s) => s.activeLevelId);
  const hidden = useUi((s) => s.hiddenLayers);
  const showRoof = useUi((s) => s.showRoof);
  const floorView = useUi((s) => s.floorView);
  const cutaway = useUi((s) => s.cutaway);
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    return () => {
      gl.shadowMap.autoUpdate = true;
    };
  }, [gl]);
  useEffect(() => {
    gl.shadowMap.needsUpdate = true;
    invalidate();
  }, [gl, invalidate, scene, active, hidden, showRoof, floorView, cutaway, tier]);
  return null;
}

export function Scene3D() {
  const walk = useUi((s) => s.walk);
  const tier = useTier();
  const cfg = TIERS[tier];
  const hour = useStore(editor.store, (st) => st.scene.lighting.timeOfDay);
  const dim = hour < 7.5 || hour > 16.5; // lamps only read as glowing when the daylight is low
  return (
    <Canvas
      shadows={COARSE_POINTER ? true : 'soft'}
      frameloop="demand"
      dpr={COARSE_POINTER && tier !== 'high' ? [1, Math.min(cfg.dpr[1], 1.25)] : cfg.dpr}
      // Progressive rendering: while the user orbits, R3F "regresses" performance (DPR drops via AdaptiveDpr)
      // and restores full quality ~180 ms after the last movement.
      performance={{ min: 0.6, max: 1, debounce: 180 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ position: [8, 7, 10], fov: 50, near: 0.1, far: 500 }}
      onPointerMissed={(e) => {
        // A click on nothing clears the selection (an orbit drag does not).
        if (!canPick() || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > CLICK_SLOP_PX) return;
        pickObject(null, undefined, e.shiftKey || useUi.getState().additive);
      }}
    >
      <Lighting tier={tier} />
      <ShadowGate tier={tier} />
      <TextureRedraw />
      <InteriorLights tier={tier} />
      <CaptureBridge />
      <Ground tier={tier} />
      <Zones tier={tier} />
      <Floors tier={tier} />
      <Walls tier={tier} />
      <Stairs tier={tier} />
      <Balconies tier={tier} />
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
      {cfg.ao && (tier === 'high' || !COARSE_POINTER) && (
        <Suspense fallback={null}>
          <Effects msaa={cfg.msaa} quality={cfg.aoQuality} bloom={cfg.bloom && dim} />
        </Suspense>
      )}
      <PerfProbe />
      <BenchmarkRunner />
    </Canvas>
  );
}
