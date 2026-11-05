import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CATALOG } from '@hd/assets';
import { buildFurniture, defaultColor, hasBuilder } from './builders';

// Three.js builds geometry without a GL context, so this runs in plain Node.
describe('procedural furniture', () => {
  it('every catalog item has a dedicated model', () => {
    for (const a of CATALOG) expect(hasBuilder(a.id), a.id).toBe(true);
  });

  it('every model builds, has meshes, and stays near its catalog footprint and height', () => {
    for (const a of CATALOG) {
      const g = buildFurniture(a.id)!;
      expect(g, a.id).toBeTruthy();
      let meshes = 0;
      g.traverse((o) => o instanceof THREE.Mesh && meshes++);
      expect(meshes, a.id).toBeGreaterThan(0);
      const box = new THREE.Box3().setFromObject(g);
      const size = box.getSize(new THREE.Vector3());
      // within 35 % of the declared width/depth (decor like TVs, taps and cushions may overhang a little)
      expect(size.x, `${a.id} width`).toBeGreaterThan(a.size[0] * 0.55);
      expect(size.x, `${a.id} width`).toBeLessThan(a.size[0] * 1.45);
      expect(size.z, `${a.id} depth`).toBeLessThan(Math.max(a.size[1] * 1.45, a.size[1] + 0.25));
      expect(size.y, `${a.id} height`).toBeLessThan(a.size[2] * 1.6 + 0.1);
    }
  });

  it('floor items stand on the floor (y ≥ 0) and ceiling items hang below y = 0', () => {
    for (const a of CATALOG) {
      const box = new THREE.Box3().setFromObject(buildFurniture(a.id)!);
      if (a.mount === 'floor') expect(box.min.y, a.id).toBeGreaterThanOrEqual(-1e-6);
      if (a.mount === 'ceiling') expect(box.max.y, a.id).toBeLessThanOrEqual(1e-6);
    }
  });

  it('wall items extend away from the wall (z ≥ 0) and are centred vertically', () => {
    for (const a of CATALOG.filter((x) => x.mount === 'wall')) {
      const box = new THREE.Box3().setFromObject(buildFurniture(a.id)!);
      expect(box.min.z, a.id).toBeGreaterThanOrEqual(-1e-6);
      expect((box.max.y + box.min.y) / 2, a.id).toBeCloseTo(0, 1);
    }
  });

  it('copies share geometry & materials (cheap to place many) but are independent objects', () => {
    const a = buildFurniture('dining-chair')!;
    const b = buildFurniture('dining-chair')!;
    expect(a).not.toBe(b);
    const ma = a.children[0] as THREE.Mesh;
    const mb = b.children[0] as THREE.Mesh;
    expect(ma.geometry).toBe(mb.geometry);
    expect(ma.material).toBe(mb.material);
    a.position.x = 3;
    expect(b.position.x).toBe(0);
  });

  it('a colour variant changes the look; unknown assets return null', () => {
    const base = buildFurniture('sofa-2')!;
    const navy = buildFurniture('sofa-2', '#4d6783')!;
    const colours = (g: THREE.Group) => {
      const set = new Set<string>();
      g.traverse((o) => o instanceof THREE.Mesh && set.add((o.material as THREE.MeshStandardMaterial).color.getHexString()));
      return set;
    };
    expect(colours(navy).has('4d6783')).toBe(true);
    expect(colours(base).has('4d6783')).toBe(false);
    expect(buildFurniture('nope')).toBeNull();
    expect(defaultColor(CATALOG[0]!)).toMatch(/^#/);
  });
});
