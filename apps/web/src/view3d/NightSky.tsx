import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { moonDirection, type SunState } from './sun';

/** A soft round glow, drawn once (canvas), for the moon. */
function glowTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.18, 'rgba(210,225,255,0.55)');
  grad.addColorStop(1, 'rgba(160,190,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** The moon's disc: bright, with a few soft darker patches. */
function moonTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.beginPath();
  g.arc(64, 64, 58, 0, Math.PI * 2);
  g.closePath();
  g.fillStyle = '#f4f7ff';
  g.fill();
  g.save();
  g.clip();
  for (const [x, y, r, a] of [[46, 50, 14, 0.12], [78, 74, 18, 0.1], [84, 44, 9, 0.12], [52, 88, 10, 0.1], [64, 62, 7, 0.08]] as const) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fillStyle = `rgba(120,135,170,${a})`;
    g.fill();
  }
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const STAR_COUNT = 1500;
const DOME = 420;

/**
 * The night sky: a dark gradient dome, a field of stars and a moon with a soft glow. `sun.darkness` (0 by day, 1 at night,
 * in between at dusk and dawn) fades it in and out. Nothing here changes while the camera moves (the dome follows the eye).
 */
export default function NightSky({ sun }: { sun: SunState }) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const dark = sun.darkness;
  const moon = useMemo(() => moonDirection(sun.hour), [sun.hour]);

  const dome = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      fog: false,
      uniforms: { uOpacity: { value: 1 }, uTop: { value: new THREE.Color('#040814') }, uHorizon: { value: new THREE.Color('#1b2a4a') } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uOpacity; uniform vec3 uTop; uniform vec3 uHorizon; varying vec3 vDir; void main(){ float t = clamp(vDir.y * 1.6, 0.0, 1.0); vec3 c = mix(uHorizon, uTop, pow(t, 0.7)); gl_FragColor = vec4(c, uOpacity); }',
    });
    return m;
  }, []);

  const stars = useMemo(() => {
    const pos = new Float32Array(STAR_COUNT * 3);
    const col = new Float32Array(STAR_COUNT * 3);
    let seed = 12345;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < STAR_COUNT; i++) {
      // Random direction on the upper hemisphere (a little below the horizon is hidden by the ground anyway).
      const y = 0.02 + rnd() * 0.98;
      const r = Math.sqrt(1 - y * y);
      const a = rnd() * Math.PI * 2;
      pos.set([Math.cos(a) * r * (DOME - 5), y * (DOME - 5), Math.sin(a) * r * (DOME - 5)], i * 3);
      const b = 0.45 + rnd() * 0.55;
      const warm = rnd();
      col.set([b * (0.85 + warm * 0.15), b * 0.92, b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, fog: false });
    return { g, m };
  }, []);

  const glow = useMemo(() => glowTexture(), []);
  const disc = useMemo(() => moonTexture(), []);
  const moonMat = useMemo(() => new THREE.SpriteMaterial({ map: disc, transparent: true, depthWrite: false, fog: false, toneMapped: false }), [disc]);
  const ref = useRef<THREE.Group>(null);
  // The sky is centred on the eye so it never gets closer or farther.
  useFrame(() => ref.current?.position.copy(camera.position));
  const glowMat = useMemo(() => new THREE.SpriteMaterial({ map: glow, color: '#b9ccff', transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }), [glow]);

  useEffect(() => {
    dome.uniforms.uOpacity!.value = Math.min(1, dark * 1.15);
    stars.m.opacity = Math.max(0, (dark - 0.35) / 0.65);
    moonMat.opacity = Math.min(1, dark * 1.2);
    glowMat.opacity = Math.min(1, dark * 1.2) * 0.45;
    invalidate();
  }, [dark, dome, stars, moonMat, glowMat, invalidate]);
  useEffect(
    () => () => {
      dome.dispose();
      stars.g.dispose();
      stars.m.dispose();
      moonMat.dispose();
      glowMat.dispose();
      glow?.dispose();
      disc?.dispose();
    },
    [dome, stars, moonMat, glowMat, glow, disc],
  );

  if (dark < 0.02) return null;
  return (
    <group ref={ref} position={camera.position} renderOrder={-10} frustumCulled={false}>
      <mesh material={dome} renderOrder={-10} frustumCulled={false}>
        <sphereGeometry args={[DOME, 24, 16]} />
      </mesh>
      <points geometry={stars.g} material={stars.m} renderOrder={-9} frustumCulled={false} />
      <group position={[moon[0] * (DOME - 10), moon[1] * (DOME - 10), moon[2] * (DOME - 10)]}>
        <sprite material={moonMat} scale={[30, 30, 1]} renderOrder={-8} />
        <sprite material={glowMat} scale={[105, 105, 1]} renderOrder={-9} />
      </group>
    </group>
  );
}
