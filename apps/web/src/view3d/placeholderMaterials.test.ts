import { describe, expect, it } from 'vitest';
import { DOOR_STYLES, FRAME_COLORS, LEAF_COLORS, WINDOW_STYLES } from '@hd/scene-schema';
import { MATERIAL_CATALOG, catalogMaterial, finishMaterials, materialsFor, paintMaterials } from './placeholderMaterials';

describe('material catalog', () => {
  it('has unique ids and valid colours', () => {
    const ids = MATERIAL_CATALOG.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of MATERIAL_CATALOG) {
      expect(m.color, m.id).toMatch(/^#[0-9a-f]{6}$/i);
      expect(m.roughness, m.id).toBeGreaterThanOrEqual(0);
      expect(m.roughness, m.id).toBeLessThanOrEqual(1);
      if (m.pattern === 'tile' || m.pattern === 'subway') expect(m.grout, m.id).toBeTruthy();
    }
  });

  it('offers a good choice for every surface', () => {
    expect(paintMaterials().length).toBeGreaterThanOrEqual(12);
    expect(finishMaterials().length).toBeGreaterThanOrEqual(10);
    expect(materialsFor('floor').length).toBeGreaterThanOrEqual(18);
    expect(materialsFor('ground').length).toBeGreaterThanOrEqual(10);
    expect(materialsFor('roof').length).toBeGreaterThanOrEqual(11);
  });

  it('names inside one picker are distinct (they are the swatch labels)', () => {
    for (const g of ['floor', 'ground', 'roof'] as const) {
      const names = materialsFor(g).map((m) => m.name);
      expect(new Set(names).size, g).toBe(names.length);
    }
    const wall = [...paintMaterials(), ...finishMaterials()].map((m) => m.name);
    expect(new Set(wall).size).toBe(wall.length);
  });

  it('every material the app itself uses still exists (scenes reference these ids)', () => {
    for (const id of ['paint-white', 'floor-wood-oak', 'wall-stone', 'wall-wood-panel', 'ground-grass', 'roof-tile-terracotta']) {
      expect(catalogMaterial(id).id, id).toBe(id);
    }
  });
});

describe('door and window options', () => {
  it('have more styles and colours, with distinct names', () => {
    expect(DOOR_STYLES.length).toBeGreaterThanOrEqual(7);
    expect(WINDOW_STYLES.length).toBeGreaterThanOrEqual(5);
    for (const list of [FRAME_COLORS, LEAF_COLORS]) {
      expect(new Set(list.map((c) => c.name)).size).toBe(list.length);
      expect(new Set(list.map((c) => c.id)).size).toBe(list.length);
    }
  });
});
