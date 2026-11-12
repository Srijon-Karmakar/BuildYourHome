import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TREE_SEASONS } from '@hd/assets';
import { cyl, mat, type Builder } from './kit';

/**
 * Trees that look like trees. Each is built from
 *  - a tapered, slightly curved trunk with root flare and a bark texture,
 *  - limbs and branches that fork twice and reach into the crown,
 *  - hundreds of leaf cards (alpha-cut clusters of drawn leaves) sampled over the crown's outline, tinted and shaded from
 *    dark inside to light outside, with soft crown-wide normals so the whole crown reads as one volume.
 * Everything of one tree is merged into three meshes (bark, leaves, fruit / flowers). Shapes are fixed per species (seeded),
 * so every copy of a species is the same tree, turned and scaled by the item. Touch screens get about half the leaves.
 */

type V3 = [number, number, number];
type LeafKind = 'broad' | 'small' | 'needle' | 'long' | 'frond';
type Shape = 'round' | 'dome' | 'cone' | 'column' | 'weeping' | 'shrub';

// ---------------------------------------------------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hashString = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const GOLDEN = 2.399963;

/** A touch screen gets about half the leaves (fewer, bigger cards would look worse than fewer of the same). */
const detail = (): number => (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches ? 0.55 : 1);

// ---------------------------------------------------------------------------------------------------------------------
// textures (drawn once; none in plain Node, where trees fall back to flat colour)
// ---------------------------------------------------------------------------------------------------------------------

function ctx2d(w: number, h: number): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c.getContext('2d');
}

const texture = (c: CanvasRenderingContext2D, repeat = false): THREE.CanvasTexture => {
  const t = new THREE.CanvasTexture(c.canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};

const grey = (l: number, a = 1) => `rgba(${l | 0},${l | 0},${l | 0},${a})`;

/** One pointed leaf from (0, 0) growing up (−y on the canvas). */
function leaf(c: CanvasRenderingContext2D, x: number, y: number, len: number, wid: number, angle: number, light: number): void {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  const g = c.createLinearGradient(-wid / 2, 0, wid / 2, -len);
  g.addColorStop(0, grey(light * 0.78));
  g.addColorStop(1, grey(Math.min(255, light * 1.08)));
  c.beginPath();
  c.moveTo(0, 0);
  c.bezierCurveTo(wid * 0.62, -len * 0.22, wid * 0.58, -len * 0.74, 0, -len);
  c.bezierCurveTo(-wid * 0.58, -len * 0.74, -wid * 0.62, -len * 0.22, 0, 0);
  c.closePath();
  c.fillStyle = g;
  c.fill();
  c.strokeStyle = grey(light * 0.55, 0.9);
  c.lineWidth = Math.max(0.8, wid * 0.05);
  c.stroke();
  // midrib
  c.beginPath();
  c.moveTo(0, -len * 0.04);
  c.lineTo(0, -len * 0.9);
  c.strokeStyle = grey(light * 0.62, 0.8);
  c.lineWidth = Math.max(0.7, wid * 0.045);
  c.stroke();
  c.restore();
}

const leafTextures: Partial<Record<LeafKind, THREE.CanvasTexture | null>> = {};

function leafTexture(kind: LeafKind): THREE.CanvasTexture | null {
  if (kind in leafTextures) return leafTextures[kind] ?? null;
  const rnd = mulberry32(hashString(`leaf-${kind}`));
  let t: THREE.CanvasTexture | null = null;
  if (kind === 'broad') {
    const c = ctx2d(256, 256);
    if (c) {
      // two layers: darker leaves behind, lighter in front; a spray growing from the lower middle
      for (let layer = 0; layer < 2; layer++) {
        for (let i = 0; i < 17; i++) {
          const a = ((i / 16) * 2 - 1) * (1.25 - layer * 0.12) + (rnd() - 0.5) * 0.22;
          leaf(c, 128 + (rnd() - 0.5) * 22, 236 - layer * 8 - rnd() * 16, 62 + rnd() * 30, 27 + rnd() * 11, a, 150 + layer * 55 + rnd() * 40);
        }
      }
      t = texture(c);
    }
  } else if (kind === 'small') {
    const c = ctx2d(256, 256);
    if (c) {
      // pinnate: a few feathery stems of many small leaflets (neem, gulmohar, birch)
      const stems = [-0.55, 0, 0.55];
      for (const s of stems) {
        const len = 190 + rnd() * 30;
        for (let k = 1; k <= 13; k++) {
          const f = k / 13;
          const bx = 128 + Math.sin(s) * len * f;
          const by = 236 - Math.cos(s) * len * f;
          for (const side of [-1, 1]) leaf(c, bx, by, 38 - f * 14, 15 - f * 4, s + side * (1.05 - f * 0.25), 160 + rnd() * 70);
        }
        leaf(c, 128 + Math.sin(s) * len, 236 - Math.cos(s) * len, 30, 12, s, 200);
      }
      t = texture(c);
    }
  } else if (kind === 'needle') {
    const c = ctx2d(256, 256);
    if (c) {
      c.lineCap = 'round';
      // a spray of needles from the lower middle
      for (let i = 0; i < 150; i++) {
        const a = (rnd() * 2 - 1) * 1.25;
        const len = 70 + rnd() * 64;
        const bx = 128 + (rnd() - 0.5) * 30;
        const by = 232 + (rnd() - 0.5) * 14;
        c.beginPath();
        c.moveTo(bx, by);
        c.lineTo(bx + Math.sin(a) * len, by - Math.cos(a) * len);
        c.strokeStyle = grey(120 + rnd() * 120);
        c.lineWidth = 2 + rnd() * 1.6;
        c.stroke();
      }
      t = texture(c);
    }
  } else if (kind === 'long') {
    const c = ctx2d(128, 256);
    if (c) {
      // long thin leaves (willow), base at the bottom like every card (the strand hangs the card tip-down)
      for (let i = 0; i < 9; i++) leaf(c, 64 + (i - 4) * 9 + (rnd() - 0.5) * 6, 250, 230 + rnd() * 20, 15 + rnd() * 6, (rnd() - 0.5) * 0.22 + (i - 4) * 0.035, 150 + rnd() * 90);
      t = texture(c);
    }
  } else {
    const c = ctx2d(128, 256);
    if (c) {
      // palm frond: a rib with leaflets leaning toward the tip
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(64, 254);
      c.lineTo(64, 4);
      c.strokeStyle = grey(110);
      c.lineWidth = 4;
      c.stroke();
      for (let k = 0; k < 34; k++) {
        const y = 240 - k * 6.8;
        const len = 56 * (1 - Math.abs(k / 34 - 0.35) * 0.85);
        for (const side of [-1, 1]) {
          c.beginPath();
          c.moveTo(64, y);
          c.lineTo(64 + side * len * 0.55, y - len * 0.78);
          c.strokeStyle = grey(150 + rnd() * 90);
          c.lineWidth = 5.5;
          c.stroke();
        }
      }
      t = texture(c);
    }
  }
  leafTextures[kind] = t;
  return t;
}

const barkTextures: Partial<Record<'plain' | 'birch', THREE.CanvasTexture | null>> = {};

function barkTexture(kind: 'plain' | 'birch'): THREE.CanvasTexture | null {
  if (kind in barkTextures) return barkTextures[kind] ?? null;
  const rnd = mulberry32(hashString(`bark-${kind}`));
  const c = ctx2d(128, 256);
  let t: THREE.CanvasTexture | null = null;
  if (c) {
    c.fillStyle = grey(kind === 'birch' ? 238 : 190);
    c.fillRect(0, 0, 128, 256);
    if (kind === 'birch') {
      for (let i = 0; i < 38; i++) {
        c.fillStyle = grey(40 + rnd() * 50, 0.85);
        c.fillRect(rnd() * 120, rnd() * 250, 10 + rnd() * 34, 2 + rnd() * 4);
      }
    } else {
      // vertical fissures with a wobble, and lighter ridges between them
      for (let i = 0; i < 46; i++) {
        const x = rnd() * 128;
        const w = 2 + rnd() * 4;
        c.beginPath();
        let px = x;
        c.moveTo(px, 0);
        for (let y = 0; y <= 256; y += 16) {
          px += (rnd() - 0.5) * 5;
          c.lineTo(px, y);
        }
        c.strokeStyle = grey(55 + rnd() * 55, 0.9);
        c.lineWidth = w;
        c.stroke();
        c.beginPath();
        c.moveTo(x + w, 0);
        c.lineTo(px + w, 256);
        c.strokeStyle = grey(220, 0.28);
        c.lineWidth = 1.6;
        c.stroke();
      }
    }
    t = texture(c, true);
  }
  barkTextures[kind] = t;
  return t;
}

const leafMaterials: Partial<Record<LeafKind, THREE.MeshStandardMaterial>> = {};
function leafMaterial(kind: LeafKind): THREE.MeshStandardMaterial {
  let m = leafMaterials[kind];
  if (!m) {
    const map = leafTexture(kind);
    m = new THREE.MeshStandardMaterial({ map: map ?? undefined, vertexColors: true, alphaTest: map ? 0.5 : 0, side: THREE.DoubleSide, roughness: 0.88, metalness: 0 });
    leafMaterials[kind] = m;
  }
  return m;
}

const barkMaterials = new Map<string, THREE.MeshStandardMaterial>();
function barkMaterial(color: string, kind: 'plain' | 'birch'): THREE.MeshStandardMaterial {
  const key = `${color}|${kind}`;
  let m = barkMaterials.get(key);
  if (!m) {
    const map = barkTexture(kind);
    m = new THREE.MeshStandardMaterial({ color, map: map ?? undefined, roughness: 0.95, metalness: 0 });
    barkMaterials.set(key, m);
  }
  return m;
}

// ---------------------------------------------------------------------------------------------------------------------
// geometry pieces
// ---------------------------------------------------------------------------------------------------------------------

/** A tube along `path` that tapers from radius `r0` to `r1`, with `uvScale` texture repeats per metre along it. */
function tube(path: THREE.Vector3[], r0: number, r1: number, radial = 7, uvScale = 1.2, flare = 0): THREE.BufferGeometry {
  const n = path.length;
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const tangents = path.map((_p, i) => {
    const a = path[Math.max(0, i - 1)]!;
    const b = path[Math.min(n - 1, i + 1)]!;
    return b.clone().sub(a).normalize();
  });
  let normal = new THREE.Vector3(1, 0, 0);
  if (Math.abs(tangents[0]!.x) > 0.9) normal = new THREE.Vector3(0, 0, 1);
  normal = normal.sub(tangents[0]!.clone().multiplyScalar(normal.dot(tangents[0]!))).normalize();
  let along = 0;
  const onGround = path[0]!.y <= 0.001; // a trunk standing on the ground never dips below it
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      along += path[i]!.distanceTo(path[i - 1]!);
      const q = new THREE.Quaternion().setFromUnitVectors(tangents[i - 1]!, tangents[i]!);
      normal.applyQuaternion(q);
    }
    const bin = new THREE.Vector3().crossVectors(tangents[i]!, normal).normalize();
    const f = i / (n - 1);
    // root flare: wider near the ground
    const r = (r0 + (r1 - r0) * f) * (1 + flare * Math.max(0, 1 - f * 6) ** 2);
    for (let k = 0; k <= radial; k++) {
      const th = (k / radial) * Math.PI * 2;
      const dir = normal.clone().multiplyScalar(Math.cos(th)).addScaledVector(bin, Math.sin(th));
      pos.push(path[i]!.x + dir.x * r, onGround ? Math.max(0, path[i]!.y + dir.y * r) : path[i]!.y + dir.y * r, path[i]!.z + dir.z * r);
      nor.push(dir.x, dir.y, dir.z);
      uv.push((k / radial) * Math.max(1, Math.round(r * 9)), along * uvScale);
    }
  }
  const row = radial + 1;
  for (let i = 0; i + 1 < n; i++) {
    for (let k = 0; k < radial; k++) {
      const a = i * row + k;
      idx.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

const curvePoints = (pts: V3[], n: number): THREE.Vector3[] => new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))).getPoints(n);

/** Leaf cards collected into one mesh. */
class Cards {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];
  col: number[] = [];
  idx: number[] = [];
  count = 0;

  /**
   * A card whose bottom middle is at `at`, growing along `dir`, `size` tall and `aspect` times as wide, turned by `roll`
   * about its own axis, with the given tint and shading normal.
   */
  add(at: V3, dir: V3, size: number, aspect: number, roll: number, color: THREE.Color, normal: V3): void {
    const d = new THREE.Vector3(...dir).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), roll));
    const base = this.pos.length / 3;
    const hw = (size * aspect) / 2;
    const corners: Array<[number, number, number, number]> = [[-hw, 0, 0, 0], [hw, 0, 1, 0], [hw, size, 1, 1], [-hw, size, 0, 1]];
    const world = corners.map(([x, y]) => new THREE.Vector3(x, y, 0).applyQuaternion(q));
    // nothing hangs below the ground
    const lift = Math.max(0, -Math.min(...world.map((p) => at[1] + p.y)));
    corners.forEach(([, , u, v], k) => {
      const p = world[k]!;
      this.pos.push(at[0] + p.x, at[1] + p.y + lift, at[2] + p.z);
      this.nor.push(normal[0], normal[1], normal[2]);
      this.uv.push(u, v);
      this.col.push(color.r, color.g, color.b);
    });
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    this.count++;
  }

  geometry(): THREE.BufferGeometry | null {
    if (this.count === 0) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    return g;
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// species
// ---------------------------------------------------------------------------------------------------------------------

interface Species {
  kind: LeafKind;
  shape: Shape;
  leaf: string;
  bark: string;
  barkKind?: 'plain' | 'birch';
  /** Height of the bare trunk, as a share of the tree's height; the crown starts a little below it. */
  trunk: number;
  /** Share of the footprint width the crown fills, and of the height above the trunk base that it fills. */
  crownW: number;
  crownH?: number;
  /** Trunk radius as a share of the height. */
  stout: number;
  limbs: number;
  /** Cards at full detail, and the card height as a share of the tree height. */
  cards: number;
  card: number;
  /** Width of a card as a multiple of its height. */
  aspect?: number;
  /** Fullness of the outline (1 = ellipse; below 1 = boxier). */
  fill?: number;
  /** Fruit or flower dots: colour, how many, size (m at 5 m tall). */
  dots?: { color: string; count: number; size: number; flowers?: boolean };
  /** Banyan: aerial roots hanging from the branches. */
  roots?: number;
  /** Willow: long strands hanging from the crown edge. */
  strands?: number;
  /** Leaf tint variation (0-1). */
  vary?: number;
}

/** Outline of the crown: radius (0..1) at height t (0 = bottom of the crown, 1 = top). */
function profile(shape: Shape, t: number, fill = 1): number {
  const dome = Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2));
  switch (shape) {
    case 'cone':
      return Math.max(0.03, (1 - t) ** 0.9) * 0.98 + 0.02;
    case 'column':
      return Math.min(1, 0.5 + 1.8 * t) * (1 - t ** 3) * 0.98 + 0.02;
    case 'dome':
      return Math.max(0.1, dome ** (0.7 * fill));
    case 'weeping':
      return Math.max(0.12, dome ** 0.8);
    case 'shrub':
      return Math.max(0.2, dome ** (0.8 * fill));
    default:
      return Math.max(0.12, dome ** (0.85 * fill));
  }
}

const NATURAL = TREE_SEASONS[0]!.id;
const isOwnColour = (c: string | undefined): boolean => !c || c === NATURAL || c === '#c9c4b9';

/** Make the leaf colour into a tint for the cards: the texture is grey, so the tint carries the colour (a little brighter). */
const tintOf = (hex: string): THREE.Color => new THREE.Color(hex).multiplyScalar(1.6);

function buildTree(spec: Species, id: string, w: number, h: number, colour: string): THREE.Group {
  const g = new THREE.Group();
  const rnd = mulberry32(hashString(id));
  const dt = detail();
  const cardSize = h * spec.card * (dt < 1 ? 1.25 : 1);
  // a card sticks out past the point it is placed at: keep the leaves inside the footprint
  const R = Math.max(0.15, (w / 2) * spec.crownW - cardSize * 0.6);
  const th = h * spec.trunk;
  const crownBase = Math.max(0.2, th * (spec.shape === 'cone' || spec.shape === 'column' ? 0.2 : 0.78));
  const CH = (spec.crownH ?? 1) * (h - crownBase);
  const rb = Math.max(0.035, h * spec.stout);
  const leafBase = isOwnColour(colour) ? spec.leaf : colour;
  const autumn = colour === '#c98a2b' || colour === '#b5502c';
  const baseColor = tintOf(leafBase);
  const bark = barkMaterial(spec.bark, spec.barkKind ?? 'plain');
  const woods: THREE.BufferGeometry[] = [];

  // ---- trunk ----
  const lean = (rnd() - 0.5) * 0.1 * h * 0.1;
  const trunkTop = spec.shape === 'cone' ? h * 0.93 : spec.shape === 'column' ? h * 0.9 : th;
  woods.push(
    tube(
      curvePoints(
        [
          [0, 0, 0],
          [lean * 0.3, trunkTop * 0.3, lean * 0.2],
          [lean, trunkTop * 0.65, -lean * 0.5],
          [lean * 0.6, trunkTop, lean * 0.3],
        ],
        10,
      ),
      rb * 1.05,
      spec.shape === 'cone' || spec.shape === 'column' ? rb * 0.12 : rb * 0.6,
      9,
      1.1,
      0.9,
    ),
  );

  // ---- limbs: they fork twice and end inside the crown ----
  const anchors: V3[] = [];
  const crownC: V3 = [0, crownBase + CH * 0.5, 0];
  const addLimb = (from: V3, to: V3, r0: number, r1: number, bendUp: number): THREE.Vector3[] => {
    const mid1: V3 = [from[0] + (to[0] - from[0]) * 0.35, from[1] + (to[1] - from[1]) * 0.35 + bendUp, from[2] + (to[2] - from[2]) * 0.35];
    const mid2: V3 = [from[0] + (to[0] - from[0]) * 0.7, from[1] + (to[1] - from[1]) * 0.7 + bendUp * 0.35, from[2] + (to[2] - from[2]) * 0.7];
    const pts = curvePoints([from, mid1, mid2, to], 7);
    woods.push(tube(pts, r0, r1, 6, 1.1));
    return pts;
  };
  const branchy = spec.shape !== 'cone' && spec.shape !== 'column' && spec.shape !== 'shrub';
  if (branchy) {
    for (let i = 0; i < spec.limbs; i++) {
      const a = i * GOLDEN + rnd() * 0.5;
      const startY = th * (0.7 + 0.3 * (i / spec.limbs));
      const reach = R * (0.55 + 0.3 * rnd());
      const t = 0.3 + 0.35 * rnd();
      const target: V3 = [Math.sin(a) * reach, crownBase + CH * t, Math.cos(a) * reach];
      const r0 = rb * (0.5 + 0.12 * rnd());
      const pts = addLimb([0, startY, 0], target, r0, r0 * 0.3, CH * 0.16);
      anchors.push(target);
      // two forks from each limb
      for (const u of [0.5, 0.78]) {
        const at = pts[Math.round(u * (pts.length - 1))]!;
        for (const side of [-1, 1]) {
          const b = a + side * (0.55 + 0.4 * rnd());
          const len = R * (0.3 + 0.22 * rnd());
          const tip: V3 = [at.x + Math.sin(b) * len, at.y + CH * (0.07 + 0.1 * rnd()), at.z + Math.cos(b) * len];
          addLimb([at.x, at.y, at.z], tip, r0 * (1 - u * 0.5) * 0.7, r0 * 0.12, CH * 0.05);
          anchors.push(tip);
        }
      }
    }
  }
  // ---- banyan: roots hanging from the limbs ----
  for (let i = 0; i < (spec.roots ?? 0); i++) {
    const a = i * GOLDEN * 1.7;
    const reach = R * (0.45 + 0.4 * rnd());
    const x = Math.sin(a) * reach;
    const z = Math.cos(a) * reach;
    const top = crownBase + CH * (0.2 + 0.1 * rnd());
    woods.push(tube(curvePoints([[x, top, z], [x * 1.02, top * 0.55, z * 1.02], [x * 1.03, 0.04, z * 1.03]], 5), 0.045 + rnd() * 0.03, 0.025, 5, 1.6));
  }
  // ---- cone / column trees: tiers of short branches pointing out and down (pine) ----
  if (spec.shape === 'cone') {
    const tiers = 9;
    for (let i = 0; i < tiers; i++) {
      const t = i / (tiers - 1);
      const y = crownBase + CH * (0.05 + 0.88 * t);
      const reach = Math.max(0.1, profile('cone', t) * R * 0.9);
      const count = 5 + Math.round(3 * (1 - t));
      for (let k = 0; k < count; k++) {
        const a = k * (Math.PI * 2) / count + i * 0.7 + rnd() * 0.3;
        addLimb([0, y, 0], [Math.sin(a) * reach, y - reach * 0.14, Math.cos(a) * reach], rb * (0.28 - 0.18 * t), rb * 0.05, reach * 0.06);
      }
    }
  }
  const woodGeo = mergeGeometries(woods.map((x) => (x.index ? x.toNonIndexed() : x)), false);
  if (woodGeo) {
    const m = new THREE.Mesh(woodGeo, bark);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  }

  // ---- leaves ----
  const cards = new Cards();
  const total = Math.round(spec.cards * dt);
  const size = cardSize;
  const aspect = spec.aspect ?? 1;
  const vary = spec.vary ?? 0.5;
  const tmp = new THREE.Color();
  const shadeAt = (rn: number, yRel: number): THREE.Color => {
    // dark inside, bright outside and on top; a little random variation in tone and hue
    const f = (0.6 + 0.46 * Math.min(1.15, rn)) * (0.88 + 0.24 * yRel) * (0.9 + (rnd() - 0.5) * 0.2 * vary * 2);
    tmp.copy(baseColor).multiplyScalar(f);
    if (autumn) tmp.offsetHSL((rnd() - 0.5) * 0.05, 0, 0);
    else tmp.offsetHSL((rnd() - 0.5) * 0.03 * vary * 2, (rnd() - 0.5) * 0.06, 0);
    return tmp.clone();
  };
  const push = (p: V3, dir: V3, rn: number, yRel: number, sizeK = 1): void => {
    // soft crown-wide normal (outward and a little up), so the crown shades like one volume
    const ox = p[0] - crownC[0];
    const oy = p[1] - crownC[1];
    const oz = p[2] - crownC[2];
    const l = Math.hypot(ox, oy * 1.1, oz) || 1;
    const nrm: V3 = [ox / l, (oy * 1.1) / l + 0.28, oz / l];
    cards.add(p, dir, size * sizeK * (0.8 + rnd() * 0.4), aspect, rnd() * Math.PI * 2, shadeAt(rn, yRel), nrm);
  };
  const outward = (p: V3, droop: number): V3 => {
    const ox = p[0];
    const oz = p[2];
    const l = Math.hypot(ox, oz) || 1;
    return [ox / l + (rnd() - 0.5) * 0.5, 0.55 - droop + (rnd() - 0.5) * 0.4, oz / l + (rnd() - 0.5) * 0.5];
  };
  const droop = spec.kind === 'needle' ? 0.85 : 0;

  if (spec.shape === 'weeping') {
    // a dome of cards, and long strands hanging from its edge
    const dome = Math.round(total * 0.4);
    for (let i = 0; i < dome; i++) {
      const t = 0.55 + 0.4 * rnd();
      const a = rnd() * Math.PI * 2;
      const r = profile('round', t) * R * (0.4 + 0.6 * Math.sqrt(rnd()));
      const p: V3 = [Math.sin(a) * r, crownBase + CH * t, Math.cos(a) * r];
      push(p, outward(p, 0), r / R, t, 1.1);
    }
  }
  const body = spec.shape === 'weeping' ? Math.round(total * 0.2) : total;
  for (let i = 0; i < body; i++) {
    const near = anchors.length > 0 && rnd() < 0.35;
    let p: V3;
    let rn: number;
    let t: number;
    if (near) {
      // around the end of a branch
      const an = anchors[(rnd() * anchors.length) | 0]!;
      const s = size * 0.9;
      p = [an[0] + (rnd() - 0.5) * s * 2, an[1] + (rnd() - 0.3) * s * 1.6, an[2] + (rnd() - 0.5) * s * 2];
      t = Math.min(1, Math.max(0, (p[1] - crownBase) / CH));
      // keep it inside the outline
      const maxR = profile(spec.shape, t, spec.fill) * R * 1.02;
      const r = Math.hypot(p[0], p[2]);
      if (r > maxR) {
        p[0] *= maxR / r;
        p[2] *= maxR / r;
      }
      rn = r / (R || 1);
    } else {
      t = 0.02 + 0.97 * Math.pow(rnd(), spec.shape === 'cone' ? 1.25 : 0.9);
      const a = i * GOLDEN + rnd() * 0.5;
      const s = 0.45 + 0.55 * Math.sqrt(rnd());
      const r = profile(spec.shape, t, spec.fill) * R * s;
      p = [Math.sin(a) * r, crownBase + CH * t, Math.cos(a) * r];
      rn = (r / (R || 1)) * 1.05;
    }
    push(p, outward(p, droop), rn, t);
  }
  // weeping strands: chains of long cards hanging from the edge of the dome
  const strands = spec.strands ?? 0;
  for (let s = 0; s < strands; s++) {
    const a = (s / strands) * Math.PI * 2 + rnd() * 0.2;
    const r0 = R * (0.55 + 0.4 * rnd());
    const top = crownBase + CH * (0.62 + 0.18 * rnd());
    const links = 3 + Math.round(rnd() * 2);
    for (let k = 0; k < links; k++) {
      const f = k / links;
      const p: V3 = [Math.sin(a) * (r0 + f * 0.12 * R), top - f * (top - 0.35) * 0.92, Math.cos(a) * (r0 + f * 0.12 * R)];
      cards.add(p, [Math.sin(a) * 0.12, -1, Math.cos(a) * 0.12], size * 1.9, 0.42, rnd() * 0.5 - 0.25, shadeAt(0.9 - f * 0.3, 0.4 + 0.4 * (1 - f)), [Math.sin(a), 0.1, Math.cos(a)]);
    }
  }
  const leafGeo = cards.geometry();
  if (leafGeo) {
    const m = new THREE.Mesh(leafGeo, leafMaterial(spec.kind));
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  }

  // ---- fruit and flowers: small balls on the outside of the crown ----
  if (spec.dots && !(autumn && spec.dots.flowers)) {
    const d = spec.dots;
    const pieces: THREE.BufferGeometry[] = [];
    const n = Math.round(d.count * (0.5 + 0.5 * dt));
    const sz = d.size * (h / 5);
    const col = new THREE.Color(d.color);
    for (let i = 0; i < n; i++) {
      const t = 0.2 + 0.78 * rnd();
      const a = i * GOLDEN * 1.3;
      const r = profile(spec.shape, t, spec.fill) * R * (0.82 + 0.2 * rnd());
      const ico = new THREE.IcosahedronGeometry(sz * (0.8 + 0.5 * rnd()), 0);
      ico.translate(Math.sin(a) * r, crownBase + CH * t, Math.cos(a) * r);
      const colors = new Float32Array(ico.attributes.position!.count * 3);
      const c2 = col.clone().offsetHSL(0, 0, (rnd() - 0.5) * 0.12);
      for (let k = 0; k < colors.length; k += 3) {
        colors[k] = c2.r;
        colors[k + 1] = c2.g;
        colors[k + 2] = c2.b;
      }
      ico.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      ico.deleteAttribute('uv');
      pieces.push(ico.index ? ico.toNonIndexed() : ico);
    }
    const dotGeo = pieces.length ? mergeGeometries(pieces, false) : null;
    if (dotGeo) {
      const m = new THREE.Mesh(dotGeo, mat('#ffffff', 0.6, 0, { vertexColors: true }));
      m.castShadow = true;
      g.add(m);
    }
  }
  return g;
}

// ---- palm: a slim curved trunk with rings, and a crown of arching fronds ----
function buildPalm(w: number, h: number, id: string): THREE.Group {
  const g = new THREE.Group();
  const rnd = mulberry32(hashString(id));
  const dt = detail();
  const lean = w * 0.12;
  const rb = h * 0.032;
  const topY = h * 0.86;
  const path = curvePoints([[0, 0, 0], [lean * 0.4, topY * 0.35, 0], [lean * 0.9, topY * 0.7, lean * 0.1], [lean, topY, 0]], 14);
  const trunk = tube(path, rb * 1.5, rb * 0.8, 9, 0.9, 0.5);
  // rings: slightly wider bands along the trunk
  const rings: THREE.BufferGeometry[] = [trunk];
  for (let i = 1; i < 30; i++) {
    const f = i / 30;
    const p = path[Math.min(path.length - 1, Math.round(f * (path.length - 1)))]!;
    const ring = new THREE.TorusGeometry(rb * (1.46 - f * 0.68), rb * 0.1, 4, 10);
    ring.rotateX(Math.PI / 2);
    ring.translate(p.x, Math.max(p.y, rb * 0.2), p.z);
    rings.push(ring.index ? ring.toNonIndexed() : ring);
  }
  const trunkGeo = mergeGeometries(rings.map((x) => (x.index ? x.toNonIndexed() : x)), false);
  if (trunkGeo) {
    const m = new THREE.Mesh(trunkGeo, barkMaterial('#8a7358', 'plain'));
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  }
  // fronds: each is a ribbon bent along an arc, with a texture of leaflets
  const frondGeos: THREE.BufferGeometry[] = [];
  const nF = Math.round(13 * (0.6 + 0.4 * dt));
  const top = new THREE.Vector3(lean, topY, 0);
  for (let i = 0; i < nF; i++) {
    const a = i * GOLDEN + rnd() * 0.3;
    const len = (w * 0.62 + rnd() * w * 0.12) * (i % 3 === 0 ? 0.8 : 1);
    const lift = 0.9 - (i / nF) * 0.55 + (rnd() - 0.5) * 0.2; // young fronds stand up
    const seg = 7;
    const pos: number[] = [];
    const nor: number[] = [];
    const uv: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    const dx = Math.sin(a);
    const dz = Math.cos(a);
    for (let s = 0; s <= seg; s++) {
      const f = s / seg;
      const out = f * len;
      const up = Math.sin(f * Math.PI * 0.62) * len * lift * 0.55 - f * f * len * 0.5 * (1 - lift * 0.4);
      const cx = top.x + dx * out;
      const cy = top.y + 0.08 + up;
      const cz = top.z + dz * out;
      const wid = len * 0.2 * (1 - f * 0.55);
      const px = -dz * wid;
      const pz = dx * wid;
      for (const side of [-1, 1]) {
        pos.push(cx + px * side, cy, cz + pz * side);
        nor.push(0, 1, 0);
        uv.push(side < 0 ? 0 : 1, f);
        const c = new THREE.Color('#4f8a3a').multiplyScalar(1.3 * (0.8 + rnd() * 0.0 + (1 - f) * 0.15));
        col.push(c.r, c.g, c.b);
      }
      if (s < seg) {
        const k = s * 2;
        idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    fg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    fg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    fg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    fg.setIndex(idx);
    frondGeos.push(fg.toNonIndexed());
  }
  const frondGeo = mergeGeometries(frondGeos, false);
  if (frondGeo) {
    const m = new THREE.Mesh(frondGeo, leafMaterial('frond'));
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  }
  // coconuts under the crown
  const nuts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const a = i * 1.7;
    const s = new THREE.IcosahedronGeometry(h * 0.025, 1);
    s.translate(lean + Math.sin(a) * 0.14, topY - 0.06 - (i % 2) * 0.05, Math.cos(a) * 0.14);
    nuts.push(s.index ? s.toNonIndexed() : s);
  }
  const nutGeo = mergeGeometries(nuts.map((x) => { x.deleteAttribute('uv'); return x; }), false);
  if (nutGeo) {
    const m = new THREE.Mesh(nutGeo, mat('#5a7a3a', 0.8));
    m.castShadow = true;
    g.add(m);
  }
  return g;
}

/** A small tree in a pot (the olive). */
function buildPotted(spec: Species, id: string, w: number, h: number, colour: string): THREE.Group {
  const g = new THREE.Group();
  const potH = Math.min(0.45, h * 0.24);
  cyl(g, w * 0.3, w * 0.22, potH, [0, 0, 0], mat('#c9bfa0', 0.8), 20);
  cyl(g, w * 0.27, w * 0.27, 0.012, [0, potH, 0], mat('#4a3a2c', 1), 20);
  const t = buildTree({ ...spec, trunk: 0.5 }, id, w, h - potH, colour);
  t.position.y = potH;
  g.add(t);
  return g;
}

// ---------------------------------------------------------------------------------------------------------------------
// the catalog
// ---------------------------------------------------------------------------------------------------------------------

const species = (s: Species): Species => s;

const SPECIES: Record<string, Species> = {
  'tree-round': species({ kind: 'broad', shape: 'round', leaf: '#4f8a3f', bark: '#6e5a45', trunk: 0.34, crownW: 0.98, stout: 0.028, limbs: 5, cards: 621, card: 0.12 }),
  'tree-mango': species({ kind: 'broad', shape: 'round', leaf: '#3f7a3a', bark: '#5e4c3a', trunk: 0.3, crownW: 0.98, stout: 0.03, limbs: 6, cards: 648, card: 0.12, fill: 0.95, dots: { color: '#e6b32a', count: 30, size: 0.07 } }),
  'tree-neem': species({ kind: 'small', shape: 'round', leaf: '#5a8f45', bark: '#6e5a45', trunk: 0.36, crownW: 1.0, stout: 0.03, limbs: 6, cards: 702, card: 0.13 }),
  'tree-gulmohar': species({ kind: 'small', shape: 'dome', leaf: '#5a9a45', bark: '#6a5848', trunk: 0.46, crownW: 1.0, crownH: 0.8, stout: 0.028, limbs: 6, cards: 675, card: 0.13, fill: 0.9, dots: { color: '#d9381e', count: 90, size: 0.1, flowers: true } }),
  'tree-cherry': species({ kind: 'broad', shape: 'round', leaf: '#f0b4c8', bark: '#4a3a30', trunk: 0.36, crownW: 0.95, stout: 0.026, limbs: 6, cards: 567, card: 0.1, dots: { color: '#fbe3ec', count: 80, size: 0.07, flowers: true }, vary: 0.4 }),
  'tree-oak': species({ kind: 'broad', shape: 'round', leaf: '#4a7a35', bark: '#5a4a3a', trunk: 0.34, crownW: 1.0, stout: 0.036, limbs: 7, cards: 756, card: 0.11, fill: 0.9 }),
  'tree-fruit': species({ kind: 'broad', shape: 'round', leaf: '#6a9a45', bark: '#6a5848', trunk: 0.32, crownW: 0.95, stout: 0.03, limbs: 5, cards: 351, card: 0.14, dots: { color: '#d9381e', count: 26, size: 0.07 } }),
  'tree-birch': species({ kind: 'small', shape: 'column', leaf: '#8ab35a', bark: '#ece8e0', barkKind: 'birch', trunk: 0.5, crownW: 0.95, stout: 0.017, limbs: 4, cards: 405, card: 0.1, vary: 0.7 }),
  'tree-cypress': species({ kind: 'needle', shape: 'column', leaf: '#2f5d3a', bark: '#5a4a3a', trunk: 0.14, crownW: 1.0, stout: 0.02, limbs: 0, cards: 405, card: 0.085, aspect: 0.9, vary: 0.35 }),
  'tree-willow': species({ kind: 'long', shape: 'weeping', leaf: '#7aa05a', bark: '#5e4c3a', trunk: 0.4, crownW: 0.9, crownH: 0.6, stout: 0.032, limbs: 5, cards: 351, card: 0.1, strands: 56, vary: 0.5 }),
  'tree-banyan': species({ kind: 'broad', shape: 'dome', leaf: '#3f7a3f', bark: '#7a6a55', trunk: 0.46, crownW: 1.0, crownH: 0.6, stout: 0.06, limbs: 7, cards: 837, card: 0.1, fill: 0.85, roots: 9 }),
  'tree-pine': species({ kind: 'needle', shape: 'cone', leaf: '#2f6a3a', bark: '#5a4636', trunk: 0.18, crownW: 1.0, stout: 0.022, limbs: 0, cards: 513, card: 0.1, aspect: 1.1, vary: 0.4 }),
  'tree-olive': species({ kind: 'small', shape: 'round', leaf: '#8a9a6a', bark: '#6a5848', trunk: 0.4, crownW: 0.95, stout: 0.02, limbs: 4, cards: 202, card: 0.12, vary: 0.6 }),
  bush: species({ kind: 'broad', shape: 'shrub', leaf: '#4f8a3f', bark: '#5e4c3a', trunk: 0.04, crownW: 1.0, stout: 0.012, limbs: 0, cards: 148, card: 0.3, vary: 0.6 }),
  'bush-flower': species({ kind: 'broad', shape: 'shrub', leaf: '#4f8a45', bark: '#5e4c3a', trunk: 0.04, crownW: 1.0, stout: 0.012, limbs: 0, cards: 148, card: 0.3, vary: 0.6, dots: { color: '#e8789c', count: 36, size: 0.1, flowers: true } }),
  hibiscus: species({ kind: 'broad', shape: 'shrub', leaf: '#3f7a3a', bark: '#5e4c3a', trunk: 0.04, crownW: 1.0, stout: 0.012, limbs: 0, cards: 148, card: 0.3, vary: 0.5, dots: { color: '#d9381e', count: 30, size: 0.11, flowers: true } }),
};

/** Builders for every tree and shrub of the catalog. */
export const REAL_TREE_BUILDERS: Record<string, Builder> = Object.fromEntries([
  ...Object.entries(SPECIES).map(([id, spec]): [string, Builder] => [
    id,
    id === 'tree-olive' ? ({ w, h, c }) => buildPotted(spec, id, w, h, c) : ({ w, h, c }) => buildTree(spec, id, w, h, c),
  ]),
  ['tree-palm', ({ w, h }) => buildPalm(w, h, 'tree-palm')] as [string, Builder],
]);
