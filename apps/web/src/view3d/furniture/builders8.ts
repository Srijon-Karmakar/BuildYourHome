import * as THREE from 'three';
import { BUILDING_COLORS } from '@hd/assets';
import { ball, box, cyl, mat, shade, type Builder } from './kit';
import { rod } from './builders2';
import { roofShape } from './builders5';

/**
 * Neighbouring buildings and the things that make a street feel lived in: shops, a temple, a school, a tower, a farm,
 * a warehouse, people, a dog, a cow, an auto-rickshaw, a bus, a bus shelter, signs and traffic lights.
 * Local frame as always: origin on the ground at the middle of the footprint, +z = the front (the side facing the road).
 */

const AS_BUILT = BUILDING_COLORS[0]!.id;
const GLASS = () => mat('#2b3a4a', 0.2, 0.2);
const wallOf = (c: string, fallback: string) => (c && c !== AS_BUILT && c !== '#c9c4b9' ? c : fallback);

/** A row of windows along the front and back of a box, one band per floor. */
function windowRows(g: THREE.Group, w: number, d: number, floors: number, floorH: number, y0: number, cols: number, trim: string): void {
  const m = GLASS();
  const t = mat(trim, 0.6);
  for (let f = 0; f < floors; f++) {
    const y = y0 + f * floorH;
    for (let i = 0; i < cols; i++) {
      const x = -w / 2 + (w / cols) * (i + 0.5);
      box(g, [1.0, 1.25, 0.05], [x, y, d / 2 + 0.01], m);
      box(g, [1.2, 0.07, 0.1], [x, y + 1.25, d / 2 + 0.03], t);
      box(g, [1.0, 1.25, 0.05], [x, y, -d / 2 - 0.01], m);
    }
  }
}

const bungalow: Builder = ({ w, d, h, c }) => {
  const g = new THREE.Group();
  const wall = mat(wallOf(c, '#efe3c4'), 0.85);
  const bodyH = Math.min(3.3, h * 0.66);
  box(g, [w, bodyH, d], [0, 0, 0], wall);
  box(g, [w + 0.2, 0.18, d + 0.2], [0, 0, 0], mat('#8f8c85', 0.9));
  windowRows(g, w, d, 1, 0, 1.0, Math.max(2, Math.round(w / 3)), '#f1efea');
  // Porch with two pillars and a door.
  box(g, [2.8, 0.15, 1.6], [-w * 0.2, bodyH - 0.4, d / 2 + 0.8], mat('#e8e4da', 0.7));
  for (const x of [-w * 0.2 - 1.2, -w * 0.2 + 1.2]) box(g, [0.18, bodyH - 0.4, 0.18], [x, 0, d / 2 + 1.5], mat('#f1efea', 0.6));
  box(g, [1.1, 2.1, 0.06], [-w * 0.2, 0.18, d / 2 + 0.02], mat('#6b4a30', 0.6));
  roofShape(g, 'hip', w + 0.9, d + 0.9, bodyH, h - bodyH, mat('#b5593a', 0.8, 0, { side: THREE.DoubleSide }));
  cyl(g, 0.3, 0.3, 1.2, [w * 0.28, bodyH + (h - bodyH) * 0.3, -d * 0.1], mat('#a95a43', 0.9), 4); // chimney
  return g;
};

const shops: Builder = ({ w, d, h, c }) => {
  const g = new THREE.Group();
  const wall = mat(wallOf(c, '#e6d6b4'), 0.85);
  const bodyH = h - 0.5;
  box(g, [w, bodyH, d], [0, 0, 0], wall);
  box(g, [w + 0.3, 0.5, d + 0.3], [0, bodyH, 0], mat('#8f8c85', 0.9));
  const n = 3;
  const cw = w / n;
  const boards = ['#c0392b', '#2f6f8f', '#e0a43a'];
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + cw * (i + 0.5);
    box(g, [cw - 0.7, 2.5, 0.06], [x, 0, d / 2 + 0.03], mat('#8f9396', 0.5, 0.5)); // rolled shutter
    for (let k = 1; k < 8; k++) box(g, [cw - 0.7, 0.025, 0.02], [x, k * 0.31, d / 2 + 0.07], mat('#5f6366', 0.5, 0.5));
    box(g, [cw - 0.3, 0.8, 0.12], [x, 2.65, d / 2 + 0.08], mat(boards[i]!, 0.6)); // signboard
    box(g, [cw - 0.6, 0.12, 0.7], [x, 2.55, d / 2 + 0.4], mat('#2b2a28', 0.6)); // awning bar
    // upper floor: window and a small balcony
    box(g, [1.3, 1.3, 0.05], [x, 3.55, d / 2 + 0.01], GLASS());
    box(g, [cw - 0.8, 0.9, 0.06], [x, 3.4, d / 2 + 0.55], mat('#2b2a28', 0.4, 0.6));
    box(g, [cw - 0.8, 0.08, 0.7], [x, 3.25, d / 2 + 0.35], mat('#cfc9bd', 0.8));
  }
  for (let i = 1; i < n; i++) box(g, [0.14, bodyH, d + 0.04], [-w / 2 + cw * i, 0, 0], mat('#cfc9bd', 0.85));
  cyl(g, 0.7, 0.7, 1.3, [w * 0.3, bodyH + 0.5, 0], mat('#2f6f8f', 0.5), 14); // a water tank on the roof
  box(g, [w * 0.2, 0.8, 0.3], [-w * 0.3, bodyH + 0.5, d / 2 - 0.2], mat('#8f9396', 0.7));
  return g;
};

const temple: Builder = ({ w, d, h, c }) => {
  const g = new THREE.Group();
  const stone = mat(wallOf(c, '#efe0c0'), 0.85);
  const trim = mat('#c9705a', 0.7);
  box(g, [w, 0.6, d], [0, 0, 0], mat('#cfc7b4', 0.9)); // plinth
  box(g, [w * 0.72, h * 0.28, d * 0.72], [0, 0.6, 0], stone); // sanctum
  // Mandapam (porch hall) in front with pillars.
  box(g, [w * 0.6, 0.18, d * 0.26], [0, 0.6 + h * 0.2, d * 0.37], stone);
  for (const x of [-0.26, -0.09, 0.09, 0.26]) cyl(g, 0.17, 0.2, h * 0.2, [x * w, 0.6, d * 0.45], stone, 12);
  // The tower (shikhara): a stepped, tapering stack with a kalash on top.
  const steps = 7;
  for (let i = 0; i < steps; i++) {
    const k = 1 - i / (steps + 1);
    box(g, [w * 0.62 * k, h * 0.07, d * 0.62 * k], [0, 0.6 + h * 0.28 + i * h * 0.07, 0], i % 2 ? trim : stone);
  }
  ball(g, [0.45, 0.6, 0.45], [0, 0.6 + h * 0.28 + steps * h * 0.07 + 0.25, 0], mat('#e0a43a', 0.4, 0.6));
  cyl(g, 0.03, 0.03, 1.2, [0, 0.6 + h * 0.28 + steps * h * 0.07 + 0.7, 0], mat('#8f8c85', 0.5, 0.6), 6);
  box(g, [0.6, 0.35, 0.02], [0.3, 0.6 + h * 0.28 + steps * h * 0.07 + 1.6, 0], mat('#e0551a', 0.7)); // flag
  box(g, [0.9, 1.9, 0.06], [0, 0.6, d * 0.36 - 0.02], mat('#6b4a30', 0.6)); // door
  for (const x of [-0.18, 0.18]) box(g, [0.08, 0.5, 0.08], [x * w, 0.6 + 0.15, d * 0.5 + 0.05], mat('#e0a43a', 0.4, 0.6)); // lamps
  return g;
};

const school: Builder = ({ w, d, h, c }) => {
  const g = new THREE.Group();
  const wall = mat(wallOf(c, '#f0e4bd'), 0.85);
  const floors = 2;
  const floorH = (h - 0.4) / floors;
  box(g, [w, h - 0.4, d], [0, 0, 0], wall);
  box(g, [w + 0.3, 0.4, d + 0.3], [0, h - 0.4, 0], mat('#b9573a', 0.8));
  box(g, [w + 0.1, 0.12, d + 0.1], [0, floorH, 0], mat('#f1efea', 0.6));
  windowRows(g, w, d, floors, floorH, 0.95, Math.max(4, Math.round(w / 2.2)), '#f1efea');
  // Entrance block, a canopy and the flagpole.
  box(g, [4.2, h + 0.6, 1.4], [0, 0, d / 2 + 0.5], mat(wallOf(c, '#e8d6a6'), 0.85));
  box(g, [3.2, 2.4, 0.08], [0, 0, d / 2 + 1.2], GLASS());
  box(g, [4.6, 0.2, 2.0], [0, 2.7, d / 2 + 1.1], mat('#b9573a', 0.8));
  cyl(g, 0.05, 0.06, 7.5, [w * 0.32, 0, d / 2 + 2.2], mat('#c9cbcd', 0.3, 0.8), 8);
  box(g, [1.2, 0.8, 0.03], [w * 0.32 + 0.65, 6.6, d / 2 + 2.2], mat('#e07a1a', 0.7));
  box(g, [4.0, 0.7, 0.05], [0, h - 1.4, d / 2 + 1.22], mat('#2f6f8f', 0.6)); // name board
  return g;
};

const tower: Builder = ({ w, d, h, c }) => {
  const g = new THREE.Group();
  const wall = mat(wallOf(c, '#bcc3c9'), 0.4, 0.2);
  box(g, [w, h, d], [0, 0, 0], wall);
  box(g, [w * 1.04, 3.5, d * 1.04], [0, 0, 0], mat('#8f979d', 0.6)); // podium
  const glass = mat('#2d4256', 0.1, 0.5);
  const floors = Math.floor((h - 8) / 3.2);
  for (let f = 0; f < floors; f++) {
    // a ribbon of glass round each floor
    box(g, [w + 0.06, 1.7, d + 0.06], [0, 4.5 + f * 3.2, 0], glass);
  }
  box(g, [w * 0.7, 3, d * 0.7], [0, h, 0], mat('#8f979d', 0.6)); // plant room
  rod(g, [0, h + 3, 0], [0, h + 9, 0], 0.08, mat('#c9cbcd', 0.3, 0.8)); // mast
  ball(g, [0.2, 0.2, 0.2], [0, h + 9, 0], mat('#d9381e', 0.4, 0, { emissive: new THREE.Color('#ff3b1e'), emissiveIntensity: 0.9 })); // aircraft light
  return g;
};

const farm: Builder = ({ w, d, h, c }) => {
  const g = new THREE.Group();
  const wall = mat(wallOf(c, '#e6d6b4'), 0.9);
  const hw = w * 0.52;
  const bodyH = 3.1;
  box(g, [hw, bodyH, d * 0.8], [-w * 0.24, 0, d * 0.1], wall);
  roofShape(g, 'gable', hw + 0.8, d * 0.8 + 0.8, bodyH, 1.9, mat('#a94d35', 0.85, 0, { side: THREE.DoubleSide }));
  g.children[g.children.length - 1]!.position.set(-w * 0.24, 0, d * 0.1);
  box(g, [1.0, 2.0, 0.06], [-w * 0.24, 0, d * 0.5 + 0.02], mat('#6b4a30', 0.6));
  for (const x of [-0.5, 0.5]) box(g, [0.8, 0.9, 0.05], [-w * 0.24 + x * hw * 0.7, 1.1, d * 0.5 + 0.02], GLASS());
  // The barn: taller, with a wide door and a loft hatch.
  const bw = w * 0.4;
  box(g, [bw, 4.4, d * 0.7], [w * 0.28, 0, -d * 0.05], mat('#a64d3a', 0.9));
  roofShape(g, 'gable', bw + 0.8, d * 0.7 + 0.8, 4.4, h - 4.4, mat('#6d6f73', 0.7, 0.3, { side: THREE.DoubleSide }));
  g.children[g.children.length - 1]!.position.set(w * 0.28, 0, -d * 0.05);
  box(g, [2.4, 2.8, 0.06], [w * 0.28, 0, d * 0.3 + 0.02], mat('#f1efea', 0.7));
  box(g, [1.0, 1.0, 0.06], [w * 0.28, 3.4, d * 0.3 + 0.02], mat('#f1efea', 0.7));
  ball(g, [1.1, 0.9, 1.1], [w * 0.05, 0.9, d * 0.42], mat('#d4b25a', 1)); // a haystack
  cyl(g, 0.8, 0.8, 1.7, [-w * 0.4, 3.1, -d * 0.2], mat('#2f6f8f', 0.5), 14); // water tank
  return g;
};

const warehouse: Builder = ({ w, d, h, c }) => {
  const g = new THREE.Group();
  const wall = mat(wallOf(c, '#b9bcbf'), 0.6, 0.25);
  const bodyH = h - 1.4;
  box(g, [w, bodyH, d], [0, 0, 0], wall);
  roofShape(g, 'gable', w + 0.4, d + 0.4, bodyH, 1.4, mat('#8f949a', 0.5, 0.5, { side: THREE.DoubleSide }));
  for (let i = 0; i < 3; i++) {
    const x = -w * 0.3 + i * w * 0.3;
    box(g, [3.2, 3.6, 0.1], [x, 0, d / 2 + 0.02], mat(i === 1 ? '#c0392b' : '#8f969c', 0.5, 0.4)); // rolling doors
    for (let k = 1; k < 9; k++) box(g, [3.2, 0.03, 0.03], [x, k * 0.4, d / 2 + 0.08], mat('#5f6366', 0.5, 0.5));
  }
  box(g, [w, 0.15, 2.2], [0, 1.1, d / 2 + 1.1], mat('#9a9890', 0.9)); // loading dock
  for (let i = 0; i < 5; i++) box(g, [1.8, 0.7, 0.05], [-w / 2 + (w / 5) * (i + 0.5), bodyH - 1.2, d / 2 + 0.01], GLASS());
  box(g, [w * 0.35, 1.1, 0.12], [0, bodyH - 0.6, d / 2 + 0.1], mat('#2f6f8f', 0.6)); // name board
  return g;
};

// ---- the street ---------------------------------------------------------------------------------------------------

const SKIN = ['#e0b08a', '#c68d63', '#a8704a', '#8a5a3c'];

/** Shirt colour from the item's colour; skin and hair vary with it so a crowd is not all one person. */
function person(walking: boolean): Builder {
  return ({ h, c }) => {
    const g = new THREE.Group();
    const tint = c && c !== '#c9c4b9' ? c : '#3f5f86';
    const n = parseInt(tint.slice(1), 16) % SKIN.length;
    const skin = mat(SKIN[n]!, 0.8);
    const shirt = mat(tint, 0.85);
    const trousers = mat(shade(tint, -0.25), 0.9);
    const sc = h / 1.7;
    const leg = (x: number, swing: number) => {
      const l = cyl(g, 0.06 * sc, 0.075 * sc, 0.85 * sc, [x * sc, 0, swing * sc], trousers, 8);
      l.rotation.x = swing * 0.9;
      l.position.y += 0.012; // the tilt would dip the foot below the ground
    };
    leg(-0.09, walking ? 0.18 : 0);
    leg(0.09, walking ? -0.18 : 0);
    cyl(g, 0.17 * sc, 0.2 * sc, 0.62 * sc, [0, 0.85 * sc, 0], shirt, 12); // torso
    ball(g, [0.095 * sc, 0.115 * sc, 0.095 * sc], [0, 1.58 * sc, 0], skin);
    ball(g, [0.1 * sc, 0.08 * sc, 0.105 * sc], [0, 1.64 * sc, -0.015 * sc], mat('#2b2a28', 0.9)); // hair
    for (const sgn of [-1, 1]) {
      const arm = cyl(g, 0.045 * sc, 0.05 * sc, 0.6 * sc, [sgn * 0.23 * sc, 0.88 * sc, 0], shirt, 8);
      arm.rotation.x = walking ? sgn * 0.5 : 0;
    }
    return g;
  };
}

const dog: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  const fur = mat('#b98a5b', 0.95);
  box(g, [w * 0.7, h * 0.4, d * 0.5], [0, h * 0.38, 0], fur); // body
  box(g, [w * 0.55, h * 0.34, d * 0.22], [0, h * 0.6, d * 0.38], fur); // head, at the front (+z)
  box(g, [w * 0.3, h * 0.14, d * 0.12], [0, h * 0.62, d * 0.52], mat('#2b2a28', 0.8)); // nose
  for (const x of [-0.25, 0.25]) for (const z of [-0.3, 0.3]) box(g, [w * 0.18, h * 0.4, w * 0.18], [x * w * 1.1, 0, z * d], fur);
  rod(g, [0, h * 0.55, -d * 0.25], [0, h * 0.85, -d * 0.5], 0.02, fur); // tail
  return g;
};

const cow: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  const hide = mat('#f1efea', 0.9);
  const patch = mat('#6b4a30', 0.9);
  box(g, [w * 0.85, h * 0.45, d * 0.55], [0, h * 0.38, -0.05 * d], hide); // body
  box(g, [w * 0.4, h * 0.2, d * 0.2], [-w * 0.15, h * 0.62, -0.05 * d + d * 0.02], patch);
  box(g, [w * 0.55, h * 0.35, d * 0.22], [0, h * 0.62, d * 0.4], hide); // head, at the front (+z)
  box(g, [w * 0.32, h * 0.18, d * 0.12], [0, h * 0.58, d * 0.55], mat('#e0b8a8', 0.8)); // muzzle
  for (const x of [-0.3, 0.3]) {
    rod(g, [x * w * 0.5, h * 0.9, d * 0.38], [x * w * 0.8, h * 1.0, d * 0.4], 0.02, mat('#e8dcc0', 0.6)); // horns
    for (const z of [-0.28, 0.28]) box(g, [w * 0.18, h * 0.4, w * 0.18], [x * w * 1.1, 0, z * d], hide);
  }
  rod(g, [0, h * 0.7, -d * 0.3], [0, h * 0.3, -d * 0.5], 0.025, hide); // tail
  return g;
};

const autoRickshaw: Builder = ({ w, d, h, c }) => {
  const g = new THREE.Group();
  const body = mat(c, 0.5);
  const black = mat('#2b2a28', 0.6);
  box(g, [w * 0.85, h * 0.35, d * 0.7], [0, h * 0.2, -d * 0.1], body); // cabin body
  box(g, [w * 0.9, 0.08, d * 0.72], [0, h * 0.92, -d * 0.1], black); // roof
  for (const x of [-0.42, 0.42]) box(g, [0.05, h * 0.5, 0.05], [x * w, h * 0.4, d * 0.2], black);
  box(g, [w * 0.7, h * 0.3, 0.05], [0, h * 0.5, d * 0.35], mat('#bcd4e6', 0.1, 0, { transparent: true, opacity: 0.4 })); // windscreen
  box(g, [w * 0.7, h * 0.22, d * 0.3], [0, h * 0.25, -d * 0.3], black); // seat
  box(g, [w * 0.35, h * 0.3, d * 0.28], [0, h * 0.15, d * 0.4], body); // front
  for (const [x, z] of [[-0.4, -0.38], [0.4, -0.38], [0, 0.45]] as Array<[number, number]>) {
    const wheel = cyl(g, 0.22, 0.22, 0.12, [x * w, 0, z * d], black, 14);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.y += 0.22;
  }
  return g;
};

const bus: Builder = ({ w, d, h, c }) => {
  const g = new THREE.Group();
  const body = mat(c, 0.45);
  const glass = mat('#2b3a4a', 0.15, 0.2);
  box(g, [w, h * 0.72, d], [0, h * 0.2, 0], body);
  box(g, [w + 0.02, h * 0.3, d * 0.92], [0, h * 0.5, 0], glass); // window band
  box(g, [w, h * 0.06, d], [0, h * 0.92, 0], mat('#f1efea', 0.6)); // roof
  box(g, [w * 0.7, h * 0.2, 0.05], [0, h * 0.55, d / 2 + 0.02], glass); // windscreen, at the front (+z)
  box(g, [w * 0.7, h * 0.12, 0.1], [0, h * 0.85, d / 2 + 0.02], mat('#e0b81a', 0.6, 0, { emissive: new THREE.Color('#e0b81a'), emissiveIntensity: 0.4 })); // destination board
  for (const z of [-0.33, 0.3]) for (const x of [-0.5, 0.5]) {
    const wheel = cyl(g, 0.5, 0.5, 0.3, [x * w, 0, z * d], mat('#1f1f1f', 0.9), 16);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.y += 0.5;
  }
  return g;
};

const busShelter: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  const metal = mat('#4a4c4e', 0.5, 0.6);
  box(g, [w, 0.1, d], [0, h - 0.1, 0], metal);
  for (const x of [-0.46, 0.46]) box(g, [0.08, h - 0.1, 0.08], [x * w, 0, -d * 0.4], metal);
  box(g, [w * 0.94, h - 0.5, 0.04], [0, 0.3, -d * 0.45], mat('#bcd4e6', 0.1, 0, { transparent: true, opacity: 0.35 }));
  box(g, [w * 0.8, 0.06, 0.4], [0, 0.45, -d * 0.2], mat('#8a5a3c', 0.7)); // bench
  box(g, [w * 0.6, 0.5, 0.05], [0, h - 0.7, -d * 0.44], mat('#2f6f8f', 0.6)); // route board
  return g;
};

const signboard: Builder = ({ w, d, h, c }) => {
  const g = new THREE.Group();
  const post = mat('#8f9396', 0.4, 0.6);
  cyl(g, 0.04, 0.05, h * 0.95, [0, 0, 0], post, 8);
  box(g, [w, h * 0.3, d], [0, h * 0.68, 0], mat(c && c !== '#c9c4b9' ? c : '#2f6f8f', 0.6));
  box(g, [w * 0.8, 0.04, d + 0.01], [0, h * 0.78, 0.0], mat('#f1efea', 0.6));
  box(g, [w * 0.6, 0.04, d + 0.01], [0, h * 0.7, 0.0], mat('#f1efea', 0.6));
  return g;
};

const trafficLight: Builder = ({ h }) => {
  const g = new THREE.Group();
  const post = mat('#3b3d40', 0.5, 0.5);
  cyl(g, 0.07, 0.09, h * 0.9, [0, 0, 0], post, 10);
  box(g, [0.28, 0.8, 0.22], [0, h * 0.78, 0.1], mat('#1f2022', 0.6));
  const lamp = (y: number, col: string, on: boolean) => ball(g, [0.075, 0.075, 0.075], [0, y, 0.22], on ? mat(col, 0.4, 0, { emissive: new THREE.Color(col), emissiveIntensity: 0.9 }) : mat(shade(col, -0.3), 0.8));
  lamp(h * 0.78 + 0.26, '#e0301e', true);
  lamp(h * 0.78, '#e0a020', false);
  lamp(h * 0.78 - 0.26, '#30b050', false);
  return g;
};

const billboard: Builder = ({ w, d, h, c }) => {
  const g = new THREE.Group();
  const post = mat('#6c7378', 0.5, 0.6);
  for (const x of [-0.3, 0.3]) cyl(g, 0.12, 0.14, h * 0.62, [x * w, 0, 0], post, 10);
  box(g, [w, h * 0.45, d], [0, h * 0.55, 0], mat('#2b2a28', 0.6));
  box(g, [w * 0.94, h * 0.4, d + 0.02], [0, h * 0.575, 0.0], mat(c && c !== '#c9c4b9' ? c : '#e0a43a', 0.5));
  box(g, [w * 0.5, h * 0.12, d + 0.04], [-w * 0.15, h * 0.7, 0], mat('#f1efea', 0.6));
  return g;
};

export const BUILDERS8: Record<string, Builder> = {
  'neighbour-bungalow': bungalow,
  'neighbour-shops': shops,
  'neighbour-temple': temple,
  'neighbour-school': school,
  'neighbour-tower': tower,
  'neighbour-farm': farm,
  'neighbour-warehouse': warehouse,
  'person-standing': person(false),
  'person-walking': person(true),
  dog,
  cow,
  'auto-rickshaw': autoRickshaw,
  bus,
  'bus-shelter': busShelter,
  signboard,
  'traffic-light': trafficLight,
  billboard,
};
