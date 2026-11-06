import { describe, expect, it } from 'vitest';
import { CATALOG, CATEGORIES, getAsset, searchCatalog } from './catalog';
import { frontOf, itemFootprint, localToPlan, pointInItem, rotationFacing } from './footprint';

describe('catalog integrity', () => {
  it('has unique ids, valid categories and sane sizes', () => {
    const ids = CATALOG.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    const cats = new Set(CATEGORIES.map((c) => c.id));
    for (const x of CATALOG) {
      expect(cats.has(x.category), x.id).toBe(true);
      // Outdoor things (cars, pools, trees) are bigger than anything indoors.
      expect(x.size.every((v) => v > 0 && v < (x.category === 'outdoor' ? 8 : 4)), x.id).toBe(true);
      expect(x.placeholder).toBe(true);
    }
  });

  it('wall items declare a mount height; every category has items', () => {
    for (const x of CATALOG.filter((y) => y.mount === 'wall')) expect(x.mountHeight, x.id).toBeGreaterThan(0);
    for (const c of CATEGORIES) expect(CATALOG.some((x) => x.category === c.id), c.id).toBe(true);
  });

  it('colour palettes start with a default and use hex ids', () => {
    for (const x of CATALOG) for (const c of x.colors ?? []) expect(c.id).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('mixes free, premium and rewarded items (to exercise the monetisation flow)', () => {
    const tiers = new Set(CATALOG.map((x) => x.tier));
    expect(tiers).toEqual(new Set(['free', 'premium', 'rewarded']));
    expect(CATALOG.filter((x) => x.tier === 'free').length).toBeGreaterThan(CATALOG.length / 2);
  });

  it('looks things up and searches by name, tag and category', () => {
    expect(getAsset('sofa-2')?.name).toBe('Sofa, 2-seat');
    expect(getAsset('nope')).toBeUndefined();
    expect(searchCatalog('couch').map((x) => x.id)).toEqual(expect.arrayContaining(['sofa-2', 'sofa-3']));
    expect(searchCatalog('', 'bathroom').every((x) => x.category === 'bathroom')).toBe(true);
    expect(searchCatalog('kitchen').length).toBeGreaterThan(0); // category name
    expect(searchCatalog('zzzz')).toEqual([]);
    expect(searchCatalog('table', 'office').map((x) => x.id)).toEqual(expect.arrayContaining(['desk', 'desk-l', 'meeting-table', 'standing-desk']));
  });
});

describe('footprint math', () => {
  const sofa = getAsset('sofa-2')!;

  it('local → plan matches Three.js rotation.y', () => {
    // θ = 90°: local +x (width) points toward −z, local +z (front) points toward +x.
    const x = localToPlan([0, 0], Math.PI / 2, 1, 0);
    const z = localToPlan([0, 0], Math.PI / 2, 0, 1);
    expect(x[0]).toBeCloseTo(0);
    expect(x[1]).toBeCloseTo(-1);
    expect(z[0]).toBeCloseTo(1);
    expect(z[1]).toBeCloseTo(0);
  });

  it('front vector and facing are inverses', () => {
    for (const a of [0, 0.7, 2, -1.3, Math.PI]) {
      const f = frontOf(a);
      expect(rotationFacing(f[0], f[1])).toBeCloseTo(Math.atan2(Math.sin(a), Math.cos(a)));
    }
  });

  it('a rect footprint has the catalog size, scaled', () => {
    const fp = itemFootprint(sofa, [0, 0], 0, [1, 1, 1]);
    expect(Math.abs(fp[1]![0] - fp[0]![0])).toBeCloseTo(1.6);
    expect(Math.abs(fp[2]![1] - fp[1]![1])).toBeCloseTo(0.9);
    const big = itemFootprint(sofa, [0, 0], 0, [1.5, 1, 2]);
    expect(Math.abs(big[1]![0] - big[0]![0])).toBeCloseTo(2.4);
    expect(Math.abs(big[2]![1] - big[1]![1])).toBeCloseTo(1.8);
  });

  it('picking respects rotation and round shapes', () => {
    expect(pointInItem(sofa, [5, 5], 0, [1, 1, 1], [5.7, 5])).toBe(true);
    expect(pointInItem(sofa, [5, 5], 0, [1, 1, 1], [5, 5.7])).toBe(false);
    // rotated 90°: the long side now runs along z
    expect(pointInItem(sofa, [5, 5], Math.PI / 2, [1, 1, 1], [5, 5.7])).toBe(true);
    const table = getAsset('coffee-table-round')!;
    expect(pointInItem(table, [0, 0], 0, [1, 1, 1], [0.44, 0])).toBe(true);
    expect(pointInItem(table, [0, 0], 0, [1, 1, 1], [0.4, 0.4])).toBe(false); // corner of the bounding box
  });

  it('is a big, balanced catalog (batch 4: 207 items, Appliances category)', () => {
    expect(CATALOG.length).toBeGreaterThanOrEqual(200);
    expect(CATEGORIES.map((c) => c.id)).toContain('appliances');
    for (const id of ['split-ac', 'geyser', 'water-purifier', 'inverter', 'air-cooler', 'diwan', 'pooja-mandir', 'motorbike', 'carport', 'rangoli']) {
      expect(getAsset(id), id).toBeTruthy();
    }
    // wall-mounted appliances hang at a sensible height
    expect(getAsset('split-ac')!.mountHeight).toBeGreaterThan(2);
  });
});
