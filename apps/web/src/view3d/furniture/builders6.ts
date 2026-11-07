import * as THREE from 'three';
import { ball, BLACK, box, cyl, GLOW, mat, type Builder } from './kit';

/**
 * Light fittings: recessed downlights, panels, pendants, cove and strip lights, picture lights, desk lamps and bollards.
 * Their glowing parts use emissive materials, so they light up with the "Lamps" switch and glow (bloom) at night.
 * Conventions as the other builders: ceiling items hang below y = 0, wall items are centred on y = 0 and stick out along +z.
 */

const BRASS = () => mat('#c9a47a', 0.4, 0.7);
const WHITE = () => mat('#f2f1ed', 0.45);
const warm = (intensity: number) => mat('#fff1d2', 0.5, 0, { emissive: new THREE.Color('#ffd9a0'), emissiveIntensity: intensity });
const cool = (intensity: number) => mat('#f4f8ff', 0.4, 0, { emissive: new THREE.Color('#dfeaff'), emissiveIntensity: intensity });
const opal = () => mat('#f7f5ef', 0.25, 0, { emissive: new THREE.Color('#ffe3b3'), emissiveIntensity: 0.65, transparent: true, opacity: 0.95 });

/** A flush ring in the ceiling with the bulb face showing. */
const downlight: Builder = ({ w }) => {
  const g = new THREE.Group();
  cyl(g, w / 2, w / 2, 0.012, [0, -0.012, 0], WHITE(), 28);
  cyl(g, w * 0.36, w * 0.36, 0.01, [0, -0.026, 0], GLOW(), 28);
  cyl(g, w * 0.4, w * 0.4, 0.004, [0, -0.03, 0], BLACK(), 28).scale.y = 0.4;
  return g;
};

const ledPanel: Builder = ({ w, d }) => {
  const g = new THREE.Group();
  box(g, [w, 0.02, d], [0, -0.02, 0], WHITE());
  box(g, [w - 0.06, 0.01, d - 0.06], [0, -0.03, 0], cool(0.8));
  return g;
};

const pendantCluster: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  cyl(g, w * 0.16, w * 0.16, 0.025, [0, -0.025, 0], BRASS(), 24);
  const drops = [
    { x: 0, z: 0, len: h * 0.55, r: 0.11 },
    { x: -w * 0.28, z: 0.05, len: h * 0.8, r: 0.095 },
    { x: w * 0.27, z: -0.04, len: h * 0.95, r: 0.105 },
  ];
  for (const p of drops) {
    cyl(g, 0.004, 0.004, p.len, [p.x * 0.6, -p.len - 0.025, p.z * 0.6], BLACK(), 6);
    ball(g, [p.r, p.r * 1.05, p.r], [p.x, -p.len - p.r * 0.7, p.z], opal());
  }
  return g;
};

const pendantLinear: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, 0.03, d * 0.7], [0, -0.03, 0], BLACK());
  for (const x of [-w * 0.4, w * 0.4]) cyl(g, 0.004, 0.004, h - 0.1, [x, -h + 0.08, 0], BLACK(), 6);
  box(g, [w, 0.05, d], [0, -h - 0.02, 0], BLACK());
  box(g, [w - 0.06, 0.012, d - 0.04], [0, -h - 0.04, 0], warm(0.95));
  return g;
};

const pendantGlobe: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  cyl(g, w * 0.08, w * 0.08, 0.02, [0, -0.02, 0], BRASS(), 16);
  cyl(g, 0.004, 0.004, h - w, [0, -(h - w) - 0.02, 0], BLACK(), 6);
  ball(g, [w / 2, w / 2, w / 2], [0, -h + w / 2, 0], opal());
  return g;
};

/** LED strip tucked up against the ceiling, glowing along the wall (centred on its mount height, sticks out along +z). */
const coveLight: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, h, 0.02], [0, -h / 2, 0.01], WHITE());
  box(g, [w - 0.02, h * 0.45, d * 0.5], [0, -h * 0.2, 0.02 + d * 0.25], warm(1.1));
  return g;
};

const stripLight: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, h, d], [0, -h / 2, d / 2], mat('#d9d8d4', 0.35, 0.6));
  box(g, [w - 0.03, h * 0.4, d * 0.5], [0, -h * 0.7, d * 0.5], cool(1.0));
  return g;
};

const pictureLight: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  box(g, [0.05, h, 0.015], [0, -h / 2, 0.0075], BRASS());
  box(g, [0.02, 0.02, d], [0, -h / 2, d / 2], BRASS());
  const hood = cyl(g, 0.018, 0.018, w * 0.9, [0, 0, 0], BRASS(), 12);
  hood.rotation.z = Math.PI / 2;
  hood.position.set(0, -h * 0.3, d - 0.02);
  box(g, [w * 0.8, 0.008, 0.02], [0, -h * 0.55, d - 0.02], warm(1));
  return g;
};

const deskLamp: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  cyl(g, w * 0.32, w * 0.36, 0.02, [0, 0, 0], BLACK(), 24);
  const lower = cyl(g, 0.007, 0.007, h * 0.6, [0, 0.02, 0], mat('#8f9396', 0.3, 0.85), 8);
  lower.rotation.z = -0.25;
  lower.position.x = -0.03;
  const upper = cyl(g, 0.007, 0.007, h * 0.55, [0, h * 0.5, 0], mat('#8f9396', 0.3, 0.85), 8);
  upper.rotation.z = 0.9;
  upper.position.set(0.1, h * 0.7, 0);
  const head = cyl(g, w * 0.1, w * 0.28, 0.14, [0, 0, 0], mat('#2b2a28', 0.5, 0.3), 20);
  head.position.set(w * 0.34, h * 0.86, 0);
  head.rotation.z = -0.5;
  ball(g, [0.035, 0.012, 0.035], [w * 0.38, h * 0.8, 0], warm(1.1));
  return g;
};

const bollardLight: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  cyl(g, w * 0.4, w * 0.45, h * 0.62, [0, 0, 0], mat('#4a4c4e', 0.5, 0.5), 20);
  cyl(g, w * 0.38, w * 0.38, h * 0.26, [0, h * 0.62, 0], warm(0.9), 20);
  cyl(g, w * 0.46, w * 0.46, 0.03, [0, h * 0.88, 0], mat('#4a4c4e', 0.5, 0.5), 20);
  return g;
};

export const BUILDERS6: Record<string, Builder> = {
  downlight,
  'led-panel': ledPanel,
  'pendant-cluster': pendantCluster,
  'pendant-linear': pendantLinear,
  'pendant-globe': pendantGlobe,
  'cove-light': coveLight,
  'strip-light': stripLight,
  'picture-light': pictureLight,
  'desk-lamp': deskLamp,
  'bollard-light': bollardLight,
};
