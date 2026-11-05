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
