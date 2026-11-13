import { describe, expect, it } from 'vitest';
import { createEmptyScene } from '@hd/scene-schema';
import { createEditor, addWall, batch, addItem } from '@hd/editor-core';
import { TERRAIN_AMPLITUDE_M, TERRAIN_FADE, terrainFlatRect, terrainGrid, terrainHeight } from './terrain';

function house() {
  const e = createEditor(createEmptyScene());
  const L = e.getState().scene.levelOrder[0]!;
  e.execute(batch('loop', ([[-5, -4], [5, -4], [5, 4], [-5, 4]] as [number, number][]).map((p, i, a) => addWall({ levelId: L, from: p, to: a[(i + 1) % 4]!, kind: 'exterior' }))));
  return e;
}

describe('terrain relief', () => {
  it('keeps everything placed on flat ground, with a margin', () => {
    const e = house();
    const flat = terrainFlatRect(e.getState().scene);
    expect(flat[0]).toBeLessThanOrEqual(-5 - 10 - 8);
    expect(flat[3]).toBeGreaterThanOrEqual(4 + 10 + 8);
    for (const [x, z] of [[0, 0], [-15, 0], [12, 10], [flat[0], flat[1]]] as const) expect(terrainHeight(x, z, flat)).toBe(0);
  });

  it('an item placed far out grows the flat area so it does not float', () => {
    const e = house();
    const L = e.getState().scene.levelOrder[0]!;
    e.execute(addItem({ levelId: L, assetId: 'tree-neem', position: [40, 0, 0] }));
    const flat = terrainFlatRect(e.getState().scene);
    expect(flat[2]).toBeGreaterThan(40);
    expect(terrainHeight(40, 0, flat)).toBe(0);
  });

  it('rolls gently between the flat area and the far ring, then settles back to flat', () => {
    const flat = terrainFlatRect(house().getState().scene);
    let max = 0, min = 0;
    const varied = new Set<number>();
    for (let x = -60; x <= 60; x += 1.5) for (let z = -60; z <= 60; z += 1.5) {
      const h = terrainHeight(x, z, flat);
      max = Math.max(max, h);
      min = Math.min(min, h);
      varied.add(Math.round(h * 20));
    }
    expect(max).toBeGreaterThan(0.2);
    expect(max).toBeLessThanOrEqual(TERRAIN_AMPLITUDE_M + 1e-9);
    expect(min).toBeGreaterThan(-TERRAIN_AMPLITUDE_M);
    expect(varied.size).toBeGreaterThan(8);
    expect(terrainHeight(TERRAIN_FADE[1] + 1, 0, flat)).toBe(0);
    // gentle: no step bigger than 12 cm over half a metre
    for (let x = 20; x < 60; x += 0.5) expect(Math.abs(terrainHeight(x + 0.5, 7, flat) - terrainHeight(x, 7, flat))).toBeLessThan(0.12);
  });

  it('builds an up-facing grid', () => {
    const flat = terrainFlatRect(house().getState().scene);
    const g = terrainGrid(flat, 10, -0.01);
    expect(g.positions.length).toBe(11 * 11 * 3);
    expect(g.indices.length).toBe(10 * 10 * 6);
    const [a, b, c] = [g.indices[0]!, g.indices[1]!, g.indices[2]!].map((i) => [g.positions[i * 3]!, g.positions[i * 3 + 1]!, g.positions[i * 3 + 2]!]);
    const ny = (b![2]! - a![2]!) * (c![0]! - a![0]!) - (b![0]! - a![0]!) * (c![2]! - a![2]!);
    expect(ny).toBeGreaterThan(0);
  });
});
