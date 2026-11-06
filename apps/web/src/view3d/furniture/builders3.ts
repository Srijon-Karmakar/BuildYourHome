import * as THREE from 'three';
import { ring, rod } from './builders2';
import { ball, BLACK, box, CHROME, cyl, GLASS, GLOW, legs, mat, shade, WHITE, type Builder, type V3 } from './kit';

/**
 * Procedural models for catalog batch 3 (same conventions as builders.ts: origin at the centre of the floor
 * footprint, +z front; wall items extend from z = 0 outward, centred on y = 0; ceiling items hang below y = 0).
 */

const GREEN = () => mat('#5f8a55', 0.85);
const GREEN2 = () => mat('#7aa66b', 0.85);
const GREEN3 = () => mat('#3f6b3d', 0.9);
const SOIL = () => mat('#4a3a2c', 1);
const STEEL = () => mat('#c9cbcd', 0.3, 0.8);
const ISPOT = (g: THREE.Group, r: number, h: number, color = '#b5604a') => {
  cyl(g, r, r * 0.75, h, [0, 0, 0], mat(color, 0.8));
  cyl(g, r * 0.92, r * 0.92, 0.012, [0, h, 0], SOIL());
};

/** A thin flat leaf (ellipsoid) pointing outward and drooping. */
function leaf(g: THREE.Group, [x, y, z]: V3, len: number, wid: number, yaw: number, droop: number, m: THREE.Material): void {
  const l = ball(g, [wid / 2, 0.01, len / 2], [0, 0, 0], m);
  l.position.set(x + Math.sin(yaw) * len * 0.45, y, z + Math.cos(yaw) * len * 0.45);
  l.rotation.set(droop, yaw, 0, 'YXZ');
}

export const sofaLike =
  (opts: { seatH: number; backH: number; arm: number; wood?: boolean; extraLong?: boolean }): Builder =>
  ({ c, w, d }) => {
    const g = new THREE.Group();
    const fabric = mat(c, 0.9);
    const cushion = mat(shade(c, 0.04), 0.9);
    const frame = mat('#7a5238', 0.55);
    if (opts.wood) legs(g, w, d, 0.12, 0.06, frame, 0.02);
    else for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, [0.05, 0.08, 0.05], [sx * (w / 2 - 0.1), 0, sz * (d / 2 - 0.1)], BLACK());
    box(g, [w, opts.seatH - 0.1, d], [0, 0.1, 0], opts.wood ? frame : fabric);
    box(g, [w, opts.backH, 0.16], [0, opts.seatH, -d / 2 + 0.08], fabric);
    for (const sx of [-1, 1]) box(g, [opts.arm, opts.seatH * 0.45, d], [sx * (w / 2 - opts.arm / 2), opts.seatH - 0.1, 0], fabric);
    const seats = Math.max(1, Math.round((w - 2 * opts.arm) / 0.65));
    const cw = (w - 2 * opts.arm) / seats;
    for (let i = 0; i < seats; i++) {
      const x = -(w - 2 * opts.arm) / 2 + cw * (i + 0.5);
      box(g, [cw - 0.02, 0.13, d - 0.2], [x, opts.seatH - 0.05, 0.08], cushion);
      box(g, [cw - 0.04, opts.backH * 0.8, 0.12], [x, opts.seatH + 0.05, -d / 2 + 0.24], cushion).rotation.x = -0.14;
    }
    return g;
  };

// ----------------------------------------------------------------------------------------------- living

const diwan: Builder = ({ c, w, d }) => {
  const g = new THREE.Group();
  const wood = mat('#7a5238', 0.55);
  const spread = mat(c, 0.9);
  box(g, [w, 0.3, d], [0, 0.1, 0], wood);
  legs(g, w, d, 0.1, 0.06, wood, 0.02);
  box(g, [w - 0.04, 0.12, d - 0.04], [0, 0.4, 0], spread);
  for (const sx of [-1, 1]) cyl(g, 0.1, 0.1, d * 0.9, [sx * (w / 2 - 0.12), 0.52, 0], mat(shade(c, -0.08), 0.9)).rotation.x = Math.PI / 2;
  for (let i = 0; i < 4; i++) box(g, [w / 4 - 0.06, 0.38, 0.14], [-w / 2 + w / 8 + (i * w) / 4, 0.52, -d / 2 + 0.14], mat(shade(c, i % 2 ? 0.1 : -0.04), 0.9)).rotation.x = -0.2;
  return g;
};

const recliner: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const fabric = mat(c, 0.9);
  box(g, [w, 0.2, d * 0.62], [0, 0.1, -d * 0.18], mat('#2b2a28', 0.5));
  box(g, [w - 0.1, 0.22, d * 0.56], [0, 0.28, -d * 0.2], fabric);
  box(g, [w - 0.1, h * 0.7, 0.2], [0, 0.35, -d / 2 + 0.12], fabric).rotation.x = -0.28;
  for (const sx of [-1, 1]) box(g, [0.18, 0.4, d * 0.62], [sx * (w / 2 - 0.09), 0.3, -d * 0.18], fabric);
  box(g, [w - 0.2, 0.12, d * 0.36], [0, 0.2, d * 0.3], mat(shade(c, 0.04), 0.9)).rotation.x = 0.15; // footrest
  return g;
};

const chaise: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const fabric = mat(c, 0.9);
  legs(g, w, d, 0.1, 0.05, mat('#3b2f27', 0.6), 0.04);
  box(g, [w, 0.26, d], [0, 0.1, 0], fabric);
  box(g, [w - 0.08, 0.1, d - 0.08], [0, 0.36, 0], mat(shade(c, 0.04), 0.9));
  box(g, [w, h - 0.3, 0.2], [0, 0.36, -d / 2 + 0.1], fabric).rotation.x = -0.25;
  box(g, [w - 0.1, 0.22, 0.2], [0, 0.46, -d / 2 + 0.5], mat(shade(c, -0.05), 0.9)).rotation.x = -0.6;
  return g;
};

const glassTable: Builder = ({ w, d }) => {
  const g = new THREE.Group();
  box(g, [w, 0.03, d], [0, 0.38, 0], GLASS());
  box(g, [w - 0.06, 0.02, d - 0.06], [0, 0.36, 0], mat('#d9e4ea', 0.1, 0.1, { transparent: true, opacity: 0.5 }));
  for (const sx of [-1, 1]) {
    box(g, [0.04, 0.38, d - 0.2], [sx * (w / 2 - 0.1), 0, 0], CHROME());
    box(g, [0.3, 0.025, d - 0.1], [sx * (w / 2 - 0.1), 0, 0], CHROME());
  }
  return g;
};

const sideboard: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const wood = mat(c, 0.5);
  legs(g, w, d, 0.14, 0.04, mat(shade(c, -0.15), 0.5), 0.05);
  box(g, [w, h - 0.14, d], [0, 0.14, 0], wood);
  const n = 4;
  for (let i = 0; i < n; i++) {
    box(g, [w / n - 0.02, h - 0.2, 0.014], [-w / 2 + (i + 0.5) * (w / n), 0.17, d / 2 + 0.005], mat(shade(c, i % 2 ? -0.04 : 0.02), 0.5));
    box(g, [0.1, 0.014, 0.02], [-w / 2 + (i + 0.5) * (w / n), h * 0.6, d / 2 + 0.02], CHROME());
  }
  return g;
};

const roomDivider: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const wood = mat(c, 0.55);
  for (const sx of [-1, 1]) box(g, [0.06, h, d + 0.1], [sx * (w / 2 - 0.03), 0, 0], wood);
  box(g, [w, 0.06, d + 0.04], [0, h - 0.06, 0], wood);
  box(g, [w, 0.06, d + 0.04], [0, 0.1, 0], wood);
  const cols = 8;
  const rows = 8;
  for (let i = 1; i < cols; i++) box(g, [0.018, h - 0.2, d], [-w / 2 + (i * w) / cols, 0.14, 0], wood);
  for (let j = 1; j < rows; j++) box(g, [w - 0.1, 0.018, d], [0, 0.1 + (j * (h - 0.2)) / rows, 0], wood);
  return g;
};

const barCabinet: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const wood = mat(c, 0.5);
  box(g, [w, 0.8, d], [0, 0, 0], wood);
  box(g, [w, h - 0.8, d], [0, 0.8, 0], mat(shade(c, -0.1), 0.5));
  box(g, [w - 0.1, h - 0.9, 0.01], [0, 0.85, d / 2 - 0.02], GLASS());
  for (let i = 0; i < 5; i++) cyl(g, 0.035, 0.035, 0.28, [-w / 2 + 0.15 + i * 0.17, 0.82, 0], mat(['#3f5f3a', '#7a4236', '#2b2a28', '#b98a5b', '#4d6783'][i]!, 0.3));
  box(g, [w - 0.2, h - 0.8, 0.02], [0, 0.8, -d / 2 + 0.02], mat('#d6e0e6', 0.1, 0.5));
  for (const sx of [-1, 1]) box(g, [w / 2 - 0.03, 0.7, 0.014], [sx * (w / 4), 0.05, d / 2 + 0.005], mat(shade(c, 0.03), 0.5));
  box(g, [w + 0.04, 0.03, d + 0.04], [0, 0.8, 0], mat('#2b2a28', 0.4));
  return g;
};

const piano: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  const black = mat('#1d1d1f', 0.25, 0.1);
  box(g, [w, h - 0.28, d - 0.08], [0, 0.18, -0.04], black);
  box(g, [w + 0.04, 0.04, d], [0, h - 0.1, -0.02], black); // lid
  box(g, [w * 0.9, 0.04, 0.1], [0, 0.78, d / 2 - 0.06], black); // key shelf
  box(g, [w * 0.86, 0.025, 0.12], [0, 0.82, d / 2 - 0.1], mat('#f4f2ec', 0.4)); // white keys
  for (let i = 0; i < 20; i++) box(g, [0.018, 0.02, 0.07], [-w * 0.4 + i * (w * 0.8) / 19, 0.845, d / 2 - 0.14], BLACK());
  for (const sx of [-1, 1]) box(g, [0.1, 0.8, d - 0.1], [sx * (w / 2 - 0.05), 0, -0.04], black);
  cyl(g, 0.03, 0.03, 0.02, [0, 0, d / 2 - 0.1], mat('#c9a47a', 0.3, 0.8));
  box(g, [w * 0.5, 0.35, 0.02], [0, 0.4, d / 2 - 0.04], mat('#2a2a2c', 0.3));
  return g;
};

const floorCushion: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, h, d], [0, 0, 0], mat(c, 0.95));
  box(g, [w - 0.06, 0.012, d - 0.06], [0, h, 0], mat(shade(c, 0.1), 0.95));
  return g;
};

// ----------------------------------------------------------------------------------------------- bedroom

const wardrobeSliding: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, h - 0.06, d - 0.04], [0, 0.06, -0.02], mat(shade(c, -0.05), 0.55));
  box(g, [w - 0.06, 0.06, d - 0.06], [0, 0, 0], BLACK());
  const n = 3;
  const dw = (w - 0.04) / n + 0.04;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.02 + dw / 2 + (i * (w - 0.04 - dw)) / (n - 1);
    box(g, [dw, h - 0.12, 0.018], [x, 0.08, d / 2 - 0.006 + (i % 2) * 0.02], mat(shade(c, i === 1 ? 0.03 : -0.02), 0.45));
    box(g, [0.014, 0.36, 0.02], [x + (i === 0 ? dw / 2 - 0.05 : -dw / 2 + 0.05), h * 0.5, d / 2 + 0.03 + (i % 2) * 0.02], CHROME());
  }
  return g;
};

const kidsBed: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const wood = mat(c, 0.55);
  box(g, [w, 0.18, d], [0, 0.1, 0], wood);
  legs(g, w, d, 0.1, 0.05, wood, 0);
  box(g, [w - 0.06, 0.16, d - 0.1], [0, 0.28, 0], mat('#efece6', 0.9));
  box(g, [w - 0.04, 0.05, d * 0.5], [0, 0.4, d * 0.2], mat('#4d9fd0', 0.9));
  for (const z of [-1, 1]) box(g, [w, h - 0.28, 0.04], [0, 0.28, z * (d / 2 - 0.02)], wood);
  box(g, [0.04, 0.3, d - 0.1], [-w / 2 + 0.02, 0.28, 0], wood);
  box(g, [0.04, 0.3, d - 0.1], [w / 2 - 0.02, 0.28, 0], wood);
  ball(g, [0.12, 0.08, 0.2], [0, 0.46, -d / 2 + 0.3], mat('#f7f6f2', 0.95));
  return g;
};

const toyBox: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, h - 0.04, d], [0, 0.04, 0], mat(c, 0.6));
  box(g, [w + 0.02, 0.04, d + 0.02], [0, h - 0.02, 0], mat(shade(c, -0.08), 0.6));
  for (const [x, col] of [[-0.22, '#d9694f'], [0, '#4d9fd0'], [0.22, '#f4d58a']] as const) box(g, [0.12, 0.1, 0.12], [x, h, 0], mat(col, 0.7), x * 4);
  return g;
};

const rockingChair: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const wood = mat(c, 0.55);
  const seat = mat('#c9b79c', 0.9);
  for (const sx of [-1, 1]) {
    for (let i = -3; i <= 3; i++) box(g, [0.04, 0.035, 0.18], [sx * (w / 2 - 0.05), 0.02 + i * i * 0.008, i * 0.14], wood).rotation.x = i * 0.12;
    rod(g, [sx * (w / 2 - 0.05), 0.06, d * 0.25], [sx * (w / 2 - 0.05), 0.45, d * 0.2], 0.018, wood);
    rod(g, [sx * (w / 2 - 0.05), 0.06, -d * 0.25], [sx * (w / 2 - 0.05), 0.95, -d * 0.35], 0.018, wood);
    rod(g, [sx * (w / 2 - 0.05), 0.55, 0.0], [sx * (w / 2 - 0.05), 0.6, d * 0.2], 0.016, wood);
  }
  box(g, [w - 0.1, 0.06, d * 0.5], [0, 0.45, 0.08], seat);
  box(g, [w - 0.1, h * 0.45, 0.05], [0, 0.5, -d * 0.3], seat).rotation.x = -0.25;
  return g;
};

// ----------------------------------------------------------------------------------------------- kitchen & dining

const diningBench: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, 0.05, d], [0, h - 0.05, 0], mat(c, 0.55));
  for (const sx of [-1, 1]) box(g, [0.06, h - 0.05, d - 0.06], [sx * (w / 2 - 0.1), 0, 0], mat(shade(c, -0.1), 0.55));
  box(g, [w - 0.3, 0.04, 0.04], [0, 0.2, 0], mat(shade(c, -0.1), 0.55));
  return g;
};

const barCounter: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, h - 0.04, d - 0.1], [0, 0, -0.05], mat(c, 0.5));
  box(g, [w + 0.1, 0.04, d + 0.12], [0, h - 0.04, 0.02], mat('#d9d5cc', 0.3));
  box(g, [w - 0.1, 0.12, 0.012], [0, 0.04, d / 2 - 0.1], mat(shade(c, -0.08), 0.5));
  cyl(g, 0.02, 0.02, w - 0.2, [0, 0.2, d / 2 + 0.08], CHROME()).rotation.z = Math.PI / 2;
  box(g, [0.04, 0.2, 0.04], [-w / 2 + 0.2, 0, d / 2 + 0.08], CHROME());
  box(g, [0.04, 0.2, 0.04], [w / 2 - 0.2, 0, d / 2 + 0.08], CHROME());
  return g;
};

const crockeryUnit: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const wood = mat(c, 0.5);
  box(g, [w, 0.8, d], [0, 0, 0], wood);
  for (const sx of [-1, 1]) box(g, [w / 2 - 0.02, 0.72, 0.014], [sx * (w / 4), 0.04, d / 2 + 0.005], mat(shade(c, -0.04), 0.5));
  box(g, [w, 0.03, d], [0, 0.8, 0], mat(shade(c, -0.1), 0.5));
  box(g, [w, h - 0.83, 0.03], [0, 0.83, -d / 2 + 0.015], wood);
  for (const sx of [-1, 1]) box(g, [0.03, h - 0.83, d], [sx * (w / 2 - 0.015), 0.83, 0], wood);
  box(g, [w, 0.03, d], [0, h - 0.03, 0], wood);
  for (let i = 1; i < 3; i++) box(g, [w - 0.06, 0.02, d - 0.04], [0, 0.83 + (i * (h - 0.86)) / 3, 0], wood);
  for (let i = 0; i < 3; i++) for (let k = 0; k < 4; k++) cyl(g, 0.07, 0.05, 0.05, [-w / 2 + 0.2 + k * 0.27, 0.86 + (i * (h - 0.86)) / 3, 0], mat('#f1efea', 0.3));
  box(g, [w - 0.05, h - 0.86, 0.008], [0, 0.84, d / 2 - 0.01], GLASS());
  return g;
};

const wineRack: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const wood = mat(c, 0.55);
  for (const sx of [-1, 1]) box(g, [0.03, h, d], [sx * (w / 2 - 0.015), 0, 0], wood);
  box(g, [w, 0.03, d], [0, h - 0.03, 0], wood);
  const rows = 5;
  for (let r = 0; r < rows; r++) {
    const y = 0.06 + (r * (h - 0.12)) / rows;
    box(g, [w - 0.06, 0.02, d], [0, y, 0], wood);
    for (let k = 0; k < 4; k++) cyl(g, 0.04, 0.04, d - 0.04, [-w / 2 + 0.12 + k * ((w - 0.24) / 3), y + 0.055, 0], mat(['#3f5f3a', '#7a4236', '#2b2a28', '#5f7a3a'][(r + k) % 4]!, 0.3)).rotation.x = Math.PI / 2;
  }
  return g;
};

const kitchenShelf: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const wood = mat(c, 0.55);
  box(g, [w, h, 0.02], [0, -h / 2, 0.01], mat(shade(c, -0.08), 0.6));
  box(g, [w, 0.03, d], [0, -h / 2, d / 2], wood);
  box(g, [w, 0.03, d], [0, 0.04, d / 2], wood);
  for (let k = 0; k < 4; k++) cyl(g, 0.05, 0.05, 0.12, [-w / 2 + 0.15 + k * 0.23, 0.07, d / 2], mat(['#b5604a', '#f1efea', '#c9a47a', '#8f9f86'][k]!, 0.6));
  for (let k = 0; k < 3; k++) cyl(g, 0.055, 0.055, 0.1, [-w / 2 + 0.2 + k * 0.3, -h / 2 + 0.03, d / 2], mat(['#c9a47a', '#f1efea', '#b5604a'][k]!, 0.6));
  return g;
};

// ----------------------------------------------------------------------------------------------- bathroom

const bathtubFree: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  const shell = cyl(g, 1, 0.85, h - 0.1, [0, 0.1, 0], WHITE(), 36);
  shell.scale.set(w / 2, 1, d / 2);
  const inner = cyl(g, 0.9, 0.9, 0.02, [0, h - 0.05, 0], mat('#cfe6f2', 0.1, 0.1), 36);
  inner.scale.set(w / 2, 1, d / 2);
  const rim = cyl(g, 1.02, 1.02, 0.04, [0, h - 0.04, 0], WHITE(), 36);
  rim.scale.set(w / 2, 1, d / 2);
  for (const [x, z] of [[-0.6, -0.25], [0.6, -0.25], [-0.6, 0.25], [0.6, 0.25]] as const) cyl(g, 0.03, 0.04, 0.1, [x * (w / 2 / 0.75), 0, z * (d / 2 / 0.35)], CHROME());
  cyl(g, 0.012, 0.012, 0.6, [w / 2 - 0.1, 0.1, 0], CHROME());
  box(g, [0.1, 0.02, 0.04], [w / 2 - 0.12, 0.7, 0.0], CHROME());
  return g;
};

const showerGlass: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, 0.06, d], [0, 0, 0], WHITE());
  box(g, [0.03, h - 0.06, d - 0.04], [w / 2 - 0.02, 0.06, 0], GLASS());
  box(g, [w - 0.04, h - 0.06, 0.03], [0, 0.06, d / 2 - 0.02], GLASS());
  for (const [x, z] of [[w / 2 - 0.02, d / 2 - 0.02], [w / 2 - 0.02, -d / 2 + 0.03], [-w / 2 + 0.03, d / 2 - 0.02]] as const) box(g, [0.04, h - 0.06, 0.04], [x, 0.06, z], CHROME());
  box(g, [w, 0.04, 0.04], [0, h - 0.04, d / 2 - 0.02], CHROME());
  cyl(g, 0.012, 0.012, 0.5, [-w / 2 + 0.1, 1.5, -d / 2 + 0.1], CHROME());
  cyl(g, 0.1, 0.1, 0.02, [-w / 2 + 0.22, 2.0, -d / 2 + 0.22], CHROME());
  cyl(g, 0.012, 0.012, 0.3, [-w / 2 + 0.1, 1.9, -d / 2 + 0.1], CHROME());
  return g;
};

const bidet: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w * 0.7, h * 0.55, d * 0.55], [0, 0, -d * 0.2], WHITE());
  const bowl = cyl(g, 0.5, 0.35, h * 0.5, [0, h * 0.5, d * 0.05], WHITE(), 24);
  bowl.scale.set(w, 1, d * 0.8);
  cyl(g, 0.012, 0.012, 0.1, [0, h, -d * 0.35], CHROME());
  return g;
};

const pedestalBasin: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  cyl(g, w * 0.12, w * 0.17, h - 0.2, [0, 0, -d * 0.1], WHITE());
  box(g, [w, 0.14, d], [0, h - 0.14, 0], WHITE());
  box(g, [w - 0.14, 0.02, d - 0.14], [0, h - 0.005, 0.02], mat('#e9eef0', 0.2));
  cyl(g, 0.012, 0.012, 0.12, [0, h, -d / 2 + 0.06], CHROME());
  box(g, [0.02, 0.012, 0.08], [0, h + 0.1, -d / 2 + 0.1], CHROME());
  return g;
};

const bathShelf: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  const glass = mat('#d6e0e6', 0.1, 0.3, { transparent: true, opacity: 0.6 });
  box(g, [w, 0.015, d], [0, -h / 2, d / 2], glass);
  box(g, [w, 0.015, d], [0, h / 2 - 0.015, d / 2], glass);
  for (const sx of [-1, 1]) box(g, [0.02, h, 0.02], [sx * (w / 2 - 0.02), -h / 2, 0.01], CHROME());
  box(g, [0.1, 0.16, 0.06], [-w * 0.25, -h / 2 + 0.015, d / 2], mat('#4d9fd0', 0.4));
  cyl(g, 0.04, 0.04, 0.1, [w * 0.15, -h / 2 + 0.015, d / 2], WHITE());
  return g;
};

// ----------------------------------------------------------------------------------------------- office

const meetingTable: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, 0.05, d], [0, h - 0.05, 0], mat(c, 0.45));
  for (const sx of [-1, 1]) box(g, [0.12, h - 0.05, d * 0.7], [sx * (w / 2 - 0.35), 0, 0], mat(shade(c, -0.1), 0.5));
  box(g, [0.5, 0.012, 0.16], [0, h, 0], BLACK());
  return g;
};

const receptionDesk: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, h - 0.3, d * 0.5], [0, 0, d * 0.25], mat(c, 0.45));
  box(g, [w + 0.06, 0.05, d * 0.6], [0, h - 0.3, d * 0.2], mat('#f1efea', 0.3));
  box(g, [w * 0.5, 0.3, d * 0.2], [-w * 0.2, h - 0.25, d * 0.12], mat(shade(c, 0.05), 0.45));
  box(g, [w, 0.72, d * 0.45], [0, 0, -d * 0.28], mat(shade(c, -0.1), 0.5));
  box(g, [w + 0.04, 0.04, d * 0.5], [0, 0.72, -d * 0.26], mat('#d9d5cc', 0.3));
  return g;
};

const lockers: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, h, d], [0, 0, 0], mat(c, 0.4, 0.3));
  const n = 3;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (i + 0.5) * (w / n);
    box(g, [w / n - 0.02, h - 0.08, 0.012], [x, 0.04, d / 2 + 0.005], mat(shade(c, -0.05), 0.4, 0.3));
    for (let k = 0; k < 4; k++) box(g, [0.14, 0.012, 0.012], [x, h - 0.2 - k * 0.025, d / 2 + 0.015], BLACK());
    box(g, [0.03, 0.1, 0.02], [x + 0.1, h * 0.45, d / 2 + 0.02], CHROME());
  }
  return g;
};

const officeSofa: Builder = sofaLike({ seatH: 0.42, backH: 0.4, arm: 0.12 });

// ----------------------------------------------------------------------------------------------- decor

const roundMirror: Builder = ({ w, d }) => {
  const g = new THREE.Group();
  const frame = cyl(g, w / 2, w / 2, d - 0.01, [0, 0, 0], mat('#c9a47a', 0.4, 0.7), 40);
  frame.rotation.x = Math.PI / 2;
  frame.position.set(0, 0, (d - 0.01) / 2);
  const glass = cyl(g, w / 2 - 0.04, w / 2 - 0.04, 0.008, [0, 0, 0], mat('#d6e0e6', 0.05, 0.8), 40);
  glass.rotation.x = Math.PI / 2;
  glass.position.set(0, 0, d);
  return g;
};

const floorMirror: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const wood = mat(c, 0.5);
  const panel = new THREE.Group();
  box(panel, [w, h - 0.1, 0.04], [0, 0, 0], wood);
  box(panel, [w - 0.08, h - 0.18, 0.012], [0, 0.04, 0.022], mat('#d6e0e6', 0.05, 0.8));
  panel.position.set(0, 0.1, -d * 0.1);
  panel.rotation.x = -0.12;
  g.add(panel);
  for (const sx of [-1, 1]) box(g, [0.04, 0.06, d - 0.05], [sx * (w / 2 - 0.05), 0, 0], wood);
  return g;
};

const grandfatherClock: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const wood = mat(c === '#b98a5b' ? '#6b4a30' : c, 0.5);
  box(g, [w, 0.25, d], [0, 0, 0], wood);
  box(g, [w - 0.08, h - 0.7, d - 0.06], [0, 0.25, 0], mat(shade('#6b4a30', 0.02), 0.5));
  box(g, [w - 0.2, 0.6, 0.012], [0, 0.45, d / 2 - 0.02], GLASS());
  cyl(g, 0.05, 0.05, 0.02, [0, 0.4, 0], BRASS());
  box(g, [0.014, 0.4, 0.01], [0, 0.55, 0], BRASS());
  box(g, [w + 0.04, 0.5, d + 0.02], [0, h - 0.5, 0], wood);
  const face = cyl(g, 0.17, 0.17, 0.02, [0, 0, 0], mat('#f1efea', 0.4), 32);
  face.rotation.x = Math.PI / 2;
  face.position.set(0, h - 0.27, d / 2 + 0.012);
  box(g, [0.01, 0.12, 0.006], [0, h - 0.22, d / 2 + 0.03], BLACK());
  box(g, [0.09, 0.01, 0.006], [0.04, h - 0.27, d / 2 + 0.03], BLACK());
  return g;
};
const BRASS = () => mat('#c9a47a', 0.4, 0.7);

const rangoli: Builder = ({ w }) => {
  const g = new THREE.Group();
  const cols = ['#e8b4b8', '#f4d58a', '#d9694f', '#ffffff', '#9a7fc4', '#7aa66b'];
  cyl(g, w / 2, w / 2, 0.004, [0, 0, 0], mat('#f1efea', 1), 40);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const p = cyl(g, w * 0.09, w * 0.09, 0.004, [Math.sin(a) * w * 0.34, 0.004, Math.cos(a) * w * 0.34], mat(cols[i % cols.length]!, 1), 16);
    p.scale.set(1.3, 1, 0.8);
    p.rotation.y = a;
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    cyl(g, w * 0.06, w * 0.06, 0.004, [Math.sin(a) * w * 0.17, 0.008, Math.cos(a) * w * 0.17], mat(cols[(i + 2) % cols.length]!, 1), 14);
  }
  cyl(g, w * 0.08, w * 0.08, 0.004, [0, 0.012, 0], mat('#d9694f', 1), 20);
  return g;
};

const doorMat: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, h, d], [0, 0, 0], mat('#6e5a45', 1));
  for (let i = 0; i < 6; i++) box(g, [w - 0.06, 0.004, 0.025], [0, h, -d / 2 + 0.05 + i * ((d - 0.1) / 5)], mat(i % 2 ? '#b5604a' : '#3b3a38', 1));
  return g;
};

const artTriptych: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  const fw = (w - 0.1) / 3;
  const cols = ['#b5604a', '#4d6783', '#c9b79c'];
  for (let i = 0; i < 3; i++) {
    const x = -w / 2 + fw / 2 + i * (fw + 0.05);
    box(g, [fw, h, d], [x, -h / 2, d / 2], mat('#2b2a28', 0.5));
    box(g, [fw - 0.05, h - 0.05, 0.01], [x, -h / 2 + 0.025, d + 0.003], mat(cols[i]!, 0.8));
    box(g, [fw - 0.14, (h - 0.05) * 0.4, 0.012], [x, -h / 2 + 0.1 + i * 0.03, d + 0.01], mat(['#f1efea', '#e8b4b8', '#3b3a38'][i]!, 0.8));
  }
  return g;
};

const sculpture: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  box(g, [w * 0.8, 0.5, w * 0.8], [0, 0, 0], mat('#e6e4e0', 0.6));
  const stone = mat('#3b3a38', 0.4, 0.4);
  ball(g, [w * 0.28, h * 0.12, w * 0.28], [0, 0.62, 0], stone);
  ball(g, [w * 0.2, h * 0.14, w * 0.2], [0.02, 0.84, 0], stone);
  ring(g, w * 0.22, 0.03, [0, h - 0.08, 0], mat('#c9a47a', 0.3, 0.8), 0);
  ball(g, [0.05, 0.05, 0.05], [0, h - 0.08, 0], mat('#c9a47a', 0.3, 0.8));
  return g;
};

const bookStack: Builder = ({ w, d }) => {
  const g = new THREE.Group();
  const cols = ['#b5604a', '#4d6783', '#8f9f86', '#c9b79c'];
  for (let i = 0; i < 4; i++) box(g, [w - i * 0.015, 0.04, d - 0.02 - i * 0.008], [0.01 * (i % 2), i * 0.04, 0], mat(cols[i]!, 0.8), (i - 1.5) * 0.12);
  return g;
};

// ----------------------------------------------------------------------------------------------- lighting

const lantern: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  const iron = mat('#2b2a28', 0.5, 0.5);
  cyl(g, w * 0.4, w * 0.45, 0.04, [0, 0, 0], iron);
  cyl(g, w * 0.34, w * 0.34, h - 0.2, [0, 0.04, 0], mat('#ffe0b0', 0.4, 0, { transparent: true, opacity: 0.55, emissive: new THREE.Color('#ffd9a0'), emissiveIntensity: 0.8 }));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    box(g, [0.02, h - 0.2, 0.02], [Math.sin(a) * w * 0.34, 0.04, Math.cos(a) * w * 0.34], iron);
  }
  cyl(g, 0.01, w * 0.45, 0.1, [0, h - 0.16, 0], iron);
  ring(g, w * 0.2, 0.01, [0, h - 0.04, 0], iron, 0);
  ball(g, [0.03, 0.05, 0.03], [0, 0.12, 0], GLOW());
  return g;
};

const trackLight: Builder = ({ w, d }) => {
  const g = new THREE.Group();
  box(g, [w, 0.03, d * 0.5], [0, -0.04, 0], mat('#f1efea', 0.5));
  for (let i = 0; i < 3; i++) {
    const x = -w * 0.3 + i * w * 0.3;
    const spot = cyl(g, 0.04, 0.05, 0.12, [x, -0.2, 0], BLACK());
    spot.rotation.z = (i - 1) * 0.35;
    ball(g, [0.035, 0.012, 0.035], [x + (i - 1) * 0.03, -0.265, 0], GLOW());
  }
  return g;
};

const uplight: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  cyl(g, w * 0.4, w * 0.45, 0.03, [0, 0, 0], BLACK());
  cyl(g, 0.012, 0.012, h - 0.35, [0, 0.03, 0], mat('#c9a47a', 0.4, 0.7));
  cyl(g, w * 0.45, w * 0.18, 0.3, [0, h - 0.32, 0], mat('#f1efea', 0.8, 0, { emissive: new THREE.Color('#ffe0b0'), emissiveIntensity: 0.5, side: THREE.DoubleSide }));
  return g;
};

// ----------------------------------------------------------------------------------------------- plants

const snakePlant: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  ISPOT(g, w * 0.4, 0.22, '#d9d5cc');
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4;
    const hh = h * (0.55 + (i % 4) * 0.12);
    const b = box(g, [0.055, hh, 0.012], [Math.sin(a) * 0.07, 0.22, Math.cos(a) * 0.07], i % 2 ? GREEN3() : GREEN(), a);
    b.rotation.z = Math.sin(a) * 0.14;
    b.rotation.x = Math.cos(a) * 0.14;
  }
  return g;
};

const monstera: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  ISPOT(g, w * 0.22, 0.3, '#c9bfa0');
  const stem = mat('#6e7a45', 0.9);
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4;
    const len = w * 0.4;
    const y = 0.4 + (i % 3) * h * 0.2;
    rod(g, [0, 0.3, 0], [Math.sin(a) * len * 0.8, y, Math.cos(a) * len * 0.8], 0.01, stem);
    leaf(g, [Math.sin(a) * len * 0.8, y, Math.cos(a) * len * 0.8], w * 0.38, w * 0.3, a, 0.35, i % 2 ? GREEN() : GREEN3());
  }
  return g;
};

const bananaPlant: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  ISPOT(g, 0.28, 0.35, '#8f6f4f');
  cyl(g, 0.05, 0.07, h * 0.5, [0, 0.35, 0], mat('#8a9a55', 0.9));
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9;
    const y = 0.35 + h * 0.5 - (i % 2) * 0.1;
    leaf(g, [0, y, 0], w * 0.8, w * 0.22, a, 0.55 + (i % 3) * 0.1, i % 2 ? GREEN() : GREEN2());
  }
  return g;
};

const bamboo: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  ISPOT(g, w * 0.4, 0.28, '#3b3a38');
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4;
    const hh = h * (0.6 + (i % 4) * 0.1) - 0.28;
    const x = Math.sin(a) * w * 0.14;
    const z = Math.cos(a) * w * 0.14;
    cyl(g, 0.014, 0.016, hh, [x, 0.28, z], mat('#b5b86b', 0.6));
    for (let k = 1; k < 5; k++) cyl(g, 0.019, 0.019, 0.008, [x, 0.28 + (k * hh) / 5, z], mat('#8f9a45', 0.7));
    ball(g, [0.05, 0.02, 0.1], [x, 0.28 + hh - 0.02, z], GREEN());
  }
  return g;
};

const moneyPlant: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  ISPOT(g, w * 0.36, 0.2, '#f1efea');
  for (let i = 0; i < 8; i++) {
    const a = i * 2.4;
    const y = 0.22 + (i / 8) * (h - 0.3);
    const x = Math.sin(a) * w * 0.3;
    const z = Math.cos(a) * w * 0.3;
    rod(g, [0, 0.2, 0], [x, y, z], 0.006, mat('#6e7a45', 0.9));
    ball(g, [0.06, 0.012, 0.07], [x, y, z], i % 2 ? GREEN() : GREEN2()).rotation.set(0.5, a, 0);
  }
  return g;
};

// ----------------------------------------------------------------------------------------------- appliances

const splitAc: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, h, d], [0, -h / 2, d / 2], mat('#f4f3ef', 0.35));
  box(g, [w - 0.08, 0.04, d * 0.5], [0, -h / 2 + 0.005, d * 0.6], mat('#2b2a28', 0.4));
  box(g, [w - 0.06, 0.012, 0.01], [0, 0.02, d + 0.002], mat('#dcdad4', 0.4));
  box(g, [0.1, 0.03, 0.005], [w / 2 - 0.12, -h / 2 + 0.1, d + 0.004], mat('#1b2a3a', 0.2, 0.2, { emissive: new THREE.Color('#4dd0e1'), emissiveIntensity: 0.6 }));
  return g;
};

const cassetteAc: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, h * 0.35, d], [0, -h * 0.35, 0], mat('#f4f3ef', 0.35));
  box(g, [w * 0.55, h * 0.1, d * 0.55], [0, -h * 0.45, 0], mat('#dcdad4', 0.5));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    box(g, [w * 0.5, 0.012, 0.05], [Math.sin(a) * (d / 2 - 0.08), -h * 0.37, Math.cos(a) * (d / 2 - 0.08)], mat('#bdbab2', 0.5), a);
  }
  box(g, [w * 0.7, 0.02, d * 0.7], [0, -h * 0.5, 0], mat('#ecebe6', 0.5));
  return g;
};

const geyser: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  cyl(g, w / 2, w / 2, h * 0.9, [0, 0, 0], mat('#f1efea', 0.35), 28).position.set(0, -h * 0.45 + h * 0.45, d / 2);
  g.children[0]!.position.y = 0;
  cyl(g, w / 2 + 0.005, w / 2 + 0.005, 0.03, [0, 0, 0], mat('#2b6cb0', 0.4)).position.set(0, h * 0.4, d / 2 + 0.006);
  for (const sx of [-1, 1]) cyl(g, 0.012, 0.012, 0.1, [sx * 0.07, 0, 0], CHROME()).position.set(sx * 0.07, -h * 0.5 - 0.02, d / 2);
  box(g, [0.14, 0.08, 0.02], [0, -h * 0.1, d + 0.001], mat('#d9d5cc', 0.4));
  ball(g, [0.012, 0.012, 0.012], [0.04, -h * 0.1, d + 0.015], GLOW());
  return g;
};

const waterPurifier: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, h, d], [0, -h / 2, d / 2], mat('#f1efea', 0.3));
  box(g, [w - 0.08, h * 0.3, 0.01], [0, -h * 0.2, d + 0.003], mat('#1b2a3a', 0.2));
  box(g, [0.06, 0.04, 0.05], [0, -h / 2 + 0.02, d + 0.02], mat('#3c8dbc', 0.4));
  ball(g, [0.012, 0.012, 0.012], [w * 0.3, -h * 0.2, d + 0.01], mat('#4dd0e1', 0.2, 0, { emissive: new THREE.Color('#4dd0e1'), emissiveIntensity: 0.8 }));
  return g;
};

const fridgeSbs: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, h - 0.05, d], [0, 0.05, 0], STEEL());
  box(g, [w - 0.06, 0.05, d - 0.06], [0, 0, 0], BLACK());
  box(g, [0.008, h - 0.1, 0.01], [0.02, 0.07, d / 2 + 0.003], BLACK());
  for (const sx of [-1, 1]) box(g, [0.025, h * 0.4, 0.03], [sx * 0.07 + 0.02, h * 0.45, d / 2 + 0.03], CHROME());
  box(g, [0.26, 0.4, 0.015], [-w / 4, h * 0.55, d / 2 + 0.004], mat('#1b2a3a', 0.2));
  return g;
};

const washerTop: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, h - 0.12, d], [0, 0, 0], WHITE());
  box(g, [w, 0.12, d * 0.36], [0, h - 0.12, -d * 0.32], mat('#e1e0dc', 0.35));
  box(g, [w - 0.1, 0.01, d * 0.5], [0, h - 0.11, d * 0.2], mat('#bcd4e6', 0.1, 0, { transparent: true, opacity: 0.7 }));
  ball(g, [0.03, 0.03, 0.02], [w * 0.28, h - 0.06, -d * 0.12], mat('#4d9fd0', 0.3));
  box(g, [w * 0.4, 0.04, 0.005], [-w * 0.1, h - 0.06, -d * 0.12], mat('#1b2a3a', 0.2));
  return g;
};

const inverter: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, 0.04, d], [0, 0.07, 0], mat('#3b3a38', 0.5));
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) cyl(g, 0.035, 0.035, 0.07, [x * (w / 2 - 0.05), 0, z * (d / 2 - 0.05)], BLACK());
  box(g, [w - 0.05, h * 0.35, d - 0.06], [0, 0.11, 0], mat('#2c4a6e', 0.5));
  box(g, [w - 0.1, h * 0.3, d - 0.12], [0, 0.11 + h * 0.35, 0], mat('#d9d5cc', 0.45));
  box(g, [0.12, 0.07, 0.01], [0, 0.11 + h * 0.45, (d - 0.12) / 2 + 0.003], mat('#1b2a3a', 0.2, 0, { emissive: new THREE.Color('#7bd88f'), emissiveIntensity: 0.5 }));
  return g;
};

const airCooler: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) cyl(g, 0.03, 0.03, 0.05, [x * (w / 2 - 0.06), 0, z * (d / 2 - 0.06)], BLACK());
  box(g, [w, h - 0.05, d], [0, 0.05, 0], mat('#dcdad4', 0.5));
  box(g, [w - 0.1, h * 0.55, 0.012], [0, h * 0.35, d / 2 + 0.003], mat('#9aa3a8', 0.4));
  for (let i = 0; i < 9; i++) box(g, [w - 0.14, 0.008, 0.016], [0, h * 0.38 + i * 0.04, d / 2 + 0.012], BLACK());
  box(g, [w - 0.2, 0.06, 0.1], [0, h - 0.04, 0], mat('#4d9fd0', 0.4));
  return g;
};

const exhaustFan: Builder = ({ w, d }) => {
  const g = new THREE.Group();
  box(g, [w, w, 0.02], [0, -w / 2, 0.01], mat('#f1efea', 0.4));
  const rim = cyl(g, w * 0.4, w * 0.4, d - 0.02, [0, 0, 0], mat('#e1e0dc', 0.4), 28);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, 0, (d - 0.02) / 2 + 0.02);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    ball(g, [w * 0.18, w * 0.05, 0.004], [Math.sin(a) * w * 0.17, Math.cos(a) * w * 0.17, d - 0.01], mat('#2b2a28', 0.5)).rotation.z = -a;
  }
  return g;
};

const tvWall: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, h, d], [0, -h / 2, d / 2 + 0.02], BLACK());
  box(g, [w - 0.04, h - 0.04, 0.004], [0, -h / 2 + 0.02, d + 0.022], mat('#14161a', 0.15, 0.3));
  box(g, [w * 0.3, h * 0.3, 0.02], [0, -h / 2, 0.01], mat('#3b3a38', 0.5));
  return g;
};

// ----------------------------------------------------------------------------------------------- outdoor

const gazebo: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const wood = mat('#e8dcc4', 0.6);
  box(g, [w, 0.12, d], [0, 0, 0], mat('#a8a49c', 0.9));
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1]] as const) box(g, [0.12, h * 0.78, 0.12], [x * (w / 2 - 0.12), 0.12, z * (d / 2 - 0.12)], wood);
  box(g, [w, 0.1, 0.1], [0, h * 0.78 + 0.1, d / 2 - 0.12], wood);
  box(g, [w, 0.1, 0.1], [0, h * 0.78 + 0.1, -d / 2 + 0.12], wood);
  for (const z of [-1, 1]) box(g, [w - 0.3, 0.08, 0.06], [0, 0.55, z * (d / 2 - 0.12)], wood);
  const roof = cyl(g, 0.05, w * 0.72, h * 0.28, [0, h * 0.78 + 0.18, 0], mat(c === '#b98a5b' ? '#7a4236' : '#7a4236', 0.8), 6);
  roof.scale.set(1, 1, d / w);
  ball(g, [0.06, 0.1, 0.06], [0, h - 0.04, 0], BRASS());
  return g;
};

const pergola: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const wood = mat(c, 0.65);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) box(g, [0.14, h, 0.14], [x * (w / 2 - 0.09), 0, z * (d / 2 - 0.09)], wood);
  for (const z of [-1, 1]) box(g, [w, 0.16, 0.1], [0, h - 0.16, z * (d / 2 - 0.09)], wood);
  for (let i = 0; i < 9; i++) box(g, [0.07, 0.07, d], [-w / 2 + 0.1 + (i * (w - 0.2)) / 8, h - 0.02, 0], mat(shade(c, -0.05), 0.65));
  return g;
};

const gardenShed: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  const wall = mat('#8f9f86', 0.8);
  box(g, [w, h - 0.35, d], [0, 0, 0], wall);
  const roof = box(g, [w + 0.2, 0.06, d + 0.3], [0, h - 0.3, 0], mat('#5b6168', 0.6));
  roof.rotation.x = 0.09;
  box(g, [0.75, h - 0.6, 0.04], [-w * 0.2, 0, d / 2 + 0.005], mat('#7a5238', 0.6));
  box(g, [0.5, 0.5, 0.03], [w * 0.28, 1.0, d / 2 + 0.005], GLASS());
  box(g, [0.56, 0.56, 0.02], [w * 0.28, 0.97, d / 2 + 0.01], mat('#e8dcc4', 0.5));
  cyl(g, 0.02, 0.02, 0.03, [-w * 0.2 + 0.3, 1.0, d / 2 + 0.04], CHROME()).rotation.x = Math.PI / 2;
  return g;
};

const dogHouse: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  const wood = mat('#b98a5b', 0.7);
  box(g, [w, h * 0.65, d], [0, 0.05, 0], wood);
  for (const s of [-1, 1]) box(g, [w / 2 + 0.1, 0.04, d + 0.12], [s * (w / 4), h * 0.62, 0], mat('#7a4236', 0.7)).rotation.z = -s * 0.5;
  const door = box(g, [0.3, 0.38, 0.03], [0, 0.05, d / 2 + 0.005], mat('#1d1d1f', 0.9));
  door.position.y = 0.24;
  ball(g, [0.15, 0.1, 0.03], [0, 0.43, d / 2 + 0.005], mat('#1d1d1f', 0.9));
  return g;
};

const mailbox: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  cyl(g, 0.025, 0.03, h - 0.2, [0, 0, 0], mat('#3b3a38', 0.6));
  box(g, [w, 0.2, d], [0, h - 0.2, 0], mat('#c0392b', 0.5));
  ball(g, [w / 2, 0.06, d / 2], [0, h - 0.0, 0], mat('#c0392b', 0.5));
  box(g, [w - 0.08, 0.02, 0.01], [0, h - 0.13, d / 2 + 0.003], BLACK());
  return g;
};

const boulder: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  const s1 = mat('#8f8c85', 0.95);
  const s2 = mat('#a39f96', 0.95);
  ball(g, [w * 0.5, h * 0.55, d * 0.5], [0, h * 0.55, 0], s1);
  ball(g, [w * 0.3, h * 0.4, d * 0.32], [w * 0.28, h * 0.4, d * 0.2], s2);
  ball(g, [w * 0.25, h * 0.3, d * 0.28], [-w * 0.3, h * 0.3, -d * 0.2], s2);
  return g;
};

const motorbike: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const paint = mat(c === '#e8e8e6' ? '#b23a34' : c, 0.3, 0.5);
  const tyre = mat('#1d1f22', 0.7);
  const r = 0.33;
  const zf = d / 2 - r - 0.03;
  for (const z of [-zf, zf]) {
    ring(g, r - 0.04, 0.04, [0, r, z], tyre, 0).rotation.y = Math.PI / 2;
    cyl(g, 0.05, 0.05, 0.1, [0, r - 0.05, z], CHROME()).rotation.z = Math.PI / 2;
  }
  box(g, [0.12, 0.1, 0.55], [0, 0.45, 0.05], mat('#2b2a28', 0.5)); // engine
  ball(g, [0.17, 0.14, 0.3], [0, 0.78, zf * 0.3], paint); // tank
  box(g, [0.2, 0.08, 0.55], [0, 0.78, -zf * 0.35], BLACK()); // seat
  rod(g, [0, 0.55, zf * 0.1], [0, 0.98, zf * 0.85], 0.02, CHROME()); // fork
  rod(g, [0, 0.98, zf * 0.85], [0, r + 0.02, zf], 0.02, CHROME());
  box(g, [0.62, 0.025, 0.025], [0, 1.0, zf * 0.8], BLACK()); // handlebar
  cyl(g, 0.08, 0.07, 0.1, [0, 0, 0], GLOW()).position.set(0, 0.92, zf * 0.98);
  box(g, [0.22, 0.04, 0.4], [0, 0.66, -zf * 0.85], paint); // rear fender
  rod(g, [0.14, 0.3, -zf * 0.9], [0.14, 0.34, -zf * 1.1], 0.03, CHROME()); // exhaust
  void w;
  void h;
  return g;
};

const swingSet: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  const steel = mat('#3c7a4d', 0.5, 0.4);
  for (const sx of [-1, 1]) {
    rod(g, [sx * (w / 2 - 0.05), 0.03, d / 2 - 0.05], [sx * (w / 2 - 0.2), h - 0.04, 0], 0.04, steel);
    rod(g, [sx * (w / 2 - 0.05), 0.03, -d / 2 + 0.05], [sx * (w / 2 - 0.2), h - 0.04, 0], 0.04, steel);
  }
  cyl(g, 0.04, 0.04, w - 0.3, [0, h - 0.06, 0], steel).rotation.z = Math.PI / 2;
  g.children[g.children.length - 1]!.position.set(0, h - 0.04, 0);
  for (const x of [-0.5, 0.5]) {
    for (const s of [-1, 1]) rod(g, [x + s * 0.18, h - 0.04, 0], [x + s * 0.18, 0.5, 0], 0.01, mat('#2b2a28', 0.5, 0.5));
    box(g, [0.42, 0.04, 0.2], [x, 0.46, 0], mat('#d9694f', 0.6));
  }
  return g;
};

const solarPanel: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  const steel = mat('#9aa3a8', 0.4, 0.7);
  const panel = new THREE.Group();
  box(panel, [w, 0.04, d * 1.1], [0, 0, 0], mat('#1d2a4a', 0.2, 0.4));
  for (let i = 1; i < 6; i++) box(panel, [0.01, 0.006, d * 1.1], [-w / 2 + (i * w) / 6, 0.022, 0], mat('#8fa0b8', 0.4));
  for (let j = 1; j < 3; j++) box(panel, [w, 0.006, 0.01], [0, 0.022, -d * 0.55 + (j * d * 1.1) / 3], mat('#8fa0b8', 0.4));
  panel.position.set(0, h * 0.7, 0);
  panel.rotation.x = -0.6;
  g.add(panel);
  for (const sx of [-1, 1]) {
    box(g, [0.05, h * 0.8, 0.05], [sx * (w / 2 - 0.15), 0, -d * 0.3], steel);
    box(g, [0.05, h * 0.3, 0.05], [sx * (w / 2 - 0.15), 0, d * 0.35], steel);
  }
  return g;
};

const carport: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  const steel = mat('#3b3a38', 0.5, 0.5);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) box(g, [0.14, h, 0.14], [x * (w / 2 - 0.1), 0, z * (d / 2 - 0.1)], steel);
  const roof = box(g, [w + 0.3, 0.08, d + 0.3], [0, h - 0.05, 0], mat('#cdd2d6', 0.4, 0.4));
  roof.rotation.z = 0.04;
  for (const x of [-1, 1]) box(g, [0.1, 0.12, d], [x * (w / 2 - 0.1), h - 0.15, 0], steel);
  return g;
};

const outdoorSofa: Builder = sofaLike({ seatH: 0.42, backH: 0.4, arm: 0.14, wood: true });

const firePit: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  const stone = mat('#8f8c85', 0.95);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    ball(g, [0.09, h * 0.35, 0.09], [Math.sin(a) * w * 0.42, h * 0.35, Math.cos(a) * w * 0.42], i % 2 ? stone : mat('#a39f96', 0.95));
  }
  cyl(g, w * 0.36, w * 0.36, 0.05, [0, 0.04, 0], mat('#2b2a28', 0.9), 20);
  for (let i = 0; i < 3; i++) cyl(g, 0.04, 0.04, 0.5, [0, 0.1, 0], mat('#5b4a3c', 0.9)).rotation.set(Math.PI / 2, 0, (i * Math.PI) / 3);
  const flame = mat('#ffb347', 0.5, 0, { emissive: new THREE.Color('#ff7a1a'), emissiveIntensity: 1 });
  cyl(g, 0.0, 0.12, h * 0.8, [0, 0.12, 0], flame, 8);
  cyl(g, 0.0, 0.07, h * 0.55, [0.08, 0.12, 0.03], flame, 8);
  return g;
};

export const BUILDERS3: Record<string, Builder> = {
  diwan,
  recliner,
  chaise,
  'glass-table': glassTable,
  sideboard,
  'room-divider': roomDivider,
  'bar-cabinet': barCabinet,
  piano,
  'floor-cushion': floorCushion,
  'wardrobe-sliding': wardrobeSliding,
  'kids-bed': kidsBed,
  'toy-box': toyBox,
  'rocking-chair': rockingChair,
  'dining-bench': diningBench,
  'bar-counter': barCounter,
  'crockery-unit': crockeryUnit,
  'wine-rack': wineRack,
  'kitchen-shelf': kitchenShelf,
  'bathtub-free': bathtubFree,
  'shower-glass': showerGlass,
  bidet,
  'pedestal-basin': pedestalBasin,
  'bath-shelf': bathShelf,
  'meeting-table': meetingTable,
  'reception-desk': receptionDesk,
  'office-sofa': officeSofa,
  lockers,
  'round-mirror': roundMirror,
  'floor-mirror': floorMirror,
  'grandfather-clock': grandfatherClock,
  rangoli,
  'door-mat': doorMat,
  'art-triptych': artTriptych,
  sculpture,
  'book-stack': bookStack,
  lantern,
  'track-light': trackLight,
  uplight,
  'snake-plant': snakePlant,
  monstera,
  'banana-plant': bananaPlant,
  bamboo,
  'money-plant': moneyPlant,
  'split-ac': splitAc,
  'cassette-ac': cassetteAc,
  geyser,
  'water-purifier': waterPurifier,
  'fridge-sbs': fridgeSbs,
  'washer-top': washerTop,
  inverter,
  'air-cooler': airCooler,
  'exhaust-fan': exhaustFan,
  'tv-wall': tvWall,
  gazebo,
  pergola,
  'garden-shed': gardenShed,
  'dog-house': dogHouse,
  mailbox,
  boulder,
  motorbike,
  'swing-set': swingSet,
  'solar-panel': solarPanel,
  carport,
  'outdoor-sofa': outdoorSofa,
  'fire-pit': firePit,
};
