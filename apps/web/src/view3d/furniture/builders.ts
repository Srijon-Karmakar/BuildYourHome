import * as THREE from 'three';
import { getAsset, type Asset } from '@hd/assets';

/**
 * Procedural placeholder models for every catalog item (ADR-013). Local frame: origin at the centre of the
 * floor footprint, +x width, +z front, +y up (ceiling items hang down from y = 0; wall items extend from their
 * back face at z = 0 outward, centred vertically on y = 0).
 * Templates are built once per (asset, colour) and cloned per placed item — clones share geometry and materials.
 */

import { BUILDERS2 } from './builders2';
import { BUILDERS3 } from './builders3';
import { BUILDERS4 } from './builders4';
import { BUILDERS5 } from './builders5';
import { BUILDERS6 } from './builders6';
import { BUILDERS8 } from './builders8';
import { BUILDERS9 } from './builders9';
import { TREE_BUILDERS } from './trees';
import { REAL_TREE_BUILDERS } from './realTrees';
import { ball, BLACK, box, CHROME, cyl, GLASS, GLOW, legs, mat, mergeByMaterial, shade, WHITE, type Builder } from './kit';

function sofa(seats: number): Builder {
  return ({ c, w, d }) => {
    const g = new THREE.Group();
    const fabric = mat(c, 0.9);
    const cushion = mat(shade(c, 0.03), 0.9);
    const wood = mat('#3b2f27', 0.6);
    const arm = 0.18;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, [0.05, 0.1, 0.05], [sx * (w / 2 - 0.1), 0, sz * (d / 2 - 0.1)], wood);
    box(g, [w, 0.2, d], [0, 0.1, 0], fabric); // base
    box(g, [w, 0.5, 0.22], [0, 0.3, -d / 2 + 0.11], fabric); // back
    for (const sx of [-1, 1]) box(g, [arm, 0.3, d], [sx * (w / 2 - arm / 2), 0.3, 0], fabric);
    const cw = (w - 2 * arm) / seats;
    for (let i = 0; i < seats; i++) {
      const x = -((w - 2 * arm) / 2) + cw * (i + 0.5);
      box(g, [cw - 0.02, 0.14, d - 0.3], [x, 0.3, 0.1], cushion);
      box(g, [cw - 0.04, 0.34, 0.14], [x, 0.44, -d / 2 + 0.3], cushion).rotation.x = -0.12;
    }
    return g;
  };
}

const coffeeTable: Builder = ({ c, w, d }) => {
  const g = new THREE.Group();
  const wood = mat(c, 0.5);
  box(g, [w, 0.04, d], [0, 0.34, 0], wood);
  box(g, [w - 0.1, 0.03, d - 0.1], [0, 0.18, 0], wood); // lower shelf
  legs(g, w, d, 0.34, 0.04, mat(shade(c, -0.1), 0.5), 0.03);
  return g;
};

const roundTable =
  (topY: number, rScale = 0.5): Builder =>
  ({ c, w }) => {
    const g = new THREE.Group();
    const wood = mat(c, 0.5);
    cyl(g, w * rScale, w * rScale, 0.04, [0, topY - 0.04, 0], wood);
    cyl(g, 0.03, 0.03, topY - 0.04, [0, 0, 0], mat(shade(c, -0.1), 0.5));
    cyl(g, w * 0.3, w * 0.3, 0.025, [0, 0, 0], mat(shade(c, -0.1), 0.5));
    return g;
  };

const tvUnit: Builder = ({ c, w, d }) => {
  const g = new THREE.Group();
  const wood = mat(c, 0.5);
  box(g, [w, 0.4, d], [0, 0.1, 0], wood);
  legs(g, w, d, 0.1, 0.04, BLACK(), 0.05);
  for (const sx of [-0.5, 0.5]) box(g, [w / 2 - 0.04, 0.34, 0.012], [sx * (w / 2 - 0.02), 0.13, d / 2 + 0.004], mat(shade(c, -0.05), 0.5));
  box(g, [w * 0.62, 0.38, 0.03], [0, 0.65, 0], BLACK()); // TV
  box(g, [w * 0.6, 0.36, 0.005], [0, 0.66, 0.017], mat('#16181c', 0.2, 0.3));
  box(g, [0.25, 0.1, 0.03], [0, 0.5, 0], BLACK());
  return g;
};

const bookshelf: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const wood = mat(c, 0.55);
  box(g, [w, h, 0.02], [0, 0, -d / 2 + 0.01], mat(shade(c, -0.08), 0.6));
  for (const sx of [-1, 1]) box(g, [0.03, h, d], [sx * (w / 2 - 0.015), 0, 0], wood);
  const shelves = 6;
  const colors = ['#b5604a', '#4d6783', '#8f9f86', '#c9b79c', '#7a5238', '#3b3a38'];
  for (let i = 0; i <= shelves; i++) {
    const y = (i / shelves) * (h - 0.03);
    box(g, [w - 0.06, 0.03, d], [0, y, 0], wood);
    if (i > 0 && i < shelves && i % 2 === 1) {
      let x = -w / 2 + 0.07;
      let k = i;
      while (x < w / 2 - 0.12) {
        const bw = 0.025 + ((k * 7) % 4) * 0.01;
        const bh = 0.22 + ((k * 5) % 5) * 0.015;
        box(g, [bw, bh, d - 0.12], [x + bw / 2, y + 0.03, 0.02], mat(colors[k % colors.length]!, 0.8));
        x += bw + 0.004;
        k++;
      }
    }
  }
  return g;
};

const rug: Builder = ({ c, w, d }) => {
  const g = new THREE.Group();
  box(g, [w, 0.012, d], [0, 0, 0], mat(c, 1));
  box(g, [w - 0.2, 0.006, d - 0.2], [0, 0.012, 0], mat(shade(c, 0.1), 1));
  return g;
};

const bed =
  (pillows: number): Builder =>
  ({ c, w, d, h }) => {
    const g = new THREE.Group();
    const frame = mat('#7a5238', 0.55);
    const sheet = mat('#efece6', 0.9);
    const cover = mat(c, 0.9);
    box(g, [w, 0.22, d], [0, 0.12, 0], frame);
    legs(g, w, d, 0.12, 0.06, frame, 0);
    box(g, [w - 0.06, 0.2, d - 0.14], [0, 0.34, 0.04], sheet); // mattress
    box(g, [w - 0.02, 0.07, d * 0.62], [0, 0.5, d * 0.17], cover); // duvet
    box(g, [w, h, 0.08], [0, 0, -d / 2 + 0.04], frame); // headboard
    const pw = (w - 0.2) / pillows;
    for (let i = 0; i < pillows; i++) {
      const p = box(g, [pw - 0.06, 0.12, 0.38], [-((w - 0.2) / 2) + pw * (i + 0.5), 0.5, -d / 2 + 0.34], mat('#f7f6f2', 0.95));
      p.rotation.x = -0.1;
    }
    return g;
  };

const wardrobe: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const body = mat(c, 0.55);
  box(g, [w, h - 0.06, d], [0, 0.06, 0], body);
  box(g, [w - 0.06, 0.06, d - 0.06], [0, 0, 0], BLACK()); // plinth
  const dw = w / 2;
  for (const sx of [-1, 1]) {
    box(g, [dw - 0.012, h - 0.12, 0.012], [sx * (dw / 2), 0.09, d / 2 + 0.004], mat(shade(c, -0.04), 0.5));
    box(g, [0.014, 0.28, 0.02], [sx * 0.04, h * 0.5, d / 2 + 0.02], CHROME());
  }
  return g;
};

const drawers =
  (rows: number): Builder =>
  ({ c, w, d, h }) => {
    const g = new THREE.Group();
    const body = mat(c, 0.55);
    box(g, [w, h - 0.1, d], [0, 0.1, 0], body);
    legs(g, w, d, 0.1, 0.04, mat(shade(c, -0.15), 0.5), 0.04);
    const rh = (h - 0.16) / rows;
    for (let i = 0; i < rows; i++) {
      box(g, [w - 0.06, rh - 0.015, 0.012], [0, 0.12 + i * rh, d / 2 + 0.004], mat(shade(c, -0.05), 0.5));
      ball(g, [0.014, 0.014, 0.014], [0, 0.12 + i * rh + rh / 2, d / 2 + 0.02], CHROME());
    }
    return g;
  };

const diningTable: Builder = ({ c, w, d }) => {
  const g = new THREE.Group();
  const wood = mat(c, 0.5);
  box(g, [w, 0.05, d], [0, 0.7, 0], wood);
  legs(g, w, d, 0.7, 0.07, mat(shade(c, -0.08), 0.5), 0.05);
  return g;
};

const diningChair: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  const wood = mat(c, 0.55);
  box(g, [w, 0.04, d], [0, 0.44, 0.0], mat(shade(c, 0.05), 0.7));
  box(g, [w, h - 0.48, 0.035], [0, 0.48, -d / 2 + 0.02], wood).rotation.x = -0.06;
  legs(g, w, d, 0.44, 0.035, wood, 0.01);
  return g;
};

const barStool: Builder = ({ c, w }) => {
  const g = new THREE.Group();
  cyl(g, w / 2, w / 2, 0.05, [0, 0.68, 0], mat(c, 0.6));
  cyl(g, 0.025, 0.025, 0.68, [0, 0, 0], CHROME());
  cyl(g, w / 2.2, w / 2.2, 0.02, [0, 0, 0], CHROME());
  return g;
};

const kitchenBase: Builder = ({ c, w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, h - 0.04 - 0.1, d], [0, 0.1, 0], mat(c, 0.5));
  box(g, [w - 0.04, 0.1, d - 0.06], [0, 0, -0.01], BLACK());
  box(g, [w + 0.01, 0.04, d + 0.02], [0, h - 0.04, 0.005], mat('#b8b4ab', 0.35)); // worktop
  box(g, [w - 0.04, h - 0.18, 0.012], [0, 0.12, d / 2 + 0.004], mat(shade(c, -0.04), 0.5));
  box(g, [0.18, 0.012, 0.02], [0, h - 0.12, d / 2 + 0.02], CHROME());
  return g;
};

const kitchenSink: Builder = (x) => {
  const g = kitchenBase({ ...x, w: x.w, c: x.c });
  const { w, h } = x;
  box(g, [0.5, 0.012, 0.36], [-w * 0.18, h - 0.002, 0], mat('#8f9396', 0.25, 0.8));
  cyl(g, 0.012, 0.012, 0.28, [w * 0.06, h, -0.2], CHROME());
  box(g, [0.02, 0.02, 0.14], [w * 0.06, h + 0.26, -0.13], CHROME());
  return g;
};

const stove: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, h - 0.02, d], [0, 0, 0], WHITE());
  box(g, [w, 0.02, d], [0, h - 0.02, 0], BLACK());
  for (const [bx, bz, r] of [[-0.14, -0.12, 0.08], [0.14, -0.12, 0.06], [-0.14, 0.14, 0.06], [0.14, 0.14, 0.08]] as const) {
    cyl(g, r, r, 0.012, [bx, h, bz], mat('#4a4a4a', 0.4, 0.6));
  }
  box(g, [w - 0.1, h * 0.5, 0.012], [0, 0.1, d / 2 + 0.004], mat('#1b1d20', 0.2, 0.4));
  box(g, [w - 0.16, 0.02, 0.03], [0, h * 0.62, d / 2 + 0.03], CHROME());
  return g;
};

const fridge: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  const body = mat('#e8e7e3', 0.3, 0.2);
  box(g, [w, h, d], [0, 0, 0], body);
  box(g, [w - 0.02, 0.012, 0.012], [0, h * 0.34, d / 2 + 0.004], mat('#9a9a97', 0.4));
  box(g, [0.02, 0.5, 0.03], [w / 2 - 0.08, h * 0.45, d / 2 + 0.02], CHROME());
  box(g, [0.02, 0.28, 0.03], [w / 2 - 0.08, h * 0.76, d / 2 + 0.02], CHROME());
  return g;
};

const toilet: Builder = ({ w, d }) => {
  const g = new THREE.Group();
  box(g, [w * 0.95, 0.4, 0.18], [0, 0.4, -d / 2 + 0.1], WHITE()); // cistern
  const bowl = cyl(g, 0.19, 0.12, 0.4, [0, 0, 0.1], WHITE());
  bowl.scale.z = 1.4;
  const seat = cyl(g, 0.2, 0.2, 0.03, [0, 0.4, 0.1], mat('#f7f6f2', 0.3));
  seat.scale.z = 1.35;
  box(g, [0.06, 0.02, 0.05], [0, 0.8, -d / 2 + 0.08], CHROME());
  return g;
};

const washbasin: Builder = ({ w, d }) => {
  const g = new THREE.Group();
  cyl(g, 0.07, 0.09, 0.62, [0, 0, -d / 2 + 0.12], WHITE());
  box(g, [w, 0.16, d], [0, 0.69, 0], WHITE());
  box(g, [w - 0.16, 0.02, d - 0.14], [0, 0.84, 0.02], mat('#dfe6ea', 0.2));
  cyl(g, 0.012, 0.012, 0.16, [0, 0.85, -d / 2 + 0.07], CHROME());
  box(g, [0.02, 0.02, 0.1], [0, 1.0, -d / 2 + 0.12], CHROME());
  return g;
};

const bathtub: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  const t = 0.08;
  box(g, [w, 0.15, d], [0, 0, 0], WHITE()); // bottom
  box(g, [w, h - 0.15, t], [0, 0.15, d / 2 - t / 2], WHITE());
  box(g, [w, h - 0.15, t], [0, 0.15, -d / 2 + t / 2], WHITE());
  for (const sx of [-1, 1]) box(g, [t, h - 0.15, d - 2 * t], [sx * (w / 2 - t / 2), 0.15, 0], WHITE());
  box(g, [w - 2 * t - 0.02, 0.01, d - 2 * t - 0.02], [0, 0.15, 0], mat('#d9e6ee', 0.15));
  cyl(g, 0.012, 0.012, 0.14, [w / 2 - 0.2, h, -d / 2 + 0.04], CHROME());
  return g;
};

const shower: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  box(g, [w, 0.08, d], [0, 0, 0], mat('#e4e3df', 0.3));
  box(g, [w, h - 0.08, 0.012], [0, 0.08, d / 2 - 0.006], GLASS());
  box(g, [0.012, h - 0.08, d], [w / 2 - 0.006, 0.08, 0], GLASS());
  box(g, [0.03, h - 0.08, 0.03], [w / 2 - 0.015, 0.08, d / 2 - 0.015], CHROME());
  cyl(g, 0.012, 0.012, 0.5, [-w / 2 + 0.1, 1.5, -d / 2 + 0.05], CHROME());
  cyl(g, 0.09, 0.09, 0.02, [-w / 2 + 0.1, 2.0, -d / 2 + 0.12], CHROME());
  return g;
};

const desk: Builder = ({ c, w, d }) => {
  const g = new THREE.Group();
  const wood = mat(c, 0.5);
  box(g, [w, 0.04, d], [0, 0.71, 0], wood);
  for (const sx of [-1, 1]) box(g, [0.04, 0.71, d - 0.06], [sx * (w / 2 - 0.03), 0, 0], mat(shade(c, -0.06), 0.5));
  box(g, [0.45, 0.45, d - 0.1], [w / 2 - 0.3, 0.2, 0], mat(shade(c, -0.06), 0.5));
  box(g, [w - 0.1, 0.3, 0.02], [0, 0.4, -d / 2 + 0.05], mat(shade(c, -0.1), 0.5));
  return g;
};

const officeChair: Builder = ({ c, w }) => {
  const g = new THREE.Group();
  const fabric = mat(c, 0.85);
  cyl(g, w * 0.46, w * 0.46, 0.08, [0, 0.44, 0], fabric);
  box(g, [w * 0.82, 0.5, 0.06], [0, 0.52, -w * 0.4], fabric).rotation.x = -0.12;
  cyl(g, 0.025, 0.025, 0.4, [0, 0.05, 0], CHROME());
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    box(g, [0.04, 0.03, 0.28], [Math.sin(a) * 0.14, 0.03, Math.cos(a) * 0.14], BLACK(), a);
  }
  return g;
};

const wallArt: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  const frame = mat('#2b2a28', 0.5);
  const fz = d / 2;
  const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frame);
  f.position.set(0, 0, fz);
  f.castShadow = true;
  g.add(f);
  const canvas = new THREE.Mesh(new THREE.BoxGeometry(w - 0.08, h - 0.08, 0.004), mat('#efece6', 0.9));
  canvas.position.set(0, 0, d + 0.001);
  g.add(canvas);
  for (const [cx, cy, cw, ch, col] of [[-0.12, 0.05, 0.3, 0.26, '#b5604a'], [0.14, -0.04, 0.26, 0.3, '#4d6783'], [0, -0.14, 0.4, 0.06, '#c9b79c']] as const) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, 0.003), mat(col, 0.9));
    p.position.set(cx, cy, d + 0.004);
    g.add(p);
  }
  return g;
};

const mirror: Builder = ({ w, d, h }) => {
  const g = new THREE.Group();
  const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat('#b98a5b', 0.5));
  f.position.set(0, 0, d / 2);
  f.castShadow = true;
  g.add(f);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(w - 0.06, h - 0.06, 0.004), mat('#dfe9ee', 0.04, 1));
  glass.position.set(0, 0, d + 0.001);
  g.add(glass);
  return g;
};

const floorLamp: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  cyl(g, w * 0.4, w * 0.4, 0.025, [0, 0, 0], BLACK());
  cyl(g, 0.012, 0.012, h - 0.4, [0, 0.02, 0], mat('#7d7b76', 0.3, 0.8));
  cyl(g, w * 0.3, w * 0.5, 0.3, [0, h - 0.3, 0], GLOW());
  return g;
};

const ceilingLight: Builder = ({ w }) => {
  const g = new THREE.Group();
  cyl(g, w / 2, w / 2, 0.05, [0, -0.05, 0], mat('#f1efea', 0.5));
  cyl(g, w / 2 - 0.05, w / 2 - 0.05, 0.01, [0, -0.057, 0], GLOW());
  return g;
};

const pendant: Builder = ({ w, h }) => {
  const g = new THREE.Group();
  cyl(g, 0.006, 0.006, h - 0.25, [0, -(h - 0.25), 0], BLACK());
  cyl(g, 0.02, w * 0.1, 0.25, [0, -h, 0], mat('#c9a47a', 0.4, 0.6)).scale.set(1, 1, 1);
  const shade2 = cyl(g, w * 0.12, w / 2, 0.22, [0, -h, 0], mat('#2b2a28', 0.5, 0.2));
  shade2.position.y = -h + 0.11;
  cyl(g, w / 2 - 0.02, w / 2 - 0.02, 0.01, [0, -h + 0.0, 0], GLOW());
  return g;
};

const plant =
  (tall: boolean): Builder =>
  ({ w, h }) => {
    const g = new THREE.Group();
    const pot = mat(tall ? '#c9bfa0' : '#b5604a', 0.8);
    const potH = tall ? 0.35 : 0.2;
    cyl(g, w * 0.38, w * 0.28, potH, [0, 0, 0], pot);
    cyl(g, w * 0.35, w * 0.35, 0.01, [0, potH, 0], mat('#4a3a2c', 1));
    const leaf = mat('#5f8a55', 0.8);
    const leaf2 = mat('#7aa66b', 0.8);
    if (tall) {
      cyl(g, 0.025, 0.04, h * 0.5, [0, potH, 0], mat('#6e5a45', 0.9));
      for (let i = 0; i < 9; i++) {
        const a = i * 2.4;
        const y = potH + h * 0.4 + (i % 3) * h * 0.13;
        ball(g, [0.17, 0.26, 0.17], [Math.sin(a) * 0.13, y, Math.cos(a) * 0.13], i % 2 ? leaf : leaf2);
      }
    } else {
      for (let i = 0; i < 7; i++) {
        const a = i * 2.4;
        ball(g, [0.07, 0.15, 0.07], [Math.sin(a) * 0.07, potH + 0.13 + (i % 3) * 0.05, Math.cos(a) * 0.07], i % 2 ? leaf : leaf2).rotation.set(Math.sin(a) * 0.5, 0, Math.cos(a) * 0.5);
      }
    }
    return g;
  };

const BUILDERS: Record<string, Builder> = {
  ...BUILDERS2,
  ...BUILDERS3,
  ...BUILDERS4,
  ...BUILDERS5,
  ...BUILDERS6,
  ...BUILDERS8,
  ...BUILDERS9,
  ...TREE_BUILDERS, // the lumpy-crowned trees replace the first, simpler ones
  ...REAL_TREE_BUILDERS, // and the leaf-card trees (real branches, bark and leaves) replace those
  'bed-king': bed(2),
  'painting-large': wallArt,
  'sofa-2': sofa(2),
  'sofa-3': sofa(3),
  armchair: sofa(1),
  'coffee-table': coffeeTable,
  'coffee-table-round': roundTable(0.4),
  'tv-unit': tvUnit,
  bookshelf,
  'side-table': roundTable(0.5, 0.5),
  rug,
  'bed-double': bed(2),
  'bed-single': bed(1),
  wardrobe,
  nightstand: drawers(2),
  dresser: drawers(3),
  'dining-table': diningTable,
  'dining-chair': diningChair,
  'bar-stool': barStool,
  'kitchen-base': kitchenBase,
  'kitchen-sink': kitchenSink,
  stove,
  fridge,
  toilet,
  washbasin,
  bathtub,
  shower,
  desk,
  'office-chair': officeChair,
  'wall-art': wallArt,
  mirror,
  'floor-lamp': floorLamp,
  'ceiling-light': ceilingLight,
  pendant,
  'plant-small': plant(false),
  'plant-tall': plant(true),
};

/** Fallback when an asset has no builder: a plain box of the catalog size. */
const fallback: Builder = ({ w, d, h, c }) => {
  const g = new THREE.Group();
  box(g, [w, h, d], [0, 0, 0], mat(c, 0.7));
  return g;
};

const templates = new Map<string, THREE.Group>();

/** True when this catalog item has a dedicated procedural model (all of them should; tested). */
export const hasBuilder = (assetId: string): boolean => assetId in BUILDERS;

/** The default main colour of an item. */
export const defaultColor = (a: Asset): string => a.colors?.[0]?.id ?? '#c9c4b9';

/** A fresh copy of the model of `assetId` (shares geometry and materials with every other copy). */
export function buildFurniture(assetId: string, color?: string): THREE.Group | null {
  const a = getAsset(assetId);
  if (!a) return null;
  const c = color ?? defaultColor(a);
  const key = `${assetId}|${c}`;
  let tpl = templates.get(key);
  if (!tpl) {
    tpl = mergeByMaterial((BUILDERS[assetId] ?? fallback)({ a, c, w: a.size[0], d: a.size[1], h: a.size[2] }));
    templates.set(key, tpl);
  }
  return tpl.clone(true);
}
