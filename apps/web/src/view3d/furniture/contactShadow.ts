import * as THREE from 'three';

/** A soft dark blob under floor furniture: costs two triangles per item and grounds it on every quality tier. */
let material: THREE.MeshBasicMaterial | null = null;

export function contactShadowMaterial(): THREE.MeshBasicMaterial {
  if (material) return material;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0,0,0,0.5)');
  grad.addColorStop(0.68, 'rgba(0,0,0,0.4)');
  grad.addColorStop(0.85, 'rgba(0,0,0,0.16)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  material = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, toneMapped: false });
  return material;
}

export const contactShadowGeometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
