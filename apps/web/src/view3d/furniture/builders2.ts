import * as THREE from 'three';
import { ball, BLACK, box, CHROME, cyl, GLASS, GLOW, legs, mat, shade, WHITE, type Builder, type V3 } from './kit';

/**
 * Procedural models for the second catalog batch (same conventions as builders.ts: origin at the centre of the
 * floor footprint, +z front, wall items extend from z = 0 outward centred on y = 0, ceiling items hang below y = 0).
 */

/** Thin cylinder between two points. */
export function rod(g: THREE.Group, a: V3, b: V3, r: number, m: THREE.Material): THREE.Mesh {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, va.distanceTo(vb), 8), m);
  mesh.position.copy(va).add(vb).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  mesh.castShadow = mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}

/** Ring (torus) lying flat by default; `rotX` = π/2 flat, 0 = standing in the x–y plane. */
export function ring(g: THREE.Group, radius: number, tube: number, [x, y, z]: V3, m: THREE.Material, rotX = Math.PI / 2): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 28), m);
  mesh.position.set(x, y, z);
  mesh.rotation.x = rotX;
  mesh.castShadow = mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}

const GREEN = () => mat('#5f8a55', 0.85);
const GREEN2 = () => mat('#7aa66b', 0.85);
const GREEN3 = () => mat('#3f6b3d', 0.9);
const TERRA = () => mat('#b5604a', 0.8);
const SOIL = () => mat('#4a3a2c', 1);
const STONE = () => mat('#a8a49c', 0.9);
const BRASS = () => mat('#c9a47a', 0.4, 0.7);

// ----------------------------------------------------------------------------------------------- living

const sofaL: Builder = ({ c, w, d }) => {
  const g = new THREE.Group();
  const fabric = mat(c, 0.9);
  const cushion = mat(shade(c, 0.03), 0.9);
  const dep = 0.95;
  const arm = 0.16;
  const ch = 0.95;
  const zMain = -d / 2 + dep / 2;
  for (const [x, z] of [[-w / 2 + 0.1, -d / 2 + 0.1], [w / 2 - 0.1, -d / 2 + 0.1], [-w / 2 + 0.1, dep - d / 2 - 0.1], [w / 2 - 0.1, d / 2 - 0.1]] as const) box(g, [0.05, 0.07, 0.05], [x, 0, z], BLACK());
  box(g, [w, 0.33, dep], [0, 0.07, zMain], fabric);
  box(g, [ch, 0.33, d - dep], [w / 2 - ch / 2, 0.07, -d / 2 + dep + (d - dep) / 2], fabric);
  box(g, [w, 0.42, 0.2], [0, 0.4, -d / 2 + 0.1], fabric);
  box(g, [arm, 0.3, dep], [-w / 2 + arm / 2, 0.4, zMain], fabric);
  box(g, [arm, 0.3, d - dep + 0.001], [w / 2 - arm / 2, 0.4, -d / 2 + dep + (d - dep) / 2], fabric);
  const w1 = w - arm - ch;
  const cw = w1 / 3;
  for (let i = 0; i < 3; i++) {
    const x = -w / 2 + arm + cw * (i + 0.5);
    box(g, [cw - 0.02, 0.12, dep - 0.22], [x, 0.4, -d / 2 + 0.2 + (dep - 0.22) / 2], cushion);
    box(g, [cw - 0.04, 0.34, 0.14], [x, 0.45, -d / 2 + 0.3], cushion).rotation.x = -0.12;
  }
  box(g, [ch - arm - 0.02, 0.12, d - dep - 0.02], [w / 2 - ch / 2 - arm / 2, 0.4, -d / 2 + dep + (d - dep) / 2], cushion);
  return g;
};

const ottoman: Builder = ({ c, w, h }) => {
  const g = new THREE.Group();
  const fabric = mat(c, 0.9);
  cyl(g, w / 2, w / 2, h - 0.08, [0, 0.08, 0], fabric);
  cyl(g, w / 2 - 0.03, w / 2, 0.04, [0, h - 0.04, 0], mat(shade(c, 0.05), 0.9));
  for (const [x, z] of [[0.18, 0.18], [-0.18, 0.18], [0.18, -0.18], [-0.18, -0.18]] as const) cyl(g, 0.02, 0.025, 0.08, [x, 0, z], mat('#3b2f27', 0.6));
  return g;
};

const consoleTable: Builder = ({ c, w, d }) => {
  const g = new THREE.Group();
  const wood = mat(c, 0.5);
  box(g, [w, 0.04, d], [0, 0.76, 0], wood);
  box(g, [w - 0.12, 0.025, d - 0.08], [0, 0.22, 0], mat(shade(c, -0.05), 0.5));
  legs(g, w, d, 0.76, 0.04, mat(shade(c, -0.12), 0.5), 0.03);
  return g;
};

const displayCabinet: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const wood = mat(c, 0.5);
  box(g, [w, h - 0.1, 0.02], [0, 0.1, -d / 2 + 0.01], mat(shade(c, -0.08), 0.6));
  for (const sx of [-1, 1]) box(g, [0.03, h - 0.1, d], [sx * (w / 2 - 0.015), 0.1, 0], wood);
  box(g, [w, 0.04, d], [0, h - 0.04, 0], wood);
  box(g, [w, 0.1, d], [0, 0, 0], wood);
  for (let i = 0; i < 4; i++) {
    const y = 0.12 + i * ((h - 0.2) / 4);
    box(g, [w - 0.06, 0.02, d - 0.04], [0, y, 0], wood);
    if (i < 3) for (let k = 0; k < 4; k++) box(g, [0.1, 0.12 + (k % 2) * 0.04, 0.1], [-w / 2 + 0.2 + k * 0.2, y + 0.02, 0], mat(['#f1efea', '#b5604a', '#4d6783', '#c9b79c'][k]!, 0.6));
  }
  box(g, [w - 0.04, h - 0.2, 0.01], [0, 0.12, d / 2 - 0.01], GLASS());
  box(g, [0.015, 0.3, 0.02], [0.03, h * 0.5, d / 2 + 0.01], CHROME());
  return g;
};

const beanBag: Builder = ({ c, w, h }) => {
  const g = new THREE.Group();
  const f = mat(c, 0.95);
  ball(g, [w / 2, h * 0.5, w / 2], [0, h * 0.5, 0], f);
  ball(g, [w * 0.3, h * 0.28, w * 0.34], [0, h * 0.84, -w * 0.12], mat(shade(c, 0.04), 0.95));
  return g;
};

const shoeRack: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const wood = mat(c, 0.55);
  for (const sx of [-1, 1]) box(g, [0.025, h, d], [sx * (w / 2 - 0.0125), 0, 0], wood);
  box(g, [w - 0.05, h - 0.02, 0.012], [0, 0.02, -d / 2 + 0.006], mat(shade(c, -0.08), 0.6));
  const cols = ['#262626', '#b5604a', '#c9b79c', '#4d6783'];
  for (let i = 0; i < 3; i++) {
    const y = 0.04 + i * 0.2;
    box(g, [w - 0.05, 0.02, d], [0, y, 0], wood).rotation.x = -0.08;
    for (let k = 0; k < 3; k++) box(g, [0.1, 0.07, 0.24], [-w / 2 + 0.17 + k * 0.23, y + 0.03, 0.02], mat(cols[(i + k) % 4]!, 0.7));
  }
  return g;
};

const poojaMandir: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const wood = mat(c, 0.5);
  const dark = mat(shade(c, -0.12), 0.5);
  const base = 0.75;
  box(g, [w, base, d], [0, 0, 0], wood); // cabinet
  for (const sx of [-1, 1]) box(g, [w / 2 - 0.04, base - 0.12, 0.012], [sx * (w / 4), 0.06, d / 2 + 0.004], dark);
  box(g, [w + 0.04, 0.04, d + 0.04], [0, base, 0], dark); // counter
  const shrineH = 0.55;
  for (const sx of [-1, 1]) cyl(g, 0.035, 0.035, shrineH, [sx * (w / 2 - 0.07), base + 0.04, d / 2 - 0.08], wood);
  box(g, [w - 0.08, shrineH, 0.02], [0, base + 0.04, -d / 2 + 0.03], dark);
  box(g, [w, 0.05, d], [0, base + 0.04 + shrineH, 0], wood); // canopy
  const roofH = h - (base + 0.04 + shrineH + 0.05) - 0.05;
  const r4 = d * 0.36; // a 4-sided cone has its corners √2·r from the centre
  const spire = cyl(g, 0.02, r4, roofH, [0, base + 0.04 + shrineH + 0.05, 0], BRASS(), 4);
  spire.rotation.y = Math.PI / 4;
  spire.scale.x = (w * 0.48) / (r4 * Math.SQRT2);
  ball(g, [0.035, 0.05, 0.035], [0, h - 0.04, 0], BRASS());
  cyl(g, 0.045, 0.06, 0.1, [0, base + 0.04, 0], BRASS()); // idol pedestal
  ball(g, [0.05, 0.07, 0.04], [0, base + 0.19, 0], mat('#d9b25a', 0.4, 0.5));
  ball(g, [0.015, 0.025, 0.015], [w / 2 - 0.16, base + 0.065, d / 2 - 0.1], GLOW()); // diya
  return g;
};

const swingJhula: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const wood = mat(c, 0.5);
  const metal = mat('#3b3a38', 0.5, 0.4);
  for (const sx of [-1, 1]) {
    // A-frame on each end
    rod(g, [sx * (w / 2 - 0.04), 0.03, d / 2 - 0.04], [sx * (w / 2 - 0.04), h - 0.04, 0], 0.035, wood);
    rod(g, [sx * (w / 2 - 0.04), 0.03, -d / 2 + 0.04], [sx * (w / 2 - 0.04), h - 0.04, 0], 0.035, wood);
  }
  box(g, [w, 0.07, 0.07], [0, h - 0.07, 0], wood); // top beam
  const seatW = w * 0.72;
  const seatY = 0.5;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) rod(g, [sx * (seatW / 2 - 0.03), h - 0.07, sz * 0.2], [sx * (seatW / 2 - 0.03), seatY + 0.08, sz * 0.2], 0.008, metal);
  box(g, [seatW, 0.06, 0.5], [0, seatY, 0], mat(shade(c, 0.05), 0.5));
  box(g, [seatW, 0.35, 0.05], [0, seatY + 0.06, -0.23], wood).rotation.x = -0.1;
  box(g, [seatW - 0.1, 0.07, 0.42], [0, seatY + 0.06, 0.02], mat('#b5604a', 0.9));
  return g;
};

// ----------------------------------------------------------------------------------------------- bedroom

const bunkBed: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const wood = mat(c, 0.55);
  const sheet = mat('#efece6', 0.9);
  const cover = mat('#8f9f86', 0.9);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, [0.07, h, 0.07], [sx * (w / 2 - 0.035), 0, sz * (d / 2 - 0.035)], wood);
  for (const y of [0.2, 0.95]) {
    box(g, [w - 0.14, 0.05, d - 0.14], [0, y, 0], wood);
    box(g, [w - 0.16, 0.14, d - 0.2], [0, y + 0.05, 0.02], sheet);
    box(g, [w - 0.16, 0.05, d * 0.55], [0, y + 0.19, d * 0.12], cover);
    for (const sx of [-1, 1]) box(g, [0.03, 0.2, d - 0.14], [sx * (w / 2 - 0.045), y + 0.05, 0], wood);
  }
  box(g, [w - 0.14, h - 0.2, 0.03], [0, 0.2, -d / 2 + 0.05], mat(shade(c, -0.08), 0.6)); // headboard
  for (let i = 0; i < 6; i++) box(g, [0.04, 0.03, 0.05], [w / 2 - 0.05, 0.3 + i * 0.22, d / 2 - 0.05], wood); // ladder rungs
  return g;
};

const crib: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const wood = mat(c, 0.55);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, [0.05, h, 0.05], [sx * (w / 2 - 0.025), 0, sz * (d / 2 - 0.025)], wood);
  box(g, [w - 0.1, 0.04, d - 0.1], [0, 0.3, 0], wood);
  box(g, [w - 0.12, 0.1, d - 0.14], [0, 0.34, 0], mat('#f7f6f2', 0.95));
  for (const z of [-1, 1]) {
    box(g, [w - 0.1, 0.04, 0.03], [0, h - 0.05, z * (d / 2 - 0.025)], wood);
    for (let i = 0; i < 9; i++) box(g, [0.02, 0.5, 0.02], [-w / 2 + 0.1 + (i * (w - 0.2)) / 8, 0.4, z * (d / 2 - 0.025)], wood);
  }
  for (const sx of [-1, 1]) {
    box(g, [0.03, 0.04, d - 0.1], [sx * (w / 2 - 0.025), h - 0.05, 0], wood);
    for (let i = 0; i < 14; i++) box(g, [0.02, 0.5, 0.02], [sx * (w / 2 - 0.025), 0.4, -d / 2 + 0.1 + (i * (d - 0.2)) / 13], wood);
  }
  return g;
};

const vanity: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const wood = mat(c, 0.5);
  box(g, [w, 0.04, d], [0, 0.74, 0], wood);
  legs(g, w, d, 0.74, 0.04, mat(shade(c, -0.12), 0.5), 0.02);
  box(g, [w * 0.4, 0.5, d - 0.04], [w * 0.28, 0.2, 0], wood);
  for (let i = 0; i < 3; i++) {
    box(g, [w * 0.4 - 0.03, 0.14, 0.012], [w * 0.28, 0.24 + i * 0.16, d / 2 - 0.016], mat(shade(c, -0.05), 0.5));
    ball(g, [0.012, 0.012, 0.012], [w * 0.28, 0.31 + i * 0.16, d / 2 + 0.002], CHROME());
  }
  box(g, [w * 0.62, h - 0.82, 0.02], [0, 0.82, -d / 2 + 0.03], mat('#d6e0e6', 0.05, 0.6)); // mirror
  box(g, [w * 0.62 + 0.05, h - 0.8, 0.015], [0, 0.8, -d / 2 + 0.02], wood);
  return g;
};

const bedBench: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, 0.1, d], [0, h - 0.18, 0], mat(c, 0.9));
  box(g, [w - 0.02, 0.08, d - 0.02], [0, h - 0.28, 0], mat('#7a5238', 0.55));
  legs(g, w, d, h - 0.28, 0.04, mat('#3b2f27', 0.6), 0.03);
  box(g, [w - 0.06, 0.07, d - 0.06], [0, h - 0.08, 0], mat(shade(c, 0.04), 0.9));
  return g;
};

// ----------------------------------------------------------------------------------------------- kitchen & dining

const kitchenTall: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const body = mat(c, 0.5);
  box(g, [w, h - 0.1, d], [0, 0.1, 0], body);
  box(g, [w - 0.06, 0.1, d - 0.06], [0, 0, 0], BLACK());
  box(g, [w - 0.02, h * 0.42, 0.015], [0, 0.12, d / 2 + 0.005], mat(shade(c, -0.04), 0.5));
  box(g, [w - 0.02, h * 0.5, 0.015], [0, 0.12 + h * 0.43, d / 2 + 0.005], mat(shade(c, -0.04), 0.5));
  for (const y of [h * 0.4, h * 0.62]) box(g, [0.014, 0.3, 0.02], [w / 2 - 0.06, y, d / 2 + 0.02], CHROME());
  return g;
};

const kitchenWall: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, h, d], [0, -h / 2, d / 2], mat(c, 0.5));
  for (const sx of [-1, 1]) {
    box(g, [w / 2 - 0.015, h - 0.03, 0.015], [sx * (w / 4), -h / 2 + 0.015, d + 0.004], mat(shade(c, -0.04), 0.5));
    box(g, [0.014, 0.22, 0.02], [sx * 0.04, -0.15, d + 0.02], CHROME());
  }
  return g;
};

const kitchenIsland: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const body = mat(c, 0.5);
  box(g, [w - 0.06, h - 0.04, d - 0.1], [0, 0.0, -0.02], body);
  box(g, [w, 0.04, d], [0, h - 0.04, 0], mat('#d9d5cc', 0.35));
  const n = Math.round(w / 0.4);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.06 + ((i + 0.5) * (w - 0.12)) / n;
    box(g, [(w - 0.12) / n - 0.012, h - 0.14, 0.012], [x, 0.06, d / 2 - 0.044], mat(shade(c, -0.04), 0.5));
    box(g, [0.1, 0.014, 0.02], [x, h - 0.14, d / 2 - 0.03], CHROME());
  }
  return g;
};

const cookerHood: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  const steel = mat('#c9cbcd', 0.3, 0.8);
  box(g, [w, 0.12, d], [0, -h / 2, d / 2], steel);
  box(g, [w * 0.85, 0.06, d * 0.8], [0, -h / 2 + 0.12, d / 2 + 0.01], steel).scale.set(1, 1, 0.9);
  box(g, [w * 0.45, h - 0.18, 0.22], [0, -h / 2 + 0.18, 0.11], steel);
  box(g, [w * 0.75, 0.01, d * 0.7], [0, -h / 2 - 0.004, d / 2], GLOW());
  return g;
};

const dishwasher: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, h - 0.04, d], [0, 0.02, 0], mat('#d9dadb', 0.35, 0.6));
  box(g, [w - 0.04, 0.06, 0.01], [0, h - 0.1, d / 2 + 0.004], BLACK());
  box(g, [w - 0.1, 0.02, 0.025], [0, h - 0.17, d / 2 + 0.02], CHROME());
  box(g, [w - 0.04, h - 0.3, 0.008], [0, 0.04, d / 2 + 0.002], mat('#c9cbcd', 0.3, 0.7));
  return g;
};

const washingMachine: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, h, d], [0, 0, 0], WHITE());
  cyl(g, 0.21, 0.21, 0.05, [0, 0, 0], CHROME()).rotation.x = Math.PI / 2;
  const door = cyl(g, 0.19, 0.19, 0.02, [0, 0, 0], GLASS());
  door.rotation.x = Math.PI / 2;
  door.position.set(0, h * 0.45, d / 2 + 0.01);
  g.children[1]!.position.set(0, h * 0.45, d / 2 + 0.005);
  box(g, [w - 0.08, 0.07, 0.01], [0, h - 0.1, d / 2 + 0.004], mat('#cfd1d3', 0.4));
  ball(g, [0.02, 0.02, 0.01], [w / 2 - 0.1, h - 0.065, d / 2 + 0.01], BLACK());
  return g;
};

const diningTableRound: Builder = ({ c, w }) => {
  const g = new THREE.Group();
  const wood = mat(c, 0.5);
  cyl(g, w / 2, w / 2, 0.05, [0, 0.7, 0], wood);
  cyl(g, 0.07, 0.09, 0.66, [0, 0.04, 0], mat(shade(c, -0.1), 0.5));
  cyl(g, w * 0.28, w * 0.3, 0.04, [0, 0, 0], mat(shade(c, -0.1), 0.5));
  return g;
};

// ----------------------------------------------------------------------------------------------- bathroom

const vanityUnit: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const body = mat(c, 0.5);
  box(g, [w, h - 0.05, d], [0, 0.0, 0], body);
  box(g, [w + 0.02, 0.04, d + 0.02], [0, h - 0.05, 0], mat('#e8e6e0', 0.22));
  box(g, [w * 0.45, 0.06, d * 0.7], [0, h - 0.02, 0.01], WHITE());
  cyl(g, 0.012, 0.012, 0.14, [0, h, -d * 0.28], CHROME());
  box(g, [0.02, 0.012, 0.1], [0, h + 0.13, -d * 0.24], CHROME());
  for (const sx of [-1, 1]) {
    box(g, [w / 2 - 0.03, h - 0.12, 0.012], [sx * (w / 4), 0.04, d / 2 + 0.004], mat(shade(c, -0.05), 0.5));
    box(g, [0.1, 0.014, 0.02], [sx * 0.08, h - 0.16, d / 2 + 0.02], CHROME());
  }
  return g;
};

const towelRail: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  const chrome = CHROME();
  for (const sx of [-1, 1]) box(g, [0.025, h, 0.025], [sx * (w / 2 - 0.0125), -h / 2, d - 0.0125], chrome);
  for (let i = 0; i < 5; i++) {
    const y = -h / 2 + 0.08 + (i * (h - 0.16)) / 4;
    cyl(g, 0.011, 0.011, w - 0.03, [0, y - (w - 0.03) / 2, d - 0.0125], chrome).rotation.z = Math.PI / 2;
  }
  for (const sx of [-1, 1]) for (const y of [-h / 2 + 0.05, h / 2 - 0.05]) box(g, [0.025, 0.025, d - 0.02], [sx * (w / 2 - 0.0125), y, (d - 0.02) / 2], chrome);
  box(g, [w - 0.1, 0.2, 0.012], [0, -0.05, d - 0.03], mat('#f1efea', 0.95)); // a towel
  return g;
};

const mirrorCabinet: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, h, d], [0, -h / 2, d / 2], WHITE());
  box(g, [w - 0.04, h - 0.04, 0.01], [0, -h / 2 + 0.02, d + 0.004], mat('#d6e0e6', 0.05, 0.7));
  return g;
};

const laundryBasket: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  cyl(g, w / 2, w / 2 - 0.05, h - 0.06, [0, 0, 0], mat('#c9b79c', 0.9));
  for (let i = 0; i < 4; i++) ring(g, w / 2 - 0.04 + i * 0.002, 0.008, [0, 0.1 + i * 0.12, 0], mat('#a8957a', 0.9));
  cyl(g, w / 2 + 0.01, w / 2 + 0.01, 0.06, [0, h - 0.06, 0], mat('#b5a083', 0.9));
  return g;
};

// ----------------------------------------------------------------------------------------------- office

const filingCabinet: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, h, d], [0, 0, 0], mat(c, 0.45, 0.3));
  for (let i = 0; i < 3; i++) {
    const y = 0.03 + i * ((h - 0.06) / 3);
    box(g, [w - 0.04, (h - 0.06) / 3 - 0.012, 0.012], [0, y, d / 2 + 0.004], mat(shade(c, -0.04), 0.45, 0.3));
    box(g, [w * 0.4, 0.02, 0.02], [0, y + (h - 0.06) / 6 + 0.02, d / 2 + 0.02], CHROME());
  }
  return g;
};

const deskL: Builder = ({ c, w, d }) => {
  const g = new THREE.Group();
  const wood = mat(c, 0.5);
  const leg = mat(shade(c, -0.12), 0.5);
  const depth = 0.7;
  box(g, [w, 0.04, depth], [0, 0.71, -d / 2 + depth / 2], wood);
  box(g, [depth, 0.04, d - depth], [-w / 2 + depth / 2, 0.71, -d / 2 + depth + (d - depth) / 2], wood);
  for (const [x, z] of [[w / 2 - 0.05, -d / 2 + 0.05], [w / 2 - 0.05, -d / 2 + depth - 0.05], [-w / 2 + 0.05, d / 2 - 0.05], [-w / 2 + depth - 0.05, d / 2 - 0.05], [-w / 2 + 0.05, -d / 2 + 0.05]] as const) box(g, [0.05, 0.71, 0.05], [x, 0, z], leg);
  box(g, [0.5, 0.35, 0.02], [w * 0.1, 0.75, -d / 2 + 0.12], BLACK()); // monitor
  box(g, [0.04, 0.18, 0.04], [w * 0.1, 0.75, -d / 2 + 0.1], BLACK());
  return g;
};

const whiteboard: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, h, d], [0, -h / 2, d / 2], mat('#b5b8ba', 0.4, 0.5));
  box(g, [w - 0.06, h - 0.06, 0.006], [0, -h / 2 + 0.03, d + 0.002], WHITE());
  box(g, [w * 0.6, 0.03, 0.06], [0, -h / 2, 0.03], mat('#b5b8ba', 0.4, 0.5));
  return g;
};

const bookcaseLow: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const wood = mat(c, 0.55);
  box(g, [w, h, 0.02], [0, 0, -d / 2 + 0.01], mat(shade(c, -0.08), 0.6));
  for (const sx of [-1, 1]) box(g, [0.03, h, d], [sx * (w / 2 - 0.015), 0, 0], wood);
  const cols = ['#b5604a', '#4d6783', '#8f9f86', '#c9b79c', '#7a5238', '#3b3a38'];
  for (let i = 0; i <= 2; i++) {
    const y = (i / 2) * (h - 0.03);
    box(g, [w - 0.06, 0.03, d], [0, y, 0], wood);
    if (i < 2) {
      let x = -w / 2 + 0.07;
      let k = i * 3;
      while (x < w / 2 - 0.14) {
        const bw = 0.03 + ((k * 7) % 3) * 0.01;
        box(g, [bw, 0.2 + ((k * 5) % 3) * 0.02, d - 0.1], [x + bw / 2, y + 0.03, 0.02], mat(cols[k % cols.length]!, 0.8));
        x += bw + 0.004;
        k++;
      }
    }
  }
  return g;
};

// ----------------------------------------------------------------------------------------------- decor

const curtain: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const fabric = mat(c, 0.95);
  cyl(g, 0.012, 0.012, w, [0, h / 2 - 0.05 - w / 2, d - 0.02], BRASS()).rotation.z = Math.PI / 2;
  const n = 14;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.05 + (i * (w - 0.1)) / (n - 1);
    box(g, [(w - 0.1) / n + 0.01, h - 0.1, 0.03], [x, -h / 2 + 0.02, d - 0.04 - (i % 2 ? 0 : 0.07)], i % 2 ? fabric : mat(shade(c, -0.05), 0.95));
  }
  return g;
};

const wallClock: Builder = ({ w, d }) => {
  const g = new THREE.Group();
  const face = cyl(g, w / 2, w / 2, d - 0.015, [0, 0, 0], WHITE());
  face.rotation.x = Math.PI / 2;
  face.position.set(0, 0, (d - 0.015) / 2);
  const rim = ring(g, w / 2 - 0.005, 0.012, [0, 0, d - 0.012], mat('#2b2a28', 0.5), 0);
  rim.scale.set(1, 1, 1.5);
  box(g, [0.012, w * 0.38, 0.006], [0, w * 0.17, d - 0.004], BLACK());
  box(g, [w * 0.28, 0.012, 0.006], [w * 0.12, 0, d - 0.004], BLACK());
  return g;
};

const wallShelf: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, h, d], [0, -h / 2, d / 2], mat(c, 0.5));
  for (const sx of [-1, 1]) box(g, [0.02, 0.07, d - 0.03], [sx * (w / 2 - 0.1), -h / 2 - 0.05, (d - 0.03) / 2 + 0.01], BLACK());
  box(g, [0.1, 0.07, 0.07], [-w / 4, h / 2, d / 2], mat('#b5604a', 0.7));
  box(g, [0.06, 0.05, 0.05], [w / 5, h / 2, d / 2 + 0.02], mat('#4d6783', 0.7));
  return g;
};

const vase: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  const clay = mat('#c9bfa0', 0.5);
  ball(g, [w * 0.46, h * 0.2, w * 0.46], [0, h * 0.2, 0], clay);
  cyl(g, w * 0.14, w * 0.2, h * 0.18, [0, h * 0.34, 0], clay);
  const stems = [[0, 0.18, '#5f8a55'], [0.05, 0.14, '#7aa66b'], [-0.05, 0.12, '#5f8a55']] as const;
  for (const [x, hh, col] of stems) rod(g, [0, h * 0.5, 0], [x, h * 0.5 + hh, 0], 0.004, mat(col, 0.8));
  for (const [x, z, col] of [[0, 0, '#e8b4b8'], [0.05, 0.02, '#f4d58a'], [-0.05, -0.02, '#e8b4b8']] as const) ball(g, [0.035, 0.03, 0.035], [x, h * 0.5 + 0.16, z], mat(col, 0.7));
  return g;
};

const rugRound: Builder = ({ c, w }) => {
  const g = new THREE.Group();
  cyl(g, w / 2, w / 2, 0.012, [0, 0, 0], mat(c, 1));
  cyl(g, w * 0.36, w * 0.36, 0.006, [0, 0.012, 0], mat(shade(c, 0.12), 1));
  cyl(g, w * 0.2, w * 0.2, 0.004, [0, 0.018, 0], mat(shade(c, -0.08), 1));
  return g;
};

const fireplace: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const wall = mat(c, 0.7);
  box(g, [w, h - 0.08, d], [0, 0, 0], mat('#d9d5cc', 0.8));
  box(g, [w + 0.12, 0.08, d + 0.1], [0, h - 0.08, 0], mat('#7a5238', 0.5)); // mantel
  box(g, [w * 0.55, h * 0.5, 0.02], [0, 0.06, d / 2 + 0.005], BLACK());
  box(g, [w * 0.5, h * 0.18, 0.02], [0, 0.08, d / 2 + 0.012], GLOW());
  box(g, [w * 0.62, 0.05, 0.1], [0, 0.03, d / 2 + 0.05], wall);
  for (const sx of [-1, 1]) cyl(g, 0.012, 0.012, h * 0.28, [sx * w * 0.2, 0.06, d / 2 + 0.02], BLACK());
  return g;
};

// ----------------------------------------------------------------------------------------------- lighting

const tableLamp: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  cyl(g, w * 0.25, w * 0.3, 0.03, [0, 0, 0], BRASS());
  cyl(g, 0.015, 0.02, h * 0.55, [0, 0.03, 0], BRASS());
  cyl(g, w * 0.3, w / 2, h * 0.38, [0, h * 0.58, 0], mat('#f1efea', 0.8, 0, { emissive: new THREE.Color('#ffe0b0'), emissiveIntensity: 0.55, side: THREE.DoubleSide }));
  return g;
};

const chandelier: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  const brass = BRASS();
  cyl(g, 0.008, 0.008, h * 0.35, [0, -h * 0.35, 0], BLACK());
  const y = -h * 0.55;
  ring(g, w * 0.42, 0.012, [0, y, 0], brass);
  ball(g, [0.045, 0.055, 0.045], [0, y - 0.04, 0], brass);
  cyl(g, 0.014, 0.014, 0.28, [0, y - 0.28, 0], brass);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const x = Math.sin(a) * w * 0.42;
    const z = Math.cos(a) * w * 0.42;
    rod(g, [0, y - 0.04, 0], [x, y, z], 0.006, brass);
    cyl(g, 0.012, 0.012, 0.07, [x, y, z], WHITE());
    ball(g, [0.02, 0.03, 0.02], [x, y + 0.09, z], GLOW());
  }
  return g;
};

const wallSconce: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  box(g, [0.05, h * 0.6, 0.012], [0, -h * 0.3, 0.006], BRASS());
  rod(g, [0, 0, 0.012], [0, 0.0, d * 0.55], 0.008, BRASS());
  const shade2 = cyl(g, w * 0.3, w / 2, h * 0.5, [0, 0.0, d * 0.55], mat('#f1efea', 0.8, 0, { emissive: new THREE.Color('#ffe0b0'), emissiveIntensity: 0.5, side: THREE.DoubleSide }));
  shade2.position.y = 0;
  return g;
};

const ceilingFan: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  cyl(g, 0.02, 0.02, h * 0.3, [0, -h * 0.3, 0], mat('#c9cbcd', 0.4, 0.6));
  cyl(g, 0.09, 0.09, 0.07, [0, -h * 0.3 - 0.07, 0], mat('#2b2a28', 0.5, 0.3));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const b = box(g, [w * 0.46, 0.012, 0.14], [Math.cos(a) * w * 0.3, -h * 0.3 - 0.04, -Math.sin(a) * w * 0.3], mat('#8b6a4a', 0.6), a);
    b.rotation.z = -0.06;
  }
  cyl(g, 0.07, 0.06, 0.05, [0, -h * 0.3 - 0.12, 0], mat('#f1efea', 0.5, 0, { emissive: new THREE.Color('#ffe0b0'), emissiveIntensity: 0.4 }));
  return g;
};

const arcLamp: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  const steel = mat('#2b2a28', 0.4, 0.6);
  const x0 = -w * 0.4;
  box(g, [0.34, 0.05, 0.3], [x0, 0, 0], mat('#d9d5cc', 0.4));
  rod(g, [x0, 0.05, 0], [x0, h * 0.62, 0], 0.014, steel);
  const pts: V3[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    pts.push([x0 + t * w * 0.78, h * 0.62 + Math.sin(t * Math.PI * 0.85) * (h * 0.36), 0]);
  }
  for (let i = 0; i < pts.length - 1; i++) rod(g, pts[i]!, pts[i + 1]!, 0.012, steel);
  const end = pts[pts.length - 1]!;
  cyl(g, 0.08, 0.17, 0.2, [end[0], end[1] - 0.2, 0], mat('#f1efea', 0.8, 0, { emissive: new THREE.Color('#ffe0b0'), emissiveIntensity: 0.5, side: THREE.DoubleSide }));
  return g;
};

// ----------------------------------------------------------------------------------------------- plants

const succulent: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  cyl(g, w * 0.36, w * 0.26, h * 0.4, [0, 0, 0], mat('#d9d5cc', 0.8));
  for (let i = 0; i < 8; i++) {
    const a = i * 0.785;
    ball(g, [0.022, 0.05, 0.012], [Math.sin(a) * 0.07, h * 0.62, Math.cos(a) * 0.07], i % 2 ? GREEN() : GREEN2()).rotation.set(Math.cos(a) * 0.7, a, 0);
  }
  ball(g, [0.03, 0.04, 0.03], [0, h * 0.55, 0], GREEN3());
  return g;
};

const palmIndoor: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  cyl(g, w * 0.3, w * 0.22, 0.4, [0, 0, 0], mat('#c9bfa0', 0.8));
  cyl(g, w * 0.27, w * 0.27, 0.01, [0, 0.4, 0], SOIL());
  cyl(g, 0.025, 0.04, h * 0.45, [0, 0.4, 0], mat('#6e5a45', 0.9));
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const len = w * 0.55;
    const base: V3 = [0, h * 0.82, 0];
    const tip: V3 = [Math.sin(a) * len, h * 0.82 - len * 0.35 + (i % 3) * 0.08, Math.cos(a) * len];
    rod(g, base, tip, 0.008, mat('#6e7a45', 0.8));
    ball(g, [0.06, 0.012, w * 0.28], [Math.sin(a) * len * 0.62, h * 0.82 - len * 0.2, Math.cos(a) * len * 0.62], i % 2 ? GREEN() : GREEN2()).rotation.y = a;
  }
  return g;
};

const bonsai: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  box(g, [w * 0.8, 0.06, w * 0.5], [0, 0, 0], mat('#5b4a3c', 0.7));
  box(g, [w * 0.74, 0.012, w * 0.44], [0, 0.06, 0], SOIL());
  const trunk = cyl(g, 0.012, 0.025, h * 0.5, [-0.04, 0.06, 0], mat('#6e5a45', 0.9));
  trunk.rotation.z = 0.25;
  for (const [x, y, r] of [[-0.02, h * 0.82, 0.11], [0.09, h * 0.72, 0.08], [-0.12, h * 0.68, 0.07]] as const) ball(g, [r, r * 0.65, r], [x, y, 0], GREEN());
  return g;
};

const cactus: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  cyl(g, w * 0.4, w * 0.3, h * 0.28, [0, 0, 0], TERRA());
  const body = mat('#4f8a52', 0.85);
  cyl(g, w * 0.13, w * 0.15, h * 0.62, [0, h * 0.28, 0], body);
  ball(g, [w * 0.13, w * 0.13, w * 0.13], [0, h * 0.9, 0], body);
  for (const [sx, y, len] of [[-1, 0.5, 0.18], [1, 0.62, 0.14]] as const) {
    cyl(g, 0.025, 0.025, len, [sx * w * 0.34, h * (y - 0.02), 0], body);
    box(g, [w * 0.34, 0.04, 0.04], [sx * w * 0.17, h * (y - 0.04), 0], body);
    ball(g, [0.025, 0.025, 0.025], [sx * w * 0.34, h * (y - 0.02) + len, 0], body);
  }
  return g;
};

const tulsi: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  const plaster = mat('#e8e0d0', 0.9);
  box(g, [w, 0.12, w], [0, 0, 0], plaster);
  box(g, [w * 0.8, 0.34, w * 0.8], [0, 0.12, 0], mat('#d9cdb4', 0.9));
  box(g, [w * 0.35, 0.16, 0.02], [0, 0.2, w * 0.4 + 0.004], mat('#8d7a5a', 0.9)); // niche
  box(g, [w * 0.92, 0.05, w * 0.92], [0, 0.46, 0], plaster);
  cyl(g, w * 0.34, w * 0.3, 0.2, [0, 0.51, 0], TERRA());
  cyl(g, w * 0.3, w * 0.3, 0.01, [0, 0.71, 0], SOIL());
  cyl(g, 0.012, 0.016, h - 0.8, [0, 0.71, 0], mat('#6e7a45', 0.9));
  for (let i = 0; i < 10; i++) {
    const a = i * 2.4;
    ball(g, [0.06, 0.04, 0.06], [Math.sin(a) * 0.1, 0.78 + (i % 4) * 0.045, Math.cos(a) * 0.1], i % 2 ? GREEN() : GREEN2());
  }
  return g;
};

// ----------------------------------------------------------------------------------------------- outdoor

const treeRound: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  const bark = mat('#6e5a45', 0.95);
  cyl(g, 0.12, 0.2, h * 0.5, [0, 0, 0], bark);
  rod(g, [0, h * 0.4, 0], [-w * 0.2, h * 0.58, 0.05], 0.06, bark);
  rod(g, [0, h * 0.42, 0], [w * 0.2, h * 0.6, -0.05], 0.06, bark);
  const r = w * 0.34;
  const blobs: Array<[number, number, number, number]> = [
    [0, h * 0.72, 0, r * 1.05],
    [-w * 0.28, h * 0.62, 0.1, r * 0.85],
    [w * 0.28, h * 0.64, -0.1, r * 0.85],
    [0.05, h * 0.62, w * 0.28, r * 0.8],
    [-0.05, h * 0.64, -w * 0.28, r * 0.8],
    [w * 0.12, h * 0.86, 0.05, r * 0.7],
  ];
  blobs.forEach(([x, y, z, rr], i) => ball(g, [rr, rr * 0.85, rr], [x, y, z], i % 2 ? GREEN() : GREEN2()));
  return g;
};

const treePine: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  cyl(g, 0.08, 0.13, h * 0.25, [0, 0, 0], mat('#5b4a3c', 0.95));
  const levels = 4;
  for (let i = 0; i < levels; i++) {
    const y = h * 0.16 + (i * h * 0.78) / levels;
    const r = (w / 2) * (1 - i * 0.2);
    cyl(g, 0.02, r, (h * 0.78) / levels + 0.45, [0, y, 0], i % 2 ? GREEN3() : GREEN(), 10);
  }
  return g;
};

const treePalm: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  const bark = mat('#9a8266', 0.95);
  const segs = 8;
  const pts: V3[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    pts.push([t * t * w * 0.14, 0.02 + t * h * 0.84, 0]);
  }
  for (let i = 0; i < segs; i++) rod(g, pts[i]!, pts[i + 1]!, 0.12 - i * 0.008, bark);
  const top = pts[segs]!;
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const len = w * 0.46;
    const tip: V3 = [top[0] + Math.sin(a) * len, top[1] - len * 0.38 + (i % 2) * 0.2, Math.cos(a) * len];
    rod(g, top, tip, 0.02, mat('#6e7a45', 0.85));
    ball(g, [0.14, 0.02, len * 0.46], [top[0] + Math.sin(a) * len * 0.55, top[1] - len * 0.12, Math.cos(a) * len * 0.55], i % 2 ? GREEN() : GREEN2()).rotation.set(0, a, 0);
  }
  for (let i = 0; i < 3; i++) ball(g, [0.1, 0.12, 0.1], [top[0] + Math.sin(i * 2.1) * 0.14, top[1] - 0.14, Math.cos(i * 2.1) * 0.14], mat('#7a8a3a', 0.8));
  return g;
};

const bush: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  const r = w * 0.34;
  const spots: Array<[number, number, number]> = [[0, h * 0.5, 0], [-w * 0.24, h * 0.38, 0.05], [w * 0.24, h * 0.4, -0.05], [0.04, h * 0.4, w * 0.24], [-0.03, h * 0.38, -w * 0.24]];
  spots.forEach(([x, y, z], i) => ball(g, [r, y, r], [x, y, z], i % 2 ? GREEN() : GREEN3()));
  return g;
};

const hedge: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, h * 0.78, d], [0, 0, 0], GREEN3());
  const n = Math.round(w / 0.4);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + ((i + 0.5) * w) / n;
    ball(g, [w / n / 1.7, h * 0.22, d / 2], [x, h * 0.78, 0], i % 2 ? GREEN() : GREEN2());
  }
  return g;
};

const flowerBed: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  const brick = mat('#a85a46', 0.9);
  box(g, [w, h * 0.55, 0.07], [0, 0, d / 2 - 0.035], brick);
  box(g, [w, h * 0.55, 0.07], [0, 0, -d / 2 + 0.035], brick);
  for (const sx of [-1, 1]) box(g, [0.07, h * 0.55, d - 0.14], [sx * (w / 2 - 0.035), 0, 0], brick);
  box(g, [w - 0.14, h * 0.5, d - 0.14], [0, 0, 0], SOIL());
  const cols = ['#e8b4b8', '#f4d58a', '#d9694f', '#ffffff', '#9a7fc4'];
  for (let i = 0; i < 18; i++) {
    const x = -w / 2 + 0.16 + ((i % 6) * (w - 0.32)) / 5;
    const z = -d / 2 + 0.16 + (Math.floor(i / 6) * (d - 0.32)) / 2;
    cyl(g, 0.005, 0.005, h * 0.4, [x, h * 0.5, z], GREEN());
    ball(g, [0.04, 0.035, 0.04], [x, h * 0.9, z], mat(cols[i % cols.length]!, 0.7));
  }
  return g;
};

const gardenBench: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const wood = mat(c, 0.6);
  const iron = mat('#2b2a28', 0.5, 0.5);
  for (let i = 0; i < 4; i++) box(g, [w, 0.03, 0.1], [0, 0.44, d / 2 - 0.08 - i * 0.11], wood);
  for (let i = 0; i < 3; i++) box(g, [w, 0.1, 0.03], [0, 0.52 + i * 0.12, -d / 2 + 0.06 + i * 0.012], wood).rotation.x = -0.12;
  for (const sx of [-1, 1]) {
    box(g, [0.04, 0.44, 0.04], [sx * (w / 2 - 0.1), 0, d / 2 - 0.08], iron);
    box(g, [0.04, h, 0.04], [sx * (w / 2 - 0.1), 0, -d / 2 + 0.06], iron);
    box(g, [0.04, 0.04, d - 0.1], [sx * (w / 2 - 0.1), 0.4, 0], iron);
    box(g, [0.04, 0.04, 0.3], [sx * (w / 2 - 0.1), 0.62, -d / 4 + 0.04], iron);
  }
  return g;
};

const patioTable: Builder = ({ c, w }) => {
  const g = new THREE.Group();
  const wood = mat(c, 0.6);
  cyl(g, w / 2, w / 2, 0.04, [0, 0.71, 0], wood);
  cyl(g, w / 2 - 0.05, w / 2 - 0.05, 0.01, [0, 0.745, 0], mat(shade(c, 0.05), 0.5));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    rod(g, [Math.sin(a) * w * 0.38, 0.03, Math.cos(a) * w * 0.38], [Math.sin(a) * w * 0.12, 0.7, Math.cos(a) * w * 0.12], 0.025, mat('#2b2a28', 0.5, 0.5));
  }
  return g;
};

const patioChair: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const wood = mat(c, 0.6);
  const iron = mat('#2b2a28', 0.5, 0.5);
  for (let i = 0; i < 4; i++) box(g, [w, 0.025, 0.1], [0, 0.44, d / 2 - 0.07 - i * 0.12], wood);
  for (let i = 0; i < 3; i++) box(g, [w, 0.09, 0.025], [0, 0.5 + i * 0.12, -d / 2 + 0.03], wood).rotation.x = -0.1;
  legs(g, w, d, 0.44, 0.03, iron, 0.01);
  for (const sx of [-1, 1]) box(g, [0.03, h - 0.44, 0.03], [sx * (w / 2 - 0.025), 0.44, -d / 2 + 0.03], iron);
  return g;
};

const patioUmbrella: Builder = ({ c, w, h }) => {
  const g = new THREE.Group();
  box(g, [0.5, 0.06, 0.5], [0, 0, 0], STONE());
  cyl(g, 0.025, 0.03, h - 0.06, [0, 0.06, 0], mat('#e8e6e0', 0.5));
  const canopy = cyl(g, 0.03, w / 2, 0.42, [0, h - 0.5, 0], mat(c, 0.85, 0, { side: THREE.DoubleSide }), 12);
  canopy.rotation.y = 0.26;
  ball(g, [0.035, 0.035, 0.035], [0, h - 0.07, 0], mat('#e8e6e0', 0.5));
  return g;
};

const sunLounger: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const wood = mat(c, 0.6);
  const pad = mat('#efece6', 0.9);
  legs(g, w, d * 0.6, 0.28, 0.05, wood, 0.02);
  box(g, [w, 0.05, d * 0.6], [0, 0.28, d * 0.2], wood);
  box(g, [w - 0.08, 0.06, d * 0.58], [0, 0.33, d * 0.2], pad);
  const back = box(g, [w, 0.05, d * 0.4], [0, 0.45, -d * 0.3], wood);
  back.rotation.x = 0.55;
  const cushion = box(g, [w - 0.08, 0.06, d * 0.38], [0, 0.49, -d * 0.3], pad);
  cushion.rotation.x = 0.55;
  void h;
  return g;
};

const bbqGrill: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  const black = mat('#2b2a28', 0.5, 0.3);
  legs(g, w * 0.7, d * 0.7, 0.55, 0.03, black, 0);
  box(g, [w * 0.7, 0.04, d * 0.7], [0, 0.55, 0], black);
  box(g, [w * 0.28, 0.03, d * 0.6], [-w * 0.48, 0.74, 0], mat('#c9cbcd', 0.3, 0.8)); // side shelf
  box(g, [w * 0.6, 0.15, d * 0.6], [0, 0.59, 0], mat('#3b3a38', 0.5, 0.3));
  const lid = cyl(g, d * 0.3, d * 0.3, w * 0.6, [0, 0.74, 0], black);
  lid.rotation.z = Math.PI / 2;
  lid.scale.set(1, 1, 0.7);
  lid.position.y = 0.74 + d * 0.12;
  box(g, [w * 0.45, 0.025, 0.025], [0, h - 0.05, d * 0.3], CHROME());
  return g;
};

const pool: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  const tile = mat('#e8e6e0', 0.35);
  box(g, [w, h * 0.82, 0.25], [0, 0, d / 2 - 0.125], tile);
  box(g, [w, h * 0.82, 0.25], [0, 0, -d / 2 + 0.125], tile);
  for (const sx of [-1, 1]) box(g, [0.25, h * 0.82, d - 0.5], [sx * (w / 2 - 0.125), 0, 0], tile);
  box(g, [w - 0.5, 0.02, d - 0.5], [0, h * 0.45, 0], mat('#4fb3d9', 0.05, 0.2, { transparent: true, opacity: 0.85 }));
  box(g, [w - 0.5, 0.01, d - 0.5], [0, 0, 0], mat('#7ac6df', 0.3));
  for (const z of [-1, 1]) box(g, [0.04, h * 1.6, 0.04], [w / 2 - 0.5, 0, z * (d / 2 - 0.12)], CHROME()); // ladder rails
  return g;
};

const fountain: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  const stone = mat('#cfcac0', 0.85);
  cyl(g, w / 2, w / 2, 0.3, [0, 0, 0], stone);
  cyl(g, w / 2 - 0.07, w / 2 - 0.07, 0.01, [0, 0.29, 0], mat('#5fb4d9', 0.05, 0.2, { transparent: true, opacity: 0.85 }));
  cyl(g, 0.1, 0.14, h * 0.45, [0, 0.3, 0], stone);
  cyl(g, w * 0.28, w * 0.12, 0.14, [0, h * 0.5, 0], stone);
  cyl(g, w * 0.25, w * 0.25, 0.01, [0, h * 0.5 + 0.13, 0], mat('#5fb4d9', 0.05, 0.2, { transparent: true, opacity: 0.85 }));
  cyl(g, 0.04, 0.05, h * 0.3, [0, h * 0.5 + 0.14, 0], stone);
  cyl(g, 0.012, 0.03, h * 0.14, [0, h * 0.85, 0], mat('#bfe3f2', 0.1, 0, { transparent: true, opacity: 0.6 }));
  return g;
};

const car: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const paint = mat(c, 0.3, 0.5);
  const dark = mat('#1d1f22', 0.6);
  box(g, [w, 0.55, d * 0.96], [0, 0.28, 0], paint); // lower body
  box(g, [w * 0.9, 0.12, d * 0.3], [0, 0.55, d * 0.3], paint); // bonnet
  box(g, [w * 0.88, 0.5, d * 0.46], [0, 0.8, -d * 0.04], paint); // cabin
  box(g, [w * 0.89, 0.34, d * 0.4], [0, 0.86, -d * 0.04], GLASS());
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const wheel = cyl(g, 0.31, 0.31, 0.24, [sx * (w / 2 - 0.1), 0, sz * d * 0.31], dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.y = 0.31;
    const hub = cyl(g, 0.17, 0.17, 0.26, [sx * (w / 2 - 0.1), 0, sz * d * 0.31], CHROME());
    hub.rotation.z = Math.PI / 2;
    hub.position.y = 0.31;
  }
  for (const sx of [-1, 1]) {
    box(g, [0.22, 0.1, 0.03], [sx * w * 0.32, 0.5, d * 0.48], GLOW());
    box(g, [0.2, 0.08, 0.03], [sx * w * 0.32, 0.5, -d * 0.48], mat('#c0392b', 0.4, 0, { emissive: new THREE.Color('#c0392b'), emissiveIntensity: 0.4 }));
  }
  void h;
  return g;
};

const bicycle: Builder = ({ w, d }) => {
  const g = new THREE.Group();
  const frame = mat('#3f5f86', 0.4, 0.5);
  const tyre = mat('#1d1f22', 0.7);
  const r = 0.34;
  const zf = d / 2 - r - 0.02;
  for (const z of [-zf, zf]) ring(g, r, 0.025, [0, r + 0.026, z], tyre, 0).rotation.y = Math.PI / 2;
  const bb: V3 = [0, 0.3, -zf * 0.15];
  rod(g, [0, r, -zf], bb, 0.015, frame);
  rod(g, bb, [0, 0.62, -zf * 0.5], 0.015, frame);
  rod(g, [0, 0.62, -zf * 0.5], [0, r, -zf], 0.015, frame);
  rod(g, [0, 0.62, -zf * 0.5], [0, 0.66, zf * 0.55], 0.015, frame);
  rod(g, bb, [0, 0.66, zf * 0.55], 0.015, frame);
  rod(g, [0, 0.66, zf * 0.55], [0, r, zf], 0.015, frame);
  box(g, [0.08, 0.025, 0.2], [0, 0.66, -zf * 0.55], BLACK()); // saddle
  box(g, [w, 0.02, 0.02], [0, 0.78, zf * 0.55], BLACK()); // handlebar
  return g;
};

const lampPost: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  const iron = mat('#2b2a28', 0.5, 0.5);
  cyl(g, w * 0.4, w / 2, 0.25, [0, 0, 0], iron);
  cyl(g, 0.03, 0.045, h - 0.65, [0, 0.25, 0], iron);
  box(g, [w * 0.7, 0.04, w * 0.7], [0, h - 0.42, 0], iron);
  cyl(g, w * 0.34, w * 0.26, 0.32, [0, h - 0.4, 0], GLASS());
  cyl(g, w * 0.14, w * 0.14, 0.2, [0, h - 0.34, 0], GLOW());
  cyl(g, 0.0, w * 0.4, 0.12, [0, h - 0.1, 0], iron);
  return g;
};

const gardenGate: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  const iron = mat('#2b2a28', 0.5, 0.5);
  for (const sx of [-1, 1]) box(g, [0.1, h, d + 0.04], [sx * (w / 2 - 0.05), 0, 0], mat('#a8a49c', 0.9));
  box(g, [w - 0.2, 0.04, 0.04], [0, 0.1, 0], iron);
  box(g, [w - 0.2, 0.04, 0.04], [0, h - 0.18, 0], iron);
  const n = 9;
  for (let i = 0; i < n; i++) {
    const x = -(w - 0.28) / 2 + (i * (w - 0.28)) / (n - 1);
    box(g, [0.02, h - 0.2, 0.02], [x, 0.08, 0], iron);
    cyl(g, 0, 0.018, 0.06, [x, h - 0.13, 0], iron, 4);
  }
  return g;
};

const fenceSection: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const wood = mat(c, 0.7);
  for (const sx of [-1, 1]) box(g, [0.08, h, 0.08], [sx * (w / 2 - 0.04), 0, 0], mat(shade(c, -0.1), 0.7));
  for (const y of [h * 0.25, h * 0.7]) box(g, [w - 0.16, 0.06, d * 0.6], [0, y, -d * 0.1], mat(shade(c, -0.05), 0.7));
  const n = 10;
  for (let i = 0; i < n; i++) box(g, [(w - 0.2) / n - 0.02, h * 0.92, 0.025], [-w / 2 + 0.1 + ((i + 0.5) * (w - 0.2)) / n, 0, d * 0.25], wood);
  return g;
};

const planterBox: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, h * 0.8, d], [0, 0, 0], mat('#8f6f4f', 0.8));
  box(g, [w - 0.08, 0.02, d - 0.08], [0, h * 0.8, 0], SOIL());
  for (let i = 0; i < 5; i++) {
    const x = -w / 2 + 0.14 + (i * (w - 0.28)) / 4;
    ball(g, [0.09, 0.1, 0.09], [x, h * 0.8 + 0.1, ((i % 2) - 0.5) * 0.1], i % 2 ? GREEN() : GREEN2());
    ball(g, [0.035, 0.03, 0.035], [x + 0.03, h * 0.8 + 0.2, ((i % 2) - 0.5) * 0.1], mat(['#e8b4b8', '#f4d58a', '#ffffff'][i % 3]!, 0.7));
  }
  return g;
};

const waterTank: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  const black = mat('#1f2326', 0.55);
  cyl(g, w * 0.46, w / 2, h * 0.86, [0, 0, 0], black);
  for (let i = 0; i < 3; i++) cyl(g, w * 0.5 + 0.005, w * 0.5 + 0.005, 0.03, [0, 0.2 + i * 0.35, 0], mat('#2c3236', 0.55));
  cyl(g, w * 0.46, w * 0.34, h * 0.1, [0, h * 0.86, 0], black);
  cyl(g, w * 0.1, w * 0.1, h * 0.05, [0, h * 0.95, 0], mat('#3c8dbc', 0.5));
  return g;
};

const steppingStones: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  const n = 5;
  for (let i = 0; i < n; i++) {
    const z = -d / 2 + 0.2 + (i * (d - 0.4)) / (n - 1);
    const x = ((i % 2) - 0.5) * w * 0.3;
    const s = cyl(g, w * 0.42, w * 0.45, h, [x, 0, z], mat(i % 2 ? '#a8a49c' : '#bdb8ae', 0.95), 14);
    s.scale.set(1, 1, 0.85);
  }
  return g;
};

const dustbin: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  const green = mat('#3c7a4d', 0.6);
  cyl(g, w / 2, w * 0.4, h - 0.08, [0, 0, 0], green);
  cyl(g, w / 2 + 0.01, w / 2 + 0.01, 0.06, [0, h - 0.08, 0], mat('#2f6140', 0.6));
  box(g, [0.1, 0.03, 0.03], [0, h - 0.01, 0], BLACK());
  return g;
};

export const BUILDERS2: Record<string, Builder> = {
  'sofa-l': sofaL,
  ottoman,
  'console-table': consoleTable,
  'display-cabinet': displayCabinet,
  'bean-bag': beanBag,
  'shoe-rack': shoeRack,
  'pooja-mandir': poojaMandir,
  'swing-jhula': swingJhula,
  'bunk-bed': bunkBed,
  crib,
  vanity,
  'bed-bench': bedBench,
  'kitchen-tall': kitchenTall,
  'kitchen-wall': kitchenWall,
  'kitchen-island': kitchenIsland,
  'cooker-hood': cookerHood,
  dishwasher,
  'washing-machine': washingMachine,
  'dining-table-round': diningTableRound,
  'vanity-unit': vanityUnit,
  'towel-rail': towelRail,
  'mirror-cabinet': mirrorCabinet,
  'laundry-basket': laundryBasket,
  'filing-cabinet': filingCabinet,
  'desk-l': deskL,
  whiteboard,
  'bookcase-low': bookcaseLow,
  curtain,
  'wall-clock': wallClock,
  'wall-shelf': wallShelf,
  vase,
  'rug-round': rugRound,
  fireplace,
  'table-lamp': tableLamp,
  chandelier,
  'wall-sconce': wallSconce,
  'ceiling-fan': ceilingFan,
  'arc-lamp': arcLamp,
  succulent,
  'palm-indoor': palmIndoor,
  bonsai,
  cactus,
  tulsi,
  'tree-round': treeRound,
  'tree-pine': treePine,
  'tree-palm': treePalm,
  bush,
  hedge,
  'flower-bed': flowerBed,
  'garden-bench': gardenBench,
  'patio-table': patioTable,
  'patio-chair': patioChair,
  'patio-umbrella': patioUmbrella,
  'sun-lounger': sunLounger,
  'bbq-grill': bbqGrill,
  pool,
  fountain,
  car,
  bicycle,
  'lamp-post': lampPost,
  'garden-gate': gardenGate,
  'fence-section': fenceSection,
  'planter-box': planterBox,
  'water-tank': waterTank,
  'stepping-stones': steppingStones,
  dustbin,
};
