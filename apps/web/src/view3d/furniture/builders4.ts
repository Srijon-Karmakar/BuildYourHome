import * as THREE from 'three';
import { ring, rod } from './builders2';
import { sofaLike } from './builders3';
import { ball, BLACK, box, CHROME, cyl, GLASS, GLOW, legs, mat, shade, WHITE, type Builder } from './kit';

/** Procedural models for catalog batch 4 (same conventions as builders.ts / builders3.ts). */

const GREEN = () => mat('#5f8a55', 0.85);
const GREEN2 = () => mat('#7aa66b', 0.85);
const SOIL = () => mat('#4a3a2c', 1);
const BRASS = () => mat('#c9a47a', 0.4, 0.7);
const STEEL = () => mat('#c9cbcd', 0.3, 0.8);
const WATER = () => mat('#5fb4d9', 0.05, 0.2, { transparent: true, opacity: 0.8 });

// ----------------------------------------------------------------------------------------------- living

const loveseat: Builder = sofaLike({ seatH: 0.42, backH: 0.42, arm: 0.15 });

const wingback: Builder = (x) => {
  const g = sofaLike({ seatH: 0.45, backH: 0.6, arm: 0.14, wood: true })(x);
  const fabric = mat(x.c, 0.9);
  for (const sx of [-1, 1]) box(g, [0.12, 0.35, 0.3], [sx * (x.w / 2 - 0.12), 0.7, -x.d / 2 + 0.2], fabric);
  return g;
};

const tvConsole: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const wood = mat(c, 0.5);
  legs(g, w, d, 0.1, 0.035, mat(shade(c, -0.15), 0.5), 0.04);
  box(g, [w, h - 0.1, d], [0, 0.1, 0], wood);
  const n = 3;
  for (let i = 0; i < n; i++) {
    box(g, [w / n - 0.02, h - 0.16, 0.012], [-w / 2 + (i + 0.5) * (w / n), 0.13, d / 2 + 0.004], mat(shade(c, i === 1 ? 0.04 : -0.03), 0.5));
    box(g, [0.1, 0.012, 0.02], [-w / 2 + (i + 0.5) * (w / n), h * 0.75, d / 2 + 0.02], CHROME());
  }
  return g;
};

const coatStand: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  const wood = mat('#6b4a30', 0.5);
  cyl(g, w * 0.4, w * 0.45, 0.04, [0, 0, 0], wood);
  cyl(g, 0.022, 0.025, h - 0.04, [0, 0.04, 0], wood);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const y = h - 0.08 - (i % 2) * 0.1;
    rod(g, [0, y, 0], [Math.sin(a) * w * 0.4, y + 0.1, Math.cos(a) * w * 0.4], 0.012, wood);
  }
  ball(g, [0.035, 0.035, 0.035], [0, h - 0.01, 0], wood);
  return g;
};

const shoeBench: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const wood = mat(c, 0.55);
  box(g, [w, 0.08, d], [0, h - 0.08, 0], mat('#c9b79c', 0.9));
  for (const sx of [-1, 1]) box(g, [0.04, h - 0.08, d - 0.04], [sx * (w / 2 - 0.02), 0, 0], wood);
  for (const y of [0.04, 0.2]) {
    box(g, [w - 0.08, 0.02, d - 0.04], [0, y, 0], wood);
    for (let k = 0; k < 3; k++) box(g, [0.14, 0.07, 0.26], [-w * 0.3 + k * 0.28, y + 0.02, 0], mat(['#262626', '#b5604a', '#c9b79c'][(k + y * 10) % 3 | 0]!, 0.7));
  }
  return g;
};

const nestingTables: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const wood = mat(c, 0.5);
  const leg = mat(shade(c, -0.12), 0.5);
  // Three tables, each smaller and lower, shifted along x so they read as a nested set.
  [[1, 0], [0.82, 0.5], [0.64, 1]].forEach(([k, off], idx) => {
    const tw = w * 0.6 * k!;
    const td = d * 0.9 * k!;
    const top = h * (1 - idx * 0.15);
    const x = -w / 2 + tw / 2 + off! * (w - tw);
    box(g, [tw, 0.03, td], [x, top - 0.03, 0], wood);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, [0.025, top - 0.03, 0.025], [x + sx * (tw / 2 - 0.035), 0, sz * (td / 2 - 0.035)], leg);
  });
  return g;
};

// ----------------------------------------------------------------------------------------------- bedroom

const storageBed: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const fabric = mat(c, 0.9);
  box(g, [w, 0.34, d], [0, 0.06, 0], mat('#7a5238', 0.55));
  box(g, [w - 0.04, 0.22, d - 0.08], [0, 0.4, 0.02], mat('#efece6', 0.9));
  box(g, [w - 0.02, 0.07, d * 0.6], [0, 0.6, d * 0.15], fabric);
  box(g, [w, h, 0.1], [0, 0, -d / 2 + 0.05], fabric);
  for (let i = 0; i < 2; i++) {
    box(g, [w / 2 - 0.06, 0.2, 0.012], [(i - 0.5) * (w / 2), 0.12, d / 2 + 0.004], mat('#6b4a30', 0.55));
    box(g, [0.14, 0.012, 0.02], [(i - 0.5) * (w / 2), 0.25, d / 2 + 0.02], CHROME());
  }
  for (let i = 0; i < 2; i++) box(g, [w / 2 - 0.2, 0.12, 0.38], [(i - 0.5) * (w / 2), 0.6, -d / 2 + 0.34], mat('#f7f6f2', 0.95)).rotation.x = -0.1;
  return g;
};

const chestDrawers: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const wood = mat(c, 0.5);
  legs(g, w, d, 0.08, 0.04, mat(shade(c, -0.15), 0.5), 0.04);
  box(g, [w, h - 0.08, d], [0, 0.08, 0], wood);
  const rows = 5;
  const rh = (h - 0.14) / rows;
  for (let i = 0; i < rows; i++) {
    box(g, [w - 0.06, rh - 0.015, 0.012], [0, 0.1 + i * rh, d / 2 + 0.004], mat(shade(c, i % 2 ? 0.02 : -0.04), 0.5));
    box(g, [0.12, 0.012, 0.02], [0, 0.1 + i * rh + rh / 2, d / 2 + 0.02], CHROME());
  }
  return g;
};

const canopyBed: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const wood = mat(c, 0.5);
  box(g, [w, 0.3, d], [0, 0.08, 0], wood);
  box(g, [w - 0.06, 0.2, d - 0.12], [0, 0.38, 0.02], mat('#efece6', 0.9));
  box(g, [w - 0.02, 0.06, d * 0.6], [0, 0.57, d * 0.15], mat('#c9b79c', 0.9));
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) box(g, [0.08, h - 0.05, 0.08], [x * (w / 2 - 0.04), 0.05, z * (d / 2 - 0.04)], wood);
  for (const z of [-1, 1]) box(g, [w, 0.06, 0.06], [0, h - 0.06, z * (d / 2 - 0.04)], wood);
  for (const x of [-1, 1]) box(g, [0.06, 0.06, d], [x * (w / 2 - 0.04), h - 0.06, 0], wood);
  const sheer = mat('#f4f0e6', 0.95, 0, { transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false });
  for (const x of [-1, 1]) box(g, [0.01, h * 0.7, d * 0.9], [x * (w / 2 - 0.03), h * 0.28, 0], sheer);
  box(g, [w - 0.2, h * 0.7, 0.01], [0, h * 0.28, -d / 2 + 0.03], sheer);
  return g;
};

const vanityStool: Builder = ({ c, w, h }) => {
  const g = new THREE.Group();
  cyl(g, w / 2, w / 2, 0.1, [0, h - 0.1, 0], mat(c, 0.9));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    rod(g, [Math.sin(a) * w * 0.3, 0.015, Math.cos(a) * w * 0.3], [Math.sin(a) * w * 0.16, h - 0.1, Math.cos(a) * w * 0.16], 0.015, BRASS());
  }
  return g;
};

// ----------------------------------------------------------------------------------------------- kids

const kidsDesk: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const wood = mat(c, 0.55);
  box(g, [w, 0.03, d], [0, h - 0.03, 0], mat('#f1efea', 0.5));
  for (const sx of [-1, 1]) box(g, [0.03, h - 0.03, d - 0.06], [sx * (w / 2 - 0.02), 0, 0], wood);
  box(g, [0.3, h - 0.2, d - 0.1], [w / 2 - 0.2, 0.08, 0], mat(shade(c, -0.05), 0.55));
  for (let i = 0; i < 3; i++) box(g, [0.26, 0.12, 0.01], [w / 2 - 0.2, 0.1 + i * 0.13, d / 2 - 0.04], mat(['#4d9fd0', '#f4d58a', '#d9694f'][i]!, 0.6));
  return g;
};

const kidsChair: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const wood = mat(c, 0.55);
  box(g, [w, 0.03, d], [0, 0.28, 0], mat('#4d9fd0', 0.6));
  legs(g, w, d, 0.28, 0.025, wood, 0.01);
  box(g, [w, h - 0.31, 0.025], [0, 0.31, -d / 2 + 0.015], mat('#4d9fd0', 0.6));
  return g;
};

const playTent: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  const tent = cyl(g, 0.02, w * 0.36, h - 0.05, [0, 0.02, 0], mat('#f4e3c8', 0.9, 0, { side: THREE.DoubleSide }), 4);
  tent.rotation.y = Math.PI / 4;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    rod(g, [Math.sin(a) * w * 0.4, 0.02, Math.cos(a) * w * 0.4], [0, h, 0], 0.012, mat('#c9a47a', 0.6));
  }
  box(g, [w * 0.3, h * 0.45, 0.01], [0, 0.02, w * 0.36], mat('#6b4a30', 0.9));
  box(g, [w * 0.26, 0.05, 0.012], [0, h * 0.65, w * 0.29], mat('#d9694f', 0.8));
  box(g, [w * 0.9, 0.012, w * 0.9], [0, 0, 0], mat('#e8b4b8', 0.95));
  return g;
};

const toyKitchen: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, h * 0.62, d], [0, 0, 0], mat('#f1efea', 0.5));
  box(g, [w + 0.02, 0.025, d + 0.02], [0, h * 0.62, 0], mat('#4d9fd0', 0.5));
  box(g, [w * 0.4, h * 0.4, 0.01], [-w * 0.2, 0.05, d / 2 + 0.004], mat('#2b2a28', 0.4));
  for (let i = 0; i < 4; i++) cyl(g, 0.035, 0.035, 0.008, [w * 0.12 + (i % 2) * 0.12, h * 0.645, -0.04 + Math.floor(i / 2) * 0.1], BLACK());
  box(g, [w, h * 0.38, 0.03], [0, h * 0.64, -d / 2 + 0.015], mat('#d9694f', 0.5));
  box(g, [w * 0.7, 0.025, 0.1], [0, h * 0.82, -d / 2 + 0.08], mat('#f1efea', 0.5));
  return g;
};

// ----------------------------------------------------------------------------------------------- kitchen & dining

const kitchenTrolley: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const body = mat(c, 0.5);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    cyl(g, 0.012, 0.012, h - 0.07, [x * (w / 2 - 0.02), 0.06, z * (d / 2 - 0.02)], CHROME());
    cyl(g, 0.025, 0.025, 0.04, [x * (w / 2 - 0.03), 0.01, z * (d / 2 - 0.03)], BLACK());
  }
  for (const y of [0.1, 0.42, h - 0.03]) box(g, [w, 0.03, d], [0, y, 0], body);
  box(g, [0.1, 0.12, 0.1], [-0.08, 0.13, 0], mat('#b5604a', 0.6));
  return g;
};

const sinkDouble: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, h - 0.04, d], [0, 0, 0], mat(c, 0.5));
  box(g, [w + 0.02, 0.04, d + 0.02], [0, h - 0.04, 0], mat('#d9d5cc', 0.3));
  for (const sx of [-1, 1]) box(g, [w * 0.28, 0.01, d * 0.6], [sx * w * 0.2, h - 0.001, 0.02], STEEL());
  cyl(g, 0.014, 0.014, 0.28, [0, h, -d / 2 + 0.07], CHROME());
  box(g, [0.02, 0.012, 0.14], [0, h + 0.27, -d / 2 + 0.13], CHROME());
  for (let i = 0; i < 3; i++) {
    box(g, [w / 3 - 0.03, h - 0.1, 0.012], [-w / 2 + (i + 0.5) * (w / 3), 0.04, d / 2 + 0.004], mat(shade(c, -0.04), 0.5));
    box(g, [0.1, 0.012, 0.02], [-w / 2 + (i + 0.5) * (w / 3), h * 0.7, d / 2 + 0.02], CHROME());
  }
  return g;
};

const waterDispenser: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, h * 0.62, d], [0, 0, 0], mat('#e8e6e0', 0.4));
  cyl(g, w * 0.34, w * 0.34, h * 0.32, [0, h * 0.64, 0], mat('#8fc4e8', 0.1, 0, { transparent: true, opacity: 0.6 }), 24);
  cyl(g, w * 0.16, w * 0.2, 0.05, [0, h * 0.96, 0], mat('#8fc4e8', 0.1, 0, { transparent: true, opacity: 0.6 }), 20);
  for (const [sx, col] of [[-1, '#c0392b'], [1, '#2b6cb0']] as const) box(g, [0.04, 0.05, 0.05], [sx * 0.06, h * 0.45, d / 2 + 0.02], mat(col, 0.4));
  box(g, [w * 0.7, 0.012, d * 0.5], [0, h * 0.18, d * 0.15], mat('#bdbab2', 0.5));
  return g;
};

const pantryUnit: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, h - 0.08, d], [0, 0.08, 0], mat(c, 0.5));
  box(g, [w - 0.06, 0.08, d - 0.06], [0, 0, 0], BLACK());
  for (const sx of [-1, 1]) {
    box(g, [w / 2 - 0.015, h * 0.46, 0.014], [sx * (w / 4), 0.12, d / 2 + 0.005], mat(shade(c, -0.04), 0.5));
    box(g, [w / 2 - 0.015, h * 0.46, 0.014], [sx * (w / 4), 0.12 + h * 0.47, d / 2 + 0.005], mat(shade(c, -0.04), 0.5));
    box(g, [0.014, 0.3, 0.02], [sx * 0.04, h * 0.4, d / 2 + 0.02], CHROME());
    box(g, [0.014, 0.3, 0.02], [sx * 0.04, h * 0.85, d / 2 + 0.02], CHROME());
  }
  return g;
};

const kitchenCorner: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const body = mat(c, 0.5);
  const arm = 0.6;
  box(g, [w, h - 0.04, arm], [0, 0, -d / 2 + arm / 2], body);
  box(g, [arm, h - 0.04, d - arm], [-w / 2 + arm / 2, 0, arm / 2 - 0.0], body);
  box(g, [w + 0.02, 0.04, arm + 0.02], [0, h - 0.04, -d / 2 + arm / 2], mat('#d9d5cc', 0.3));
  box(g, [arm + 0.02, 0.04, d - arm], [-w / 2 + arm / 2, h - 0.04, arm / 2], mat('#d9d5cc', 0.3));
  box(g, [w - arm, h - 0.1, 0.012], [arm / 2, 0.04, -d / 2 + arm + 0.004], mat(shade(c, -0.04), 0.5));
  return g;
};

// ----------------------------------------------------------------------------------------------- bathroom

const toiletWall: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w + 0.06, 0.7, 0.15], [0, 0, -d / 2 + 0.075], mat('#d9d5cc', 0.7));
  box(g, [0.2, 0.12, 0.012], [0, 0.45, -d / 2 + 0.156], CHROME());
  const bowl = cyl(g, 0.5, 0.35, h * 0.55, [0, h * 0.42, 0.03], WHITE(), 24);
  bowl.scale.set(w * 0.9, 1, d * 0.8);
  box(g, [w * 0.9, 0.04, d * 0.75], [0, h * 0.97, 0.03], mat('#efece6', 0.4));
  return g;
};

const doubleVanity: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, h - 0.05, d], [0, 0, 0], mat(c, 0.5));
  box(g, [w + 0.02, 0.04, d + 0.02], [0, h - 0.05, 0], mat('#e8e6e0', 0.22));
  for (const sx of [-1, 1]) {
    box(g, [w * 0.22, 0.06, d * 0.7], [sx * w * 0.25, h - 0.02, 0.01], WHITE());
    cyl(g, 0.012, 0.012, 0.14, [sx * w * 0.25, h, -d * 0.28], CHROME());
    box(g, [w / 4 - 0.03, h - 0.12, 0.012], [sx * (w * 0.25), 0.04, d / 2 + 0.004], mat(shade(c, -0.05), 0.5));
    box(g, [0.1, 0.014, 0.02], [sx * w * 0.25, h - 0.16, d / 2 + 0.02], CHROME());
  }
  return g;
};

const bathStool: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  cyl(g, w / 2, w / 2, 0.04, [0, h - 0.04, 0], mat('#c9a47a', 0.6));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    rod(g, [Math.sin(a) * w * 0.35, 0.01, Math.cos(a) * w * 0.35], [Math.sin(a) * w * 0.2, h - 0.04, Math.cos(a) * w * 0.2], 0.015, mat('#a8814f', 0.6));
  }
  return g;
};

// ----------------------------------------------------------------------------------------------- office

const standingDesk: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const frame = mat('#2b2a28', 0.45, 0.5);
  box(g, [w, 0.04, d], [0, h * 0.7, 0], mat(c, 0.45));
  for (const sx of [-1, 1]) {
    box(g, [0.06, h * 0.7, 0.06], [sx * (w / 2 - 0.12), 0.03, 0], frame);
    box(g, [0.05, 0.03, d - 0.1], [sx * (w / 2 - 0.12), 0, 0], frame);
  }
  box(g, [0.5, 0.32, 0.02], [0, h * 0.7 + 0.2, -d * 0.2], BLACK());
  box(g, [0.05, 0.16, 0.05], [0, h * 0.7 + 0.04, -d * 0.2], BLACK());
  box(g, [0.4, 0.015, 0.14], [0, h * 0.7 + 0.04, d * 0.1], mat('#3b3a38', 0.5));
  return g;
};

const conferenceChair: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const fabric = mat(c, 0.9);
  cyl(g, 0.025, 0.025, 0.4, [0, 0.05, 0], CHROME());
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    rod(g, [0, 0.06, 0], [Math.sin(a) * w * 0.45, 0.04, Math.cos(a) * w * 0.45], 0.015, BLACK());
    ball(g, [0.025, 0.025, 0.025], [Math.sin(a) * w * 0.45, 0.025, Math.cos(a) * w * 0.45], BLACK());
  }
  box(g, [w * 0.85, 0.09, d * 0.85], [0, 0.45, 0.02], fabric);
  box(g, [w * 0.8, h * 0.45, 0.07], [0, 0.5, -d * 0.4], fabric).rotation.x = -0.1;
  for (const sx of [-1, 1]) box(g, [0.04, 0.03, d * 0.4], [sx * (w * 0.4), 0.66, 0], BLACK());
  return g;
};

const cubicle: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const panel = mat(shade(c, -0.1), 0.9);
  box(g, [w, h, 0.06], [0, 0, -d / 2 + 0.03], panel);
  box(g, [0.06, h, d], [-w / 2 + 0.03, 0, 0], panel);
  box(g, [0.06, h * 0.85, d * 0.5], [w / 2 - 0.03, 0, -d * 0.25], panel);
  box(g, [w - 0.2, 0.04, d * 0.5], [0, 0.72, -d * 0.22], mat('#e8e6e0', 0.45));
  box(g, [0.5, 0.32, 0.02], [0, 0.78, -d * 0.4], BLACK());
  box(g, [0.45, 0.46, 0.5], [w * 0.2, 0, -d * 0.2], mat('#bdbab2', 0.45));
  return g;
};

// ----------------------------------------------------------------------------------------------- decor

const tallVase: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  const clay = mat('#3b5b6e', 0.4);
  ball(g, [w * 0.5, h * 0.3, w * 0.5], [0, h * 0.3, 0], clay);
  cyl(g, w * 0.16, w * 0.3, h * 0.28, [0, h * 0.5, 0], clay);
  cyl(g, w * 0.2, w * 0.16, 0.04, [0, h * 0.78, 0], clay);
  for (let i = 0; i < 5; i++) {
    const a = i * 1.3;
    rod(g, [0, h * 0.78, 0], [Math.sin(a) * 0.12, h - 0.02 - (i % 2) * 0.1, Math.cos(a) * 0.12], 0.006, mat('#6e7a45', 0.9));
    ball(g, [0.035, 0.035, 0.035], [Math.sin(a) * 0.12, h - 0.02 - (i % 2) * 0.1, Math.cos(a) * 0.12], mat(['#e8b4b8', '#f4d58a', '#ffffff'][i % 3]!, 0.7));
  }
  return g;
};

const aquarium: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  const stand = mat('#3b3a38', 0.5);
  box(g, [w, 0.55, d], [0, 0, 0], stand);
  box(g, [w - 0.06, h - 0.65, d - 0.06], [0, 0.57, 0], WATER());
  box(g, [w - 0.02, h - 0.62, d - 0.02], [0, 0.56, 0], GLASS());
  box(g, [w, 0.05, d], [0, h - 0.06, 0], stand);
  box(g, [w - 0.2, 0.02, d - 0.2], [0, h - 0.015, 0], GLOW());
  box(g, [w - 0.08, 0.04, d - 0.08], [0, 0.55, 0], mat('#d9c9a3', 1));
  for (let i = 0; i < 6; i++) ball(g, [0.04, 0.02, 0.012], [-w * 0.35 + i * w * 0.14, 0.8 + (i % 3) * 0.12, -0.05 + (i % 2) * 0.1], mat(['#e6732b', '#f4d58a', '#4d9fd0'][i % 3]!, 0.5));
  for (let i = 0; i < 4; i++) rod(g, [-w * 0.3 + i * 0.2, 0.58, -d * 0.25], [-w * 0.3 + i * 0.2 + 0.03, 0.9, -d * 0.25], 0.01, GREEN());
  return g;
};

const urli: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  const bowl = cyl(g, w / 2, w * 0.38, h, [0, 0, 0], BRASS(), 32);
  void bowl;
  cyl(g, w / 2 - 0.03, w / 2 - 0.03, 0.01, [0, h - 0.04, 0], WATER(), 32);
  const cols = ['#f4d58a', '#e8b4b8', '#d9694f', '#ffffff'];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r = w * 0.28 * (i % 2 ? 0.55 : 1);
    ball(g, [0.05, 0.015, 0.05], [Math.sin(a) * r, h - 0.025, Math.cos(a) * r], mat(cols[i % 4]!, 0.7));
  }
  ball(g, [0.03, 0.04, 0.03], [0, h - 0.015, 0], GLOW());
  return g;
};

const wallMandala: Builder = ({ w, d }) => {
  const g = new THREE.Group();
  const cols = ['#2b2a28', '#d9694f', '#f4d58a', '#4d6783', '#f1efea', '#b5604a'];
  for (let i = 0; i < cols.length; i++) {
    const disc = cyl(g, (w / 2) * (1 - i * 0.15), (w / 2) * (1 - i * 0.15), 0.008, [0, 0, 0], mat(cols[i]!, 0.7), 32);
    disc.rotation.x = Math.PI / 2;
    disc.position.set(0, 0, d - 0.03 + i * 0.008);
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ball(g, [0.03, 0.06, 0.008], [Math.sin(a) * w * 0.43, Math.cos(a) * w * 0.43, d - 0.03], mat('#f4d58a', 0.7)).rotation.z = -a;
  }
  return g;
};

const globe: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  cyl(g, w * 0.3, w * 0.35, 0.03, [0, 0, 0], mat('#3b2f27', 0.5));
  cyl(g, 0.015, 0.015, h * 0.25, [0, 0.03, 0], BRASS());
  const r = (h - 0.12) / 2;
  ball(g, [r, r, r], [0, 0.06 + r + 0.08, 0], mat('#4d86b0', 0.6));
  for (const [x, y, z, s] of [[0.1, 0.4, 0.1, 0.1], [-0.1, 0.34, 0.12, 0.08], [0.05, 0.3, -0.12, 0.09]] as const) ball(g, [s, s * 0.8, s * 0.4], [x * (r / 0.2), y, z * (r / 0.2) * 0.6], mat('#8fae6a', 0.7));
  ring(g, r + 0.02, 0.008, [0, 0.06 + r + 0.08, 0], BRASS(), 0).rotation.y = Math.PI / 2;
  return g;
};

// ----------------------------------------------------------------------------------------------- outdoor

const hammock: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  const wood = mat('#6b4a30', 0.7);
  const cloth = mat('#d9a066', 0.9);
  for (const sx of [-1, 1]) cyl(g, 0.05, 0.06, h, [sx * (w / 2 - 0.1), 0, 0], wood);
  const n = 11;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const x = -w * 0.4 + t * w * 0.8;
    const y = h * 0.85 - Math.sin(t * Math.PI) * 0.45;
    box(g, [w * 0.8 / n + 0.02, 0.03, d * 0.8], [x, y, 0], cloth).rotation.z = Math.cos(t * Math.PI) * 0.5;
  }
  for (const sx of [-1, 1]) rod(g, [sx * (w / 2 - 0.1), h * 0.95, 0], [sx * w * 0.4, h * 0.85, 0], 0.012, mat('#e8dcc4', 0.9));
  return g;
};

const birdBath: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  const stone = mat('#bfb9ae', 0.9);
  cyl(g, w * 0.25, w * 0.32, 0.08, [0, 0, 0], stone);
  cyl(g, w * 0.09, w * 0.13, h - 0.28, [0, 0.08, 0], stone);
  cyl(g, w / 2, w * 0.18, 0.16, [0, h - 0.2, 0], stone, 28);
  cyl(g, w / 2 - 0.05, w / 2 - 0.05, 0.01, [0, h - 0.06, 0], WATER(), 28);
  ball(g, [0.05, 0.04, 0.06], [0.08, h - 0.02, 0], mat('#8a5a43', 0.7));
  return g;
};

const well: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  const stone = mat('#a39f96', 0.95);
  cyl(g, w / 2, w / 2, h * 0.4, [0, 0, 0], stone, 24);
  cyl(g, w / 2 - 0.1, w / 2 - 0.1, 0.02, [0, h * 0.4 - 0.01, 0], mat('#12202c', 0.2), 24);
  for (const sx of [-1, 1]) box(g, [0.08, h * 0.6, 0.08], [sx * (w / 2 - 0.08), h * 0.4, 0], mat('#6b4a30', 0.7));
  for (const s of [-1, 1]) box(g, [w * 0.62, 0.05, w + 0.15], [s * (w * 0.2), h * 0.95, 0], mat('#7a4236', 0.7)).rotation.z = -s * 0.5;
  cyl(g, 0.025, 0.025, w - 0.2, [0, h * 0.78, 0], mat('#3b2f27', 0.7)).rotation.z = Math.PI / 2;
  g.children[g.children.length - 1]!.position.set(0, h * 0.78, 0);
  cyl(g, 0.1, 0.08, 0.16, [0, h * 0.5, 0], mat('#8a5a43', 0.6));
  rod(g, [0, h * 0.78, 0], [0, h * 0.5 + 0.16, 0], 0.006, mat('#3b2f27', 0.7));
  return g;
};

const greenhouse: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  const frame = mat('#e8e6e0', 0.5, 0.3);
  box(g, [w, 0.1, d], [0, 0, 0], mat('#8a8a86', 0.9));
  const wallH = h * 0.7;
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) box(g, [0.05, wallH, 0.05], [x * (w / 2 - 0.03), 0.1, z * (d / 2 - 0.03)], frame);
  for (const z of [-1, 1]) box(g, [w, wallH, 0.01], [0, 0.1, z * (d / 2 - 0.03)], GLASS());
  for (const x of [-1, 1]) box(g, [0.01, wallH, d], [x * (w / 2 - 0.03), 0.1, 0], GLASS());
  for (const s of [-1, 1]) {
    const roof = box(g, [w, 0.01, d * 0.6], [0, 0, s * d * 0.23], GLASS());
    roof.position.y = 0.1 + wallH + (h - wallH - 0.1) * 0.5;
    roof.rotation.x = s * 0.5;
  }
  box(g, [w, 0.05, 0.05], [0, h - 0.05, 0], frame);
  for (let i = 0; i < 4; i++) {
    box(g, [0.4, 0.2, 0.4], [-w * 0.3 + i * (w * 0.2), 0.1, -d * 0.2], mat('#8a5a43', 0.8));
    ball(g, [0.14, 0.18, 0.14], [-w * 0.3 + i * (w * 0.2), 0.42, -d * 0.2], i % 2 ? GREEN() : GREEN2());
  }
  return g;
};

const raisedBed: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  const wood = mat('#8f6f4f', 0.8);
  box(g, [w, h, 0.05], [0, 0, d / 2 - 0.025], wood);
  box(g, [w, h, 0.05], [0, 0, -d / 2 + 0.025], wood);
  for (const sx of [-1, 1]) box(g, [0.05, h, d - 0.1], [sx * (w / 2 - 0.025), 0, 0], wood);
  box(g, [w - 0.1, h * 0.85, d - 0.1], [0, 0, 0], SOIL());
  for (let i = 0; i < 8; i++) {
    const x = -w / 2 + 0.2 + (i % 4) * ((w - 0.4) / 3);
    const z = -d * 0.22 + Math.floor(i / 4) * d * 0.44;
    rod(g, [x, h * 0.85, z], [x, h + 0.18, z], 0.01, GREEN());
    ball(g, [0.08, 0.05, 0.08], [x, h + 0.14, z], mat(['#5f8a55', '#7aa66b', '#c0392b', '#e6732b'][i % 4]!, 0.8));
  }
  return g;
};

const gardenArch: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const wood = mat(c === '#b98a5b' ? '#e8e6e0' : c, 0.6);
  const r = w / 2 - 0.05;
  for (const sx of [-1, 1]) box(g, [0.06, h - r, d], [sx * r, 0, 0], wood);
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI;
    const a1 = ((i + 1) / n) * Math.PI;
    rod(g, [Math.cos(a0) * r, h - r + Math.sin(a0) * r, 0], [Math.cos(a1) * r, h - r + Math.sin(a1) * r, 0], 0.03, wood);
  }
  for (let i = 0; i < 9; i++) {
    const a = (i / 8) * Math.PI;
    ball(g, [0.07, 0.07, 0.07], [Math.cos(a) * r, h - r + Math.sin(a) * r, (i % 2) * 0.06 - 0.03], i % 2 ? GREEN() : GREEN2());
    if (i % 3 === 0) ball(g, [0.04, 0.04, 0.04], [Math.cos(a) * r, h - r + Math.sin(a) * r + 0.05, 0.05], mat('#e8b4b8', 0.7));
  }
  void d;
  return g;
};

const evCharger: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  cyl(g, 0.04, 0.05, 0.1, [0, 0, 0], mat('#3b3a38', 0.6));
  box(g, [w, h - 0.1, d], [0, 0.1, 0], mat('#f1efea', 0.35));
  box(g, [w - 0.08, 0.2, 0.01], [0, h * 0.6, d / 2 + 0.003], mat('#14161a', 0.2, 0, { emissive: new THREE.Color('#2ecc71'), emissiveIntensity: 0.35 }));
  box(g, [w, 0.05, d], [0, h - 0.05, 0], mat('#2ecc71', 0.4));
  cyl(g, 0.012, 0.012, 0.5, [w / 2, 0.5, 0], mat('#1d1f22', 0.7));
  return g;
};

const bikeRack: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  const steel = mat('#5b6168', 0.45, 0.6);
  box(g, [w, 0.04, d], [0, 0, 0], steel);
  const n = 5;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.2 + (i * (w - 0.4)) / (n - 1);
    ring(g, h * 0.45, 0.012, [x, h * 0.5, 0], steel, 0).rotation.y = Math.PI / 2;
  }
  return g;
};

const slide: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  const frame = mat('#3c7a4d', 0.5);
  const plat = h * 0.7;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, [0.07, plat, 0.07], [sx * (w / 2 - 0.05), 0, -d / 2 + 0.12 + (sz + 1) * 0.3], frame);
  box(g, [w, 0.05, 0.7], [0, plat, -d / 2 + 0.42], mat('#f4d58a', 0.6));
  for (const sx of [-1, 1]) box(g, [0.03, 0.4, 0.7], [sx * (w / 2 - 0.03), plat, -d / 2 + 0.42], frame);
  const ramp = box(g, [w - 0.1, 0.04, d - 0.9], [0, plat * 0.5, d * 0.17], mat('#d9694f', 0.45));
  ramp.rotation.x = Math.atan2(plat, d - 0.9);
  for (let i = 0; i < 5; i++) box(g, [0.5, 0.03, 0.05], [0, 0.15 + i * 0.22, -d / 2 + 0.06], frame);
  return g;
};

const sandbox: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  const wood = mat('#b98a5b', 0.75);
  box(g, [w, h, 0.06], [0, 0, d / 2 - 0.03], wood);
  box(g, [w, h, 0.06], [0, 0, -d / 2 + 0.03], wood);
  for (const sx of [-1, 1]) box(g, [0.06, h, d - 0.12], [sx * (w / 2 - 0.03), 0, 0], wood);
  box(g, [w - 0.12, h * 0.8, d - 0.12], [0, 0, 0], mat('#e3cf9f', 1));
  cyl(g, 0.07, 0.06, 0.1, [0.3, h * 0.8, 0.2], mat('#d9694f', 0.6));
  cyl(g, 0.05, 0.05, 0.08, [-0.25, h * 0.8, -0.2], mat('#4d9fd0', 0.6));
  return g;
};

export const BUILDERS4: Record<string, Builder> = {
  loveseat,
  wingback,
  'tv-console': tvConsole,
  'coat-stand': coatStand,
  'shoe-bench': shoeBench,
  'nesting-tables': nestingTables,
  'storage-bed': storageBed,
  'chest-drawers': chestDrawers,
  'canopy-bed': canopyBed,
  'vanity-stool': vanityStool,
  'kids-desk': kidsDesk,
  'kids-chair': kidsChair,
  'play-tent': playTent,
  'toy-kitchen': toyKitchen,
  'kitchen-trolley': kitchenTrolley,
  'sink-double': sinkDouble,
  'water-dispenser': waterDispenser,
  'pantry-unit': pantryUnit,
  'kitchen-corner': kitchenCorner,
  'toilet-wall': toiletWall,
  'double-vanity': doubleVanity,
  'bath-stool': bathStool,
  'standing-desk': standingDesk,
  'conference-chair': conferenceChair,
  cubicle,
  'tall-vase': tallVase,
  aquarium,
  urli,
  'wall-mandala': wallMandala,
  globe,
  hammock,
  'bird-bath': birdBath,
  well,
  greenhouse,
  'raised-bed': raisedBed,
  'garden-arch': gardenArch,
  'ev-charger': evCharger,
  'bike-rack': bikeRack,
  slide,
  sandbox,
};

