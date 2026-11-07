import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useStore } from 'zustand';
import { houseBounds, type ResolvedEnvironment, type Weather } from '@hd/editor-core';
import { editor, useUi } from '../plan/session';
import type { Tier } from './qualityLogic';
import { catalogMaterial } from './placeholderMaterials';
import { mix, type SunState } from './sun';
import { cityAt, groundAt, isFlat, wallAt, type Ring } from './scenery';
import { weatherLook } from './weather';

/**
 * Everything far away and in the air: clouds, hills or a city skyline on the horizon, a few birds, and rain.
 * Built once from fixed random seeds (the same every time), centred on the eye so it never gets closer or farther.
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

const rgb = (hex: string): [number, number, number] => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};

/**
 * A soft round puff (drawn once) that clouds are made of. It is an alpha map (white in the middle, fading to black) and
 * the colour is plain white, so the edges never go grey the way a transparent texture's do.
 */
function puffTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  if (!g) return null;
  g.fillStyle = '#000';
  g.fillRect(0, 0, 128, 128);
  const grad = g.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, '#fff');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.92)');
  grad.addColorStop(0.8, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/** How much of the day's colour a far thing keeps: dark at night, warm near sunset. */
function tint(sun: SunState): THREE.Color {
  const low = sun.elevationDeg < 20 && !sun.night ? 1 - sun.elevationDeg / 20 : 0;
  const dayColor = mix('#ffffff', '#ffd6b0', low * 0.7);
  return new THREE.Color(mix(dayColor, '#252d48', Math.min(1, sun.darkness * 0.92)));
}

// ---- clouds ------------------------------------------------------------------------------------------------------

function Clouds({ count, color, sun }: { count: number; color: string; sun: SunState }) {
  const invalidate = useThree((s) => s.invalidate);
  const map = useMemo(() => puffTexture(), []);
  const geometry = useMemo(() => {
    const rnd = stream(4242);
    const pos: number[] = [];
    const col: number[] = [];
    const hi = rgb('#ffffff');
    const lo = rgb('#e6ebf1'); // the underside of a cloud
    for (let i = 0; i < count; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 80 + rnd() * 250;
      const cx = Math.cos(a) * r;
      const cz = Math.sin(a) * r;
      const cy = 70 + rnd() * 50;
      const dir = rnd() * Math.PI;
      const puffs = 9 + Math.floor(rnd() * 5);
      for (let k = 0; k < puffs; k++) {
        const along = (k / (puffs - 1) - 0.5) * (70 + rnd() * 50);
        // a flat bottom and a domed top: the middle puffs ride higher
        const dy = rnd() * 5 + (1 - Math.abs(k / (puffs - 1) - 0.5) * 2) * 7;
        const dz = (rnd() - 0.5) * 14;
        pos.push(cx + Math.cos(dir) * along - Math.sin(dir) * dz, cy + dy, cz + Math.sin(dir) * along + Math.cos(dir) * dz);
        const t = Math.min(1, Math.max(0, dy / 11));
        col.push(lo[0] + (hi[0] - lo[0]) * t, lo[1] + (hi[1] - lo[1]) * t, lo[2] + (hi[2] - lo[2]) * t);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return g;
  }, [count]);
  const material = useMemo(() => new THREE.PointsMaterial({ size: 56, sizeAttenuation: true, alphaMap: map, vertexColors: true, transparent: true, depthWrite: false, fog: false, toneMapped: false }), [map]);
  useEffect(() => {
    // Brighter than white: the tone mapping of the post-processing pass would otherwise turn white clouds grey.
    material.color.copy(tint(sun)).multiply(new THREE.Color(color)).multiplyScalar(1.5);
    material.opacity = 0.95 * (1 - sun.darkness);
    invalidate();
  }, [material, sun, color, invalidate]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(
    () => () => {
      material.dispose();
      map?.dispose();
    },
    [material, map],
  );
  if (sun.darkness > 0.97) return null;
  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={-6} />;
}

// ---- horizon -----------------------------------------------------------------------------------------------------

const RING_SEGMENTS = 360;
const FOOT = -8;

/**
 * One wall of scenery round the eye (a ring with four rows of colour: foot, low, high, top). Its height and colour
 * at each angle come from the four sides of the environment blended together (see scenery.ts).
 */
function sceneryRing(env: ResolvedEnvironment, ring: Ring, radius: number): THREE.BufferGeometry | null {
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  let any = false;
  for (let i = 0; i <= RING_SEGMENTS; i++) {
    const a = (i / RING_SEGMENTS) * Math.PI * 2;
    const w = wallAt(env, ring, a);
    if (w.h > 0.5) any = true;
    const h = Math.max(0, w.h);
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    // Slopes that face the light are brighter and the others darker, so ridges read as solid shapes.
    const slope = (wallAt(env, ring, a + 0.012).h - wallAt(env, ring, a - 0.012).h) / (0.024 * radius);
    const shade = 1 - Math.max(-0.2, Math.min(0.2, slope * 0.3));
    // Four rows: foot, then two partway up (the snow line on snowy mountains) and the top.
    const y1 = Math.min(h, w.snowAt);
    const y2 = Math.min(h, w.snowAt + 1.5);
    pos.push(x, FOOT, z, x, y1, z, x, y2, z, x, h, z);
    w.colors.forEach((c, r) => {
      const k = r === 0 ? 1 : shade;
      col.push(Math.min(1, c[0] * k), Math.min(1, c[1] * k), Math.min(1, c[2] * k));
    });
    if (i < RING_SEGMENTS) {
      const r0 = i * 4;
      const r1 = (i + 1) * 4;
      for (let k = 0; k < 3; k++) idx.push(r0 + k, r0 + k + 1, r1 + k, r0 + k + 1, r1 + k + 1, r1 + k);
    }
  }
  if (!any) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

/** Hills, mountains, woodland and dunes on the horizon, as far and near walls, plus the land beyond the plot. */
function Relief({ env, sun, key3 }: { env: ResolvedEnvironment; sun: SunState; key3: string }) {
  const invalidate = useThree((s) => s.invalidate);
  const far = useMemo(() => sceneryRing(env, 'far', 330), [key3]); // eslint-disable-line react-hooks/exhaustive-deps
  const near = useMemo(() => sceneryRing(env, 'near', 255), [key3]); // eslint-disable-line react-hooks/exhaustive-deps
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: true }), []);
  useEffect(() => {
    mat.color.copy(tint(sun));
    invalidate();
  }, [mat, sun, invalidate]);
  useEffect(() => () => far?.dispose(), [far]);
  useEffect(() => () => near?.dispose(), [near]);
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <>
      {far && <mesh geometry={far} material={mat} frustumCulled={false} renderOrder={-5} />}
      {near && <mesh geometry={near} material={mat} frustumCulled={false} renderOrder={-4} />}
    </>
  );
}

/** Buildings on the horizon wherever a side is a city; lit windows show at night. */
function Skyline({ env, sun, key3 }: { env: ResolvedEnvironment; sun: SunState; key3: string }) {
  const invalidate = useThree((s) => s.invalidate);
  const { matrices, colors, windows } = useMemo(() => {
    const rnd = stream(777);
    const dummy = new THREE.Object3D();
    const matrices: THREE.Matrix4[] = [];
    const colors: THREE.Color[] = [];
    const win: number[] = [];
    const SLOTS = 150;
    for (let i = 0; i < SLOTS; i++) {
      const a = ((i + rnd() * 0.6) / SLOTS) * Math.PI * 2;
      const R = 255 + rnd() * 16;
      const w = 9 + rnd() * 17;
      const d = 10 + rnd() * 6;
      const tall = rnd() < 0.14;
      const base = tall ? 55 + rnd() * 35 : 12 + rnd() * 34;
      const shade = 0.55 + rnd() * 0.3;
      const spots = Array.from({ length: 5 + Math.floor(rnd() * 14) }, () => [rnd(), rnd()] as const);
      const city = cityAt(env, a);
      if (city.amount < 0.45) continue; // not a city on this side
      const h = base * city.height * (0.5 + 0.5 * Math.min(1, (city.amount - 0.45) / 0.4));
      dummy.position.set(Math.cos(a) * R, 0, Math.sin(a) * R);
      dummy.rotation.set(0, -a + Math.PI / 2, 0);
      dummy.scale.set(w, h, d);
      dummy.updateMatrix();
      matrices.push(dummy.matrix.clone());
      colors.push(new THREE.Color(shade * 0.78, shade * 0.84, shade * 0.92));
      // lit windows on the side that faces the viewer (toward the centre)
      for (const [u, v] of spots) {
        const lx = (u - 0.5) * (w - 2);
        const ly = 2 + v * Math.max(1, h - 4);
        const p = new THREE.Vector3(lx, ly, -d / 2 - 0.2).applyMatrix4(new THREE.Matrix4().makeRotationY(-a + Math.PI / 2)).add(new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R));
        win.push(p.x, p.y, p.z);
      }
    }
    return { matrices, colors, windows: new Float32Array(win) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key3]);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ fog: true }), []);
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), []);
  const winGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(windows, 3));
    return g;
  }, [windows]);
  const winMat = useMemo(() => new THREE.PointsMaterial({ color: '#ffd88a', size: 2.4, sizeAttenuation: false, transparent: true, depthWrite: false, fog: false }), []);
  useEffect(() => {
    mat.color.copy(tint(sun));
    winMat.opacity = Math.max(0, (sun.darkness - 0.25) / 0.75);
    invalidate();
  }, [mat, winMat, sun, invalidate]);
  useEffect(
    () => () => {
      mat.dispose();
      box.dispose();
      winGeo.dispose();
      winMat.dispose();
    },
    [mat, box, winGeo, winMat],
  );
  if (matrices.length === 0) return null;
  return (
    <>
      <instancedMesh
        key={matrices.length}
        args={[undefined, undefined, matrices.length]}
        material={mat}
        frustumCulled={false}
        renderOrder={-4}
        ref={(m) => {
          if (!m) return;
          matrices.forEach((mx, i) => {
            m.setMatrixAt(i, mx);
            m.setColorAt(i, colors[i]!);
          });
          m.instanceMatrix.needsUpdate = true;
          if (m.instanceColor) m.instanceColor.needsUpdate = true;
        }}
      >
        <primitive object={box} attach="geometry" />
      </instancedMesh>
      <points geometry={winGeo} material={winMat} frustumCulled={false} renderOrder={-3} />
    </>
  );
}

/** Flat ground from the edge of the scene out to the horizon, tinted by what lies that way (water, sand, woods, paving). */
function FarGround({ env, key3 }: { env: ResolvedEnvironment; key3: string }) {
  const invalidate = useThree((s) => s.invalidate);
  const ground = useStore(editor.store, (s) => s.scene.terrain.groundMaterial.id);
  const hasPlot = useStore(editor.store, (s) => !!s.scene.plot);
  // The same colour as the ground just inside it (the plain verge around a plot, or the chosen ground), so there is no seam.
  const base = hasPlot ? '#cfccc4' : catalogMaterial(ground).color;
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, vertexColors: true, side: THREE.DoubleSide }), []);
  const geometry = useMemo(() => {
    const c = new THREE.Color(base);
    const k = hasPlot ? 0.67 : 0.62; // the lit, flat ring reads lighter than the textured ground inside it
    const b: [number, number, number] = [c.r * k, c.g * k, c.b * k];
    const radii = [88, 122, 345];
    const N = 120;
    const pos: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      const raw = groundAt(env, a, [c.r, c.g, c.b]);
      const target: [number, number, number] = [raw[0] * k, raw[1] * k, raw[2] * k];
      // The first band eases from the home's ground into the colour of that side.
      radii.forEach((r, k) => {
        pos.push(Math.cos(a) * r, 0, Math.sin(a) * r);
        const t = k === 0 ? 0 : 1;
        col.push(b[0] + (target[0] - b[0]) * t, b[1] + (target[1] - b[1]) * t, b[2] + (target[2] - b[2]) * t);
      });
      if (i < N) {
        for (let k = 0; k < 2; k++) {
          const v00 = i * 3 + k;
          const v10 = (i + 1) * 3 + k;
          idx.push(v00, v10, v00 + 1, v10, v10 + 1, v00 + 1); // facing up
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key3, base, hasPlot]);
  useEffect(() => invalidate(), [geometry, invalidate]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => mat.dispose(), [mat]);
  return <mesh geometry={geometry} material={mat} position={[0, -0.06, 0]} frustumCulled={false} renderOrder={-7} />;
}

// ---- birds -------------------------------------------------------------------------------------------------------

function Birds({ sun }: { sun: SunState }) {
  const invalidate = useThree((s) => s.invalidate);
  const geometry = useMemo(() => {
    const rnd = stream(99);
    const pos: number[] = [];
    for (let i = 0; i < 9; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 45 + rnd() * 90;
      const c = new THREE.Vector3(Math.cos(a) * r, 34 + rnd() * 26, Math.sin(a) * r);
      const yaw = rnd() * Math.PI * 2;
      const s = 1.4 + rnd() * 0.8;
      const wing = (side: number): THREE.Vector3 => new THREE.Vector3(side * 2 * s, 0.7 * s, 0.3 * s).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).add(c);
      const l = wing(-1);
      const r2 = wing(1);
      pos.push(l.x, l.y, l.z, c.x, c.y, c.z, c.x, c.y, c.z, r2.x, r2.y, r2.z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return g;
  }, []);
  const mat = useMemo(() => new THREE.LineBasicMaterial({ color: '#2b2a28', transparent: true, fog: false }), []);
  useEffect(() => {
    mat.opacity = 0.85 * (1 - sun.darkness);
    invalidate();
  }, [mat, sun, invalidate]);
  useEffect(
    () => () => {
      geometry.dispose();
      mat.dispose();
    },
    [geometry, mat],
  );
  if (sun.darkness > 0.6) return null;
  return <lineSegments geometry={geometry} material={mat} frustumCulled={false} />;
}

// ---- rain --------------------------------------------------------------------------------------------------------

const RAIN_BOX = { x: 44, y: 26, z: 44 };

/** Falling rain streaks around the eye. Animated on the GPU; asks for a new frame every frame while it rains. */
function Rain({ count }: { count: number }) {
  const walk = useUi((s) => s.walk);
  const scene = useStore(editor.store, (s) => s.scene);
  const bounds = useMemo(() => houseBounds(scene), [scene]);
  const ref = useRef<THREE.LineSegments>(null);
  const { geometry, material } = useMemo(() => {
    const rnd = stream(31337);
    const pos = new Float32Array(count * 6);
    const end = new Float32Array(count * 2);
    const phase = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const x = (rnd() - 0.5) * RAIN_BOX.x;
      const y = rnd() * RAIN_BOX.y;
      const z = (rnd() - 0.5) * RAIN_BOX.z;
      const ph = rnd() * RAIN_BOX.y;
      pos.set([x, y, z, x, y, z], i * 6);
      end.set([0, 1], i * 2);
      phase.set([ph, ph], i * 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: false,
      uniforms: { uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() } },
      vertexShader: `
        uniform float uTime; uniform vec3 uCenter; attribute float aEnd; attribute float aPhase; varying float vA;
        void main() {
          float y = mod(position.y - uTime * 17.0 - aPhase, ${RAIN_BOX.y.toFixed(1)});
          vec3 p = vec3(position.x + aEnd * 0.1, y + aEnd * 0.9, position.z) + vec3(uCenter.x, uCenter.y - 8.0, uCenter.z);
          vA = 1.0 - aEnd * 0.75;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: 'varying float vA; void main() { gl_FragColor = vec4(0.8, 0.86, 0.94, 0.42 * vA); }',
    });
    return { geometry: g, material: m };
  }, [count]);
  useFrame((state) => {
    const cam = state.camera.position;
    material.uniforms.uTime!.value = state.clock.elapsedTime;
    (material.uniforms.uCenter!.value as THREE.Vector3).copy(cam);
    // No rain falling through the ceiling while you walk about inside the house.
    const inside = !!bounds && walk && cam.x > bounds.min[0] - 0.3 && cam.x < bounds.max[0] + 0.3 && cam.z > bounds.min[1] - 0.3 && cam.z < bounds.max[1] + 0.3;
    if (ref.current) ref.current.visible = !inside;
    state.invalidate();
  });
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  return <lineSegments ref={ref} geometry={geometry} material={material} frustumCulled={false} renderOrder={5} />;
}

// ---- all together ------------------------------------------------------------------------------------------------

export default function Atmosphere({ sun, weather, env, tier }: { sun: SunState; weather: Weather | undefined; env: ResolvedEnvironment; tier: Tier }) {
  const camera = useThree((s) => s.camera);
  const look = weatherLook(weather);
  const ref = useRef<THREE.Group>(null);
  // Distant things stand still relative to the eye: no parallax, so they read as far away.
  useFrame(() => ref.current?.position.set(camera.position.x, 0, camera.position.z));
  // How many clouds: the weather decides unless the environment says otherwise (fog and rain are always an even grey sky).
  const grey = weather === 'fog' || weather === 'rain';
  const clouds = grey ? 0 : env.clouds === 'none' ? 0 : env.clouds === 'few' ? 9 : env.clouds === 'many' ? 44 : look.clouds;
  // The scenery depends only on the four sides, so it is rebuilt only when they change.
  const key3 = JSON.stringify(env.sides);
  const flat = isFlat(env);
  return (
    <group ref={ref} position={[camera.position.x, 0, camera.position.z]}>
      <FarGround env={env} key3={key3} />
      {!flat && <Relief env={env} sun={sun} key3={key3} />}
      {!flat && <Skyline env={env} sun={sun} key3={key3} />}
      {clouds > 0 && <Clouds count={clouds} color={look.cloudColor} sun={sun} />}
      {env.birds && !look.rain && weather !== 'fog' && <Birds sun={sun} />}
      {look.rain && tier !== 'low' && <Rain count={tier === 'high' ? 900 : 450} />}
    </group>
  );
}
