import * as THREE from 'three';
import { rippleNormal } from '../textures';
import { ring, rod } from './builders2';
import { ball, BLACK, box, CHROME, cyl, GLASS, GLOW, mat, shade, type Builder } from './kit';

/** Trees, nature, garden decor and scenery (neighbours, ponds, hills, roads). Same conventions as the other builders. */

const BARK = '#6e5a45';
const SOIL = () => mat('#4a3a2c', 1);
const STONE = () => mat('#a8a49c', 0.95);
const BRASS = () => mat('#c9a47a', 0.4, 0.7);
let waterMat: THREE.MeshPhysicalMaterial | null = null;
/** Glassy pond water: mirror-like clearcoat, a deep blue-green tint and gentle ripples in the reflections. */
const WATER = () => {
  if (!waterMat) {
    // The ripple picture needs a canvas (not available in unit tests): without one the water is simply smooth.
    const n = typeof document === 'undefined' ? null : rippleNormal(128);
    if (n) {
      n.wrapS = n.wrapT = THREE.RepeatWrapping;
      n.repeat.set(3, 3);
    }
    waterMat = new THREE.MeshPhysicalMaterial({
      color: '#2f7f9a',
      roughness: 0.04,
      metalness: 0.1,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      envMapIntensity: 2.4,
      transparent: true,
      opacity: 0.92,
      normalMap: n,
      normalScale: new THREE.Vector2(0.35, 0.35),
    });
  }
  return waterMat;
};
const leafMat = (hex: string, k = 0) => mat(shade(hex, k), 0.85);

/** Half an ellipsoid sitting on y = 0 (a hill or mound). */
function dome(g: THREE.Group, rx: number, ry: number, rz: number, [x, z]: [number, number], m: THREE.Material): void {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2), m);
  mesh.scale.set(rx, ry, rz);
  mesh.position.set(x, 0, z);
  mesh.castShadow = mesh.receiveShadow = true;
  g.add(mesh);
}

/** A pyramid (hip) or gable roof over a bw × bd footprint starting at height y0. */
function roofShape(g: THREE.Group, kind: 'hip' | 'gable', bw: number, bd: number, y0: number, hh: number, m: THREE.Material): void {
  const x = bw / 2;
  const z = bd / 2;
  const c: Array<[number, number, number]> = [[-x, y0, -z], [x, y0, -z], [x, y0, z], [-x, y0, z]];
  const tris: Array<[number, number, number][]> = [];
  if (kind === 'hip') {
    const apex: [number, number, number] = [0, y0 + hh, 0];
    for (let i = 0; i < 4; i++) tris.push([c[i]!, c[(i + 1) % 4]!, apex]);
  } else {
    const r1: [number, number, number] = [-x, y0 + hh, 0];
    const r2: [number, number, number] = [x, y0 + hh, 0];
    tris.push([c[0]!, c[1]!, r2], [c[0]!, r2, r1], [c[2]!, c[3]!, r1], [c[2]!, r1, r2], [c[3]!, c[0]!, r1], [c[1]!, c[2]!, r2]);
  }
  const pos: number[] = [];
  for (const t of tris) for (const v of t) pos.push(...v);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, m);
  mesh.castShadow = mesh.receiveShadow = true;
  g.add(mesh);
}

/** A round-crowned tree: trunk + a cluster of foliage blobs (+ optional flowers). */
function crownTree(opts: { trunk?: string; trunkH?: number; leaf: string; blobs?: number; spread?: number; flatten?: number; flowers?: string; drop?: boolean }): Builder {
  return ({ w, h }) => {
    const g = new THREE.Group();
    const bark = mat(opts.trunk ?? BARK, 0.95);
    const th = h * (opts.trunkH ?? 0.45);
    cyl(g, w * 0.03 + 0.05, w * 0.045 + 0.09, th, [0, 0, 0], bark);
    rod(g, [0, th * 0.8, 0], [-w * 0.18, th * 1.2, 0.05], 0.05, bark);
    rod(g, [0, th * 0.85, 0], [w * 0.18, th * 1.25, -0.05], 0.05, bark);
    const n = opts.blobs ?? 7;
    const r = w * 0.3;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.4;
      const ring_ = i === 0 ? 0 : (opts.spread ?? 0.28) * w;
      const y = th + (h - th) * (i === 0 ? 0.55 : 0.3 + ((i * 37) % 5) * 0.08) + (opts.drop ? -(h - th) * 0.1 : 0);
      const rr = r * (i === 0 ? 1.15 : 0.8 + ((i * 13) % 4) * 0.08);
      ball(g, [rr, rr * (opts.flatten ?? 0.85), rr], [Math.sin(a) * ring_, y, Math.cos(a) * ring_], leafMat(opts.leaf, (i % 3) * 0.03 - 0.02));
      if (opts.flowers && i % 2 === 0) for (let k = 0; k < 4; k++) ball(g, [0.07, 0.06, 0.07], [Math.sin(a + k) * (ring_ + rr * 0.7), y + rr * 0.3, Math.cos(a + k) * (ring_ + rr * 0.7)], mat(opts.flowers, 0.7));
    }
    return g;
  };
}

const banyan: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  const bark = mat('#7a6a55', 0.95);
  cyl(g, 0.3, 0.45, h * 0.5, [0, 0, 0], bark);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const x = Math.sin(a) * w * 0.3;
    const z = Math.cos(a) * w * 0.3;
    rod(g, [0, h * 0.45, 0], [x, h * 0.62, z], 0.07, bark);
    rod(g, [x, h * 0.62, z], [x * 1.02, 0.03, z * 1.02], 0.025, mat('#8a7a63', 0.95)); // hanging prop roots
  }
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const ring_ = i === 0 ? 0 : w * 0.3;
    const rr = (i === 0 ? 0.36 : 0.26) * w;
    ball(g, [rr, rr * 0.55, rr], [Math.sin(a) * ring_, h * 0.72 + (i % 3) * 0.2, Math.cos(a) * ring_], leafMat('#3f7a3f', (i % 3) * 0.03));
  }
  return g;
};

const cypress: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  cyl(g, 0.05, 0.08, h * 0.12, [0, 0, 0], mat(BARK, 0.95));
  const body = cyl(g, 0.02, w * 0.5, h * 0.9, [0, h * 0.1, 0], leafMat('#2f5d3a'), 12);
  void body;
  ball(g, [w * 0.45, h * 0.3, w * 0.45], [0, h * 0.4, 0], leafMat('#356b40'));
  return g;
};

const birch: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  const bark = mat('#ece8e0', 0.8);
  cyl(g, 0.045, 0.07, h * 0.62, [0, 0, 0], bark);
  for (let i = 0; i < 6; i++) box(g, [0.1, 0.03, 0.1], [0, h * 0.08 + i * h * 0.09, 0], mat('#3b3a38', 0.9));
  for (let i = 0; i < 6; i++) {
    const a = i * 1.1;
    ball(g, [w * 0.28, w * 0.34, w * 0.28], [Math.sin(a) * w * 0.15, h * 0.62 + (i % 3) * h * 0.12, Math.cos(a) * w * 0.15], leafMat('#8ab35a', (i % 2) * 0.04));
  }
  return g;
};

const willow: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  const bark = mat('#5e4c3a', 0.95);
  cyl(g, 0.1, 0.2, h * 0.5, [0, 0, 0], bark);
  ball(g, [w * 0.3, w * 0.18, w * 0.3], [0, h * 0.78, 0], leafMat('#7aa05a'));
  const n = 16;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.sin(a) * w * 0.34;
    const z = Math.cos(a) * w * 0.34;
    rod(g, [x * 0.6, h * 0.8, z * 0.6], [x, h * 0.18 + (i % 3) * 0.2, z], 0.014, mat('#8db35f', 0.9));
    ball(g, [0.2, 0.9, 0.2], [x, h * 0.45, z], leafMat('#86ad5c', (i % 2) * 0.03)).scale.y = h * 0.28;
  }
  return g;
};

const potTree: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  cyl(g, w * 0.3, w * 0.22, 0.4, [0, 0, 0], mat('#c9bfa0', 0.8));
  cyl(g, w * 0.26, w * 0.26, 0.01, [0, 0.4, 0], SOIL());
  cyl(g, 0.03, 0.05, h * 0.4, [0, 0.4, 0], mat(BARK, 0.95));
  for (let i = 0; i < 6; i++) {
    const a = i * 1.1;
    ball(g, [w * 0.3, w * 0.22, w * 0.3], [Math.sin(a) * w * 0.18, 0.4 + h * 0.5 + (i % 3) * 0.14, Math.cos(a) * w * 0.18], leafMat('#8a9a6a', (i % 2) * 0.04));
  }
  return g;
};

const flowerBush =
  (leaf: string, flower: string, tall = false): Builder =>
  ({ w, h }) => {
    const g = new THREE.Group();
    const r = w * 0.34;
    const spots: Array<[number, number, number]> = [[0, 0.5, 0], [-0.26, 0.4, 0.05], [0.26, 0.42, -0.05], [0.04, 0.4, 0.26], [-0.03, 0.4, -0.26]];
    spots.forEach(([x, y, z], i) => {
      const ry = h * (tall ? 0.34 : 0.3) * (0.7 + y);
      ball(g, [r, ry, r], [x * w, ry, z * w], leafMat(leaf, (i % 2) * 0.04));
    });
    for (let i = 0; i < 14; i++) {
      const a = i * 2.4;
      ball(g, [0.06, 0.05, 0.06], [Math.sin(a) * w * 0.34 * ((i % 3) / 3 + 0.5), h * (0.4 + ((i * 7) % 5) * 0.09), Math.cos(a) * w * 0.34 * ((i % 3) / 3 + 0.5)], mat(flower, 0.7));
    }
    return g;
  };

const topiaryBall: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  cyl(g, w * 0.3, w * 0.22, h * 0.3, [0, 0, 0], mat('#b5604a', 0.8));
  cyl(g, 0.02, 0.025, h * 0.15, [0, h * 0.3, 0], mat(BARK, 0.95));
  ball(g, [w * 0.46, w * 0.46, w * 0.46], [0, h * 0.7, 0], leafMat('#3f7a45'));
  return g;
};

const topiarySpiral: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  cyl(g, w * 0.3, w * 0.24, h * 0.18, [0, 0, 0], mat('#b5604a', 0.8));
  for (let i = 0; i < 4; i++) cyl(g, w * (0.45 - i * 0.09), w * (0.4 - i * 0.07) + 0.04, h * 0.2, [0, h * 0.18 + i * h * 0.19, 0], leafMat('#3f7a45', i * 0.01), 14).rotation.y = i * 0.8;
  ball(g, [w * 0.14, w * 0.14, w * 0.14], [0, h - 0.04, 0], leafMat('#3f7a45'));
  return g;
};

/** A low bed edged with brick and filled with rows of coloured flowers. */
const flowerBed =
  (colors: string[], stem = 0.28, rows = 3): Builder =>
  ({ w, d, h }) => {
    const g = new THREE.Group();
    box(g, [w, 0.14, d], [0, 0, 0], mat('#8a5a43', 0.9));
    box(g, [w - 0.1, 0.1, d - 0.1], [0, 0.06, 0], SOIL());
    const cols = Math.max(3, Math.round(w / 0.2));
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i < cols; i++) {
        const x = -w / 2 + 0.12 + (i * (w - 0.24)) / (cols - 1);
        const z = -d / 2 + 0.12 + (rows === 1 ? d / 2 - 0.12 : (r * (d - 0.24)) / (rows - 1));
        rod(g, [x, 0.12, z], [x, h * stem + 0.1, z], 0.006, leafMat('#5f8a55'));
        ball(g, [0.05, 0.04, 0.05], [x, h * 0.85 + ((i + r) % 3) * 0.02, z], mat(colors[(i + r) % colors.length]!, 0.7));
      }
    }
    return g;
  };

const marigoldPatch: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  cyl(g, w / 2, w / 2, 0.08, [0, 0, 0], SOIL(), 20);
  for (let i = 0; i < 22; i++) {
    const a = i * 2.4;
    const r = (w * 0.42 * Math.sqrt((i + 1) / 22));
    ball(g, [0.08, 0.06, 0.08], [Math.sin(a) * r, h * (0.6 + (i % 3) * 0.12), Math.cos(a) * r], mat(i % 2 ? '#f2a31b' : '#e8761c', 0.7));
    ball(g, [0.06, 0.04, 0.06], [Math.sin(a) * r, h * 0.3, Math.cos(a) * r], leafMat('#5f8a55'));
  }
  return g;
};

const sunflowers: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, 0.1, d], [0, 0, 0], SOIL());
  for (let i = 0; i < 5; i++) {
    const x = -w / 2 + 0.15 + (i * (w - 0.3)) / 4;
    const hh = h * (0.7 + (i % 3) * 0.15);
    cyl(g, 0.012, 0.016, hh, [x, 0.1, 0], leafMat('#5f8a55'));
    const head = cyl(g, 0.11, 0.11, 0.03, [x, 0, 0.02], mat('#e8b41c', 0.6), 18);
    head.rotation.x = Math.PI / 2 - 0.3;
    head.position.set(x, 0.1 + hh, 0.03);
    const eye = cyl(g, 0.06, 0.06, 0.035, [x, 0, 0], mat('#4a3320', 0.9), 14);
    eye.rotation.x = Math.PI / 2 - 0.3;
    eye.position.set(x, 0.1 + hh - 0.005, 0.045);
    ball(g, [0.06, 0.02, 0.1], [x + 0.05, 0.1 + hh * 0.45, 0], leafMat('#5f8a55'));
  }
  return g;
};

const lavender: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, 0.08, d], [0, 0, 0], SOIL());
  for (let i = 0; i < 7; i++) {
    const x = -w / 2 + 0.12 + (i * (w - 0.24)) / 6;
    ball(g, [0.13, h * 0.3, 0.13], [x, 0.08 + h * 0.2, 0], leafMat('#6b8e5a'));
    for (let k = 0; k < 4; k++) {
      rod(g, [x, 0.12, 0], [x + (k - 1.5) * 0.04, h * 0.85, (k % 2) * 0.03], 0.006, leafMat('#6b8e5a'));
      ball(g, [0.015, 0.07, 0.015], [x + (k - 1.5) * 0.04, h * 0.85, (k % 2) * 0.03], mat('#8a6bc4', 0.7));
    }
  }
  return g;
};

const tallGrass: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  for (let i = 0; i < 26; i++) {
    const a = i * 2.4;
    const r = w * 0.3 * ((i % 5) / 5 + 0.2);
    const hh = h * (0.6 + ((i * 7) % 5) * 0.1);
    const b = box(g, [0.018, hh, 0.006], [Math.sin(a) * r, 0, Math.cos(a) * r], leafMat('#a9b366', (i % 3) * 0.03), a);
    b.rotation.z = Math.sin(a) * 0.35;
    b.rotation.x = Math.cos(a) * 0.35;
  }
  return g;
};

const fern: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const len = w * 0.46;
    rod(g, [0, 0.03, 0], [Math.sin(a) * len, h * 0.55 - (i % 2) * 0.1, Math.cos(a) * len], 0.01, leafMat('#4f8a4a'));
    const l = ball(g, [0.06, 0.012, len * 0.5], [Math.sin(a) * len * 0.5, h * 0.35, Math.cos(a) * len * 0.5], leafMat('#4f8a4a', (i % 2) * 0.05));
    l.rotation.set(0.3, a, 0, 'YXZ');
  }
  return g;
};

const rockCluster: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  const a = mat('#8f8c85', 0.95);
  const b = mat('#a39f96', 0.95);
  ball(g, [w * 0.34, h * 0.5, d * 0.4], [-w * 0.15, h * 0.5, 0], a);
  ball(g, [w * 0.26, h * 0.38, d * 0.3], [w * 0.22, h * 0.38, d * 0.12], b);
  ball(g, [w * 0.18, h * 0.28, d * 0.22], [w * 0.05, h * 0.28, -d * 0.28], b);
  return g;
};

const logPile: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  const l = cyl(g, d / 2, d / 2, w, [0, 0, 0], mat('#6b4a30', 0.95), 14);
  l.rotation.z = Math.PI / 2;
  l.position.set(0, h / 2, 0);
  const cap = cyl(g, d / 2 - 0.03, d / 2 - 0.03, 0.01, [0, 0, 0], mat('#c9a47a', 0.8), 14);
  cap.rotation.z = Math.PI / 2;
  cap.position.set(w / 2, h / 2, 0);
  return g;
};

const lotus: Builder = ({ w }) => {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = i * 1.3;
    const r = i === 0 ? 0 : w * 0.28;
    cyl(g, w * 0.18, w * 0.18, 0.008, [Math.sin(a) * r, 0.02, Math.cos(a) * r], leafMat('#4f8a4a', (i % 2) * 0.04), 16);
  }
  for (const [x, z] of [[0.05, 0.04], [-w * 0.25, w * 0.15]] as const) {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      ball(g, [0.035, 0.07, 0.015], [x + Math.sin(a) * 0.05, 0.11, z + Math.cos(a) * 0.05], mat('#f0a8c4', 0.6)).rotation.set(Math.cos(a) * 0.5, a, Math.sin(a) * 0.5);
    }
    ball(g, [0.025, 0.025, 0.025], [x, 0.09, z], mat('#f4d58a', 0.6));
  }
  return g;
};

const gnome: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  cyl(g, w * 0.28, w * 0.34, h * 0.4, [0, 0, 0], mat('#2c5ea8', 0.7));
  ball(g, [w * 0.22, w * 0.22, w * 0.22], [0, h * 0.45, 0], mat('#f2c9a5', 0.8));
  cyl(g, w * 0.3, w * 0.3, h * 0.12, [0, h * 0.42, w * 0.04], mat('#f1efea', 0.9), 14);
  cyl(g, 0.0, w * 0.3, h * 0.38, [0, h * 0.58, 0], mat('#c0392b', 0.7), 14);
  return g;
};

const sundial: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  cyl(g, w * 0.2, w * 0.28, h - 0.18, [0, 0, 0], STONE(), 18);
  cyl(g, w * 0.5, w * 0.34, 0.12, [0, h - 0.18, 0], STONE(), 24);
  const gnomon = box(g, [0.01, 0.2, 0.2], [0, h - 0.06, 0], BRASS());
  gnomon.rotation.x = -0.6;
  return g;
};

const stoneLantern: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  const st = STONE();
  cyl(g, w * 0.4, w * 0.45, 0.1, [0, 0, 0], st, 8);
  cyl(g, w * 0.12, w * 0.14, h * 0.4, [0, 0.1, 0], st, 8);
  cyl(g, w * 0.34, w * 0.3, 0.08, [0, 0.1 + h * 0.4, 0], st, 8);
  cyl(g, w * 0.26, w * 0.26, h * 0.2, [0, 0.18 + h * 0.4, 0], mat('#ffe0b0', 0.4, 0, { emissive: new THREE.Color('#ffd9a0'), emissiveIntensity: 0.7 }), 8);
  cyl(g, 0.01, w * 0.5, h * 0.16, [0, 0.38 + h * 0.4, 0], st, 8);
  ball(g, [0.05, 0.06, 0.05], [0, h - 0.04, 0], st);
  return g;
};

const gardenStatue: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  const stone = mat('#e3dfd6', 0.7);
  box(g, [w * 0.8, 0.5, w * 0.8], [0, 0, 0], stone);
  cyl(g, w * 0.18, w * 0.26, h * 0.4, [0, 0.5, 0], stone, 14);
  ball(g, [w * 0.2, w * 0.2, w * 0.2], [0, 0.5 + h * 0.5, 0], stone);
  cyl(g, w * 0.12, w * 0.22, h * 0.35, [0, 0.55 + h * 0.25, 0], stone, 14);
  return g;
};

const urnPlanter: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  const pot = mat('#d9d0bf', 0.7);
  cyl(g, w * 0.2, w * 0.28, h * 0.1, [0, 0, 0], pot);
  cyl(g, w * 0.12, w * 0.2, h * 0.3, [0, h * 0.1, 0], pot);
  cyl(g, w * 0.34, w * 0.14, h * 0.22, [0, h * 0.4, 0], pot);
  cyl(g, w * 0.36, w * 0.34, 0.04, [0, h * 0.62, 0], pot);
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9;
    ball(g, [0.1, 0.12, 0.1], [Math.sin(a) * 0.12, h * 0.72 + (i % 3) * 0.08, Math.cos(a) * 0.12], leafMat('#5f8a55', (i % 2) * 0.05));
    if (i % 2) ball(g, [0.05, 0.04, 0.05], [Math.sin(a) * 0.16, h * 0.9, Math.cos(a) * 0.16], mat('#e8b4b8', 0.7));
  }
  return g;
};

const wheelbarrow: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  const tub = box(g, [w * 0.8, h * 0.35, d * 0.5], [0, h * 0.4, d * 0.1], mat('#3c7a4d', 0.6));
  tub.rotation.x = -0.1;
  const wheel = ring(g, h * 0.26, 0.03, [0, h * 0.26 + 0.035, d / 2 - 0.12], BLACK(), 0);
  wheel.rotation.y = Math.PI / 2;
  for (const sx of [-1, 1]) {
    rod(g, [sx * w * 0.3, h * 0.45, -d / 2 + 0.05], [sx * w * 0.12, h * 0.4, d / 2 - 0.1], 0.02, mat('#8f6f4f', 0.8));
    rod(g, [sx * w * 0.3, 0.02, -d * 0.2], [sx * w * 0.3, h * 0.42, -d * 0.2], 0.02, mat('#8f6f4f', 0.8));
  }
  ball(g, [0.14, 0.08, 0.14], [0, h * 0.62, d * 0.05], SOIL());
  return g;
};

const wateringCan: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  const m = mat('#4d9fd0', 0.4, 0.3);
  cyl(g, d * 0.42, d * 0.45, h * 0.65, [-w * 0.1, 0, 0], m, 18);
  rod(g, [-w * 0.1 + d * 0.3, h * 0.2, 0], [w * 0.45, h * 0.62, 0], 0.014, m);
  cyl(g, 0.03, 0.04, 0.05, [w * 0.45, h * 0.6, 0], m);
  rod(g, [-w * 0.1 - d * 0.35, h * 0.55, 0], [-w * 0.1, h * 0.95, 0], 0.012, m);
  rod(g, [-w * 0.1, h * 0.95, 0], [-w * 0.1 + d * 0.35, h * 0.55, 0], 0.012, m);
  return g;
};

const stakeLight: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  cyl(g, 0.012, 0.015, h * 0.7, [0, 0, 0], mat('#3b3a38', 0.5, 0.5));
  cyl(g, w * 0.3, w * 0.4, h * 0.2, [0, h * 0.7, 0], mat('#f1efea', 0.4, 0, { emissive: new THREE.Color('#ffe0b0'), emissiveIntensity: 0.6, transparent: true, opacity: 0.9 }));
  cyl(g, w * 0.45, w * 0.3, 0.03, [0, h * 0.9, 0], mat('#3b3a38', 0.5, 0.5));
  return g;
};

// ----------------------------------------------------------------------------------------------- scenery

/** A simple neighbouring building: body, roof, doors / windows suggested with boxes. */
function building(opts: { wall: string; roof: 'flat' | 'hip' | 'gable'; roofColor: string; floors: number; trim?: string }): Builder {
  return ({ w, d, h }) => {
    const g = new THREE.Group();
    const wall = mat(opts.wall, 0.85);
    const trim = mat(opts.trim ?? '#f1efea', 0.6);
    const roofH = opts.roof === 'flat' ? 0.25 : Math.min(2.4, h * 0.3);
    const bodyH = h - roofH;
    box(g, [w, bodyH, d], [0, 0, 0], wall);
    box(g, [w + 0.2, 0.15, d + 0.2], [0, 0, 0], mat('#8f8c85', 0.9));
    const floorH = bodyH / opts.floors;
    for (let f = 0; f < opts.floors; f++) {
      const y = f * floorH + floorH * 0.35;
      const cols = Math.max(2, Math.round(w / 2.6));
      for (let i = 0; i < cols; i++) {
        const x = -w / 2 + (w / cols) * (i + 0.5);
        box(g, [0.95, 1.15, 0.05], [x, y, d / 2 + 0.01], mat('#2b3a4a', 0.2, 0.2));
        box(g, [1.1, 0.08, 0.1], [x, y + 1.15, d / 2 + 0.03], trim);
        box(g, [0.95, 1.15, 0.05], [x, y, -d / 2 - 0.01], mat('#2b3a4a', 0.2, 0.2));
      }
      if (f > 0) box(g, [w + 0.1, 0.1, d + 0.1], [0, f * floorH, 0], trim);
    }
    box(g, [1.1, 2.1, 0.06], [w * 0.2, 0.15, d / 2 + 0.02], mat('#6b4a30', 0.6));
    const r = mat(opts.roofColor, 0.8);
    if (opts.roof === 'flat') {
      box(g, [w + 0.3, 0.25, d + 0.3], [0, bodyH, 0], r);
      box(g, [w + 0.3, 0.5, 0.15], [0, bodyH + 0.25, d / 2 + 0.07], mat(opts.wall, 0.85));
    } else {
      const rm = mat(opts.roofColor, 0.8, 0, { side: THREE.DoubleSide });
      roofShape(g, opts.roof, w + 0.7, d + 0.7, bodyH, roofH, rm);
    }
    return g;
  };
}

const apartmentBlock: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, h - 0.4, d], [0, 0, 0], mat('#c9bfa6', 0.85));
  box(g, [w + 0.2, 0.4, d + 0.2], [0, h - 0.4, 0], mat('#8f8c85', 0.9));
  const floors = Math.floor(h / 3);
  const cols = Math.round(w / 2.4);
  for (let f = 0; f < floors; f++) {
    for (let i = 0; i < cols; i++) {
      const x = -w / 2 + (w / cols) * (i + 0.5);
      box(g, [1.2, 1.4, 0.05], [x, 0.9 + f * 3, d / 2 + 0.01], mat('#2b3a4a', 0.2, 0.2));
      box(g, [1.4, 0.06, 0.4], [x, 0.9 + f * 3, d / 2 + 0.2], mat('#e8e6e0', 0.6));
      box(g, [1.2, 1.4, 0.05], [x, 0.9 + f * 3, -d / 2 - 0.01], mat('#2b3a4a', 0.2, 0.2));
    }
  }
  box(g, [2.2, 3.0, 0.06], [0, 0.15, d / 2 + 0.02], mat('#3b3a38', 0.5));
  box(g, [w * 0.3, 1.2, d * 0.3], [w * 0.2, h - 0.4, 0], mat('#b9b6ac', 0.9)); // lift room
  return g;
};

const pond =
  (round: boolean): Builder =>
  ({ w, d, h }) => {
    const g = new THREE.Group();
    const stone = STONE();
    if (round) {
      cyl(g, w / 2, w / 2, h, [0, 0, 0], stone, 32);
      cyl(g, w / 2 - 0.2, w / 2 - 0.2, 0.01, [0, h - 0.04, 0], WATER(), 32);
    } else {
      const edge = cyl(g, 0.5, 0.5, h, [0, 0, 0], stone, 32);
      edge.scale.set(w, 1, d);
      const water = cyl(g, 0.5 - 0.2 / Math.max(w, d), 0.5 - 0.2 / Math.max(w, d), 0.01, [0, h - 0.04, 0], WATER(), 32);
      water.scale.set(w, 1, d);
    }
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      ball(g, [0.2 + (i % 3) * 0.05, h * 0.75, 0.18], [Math.sin(a) * (w / 2 - 0.1), h * 0.75, Math.cos(a) * ((round ? w : d) / 2 - 0.1)], i % 2 ? STONE() : mat('#8f8c85', 0.95));
    }
    for (let i = 0; i < 3; i++) cyl(g, 0.22, 0.22, 0.006, [Math.sin(i * 2) * w * 0.18, h - 0.03, Math.cos(i * 2) * (round ? w : d) * 0.18], leafMat('#4f8a4a'), 14);
    return g;
  };

const hill =
  (color: string): Builder =>
  ({ w, d, h }) => {
    const g = new THREE.Group();
    dome(g, w / 2, h, d / 2, [0, 0], mat(color, 1));
    dome(g, w * 0.25, h * 0.7, d * 0.28, [w * 0.2, d * 0.08], mat(shade(color, 0.04), 1));
    return g;
  };

const road =
  (corner: boolean): Builder =>
  ({ w, d, h }) => {
    const g = new THREE.Group();
    box(g, [w, h, d], [0, 0, 0], mat('#4a4a4c', 0.95));
    if (!corner) {
      for (let i = 0; i < Math.floor(d / 1.6); i++) box(g, [0.12, 0.006, 0.8], [0, h, -d / 2 + 0.6 + i * 1.6], mat('#f1efea', 0.8));
      for (const sx of [-1, 1]) box(g, [0.08, 0.006, d], [sx * (w / 2 - 0.25), h, 0], mat('#f1efea', 0.8));
    } else {
      for (let i = 0; i < 3; i++) box(g, [0.12, 0.006, 0.8], [0, h, -d / 2 + 0.6 + i * 1.6], mat('#f1efea', 0.8));
      box(g, [0.08, 0.006, d], [w / 2 - 0.25, h, 0], mat('#f1efea', 0.8));
    }
    return g;
  };

const pavement: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, h, d], [0, 0, 0], mat('#b8b4ab', 0.9));
  for (let i = 1; i < Math.floor(d / 1); i++) box(g, [w, 0.004, 0.02], [0, h, -d / 2 + i * 1], mat('#8f8c85', 0.9));
  return g;
};

const streetLight: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  const steel = mat('#5b6168', 0.5, 0.6);
  cyl(g, 0.1, 0.14, 0.25, [0, 0, 0], steel);
  cyl(g, 0.045, 0.07, h - 0.4, [0, 0.25, 0], steel);
  rod(g, [0, h - 0.3, 0], [w * 0.8, h - 0.15, 0], 0.035, steel);
  box(g, [0.5, 0.1, 0.2], [w * 0.85, h - 0.28, 0], mat('#3b3a38', 0.5));
  box(g, [0.4, 0.02, 0.15], [w * 0.85, h - 0.3, 0], GLOW());
  return g;
};

const compoundWall: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, h, d], [0, 0, 0], mat('#e3d9c4', 0.9));
  box(g, [w + 0.04, 0.1, d + 0.08], [0, h, 0], mat('#c9bfa6', 0.9));
  const n = Math.round(w / 2.5);
  for (let i = 0; i <= n; i++) box(g, [0.3, h + 0.15, d + 0.1], [-w / 2 + (i * w) / n, 0, 0], mat('#d2c7ad', 0.9));
  return g;
};

export const BUILDERS5: Record<string, Builder> = {
  'tree-mango': crownTree({ leaf: '#3f7a3a', blobs: 8 }),
  'tree-neem': crownTree({ leaf: '#5a8f45', blobs: 9, spread: 0.3 }),
  'tree-banyan': banyan,
  'tree-gulmohar': crownTree({ leaf: '#5a9a45', blobs: 8, flatten: 0.6, flowers: '#d9381e' }),
  'tree-cherry': crownTree({ trunk: '#4a3a30', leaf: '#f0b4c8', blobs: 8, flowers: '#f7d4e0' }),
  'tree-oak': crownTree({ leaf: '#4a7a35', blobs: 9, spread: 0.3 }),
  'tree-birch': birch,
  'tree-cypress': cypress,
  'tree-willow': willow,
  'tree-fruit': crownTree({ leaf: '#6a9a45', blobs: 6, flowers: '#d9381e' }),
  'tree-olive': potTree,
  'bush-flower': flowerBush('#4f8a45', '#e8789c'),
  hibiscus: flowerBush('#3f7a3a', '#d9381e', true),
  'topiary-ball': topiaryBall,
  'topiary-spiral': topiarySpiral,
  'rose-bed': flowerBed(['#c0392b', '#e8789c', '#f4d58a', '#ffffff']),
  'marigold-patch': marigoldPatch,
  sunflowers,
  'lavender-row': lavender,
  'tall-grass': tallGrass,
  fern,
  'rock-cluster': rockCluster,
  log: logPile,
  lotus,
  'garden-gnome': gnome,
  sundial,
  'stone-lantern': stoneLantern,
  'garden-statue': gardenStatue,
  'urn-planter': urnPlanter,
  wheelbarrow,
  'watering-can': wateringCan,
  'stake-light': stakeLight,
  'neighbour-modern': building({ wall: '#e8e4da', roof: 'flat', roofColor: '#7d7f84', floors: 2, trim: '#2b2a28' }),
  'neighbour-villa': building({ wall: '#efe3c8', roof: 'hip', roofColor: '#a8442f', floors: 2 }),
  'neighbour-row': building({ wall: '#d9a58a', roof: 'gable', roofColor: '#6d7074', floors: 2 }),
  'neighbour-hut': building({ wall: '#d8c7a4', roof: 'hip', roofColor: '#9a4a30', floors: 1 }),
  'apartment-block': apartmentBlock,
  'pond-small': pond(false),
  'pond-large': pond(false),
  'pond-round': pond(true),
  hill: hill('#7f9a62'),
  mound: hill('#8aa86a'),
  'road-straight': road(false),
  'road-corner': road(true),
  pavement,
  'street-light': streetLight,
  'compound-wall': compoundWall,
};

void CHROME;
void GLASS;
