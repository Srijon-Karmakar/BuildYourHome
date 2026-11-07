import * as THREE from 'three';

/**
 * Procedural PBR-ish textures (ADR-013: placeholders until a scanned/authored set exists).
 * Generated once per size on a canvas, deterministic (seeded), seamlessly tileable, cached.
 */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cache = new Map<string, THREE.CanvasTexture>();

function finish(canvas: HTMLCanvasElement, srgb: boolean): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** World size of one wood tile (metres): 6 planks of ~0.2 m. */
export const WOOD_TILE_M = 1.2;
/** World size of one plaster tile (metres). */
export const PLASTER_TILE_M = 1.5;

/** Oak plank floor: staggered seams, per-plank colour variation, grain, dark gaps. */
export function woodTexture(size: number): THREE.CanvasTexture {
  const key = `wood:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const rnd = mulberry32(11);
  const rows = 6;
  const rh = size / rows;
  const px = size / 512; // line widths scale with resolution

  for (let r = 0; r < rows; r++) {
    const y = r * rh;
    const seamCount = 1 + (rnd() < 0.55 ? 1 : 0);
    const seams = Array.from({ length: seamCount }, () => rnd() * size).sort((a, b) => a - b);
    for (let s = 0; s < seams.length; s++) {
      const x0 = seams[s]!;
      const x1 = s + 1 < seams.length ? seams[s + 1]! : seams[0]! + size; // last plank wraps around
      const light = 48 + (rnd() - 0.5) * 6;
      const hue = 29 + (rnd() - 0.5) * 5;
      const sat = 38 + (rnd() - 0.5) * 8;
      for (const shift of [0, -size]) {
        const a = x0 + shift;
        const b = x1 + shift;
        g.fillStyle = `hsl(${hue} ${sat}% ${light}%)`;
        g.fillRect(a, y, b - a, rh);
        // Grain: long, slightly wavy darker streaks.
        for (let k = 0; k < 16; k++) {
          const gy = y + rnd() * rh;
          const wave = (rnd() - 0.5) * 3 * px;
          g.strokeStyle = `rgba(60,35,15,${0.05 + rnd() * 0.1})`;
          g.lineWidth = (0.6 + rnd() * 1.2) * px;
          g.beginPath();
          g.moveTo(a, gy);
          g.bezierCurveTo(a + (b - a) * 0.3, gy + wave, a + (b - a) * 0.7, gy - wave, b, gy + wave * 0.4);
          g.stroke();
        }
        // End-joint gap.
        g.strokeStyle = 'rgba(35,20,10,0.55)';
        g.lineWidth = 1.6 * px;
        g.beginPath();
        g.moveTo(a, y);
        g.lineTo(a, y + rh);
        g.stroke();
      }
    }
    // Gap between rows.
    g.strokeStyle = 'rgba(35,20,10,0.6)';
    g.lineWidth = 1.8 * px;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(size, y);
    g.stroke();
  }

  const tex = finish(c, true);
  tex.repeat.set(1 / WOOD_TILE_M, 1 / WOOD_TILE_M);
  cache.set(key, tex);
  return tex;
}

/** Fine plaster relief as a tileable normal map (3 octaves of wrapped value noise). */
export function plasterNormal(size: number): THREE.CanvasTexture {
  const key = `plaster:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const rnd = mulberry32(5);
  const octaves = [
    { cells: 16, amp: 1 },
    { cells: 48, amp: 0.5 },
    { cells: 128, amp: 0.25 },
  ].map((o) => ({ ...o, grid: Float32Array.from({ length: o.cells * o.cells }, () => rnd()) }));

  const smooth = (t: number) => t * t * (3 - 2 * t);
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let h = 0;
      for (const o of octaves) {
        const fx = (x / size) * o.cells;
        const fy = (y / size) * o.cells;
        const x0 = Math.floor(fx) % o.cells;
        const y0 = Math.floor(fy) % o.cells;
        const x1 = (x0 + 1) % o.cells;
        const y1 = (y0 + 1) % o.cells;
        const tx = smooth(fx - Math.floor(fx));
        const ty = smooth(fy - Math.floor(fy));
        const a = o.grid[y0 * o.cells + x0]! * (1 - tx) + o.grid[y0 * o.cells + x1]! * tx;
        const b = o.grid[y1 * o.cells + x0]! * (1 - tx) + o.grid[y1 * o.cells + x1]! * tx;
        h += (a * (1 - ty) + b * ty) * o.amp;
      }
      height[y * size + x] = h;
    }
  }

  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const img = g.createImageData(size, size);
  const strength = 2.2;
  const at = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)]!;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (at(x - 1, y) - at(x + 1, y)) * strength;
      const ny = (at(x, y - 1) - at(x, y + 1)) * strength;
      const len = Math.hypot(nx, ny, 1);
      const i = (y * size + x) * 4;
      img.data[i] = ((nx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);

  const tex = finish(c, false);
  tex.repeat.set(1 / PLASTER_TILE_M, 1 / PLASTER_TILE_M);
  cache.set(key, tex);
  return tex;
}

/** World size of one tile pattern repeat (metres): 2 × 2 tiles of 0.6 m. */
export const TILE_REPEAT_M = 1.2;

/** Square tiles with grout lines and tiny per-tile brightness variation. White-ish base, tinted by the material colour. */
export function tileTexture(size: number, grout: string): THREE.CanvasTexture {
  const key = `tile:${size}:${grout}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const rnd = mulberry32(23);
  const n = 2;
  const cell = size / n;
  const gap = Math.max(2, size / 256);
  g.fillStyle = grout;
  g.fillRect(0, 0, size, size);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const v = 238 + Math.round((rnd() - 0.5) * 12);
      g.fillStyle = `rgb(${v},${v},${v - 2})`;
      g.fillRect(x * cell + gap / 2, y * cell + gap / 2, cell - gap, cell - gap);
    }
  }
  const tex = finish(c, true);
  tex.repeat.set(1 / TILE_REPEAT_M, 1 / TILE_REPEAT_M);
  cache.set(key, tex);
  return tex;
}

// ------------------------------------------------------------------------------------------------
// Wall finishes and extra floors (all tileable, seeded, tinted by the material colour).
// Light neutral bases + darker joints so the tint colours the faces and the joints read as mortar/grout.
// ------------------------------------------------------------------------------------------------

export const BRICK_TILE_M = 0.6;
export const STONE_TILE_M = 1.2;
export const PANEL_TILE_M = 0.6;
export const SUBWAY_TILE_M = 0.6;
export const TERRAZZO_TILE_M = 1.2;
export const CARPET_TILE_M = 0.8;

function newCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')!];
}

const grey = (v: number) => `rgb(${Math.round(v)},${Math.round(v)},${Math.round(v - 3)})`;

/** Running-bond brick: 4 bricks × 8 courses per tile. */
export function brickTexture(size: number): THREE.CanvasTexture {
  const key = `brick:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, g] = newCanvas(size);
  const rnd = mulberry32(31);
  const cols = 4;
  const rows = 8;
  const bw = size / cols;
  const bh = size / rows;
  const mortar = Math.max(2, size / 170);
  g.fillStyle = grey(246); // mortar
  g.fillRect(0, 0, size, size);
  for (let r = 0; r < rows; r++) {
    const shift = r % 2 ? bw / 2 : 0;
    for (let k = -1; k < cols; k++) {
      const x = k * bw + shift;
      const v = 205 + (rnd() - 0.5) * 36;
      g.fillStyle = grey(v);
      g.fillRect(x + mortar / 2, r * bh + mortar / 2, bw - mortar, bh - mortar);
      // speckle
      for (let i = 0; i < 10; i++) {
        g.fillStyle = `rgba(0,0,0,${0.03 + rnd() * 0.05})`;
        g.fillRect(x + rnd() * bw, r * bh + rnd() * bh, 1 + rnd() * 2, 1 + rnd() * 2);
      }
    }
  }
  const tex = finish(c, true);
  tex.repeat.set(1 / BRICK_TILE_M, 1 / BRICK_TILE_M);
  cache.set(key, tex);
  return tex;
}

/** Irregular ashlar stone: 3 courses of varying block width. */
export function stoneTexture(size: number): THREE.CanvasTexture {
  const key = `stone:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, g] = newCanvas(size);
  const rnd = mulberry32(47);
  const courses = [0.36, 0.28, 0.36];
  g.fillStyle = grey(120);
  g.fillRect(0, 0, size, size);
  const gap = Math.max(3, size / 110);
  let y = 0;
  for (const frac of courses) {
    const h = frac * size;
    // block widths summing to `size`
    const widths: number[] = [];
    let used = 0;
    while (used < size - 0.2 * size) {
      const w = (0.22 + rnd() * 0.3) * size;
      widths.push(w);
      used += w;
    }
    widths.push(size - used);
    let x = 0;
    for (const w of widths) {
      g.fillStyle = grey(196 + (rnd() - 0.5) * 40);
      g.fillRect(x + gap / 2, y + gap / 2, w - gap, h - gap);
      for (let i = 0; i < 24; i++) {
        g.fillStyle = `rgba(0,0,0,${0.03 + rnd() * 0.06})`;
        g.beginPath();
        g.arc(x + rnd() * w, y + rnd() * h, 1 + rnd() * 3, 0, Math.PI * 2);
        g.fill();
      }
      x += w;
    }
    y += h;
  }
  const tex = finish(c, true);
  tex.repeat.set(1 / STONE_TILE_M, 1 / STONE_TILE_M);
  cache.set(key, tex);
  return tex;
}

/** Vertical wood slats (acoustic / feature panel). */
export function panelTexture(size: number): THREE.CanvasTexture {
  const key = `panel:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, g] = newCanvas(size);
  const rnd = mulberry32(53);
  const slats = 6;
  const sw = size / slats;
  const gap = Math.max(2, size / 150);
  g.fillStyle = grey(70);
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < slats; i++) {
    g.fillStyle = grey(215 + (rnd() - 0.5) * 30);
    g.fillRect(i * sw + gap / 2, 0, sw - gap, size);
    for (let k = 0; k < 14; k++) {
      g.strokeStyle = `rgba(0,0,0,${0.04 + rnd() * 0.07})`;
      g.lineWidth = 0.7 + rnd();
      const gx = i * sw + gap + rnd() * (sw - 2 * gap);
      g.beginPath();
      g.moveTo(gx, 0);
      g.bezierCurveTo(gx + (rnd() - 0.5) * 4, size * 0.3, gx + (rnd() - 0.5) * 4, size * 0.7, gx, size);
      g.stroke();
    }
  }
  const tex = finish(c, true);
  tex.repeat.set(1 / PANEL_TILE_M, 1 / PANEL_TILE_M);
  cache.set(key, tex);
  return tex;
}

/** Glossy subway tile (offset rows). */
export function subwayTexture(size: number, grout: string): THREE.CanvasTexture {
  const key = `subway:${size}:${grout}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, g] = newCanvas(size);
  const rnd = mulberry32(61);
  const cols = 2;
  const rows = 4;
  const tw = size / cols;
  const th = size / rows;
  const gap = Math.max(2, size / 200);
  g.fillStyle = grout;
  g.fillRect(0, 0, size, size);
  for (let r = 0; r < rows; r++) {
    const shift = r % 2 ? tw / 2 : 0;
    for (let k = -1; k < cols; k++) {
      g.fillStyle = grey(242 + (rnd() - 0.5) * 8);
      g.fillRect(k * tw + shift + gap / 2, r * th + gap / 2, tw - gap, th - gap);
    }
  }
  const tex = finish(c, true);
  tex.repeat.set(1 / SUBWAY_TILE_M, 1 / SUBWAY_TILE_M);
  cache.set(key, tex);
  return tex;
}

/** Terrazzo: pale matrix with random coloured chips. */
export function terrazzoTexture(size: number): THREE.CanvasTexture {
  const key = `terrazzo:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, g] = newCanvas(size);
  const rnd = mulberry32(71);
  g.fillStyle = grey(244);
  g.fillRect(0, 0, size, size);
  const chips = ['#b8a58c', '#8f8a80', '#c9b79c', '#6f6a62', '#d8cdb8', '#a28c74'];
  const n = Math.round(size * 0.55);
  for (let i = 0; i < n; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = (1.2 + rnd() * 4.5) * (size / 512);
    g.fillStyle = chips[Math.floor(rnd() * chips.length)]!;
    g.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + rnd();
      const rr = r * (0.6 + rnd() * 0.6);
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      // wrap so the tile stays seamless
      for (const [ox, oy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]] as const) {
        if (ox === 0 && oy === 0) {
          if (k === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
      }
    }
    g.closePath();
    g.fill();
  }
  const tex = finish(c, true);
  tex.repeat.set(1 / TERRAZZO_TILE_M, 1 / TERRAZZO_TILE_M);
  cache.set(key, tex);
  return tex;
}

/** Soft carpet pile: fine speckle. */
export function carpetTexture(size: number): THREE.CanvasTexture {
  const key = `carpet:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, g] = newCanvas(size);
  const rnd = mulberry32(83);
  g.fillStyle = grey(225);
  g.fillRect(0, 0, size, size);
  const n = size * size * 0.35;
  for (let i = 0; i < n; i++) {
    const v = 180 + rnd() * 70;
    g.fillStyle = grey(v);
    g.fillRect(rnd() * size, rnd() * size, 1, 1.4);
  }
  const tex = finish(c, true);
  tex.repeat.set(1 / CARPET_TILE_M, 1 / CARPET_TILE_M);
  cache.set(key, tex);
  return tex;
}

/** Soft water ripples as a tangent-space normal map (sum of a few sine waves; tiles seamlessly). */
export function rippleNormal(size = 128): THREE.CanvasTexture {
  const key = `ripple:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const waves = [
    { kx: 2, ky: 1, a: 1, p: 0.3 },
    { kx: -3, ky: 2, a: 0.7, p: 1.7 },
    { kx: 5, ky: 4, a: 0.4, p: 2.9 },
    { kx: 1, ky: -6, a: 0.3, p: 4.1 },
  ];
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const img = g.createImageData(size, size);
  const k = (Math.PI * 2) / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let dx = 0;
      let dy = 0;
      for (const w of waves) {
        const d = Math.cos((w.kx * x + w.ky * y) * k + w.p) * w.a * 0.09;
        dx += d * w.kx;
        dy += d * w.ky;
      }
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      img.data[i] = (-dx / len) * 127.5 + 127.5;
      img.data[i + 1] = (-dy / len) * 127.5 + 127.5;
      img.data[i + 2] = (1 / len) * 127.5 + 127.5;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = finish(c, false);
  cache.set(key, tex);
  return tex;
}

// ------------------------------------------------------------------------------------------------
// Roofing: laid out in metres along the roof face (u along the eave, v up the slope), tinted by the material colour.
// ------------------------------------------------------------------------------------------------

export const ROOF_TILE_M = 1.0;

/** Rows of overlapping clay tiles: each tile has a lit top edge and a shadow where the next row overlaps it. */
export function roofTileTexture(size: number): THREE.CanvasTexture {
  const key = `rooftile:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const rnd = mulberry32(31);
  const rows = 5;
  const cols = 5;
  const rh = size / rows;
  const cw = size / cols;
  g.fillStyle = '#9a9a9a';
  g.fillRect(0, 0, size, size);
  for (let r = 0; r < rows; r++) {
    for (let k = -1; k <= cols; k++) {
      const x = k * cw + (r % 2 ? cw / 2 : 0);
      const v = 205 + Math.round((rnd() - 0.5) * 36);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(x + 1, r * rh, cw - 2, rh);
      const grad = g.createLinearGradient(0, r * rh, 0, (r + 1) * rh);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.7, 'rgba(0,0,0,0.05)');
      grad.addColorStop(1, 'rgba(0,0,0,0.42)');
      g.fillStyle = grad;
      g.fillRect(x + 1, r * rh, cw - 2, rh);
      g.fillStyle = 'rgba(0,0,0,0.25)'; // the rib between two tiles
      g.fillRect(x + cw / 2 - 1, r * rh, 2, rh * 0.9);
    }
  }
  const tex = finish(c, true);
  tex.repeat.set(1 / ROOF_TILE_M, 1 / ROOF_TILE_M);
  cache.set(key, tex);
  return tex;
}

/** Asphalt / slate shingles: staggered rows of rectangular tabs with notches. */
export function shingleTexture(size: number): THREE.CanvasTexture {
  const key = `shingle:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const rnd = mulberry32(37);
  const rows = 6;
  const cols = 4;
  const rh = size / rows;
  const cw = size / cols;
  g.fillStyle = '#8c8c8c';
  g.fillRect(0, 0, size, size);
  for (let r = 0; r < rows; r++) {
    for (let k = -1; k <= cols; k++) {
      const x = k * cw + (r % 2 ? cw / 2 : 0);
      const v = 200 + Math.round((rnd() - 0.5) * 44);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(x + 1.5, r * rh + 1, cw - 3, rh - 1);
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(x + 1.5, (r + 1) * rh - 3, cw - 3, 3);
    }
  }
  const tex = finish(c, true);
  tex.repeat.set(1 / ROOF_TILE_M, 1 / ROOF_TILE_M);
  cache.set(key, tex);
  return tex;
}

/** Standing-seam metal: raised ribs running up the slope every 40 cm. */
export function seamTexture(size: number): THREE.CanvasTexture {
  const key = `seam:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = '#e4e4e4';
  g.fillRect(0, 0, size, size);
  const ribs = 3;
  const pitch = size / ribs;
  for (let k = 0; k < ribs; k++) {
    const x = k * pitch;
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.fillRect(x, 0, size * 0.012, size);
    g.fillStyle = 'rgba(0,0,0,0.38)';
    g.fillRect(x + size * 0.012, 0, size * 0.014, size);
    const grad = g.createLinearGradient(x + size * 0.03, 0, x + pitch, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0.0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.07)');
    g.fillStyle = grad;
    g.fillRect(x + size * 0.03, 0, pitch - size * 0.03, size);
  }
  const tex = finish(c, true);
  tex.repeat.set(1 / 1.2, 1 / ROOF_TILE_M);
  cache.set(key, tex);
  return tex;
}
