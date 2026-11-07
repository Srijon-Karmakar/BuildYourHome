import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TREE_SEASONS } from '@hd/assets';
import { ball, cyl, mat, type Builder } from './kit';
import { rod } from './builders2';

/**
 * Trees with a real silhouette: foliage is built from lumpy, softly shaded clusters (darker underneath, lighter on top) on a
 * tapered trunk with limbs reaching into the crown. All foliage shares one material and carries its colour in the vertices,
 * so a whole crown is a single draw call and a season colour is just a different tint.
 */


const LEAF = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
const BARK = '#6e5a45';

/** Same number for the same place, so the vertices a sphere shares move together. */
function noise3(x: number, y: number, z: number, seed: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 19.19) * 43758.5453;
  return s - Math.floor(s);
}

const cache = new Map<string, THREE.BufferGeometry>();

/** A lumpy ball of leaves on y = 0 centre, unit size, shaded from dark (underneath) to light (top). */
function leafGeometry(seed: number, detail: number, lumpy: number): THREE.BufferGeometry {
  const key = `${seed}|${detail}|${lumpy}`;
  let g = cache.get(key);
  if (g) return g;
  let base: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, detail);
  base.deleteAttribute('uv');
  base.deleteAttribute('normal');
  base = mergeVertices(base, 1e-4);
  const pos = base.attributes.position as THREE.BufferAttribute;
  const shade = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const k = 1 + (noise3(Math.round(x * 40), Math.round(y * 40), Math.round(z * 40), seed) - 0.5) * lumpy;
    // A second, coarser wobble so the outline is not just fine noise.
    const big = 1 + (noise3(Math.round(x * 3), Math.round(y * 3), Math.round(z * 3), seed + 7) - 0.5) * lumpy * 0.8;
    pos.setXYZ(i, x * k * big, y * k * big, z * k * big);
    shade[i] = 0.58 + 0.5 * ((y + 1) / 2) + (noise3(Math.round(x * 25), Math.round(y * 25), Math.round(z * 25), seed + 3) - 0.5) * 0.14;
  }
  base.computeVertexNormals();
  base.setAttribute('shade', new THREE.BufferAttribute(shade, 1));
  g = base;
  cache.set(key, g);
  return g;
}

/** One cluster of leaves of `rx`, `ry`, `rz` at (x, y, z). `color` is its own base colour. */
function cluster(g: THREE.Group, [rx, ry, rz]: [number, number, number], [x, y, z]: [number, number, number], color: THREE.Color, seed: number, detail = 2, lumpy = 0.28): void {
  const base = leafGeometry(seed % 7, detail, lumpy);
  const geo = base.clone();
  const shade = base.getAttribute('shade') as THREE.BufferAttribute;
  const colors = new Float32Array(shade.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < shade.count; i++) {
    c.copy(color).multiplyScalar(shade.getX(i));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.deleteAttribute('shade');
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.scale(rx, ry, rz);
  geo.translate(x, y, z);
  const mesh = new THREE.Mesh(geo, LEAF);
  mesh.castShadow = mesh.receiveShadow = true;
  g.add(mesh);
}

interface Spec {
  /** The tree's own foliage colour. */
  leaf: string;
  trunk?: string;
  /** How much of the height is bare trunk. */
  trunkH: number;
  /** Crown width as a share of the footprint, and crown height as a share of the height. */
  crownW: number;
  crownH: number;
  clusters: number;
  /** Size of each cluster (1 = the usual) and how flat the crown is (1 = round). */
  blob?: number;
  squash?: number;
  lumpy?: number;
  /** Trunk thickness factor. */
  stout?: number;
  limbs?: number;
  flowers?: string;
  fruit?: string;
}

const goldenAngle = 2.399963;

function tree(spec: Spec): Builder {
  return ({ w, h, c }) => {
    const g = new THREE.Group();
    const natural = TREE_SEASONS[0]!.id;
    const leaf = new THREE.Color(c && c !== natural && c !== '#c9c4b9' ? c : spec.leaf);
    const autumn = c === '#c98a2b' || c === '#b5502c' || c === '#b9c8bf';
    const bark = mat(spec.trunk ?? BARK, 0.95);
    const stout = spec.stout ?? 1;
    const th = h * spec.trunkH;
    const rb = (0.06 + w * 0.022) * stout;
    const rt = rb * 0.55;
    // Root flare, then the trunk.
    cyl(g, rb * 1.05, rb * 1.9, 0.22, [0, 0, 0], bark, 12);
    cyl(g, rt, rb * 1.05, th - 0.1, [0, 0.2, 0], bark, 12);
    const R = (w / 2) * spec.crownW;
    const cy = th; // where the crown starts
    const CH = h * spec.crownH;
    // Limbs into the crown.
    const limbs = spec.limbs ?? 4;
    for (let k = 0; k < limbs; k++) {
      const a = k * goldenAngle + 0.5;
      const reach = R * (0.35 + 0.15 * (k % 2));
      rod(g, [0, th * 0.78, 0], [Math.sin(a) * reach, th + CH * (0.32 + 0.1 * (k % 3)), Math.cos(a) * reach], rt * 0.8, bark);
    }
    // Foliage: a dome of clusters, the biggest in the middle, outer ones sitting lower.
    const n = spec.clusters;
    const blob = spec.blob ?? 1;
    const squash = spec.squash ?? 0.85;
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n;
      const radial = i === 0 ? 0 : Math.sqrt(u) * R * 0.78;
      const a = i * goldenAngle;
      const drop = 1 - (radial / (R * 0.8)) ** 2; // 1 at the middle, 0 at the rim
      const y = cy + CH * (0.28 + 0.52 * Math.max(0, drop)) - (i === 0 ? 0 : CH * 0.05);
      const rr = R * 0.46 * blob * (i === 0 ? 1.15 : 0.8 + noise3(i, 3, 5, 1) * 0.35);
      const tint = leaf.clone().offsetHSL((noise3(i, 9, 2, 4) - 0.5) * 0.02, 0, (noise3(i, 1, 7, 2) - 0.5) * 0.06);
      cluster(g, [rr, rr * squash, rr], [Math.sin(a) * radial, y, Math.cos(a) * radial], tint, i, i === 0 ? 3 : 2, spec.lumpy ?? 0.3);
    }
    // Flowers / fruit: small dots on the surface of the crown.
    const dots = spec.flowers && !autumn ? spec.flowers : spec.fruit;
    if (dots) {
      const m = mat(dots, 0.7);
      for (let i = 0; i < 26; i++) {
        const a = i * goldenAngle * 1.3;
        const t = ((i * 0.61803) % 1) * 0.9 + 0.05;
        const rad = Math.sqrt(t) * R * 0.85;
        const y = cy + CH * (0.3 + 0.5 * Math.max(0, 1 - (rad / (R * 0.85)) ** 2)) + (spec.flowers ? CH * 0.12 : -CH * 0.04);
        ball(g, spec.flowers ? [0.07, 0.05, 0.07] : [0.06, 0.07, 0.06], [Math.sin(a) * rad, y, Math.cos(a) * rad], m);
      }
    }
    return g;
  };
}

const cypress: Builder = ({ w, h, c }) => {
  const g = new THREE.Group();
  const leaf = new THREE.Color(c && c !== TREE_SEASONS[0]!.id && c !== '#c9c4b9' ? c : '#2f5d3a');
  cyl(g, 0.04, 0.09, h * 0.14, [0, 0, 0], mat(BARK, 0.95), 8);
  const layers = 6;
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1);
    const r = (w / 2) * (1 - t * 0.78) * 1.05;
    cluster(g, [r, h * 0.13, r], [0, h * 0.16 + t * h * 0.74, 0], leaf.clone().offsetHSL(0, 0, (i % 2) * 0.02), i + 2, 2, 0.22);
  }
  cluster(g, [w * 0.12, h * 0.07, w * 0.12], [0, h * 0.97, 0], leaf, 5, 1, 0.2);
  return g;
};

const birch: Builder = ({ w, h, c }) => {
  const g = new THREE.Group();
  const leaf = new THREE.Color(c && c !== TREE_SEASONS[0]!.id && c !== '#c9c4b9' ? c : '#8ab35a');
  const bark = mat('#ece8e0', 0.8);
  cyl(g, 0.04, 0.075, h * 0.62, [0, 0, 0], bark, 10);
  for (let i = 0; i < 7; i++) cyl(g, 0.043 + 0.0, 0.043, 0.025, [0, h * 0.07 + i * h * 0.075, 0], mat('#3b3a38', 0.9), 8).scale.set(1.12, 1, 1.12);
  rod(g, [0, h * 0.45, 0], [w * 0.2, h * 0.65, 0.05], 0.025, bark);
  rod(g, [0, h * 0.5, 0], [-w * 0.2, h * 0.7, -0.04], 0.025, bark);
  for (let i = 0; i < 8; i++) {
    const a = i * goldenAngle;
    const rad = i === 0 ? 0 : w * 0.18;
    cluster(g, [w * 0.26, w * 0.3, w * 0.26], [Math.sin(a) * rad, h * (0.6 + (i % 4) * 0.1), Math.cos(a) * rad], leaf.clone().offsetHSL(0, 0, (i % 2) * 0.04), i, 2, 0.3);
  }
  return g;
};

const willow: Builder = ({ w, h, c }) => {
  const g = new THREE.Group();
  const leaf = new THREE.Color(c && c !== TREE_SEASONS[0]!.id && c !== '#c9c4b9' ? c : '#7aa05a');
  const bark = mat('#5e4c3a', 0.95);
  cyl(g, 0.1, 0.22, h * 0.5, [0, 0, 0], bark, 12);
  rod(g, [0, h * 0.4, 0], [w * 0.16, h * 0.72, 0], 0.07, bark);
  rod(g, [0, h * 0.4, 0], [-w * 0.15, h * 0.7, 0.05], 0.07, bark);
  cluster(g, [w * 0.3, w * 0.16, w * 0.3], [0, h * 0.8, 0], leaf, 1, 3, 0.3);
  const n = 22;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const ring = w * (0.2 + (i % 3) * 0.07);
    const len = h * (0.34 + (i % 4) * 0.05);
    // A hanging curtain: a long thin, lumpy cluster from the crown down.
    cluster(g, [0.13, len / 2, 0.13], [Math.sin(a) * ring, h * 0.78 - len / 2, Math.cos(a) * ring], leaf.clone().offsetHSL(0.01, 0, (i % 2) * 0.04 - 0.02), i, 1, 0.3);
  }
  return g;
};

const banyan: Builder = ({ w, h, c }) => {
  const g = new THREE.Group();
  const leaf = new THREE.Color(c && c !== TREE_SEASONS[0]!.id && c !== '#c9c4b9' ? c : '#3f7a3f');
  const bark = mat('#7a6a55', 0.95);
  const th = h * 0.5;
  cyl(g, 0.3, 0.75, 0.5, [0, 0, 0], bark, 14);
  cyl(g, 0.28, 0.4, th - 0.4, [0, 0.45, 0], bark, 14);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    const x = Math.sin(a) * w * 0.3;
    const z = Math.cos(a) * w * 0.3;
    rod(g, [0, th * 0.9, 0], [x, h * 0.64, z], 0.1, bark);
    rod(g, [x, h * 0.64, z], [x * 1.04, 0.02, z * 1.04], 0.03 + (i % 3) * 0.012, mat('#8a7a63', 0.95)); // hanging prop roots
  }
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a = i * goldenAngle;
    const rad = i === 0 ? 0 : Math.sqrt((i + 0.5) / n) * w * 0.34;
    const rr = (i === 0 ? 0.3 : 0.2 + noise3(i, 2, 4, 3) * 0.06) * w;
    cluster(g, [rr, rr * 0.5, rr], [Math.sin(a) * rad, h * 0.72 + (1 - rad / (w * 0.34)) * h * 0.1, Math.cos(a) * rad], leaf.clone().offsetHSL(0, 0, (i % 3) * 0.02 - 0.02), i, 2, 0.3);
  }
  return g;
};

const potted: Builder = ({ w, h, c }) => {
  const g = new THREE.Group();
  const leaf = new THREE.Color(c && c !== TREE_SEASONS[0]!.id && c !== '#c9c4b9' ? c : '#8a9a6a');
  cyl(g, w * 0.3, w * 0.22, 0.4, [0, 0, 0], mat('#c9bfa0', 0.8), 16);
  cyl(g, w * 0.26, w * 0.26, 0.01, [0, 0.4, 0], mat('#4a3a2c', 1), 16);
  cyl(g, 0.025, 0.045, h * 0.4, [0, 0.4, 0], mat(BARK, 0.95), 8);
  rod(g, [0, 0.4 + h * 0.3, 0], [w * 0.14, 0.4 + h * 0.5, 0], 0.02, mat(BARK, 0.95));
  for (let i = 0; i < 7; i++) {
    const a = i * goldenAngle;
    const rad = i === 0 ? 0 : w * 0.17;
    cluster(g, [w * 0.24, w * 0.18, w * 0.24], [Math.sin(a) * rad, 0.4 + h * 0.52 + (i % 3) * 0.1, Math.cos(a) * rad], leaf.clone().offsetHSL(0, 0, (i % 2) * 0.04), i, 2, 0.25);
  }
  return g;
};

/** The shade tree and the other garden trees of the outdoor group use the same crown builder. */
export const TREE_BUILDERS: Record<string, Builder> = {
  'tree-mango': tree({ leaf: '#3f7a3a', trunkH: 0.34, crownW: 0.98, crownH: 0.66, clusters: 12, blob: 1.0, squash: 0.82, stout: 1.1, fruit: '#e6b32a' }),
  'tree-neem': tree({ leaf: '#5a8f45', trunkH: 0.4, crownW: 1.0, crownH: 0.58, clusters: 14, blob: 0.82, squash: 0.78, lumpy: 0.36 }),
  'tree-gulmohar': tree({ leaf: '#5a9a45', trunkH: 0.46, crownW: 1.0, crownH: 0.44, clusters: 11, blob: 0.98, squash: 0.55, flowers: '#d9381e' }),
  'tree-cherry': tree({ leaf: '#f0b4c8', trunk: '#4a3a30', trunkH: 0.38, crownW: 0.95, crownH: 0.58, clusters: 12, blob: 0.9, squash: 0.8, flowers: '#f7d4e0' }),
  'tree-oak': tree({ leaf: '#4a7a35', trunkH: 0.36, crownW: 1.0, crownH: 0.64, clusters: 14, blob: 1.05, squash: 0.85, stout: 1.5, limbs: 5 }),
  'tree-fruit': tree({ leaf: '#6a9a45', trunkH: 0.34, crownW: 0.95, crownH: 0.66, clusters: 8, blob: 0.95, squash: 0.85, fruit: '#d9381e' }),
  'tree-round': tree({ leaf: '#4f8a3f', trunkH: 0.36, crownW: 0.96, crownH: 0.64, clusters: 11, blob: 1.0, squash: 0.85 }),
  'tree-birch': birch,
  'tree-cypress': cypress,
  'tree-willow': willow,
  'tree-banyan': banyan,
  'tree-olive': potted,
};
