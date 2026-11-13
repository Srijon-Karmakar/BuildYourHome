import * as THREE from 'three';
import { BLACK, box, cyl, mat, shade, type Builder } from './kit';
import { BUILDERS2 } from './builders2';

/**
 * LED screens (the housing and how it is held up; the lit picture is drawn on top by ScreenFace) and outdoor AC
 * units. Conventions as the other builders: floor items stand on y = 0 centred on the footprint, wall items are
 * centred on y = 0 with the back on z = 0 sticking out along +z, ceiling items hang below y = 0. Front = +z.
 */

// ------------------------------------------------------------------------------------------------ LED screens

/** The picture area the catalog thumbnails show (ScreenFace covers it in the 3D view). */
const PREVIEW = () => mat('#1f4f8f', 0.2, 0, { emissive: new THREE.Color('#3f7fd8'), emissiveIntensity: 0.6 });

/** A flat panel: `w` x `h`, its front at z = zFront, `depth` deep, centred at height y. */
function panel(g: THREE.Group, w: number, h: number, depth: number, y: number, zFront: number, c: string) {
  box(g, [w, h, depth], [0, y - h / 2, zFront - depth / 2], mat(c, 0.45, 0.2));
  box(g, [w * 0.98, h * 0.96, 0.004], [0, y - h * 0.48, zFront], PREVIEW());
}

const ledWall: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  panel(g, w, h, d, 0, d, c);
  return g;
};

const ledStand: Builder = ({ a, c, w, d }) => {
  const g = new THREE.Group();
  const f = a.screen!;
  const metal = mat('#2a2b2e', 0.4, 0.6);
  panel(g, f.w, f.h, 0.05, f.y, f.z, c);
  // two legs on a wheeled base
  for (const x of [-f.w * 0.3, f.w * 0.3]) {
    box(g, [0.05, f.y + f.h / 2 - 0.2, 0.04], [x, 0.08, -0.03], metal);
    box(g, [0.08, 0.04, d], [x, 0.04, 0], metal);
    for (const z of [-d / 2 + 0.04, d / 2 - 0.04]) cyl(g, 0.03, 0.03, 0.04, [x, 0, z], BLACK(), 12);
  }
  box(g, [w * 0.62, 0.04, 0.04], [0, 0.45, -0.03], metal);
  return g;
};

const ledHanging: Builder = ({ a, c }) => {
  const g = new THREE.Group();
  const f = a.screen!;
  const top = f.y + f.h / 2;
  panel(g, f.w, f.h, 0.06, f.y, f.z, c);
  for (const x of [-f.w * 0.35, f.w * 0.35]) {
    cyl(g, 0.008, 0.008, -top, [x, top, -0.01], mat('#9a9c9f', 0.3, 0.8), 8);
    cyl(g, 0.04, 0.04, 0.012, [x, -0.012, -0.01], mat('#9a9c9f', 0.3, 0.8), 16);
  }
  return g;
};

const ledTotem: Builder = ({ a, c, w, d, h }) => {
  const g = new THREE.Group();
  const f = a.screen!;
  box(g, [w, h, d * 0.86], [0, 0, f.z - (d * 0.86) / 2], mat(c, 0.45, 0.2));
  box(g, [w * 1.06, 0.06, d], [0, 0, 0], mat(shade(c, -0.08), 0.5, 0.3));
  box(g, [f.w, f.h, 0.004], [0, f.y - f.h / 2, f.z], PREVIEW());
  return g;
};

const ledBillboard: Builder = ({ a, c, d }) => {
  const g = new THREE.Group();
  const f = a.screen!;
  const steel = mat('#6f7378', 0.45, 0.6);
  const bottom = f.y - f.h / 2;
  panel(g, f.w, f.h, 0.3, f.y, f.z, c);
  cyl(g, 0.22, 0.26, bottom + 0.2, [0, 0, -0.1], steel, 20);
  box(g, [0.9, 0.18, d], [0, 0, -0.05], mat('#a8a49c', 0.9)); // footing
  box(g, [f.w * 0.9, 0.08, 0.6], [0, bottom - 0.12, -0.2], steel); // service walkway
  return g;
};

// ------------------------------------------------------------------------------------------------ AC units

/** Wall items are centred on their mount height: shift everything so the model's own middle is at y = 0. */
function centreVertically(g: THREE.Group): THREE.Group {
  const box = new THREE.Box3().setFromObject(g);
  const dy = -(box.min.y + box.max.y) / 2;
  for (const child of g.children) child.position.y += dy;
  return g;
}

/** The fan grille on the front of a condenser: a dark disc with a ring of bars and a hub. */
function fanGrille(g: THREE.Group, r: number, [x, y, z]: [number, number, number], casing: THREE.Material) {
  const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 32), mat('#1e1f21', 0.8));
  disc.position.set(x, y, z + 0.002);
  g.add(disc);
  for (let i = 1; i <= 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry((r * i) / 3.3, 0.005, 6, 36), casing);
    ring.position.set(x, y, z + 0.006);
    g.add(ring);
  }
  for (let i = 0; i < 4; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(r * 2, 0.008, 0.006), casing);
    bar.position.set(x, y, z + 0.008);
    bar.rotation.z = (i * Math.PI) / 4;
    g.add(bar);
  }
  const hub = new THREE.Mesh(new THREE.CircleGeometry(r * 0.16, 20), casing);
  hub.position.set(x, y, z + 0.01);
  g.add(hub);
}

/** Condenser body: casing, fan grille on the left two thirds, coil louvres on the right and a pipe cover. */
function condenser(g: THREE.Group, c: string, w: number, h: number, d: number, y0: number, z0: number, fans = 1) {
  const casing = mat(c, 0.45, 0.15);
  box(g, [w, h, d], [0, y0, z0 + d / 2], casing);
  const front = z0 + d;
  const r = Math.min(h / (fans * 2.3), w * 0.3);
  for (let i = 0; i < fans; i++) fanGrille(g, r, [-w * 0.14, y0 + (h * (i + 0.5)) / fans, front], casing);
  // coil louvres on the side panel
  const louvre = mat(shade(c, -0.18), 0.6);
  for (let i = 0; i < 7; i++) box(g, [w * 0.2, 0.01, 0.004], [w * 0.33, y0 + h * 0.15 + (i * h * 0.7) / 7, front + 0.001], louvre);
  // service valves and the copper pipes heading into the wall
  box(g, [0.1, h * 0.25, 0.05], [w / 2 + 0.03, y0 + h * 0.08, z0 + d * 0.3], mat(shade(c, -0.05), 0.5));
  const copper = mat('#b87333', 0.35, 0.8);
  for (const k of [0, 1]) cyl(g, 0.009, 0.009, 0.3, [w / 2 + 0.03 + k * 0.025, y0 + h * 0.33, z0 + d * 0.3], copper, 8);
}

const acOutdoor: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const steel = mat('#5d6064', 0.5, 0.6);
  const depth = d * 0.75;
  condenser(g, c, w, h, depth, -h / 2, d - depth, 1);
  // L-brackets fixed to the wall under the unit
  for (const x of [-w * 0.35, w * 0.35]) {
    box(g, [0.04, 0.04, d], [x, -h / 2 - 0.04, d / 2], steel);
    box(g, [0.04, h * 0.55, 0.04], [x, -h / 2 - h * 0.55, 0.02], steel);
    const rise = h * 0.48;
    const run = d * 0.88;
    const brace = box(g, [0.03, 0.03, Math.hypot(rise, run)], [x, -h / 2 - h * 0.26 - 0.015, d * 0.46], steel);
    brace.rotation.x = -Math.atan2(rise, run);
  }
  return centreVertically(g);
};

const acGround: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const conc = mat('#b4b0a8', 0.9);
  for (const x of [-w * 0.32, w * 0.32]) box(g, [0.12, 0.08, d], [x, 0, 0], conc);
  condenser(g, c, w, h - 0.08, d * 0.9, 0.08, -d / 2, 1);
  return g;
};

const acTwin: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const conc = mat('#b4b0a8', 0.9);
  box(g, [w * 1.05, 0.08, d], [0, 0, 0], conc);
  condenser(g, c, w, h - 0.08, d * 0.9, 0.08, -d / 2, 2);
  return g;
};

const acRooftop: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const casing = mat(c, 0.45, 0.15);
  const steel = mat('#6f7378', 0.5, 0.6);
  // steel frame on rubber feet, coil walls round the sides, two fans blowing up through the top
  for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) box(g, [0.08, 0.1, d], [x, 0, 0], steel);
  box(g, [w, h - 0.12, d], [0, 0.1, 0], casing);
  const coil = mat(shade(c, -0.2), 0.7);
  for (let i = 0; i < 9; i++) box(g, [w * 0.86, 0.012, 0.004], [0, 0.18 + (i * (h - 0.35)) / 9, d / 2 + 0.001], coil);
  for (const x of [-w / 4, w / 4]) {
    const r = Math.min(w / 4, d / 2) * 0.82;
    cyl(g, r, r, 0.06, [x, h - 0.04, 0], casing, 32);
    const top = new THREE.Mesh(new THREE.CircleGeometry(r * 0.92, 32), mat('#1e1f21', 0.8));
    top.rotation.x = -Math.PI / 2;
    top.position.set(x, h + 0.022, 0);
    g.add(top);
    for (let i = 0; i < 4; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(r * 1.9, 0.008, 0.01), casing);
      bar.position.set(x, h + 0.026, 0);
      bar.rotation.y = (i * Math.PI) / 4;
      g.add(bar);
    }
  }
  return g;
};

const acWindow: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const casing = mat(c, 0.45, 0.15);
  // the indoor face sits flush with the wall's other side; the boxy body sticks out (+z) with louvres on its sides
  box(g, [w, h, d], [0, -h / 2, d / 2], casing);
  const grille = mat(shade(c, -0.12), 0.6);
  for (let i = 0; i < 6; i++) box(g, [w * 0.85, 0.012, 0.004], [0, -h * 0.4 + (i * h * 0.75) / 6, d + 0.001], grille);
  for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) box(g, [0.004, h * 0.7, 0.02], [sx * (w / 2 + 0.001), -h * 0.35, d * 0.25 + i * d * 0.13], grille);
  box(g, [w + 0.04, 0.03, d * 0.5], [0, -h / 2 - 0.03, d * 0.5], mat('#5d6064', 0.5, 0.6)); // support tray
  return g;
};

// ------------------------------------------------------------------------------------------------ blinds
// (the placed ones are rebuilt for their size and how far they are raised by CurtainFace; these are the catalog thumbnails)

const blindRoman: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const cloth = mat(c, 0.95);
  box(g, [w + 0.02, 0.05, d], [0, h / 2 - 0.05, d / 2], mat(shade(c, -0.12), 0.9));
  box(g, [w, h - 0.05, 0.02], [0, -h / 2, d * 0.35], cloth);
  for (let i = 1; i < 6; i++) box(g, [w, 0.012, 0.035], [0, h / 2 - 0.05 - (i * (h - 0.06)) / 6 - 0.012, d * 0.35], mat(shade(c, -0.07), 0.95));
  return g;
};

const blindVenetian: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const slat = mat(c, 0.5, 0.15);
  box(g, [w + 0.02, 0.04, d], [0, h / 2 - 0.04, d / 2], mat(shade(c, -0.1), 0.5, 0.2));
  const n = 24;
  for (let i = 0; i < n; i++) {
    const s = box(g, [w - 0.02, 0.008, 0.035], [0, h / 2 - 0.06 - (i * (h - 0.1)) / n - 0.01, d / 2], slat);
    s.rotation.x = -0.75;
  }
  box(g, [w - 0.02, 0.014, 0.03], [0, -h / 2, d / 2], mat(shade(c, -0.15), 0.5, 0.2));
  return g;
};

// ------------------------------------------------------------------------------------------------ wall features
// (placed ones are rebuilt for their size, finish and bend by FeatureFace; these are the catalog thumbnails)

const featureSlab: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, h, d], [0, 0, 0], mat('#d9d4c8', 0.85));
  box(g, [w + 0.06, 0.05, d + 0.06], [0, h, 0], mat('#c9c4b9', 0.8));
  return g;
};

export const BUILDERS9: Record<string, Builder> = {
  'feature-wall': featureSlab,
  'feature-curved': featureSlab,
  'feature-box': featureSlab,
  'feature-extended': featureSlab,
  'curtain-sheer': BUILDERS2.curtain!,
  'blind-roman': blindRoman,
  'blind-venetian': blindVenetian,
  'led-screen': ledWall,
  'led-video-wall': ledWall,
  'led-curved': ledWall,
  'led-facade': ledWall,
  'led-ticker': ledWall,
  'led-stand': ledStand,
  'led-hanging': ledHanging,
  'led-totem': ledTotem,
  'led-billboard': ledBillboard,
  'ac-outdoor': acOutdoor,
  'ac-outdoor-ground': acGround,
  'ac-outdoor-twin': acTwin,
  'ac-rooftop': acRooftop,
  'ac-window': acWindow,
};
