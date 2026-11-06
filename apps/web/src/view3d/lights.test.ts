import { describe, expect, it } from 'vitest';
import { createEditor } from '@hd/editor-core';
import { addItem, addLevel, setLevelProps } from '@hd/editor-core';
import { createEmptyScene } from '@hd/scene-schema';
import { lampLevel, lampsOf, nearestLamps } from './lights';
import { sunAt } from './sun';
import { TIERS } from './qualityLogic';

function sceneWith() {
  const e = createEditor(createEmptyScene());
  const L = e.getState().activeLevelId;
  e.execute(addItem({ levelId: L, assetId: 'floor-lamp', position: [1, 0, 1] }));
  e.execute(addItem({ levelId: L, assetId: 'ceiling-light', position: [4, 3, 1] }));
  e.execute(addItem({ levelId: L, assetId: 'wall-sconce', position: [0, 1.7, 5], rotationY: 0 }));
  e.execute(addItem({ levelId: L, assetId: 'sofa-2', position: [2, 0, 2] })); // not a light
  return e.getState().scene;
}

describe('lamps', () => {
  it('finds only the light-giving items and places each at a sensible height', () => {
    const lamps = lampsOf(sceneWith());
    expect(lamps).toHaveLength(3);
    const byId = (re: RegExp) => lamps.find((l) => re.test(l.id))!;
    const heights = lamps.map((l) => l.pos[1]).sort((a, b) => a - b);
    expect(heights[0]).toBeCloseTo(1.44, 1); // floor lamp: 90 % of its 1.6 m
    expect(heights[1]).toBeCloseTo(1.7, 2); // wall light at its mount height
    expect(heights[2]).toBeCloseTo(2.86, 2); // ceiling light hangs 14 cm below the 3 m ceiling
    expect(byId(/./)).toBeTruthy();
  });

  it('upper-floor lamps sit at the upper floor height', () => {
    const e = createEditor(createEmptyScene());
    e.execute(addLevel());
    const up = e.getState().scene.levelOrder[1]!;
    e.execute(setLevelProps(up, { height: 2.8 }));
    e.execute(addItem({ levelId: up, assetId: 'ceiling-light', position: [0, 2.8, 0] }));
    const l = lampsOf(e.getState().scene)[0]!;
    expect(l.pos[1]).toBeCloseTo(3 + 2.8 - 0.14, 2);
  });

  it('picks the nearest lamps to the camera', () => {
    const lamps = lampsOf(sceneWith());
    const near = nearestLamps(lamps, [1, 1.5, 1], 2);
    expect(near).toHaveLength(2);
    expect(near[0]!.pos[0]).toBeCloseTo(1, 5);
    expect(nearestLamps(lamps, [0, 0, 0], 0)).toEqual([]);
    expect(nearestLamps(lamps, [0, 0, 0], 99)).toHaveLength(3);
  });

  it('auto lamps come on as daylight fades; on / off are absolute', () => {
    expect(lampLevel('auto', sunAt(12))).toBe(0);
    expect(lampLevel('auto', sunAt(23))).toBe(1);
    const dusk = lampLevel('auto', sunAt(17.8));
    expect(dusk).toBeGreaterThan(0);
    expect(dusk).toBeLessThan(1);
    expect(lampLevel('on', sunAt(12))).toBe(1);
    expect(lampLevel('off', sunAt(23))).toBe(0);
  });

  it('real lights are limited per quality tier (Low: glow only)', () => {
    expect(TIERS.low.lamps).toBe(0);
    expect(TIERS.medium.lamps).toBeGreaterThan(0);
    expect(TIERS.high.lamps).toBeGreaterThanOrEqual(TIERS.medium.lamps);
  });
});
