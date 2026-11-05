import * as THREE from 'three';
import { buildFurniture } from './builders';

/**
 * Catalog thumbnails, rendered once from the real procedural models with a small offscreen renderer.
 * The renderer (a second WebGL context) is created only when the catalog is opened and released shortly
 * after the queue empties, so it never competes with the editor's own canvas for long.
 */
const SIZE = 168;
const cache = new Map<string, string>(); // '' = failed (UI shows a placeholder)
const queued = new Set<string>();
const queue: string[] = [];
const listeners = new Set<() => void>();

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let rendererFailed = false;
let running = false;
let releaseTimer: number | undefined;

export const getThumbnail = (id: string): string | undefined => cache.get(id);

export function subscribeThumbnails(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function ensureRenderer(): boolean {
  if (renderer) return true;
  if (rendererFailed) return false;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(SIZE, SIZE, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9a948a, 1.35));
    const sun = new THREE.DirectionalLight(0xffffff, 1.9);
    sun.position.set(2.5, 4, 3);
    scene.add(sun);
    camera = new THREE.PerspectiveCamera(28, 1, 0.05, 50);
    return true;
  } catch {
    rendererFailed = true;
    renderer = null;
    return false;
  }
}

function renderOne(id: string): string {
  if (!ensureRenderer() || !renderer || !scene || !camera) return '';
  const obj = buildFurniture(id);
  if (!obj) return '';
  const box = new THREE.Box3().setFromObject(obj);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  obj.position.sub(sphere.center); // centre on the origin
  scene.add(obj);
  const dist = (sphere.radius / Math.sin((camera.fov * Math.PI) / 360)) * 1.08;
  camera.position.set(0.85, 0.7, 1.0).normalize().multiplyScalar(dist);
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
  scene.remove(obj);
  return renderer.domElement.toDataURL('image/png');
}

function release(): void {
  if (!renderer) return;
  renderer.dispose();
  renderer.forceContextLoss();
  renderer = null;
  scene = null;
  camera = null;
}

function step(): void {
  const id = queue.shift();
  if (!id) {
    running = false;
    releaseTimer = window.setTimeout(release, 1500);
    return;
  }
  try {
    cache.set(id, renderOne(id));
  } catch {
    cache.set(id, '');
  }
  queued.delete(id);
  listeners.forEach((f) => f());
  window.setTimeout(step, 0); // yield between renders so the UI stays responsive
}

/** Ask for thumbnails (idempotent). `subscribeThumbnails` fires as each one becomes ready. */
export function requestThumbnails(ids: readonly string[]): void {
  for (const id of ids) {
    if (cache.has(id) || queued.has(id)) continue;
    queued.add(id);
    queue.push(id);
  }
  if (!running && queue.length > 0) {
    running = true;
    window.clearTimeout(releaseTimer);
    window.setTimeout(step, 0);
  }
}
