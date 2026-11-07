import { describe, expect, it } from 'vitest';
import { getAsset, itemFootprint } from '@hd/assets';
import { createEmptyScene, type Id } from '@hd/scene-schema';
import {
  addItem,
  addZone,
  clearStreet,
  createEditor,
  fillStreet,
  MAX_STREET_BUILDINGS,
  planStreet,
  removeZones,
  setHorizon,
  setPlot,
  setWeather,
  STREET_STYLES,
  streetItemCount,
  streetTag,
} from './index';

const mk = () => createEditor(createEmptyScene());
const addRoad = (e: ReturnType<typeof mk>, points: Array<[number, number]> = [[-60, 20], [60, 20]], width = 6): Id => {
  e.execute(addZone({ shape: 'road', points, material: { id: 'ground-asphalt' }, width }));
  return Object.values(e.getState().scene.zones).find((z) => z.shape === 'road')!.id;
};
const itemsOf = (e: ReturnType<typeof mk>, id: Id) => Object.values(e.getState().scene.items).filter((i) => i.tag === streetTag(id));

describe('neighbours along a road', () => {
  it('fills both sides, facing the road, outside the pavement, one undo step; filling again replaces', () => {
    const e = mk();
    const id = addRoad(e);
    e.execute(fillStreet(id, 'suburb', 1, { life: false }));
    const placed = itemsOf(e, id);
    expect(placed.length).toBeGreaterThan(8);
    const houses = placed.filter((i) => getAsset(i.assetId)!.tags.includes('neighbour'));
    expect(houses.length).toBeLessThanOrEqual(MAX_STREET_BUILDINGS);
    expect(houses.some((i) => i.position[2] < 20)).toBe(true); // north side
    expect(houses.some((i) => i.position[2] > 20)).toBe(true); // south side
    for (const h of houses) {
      const north = h.position[2] < 20;
      // The front (+z) points at the road: south-facing on the north side (rotation 0), north-facing on the south side.
      expect(Math.cos(h.rotationY), h.assetId).toBeCloseTo(north ? 1 : -1, 1);
      // Clear of the carriageway and the 1.5 m pavements.
      expect(Math.abs(h.position[2] - 20) - getAsset(h.assetId)!.size[1] / 2, h.assetId).toBeGreaterThan(3 + 1.5);
    }
    const first = placed.length;
    e.execute(fillStreet(id, 'suburb', 2, { life: false }));
    expect(itemsOf(e, id).length).not.toBe(0);
    expect(Object.values(e.getState().scene.items).filter((i) => i.tag?.startsWith('street:'))).toHaveLength(itemsOf(e, id).length);
    e.undo();
    expect(itemsOf(e, id)).toHaveLength(first); // back to the first fill
  });

  it('the same seed gives the same street; another seed gives another', () => {
    const e = mk();
    const id = addRoad(e);
    const a = planStreet(e.getState().scene, id, 'village', 5);
    const b = planStreet(e.getState().scene, id, 'village', 5);
    const c = planStreet(e.getState().scene, id, 'village', 6);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('no two buildings overlap, and nothing stands on the road or on your house', () => {
    const e = mk();
    const id = addRoad(e, [[-40, 12], [40, 12]], 8);
    // The plot (and with it the house) must stay clear.
    e.execute(setPlot([[-14, -10], [14, -10], [14, 8], [-14, 8]]));
    for (const style of STREET_STYLES) {
      const pieces = planStreet(e.getState().scene, id, style.id, 3);
      const boxes = pieces.filter((p) => getAsset(p.asset)!.tags.includes('neighbour')).map((p) => itemFootprint(getAsset(p.asset)!, [p.x, p.z], p.rot, [p.scale, p.scale, p.scale]));
      for (const poly of boxes) for (const v of poly) expect(v[0] >= -14 && v[0] <= 14 && v[1] >= -10 && v[1] <= 8, `${style.id} building corner inside the plot`).toBe(false);
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        const sep = Math.min(
          ...a.map((p) => Math.min(...b.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1])))),
        );
        expect(sep, `${style.id} ${i}/${j}`).toBeGreaterThan(0.2);
      }
    }
  });

  it('street life stays in the street and the tag lets Clear remove only this road\'s fill', () => {
    const e = mk();
    const id = addRoad(e, [[-50, 0], [50, 0]]);
    e.execute(addZone({ shape: 'road', points: [[-50, 60], [50, 60]], material: { id: 'ground-asphalt' }, width: 6 }));
    const other = Object.values(e.getState().scene.zones).find((z) => z.shape === 'road' && z.id !== id)!.id;
    e.execute(fillStreet(id, 'city', 4));
    e.execute(fillStreet(other, 'village', 4));
    const life = itemsOf(e, id).filter((i) => !getAsset(i.assetId)!.tags.includes('neighbour') && getAsset(i.assetId)!.category === 'scenery');
    expect(life.length).toBeGreaterThan(0);
    e.execute(clearStreet(id));
    expect(streetItemCount(e.getState().scene, id)).toBe(0);
    expect(streetItemCount(e.getState().scene, other)).toBeGreaterThan(0);
  });

  it('deleting the road takes its neighbours with it; a hand-placed item is never touched', () => {
    const e = mk();
    const id = addRoad(e);
    e.execute(fillStreet(id, 'bungalows', 1));
    e.execute(addItem({ levelId: e.getState().scene.levelOrder[0]!, assetId: 'bush', position: [0, 0, 0] }));
    const mine = Object.values(e.getState().scene.items).find((i) => !i.tag)!.id;
    e.execute(removeZones([id]));
    expect(Object.values(e.getState().scene.items).filter((i) => i.tag?.startsWith('street:'))).toHaveLength(0);
    expect(e.getState().scene.items[mine]).toBeTruthy();
    e.undo();
    expect(streetItemCount(e.getState().scene, id)).toBeGreaterThan(0);
  });

  it('unknown style or road does nothing; trees and life can be switched off', () => {
    const e = mk();
    const id = addRoad(e);
    e.execute(fillStreet(id, 'nope'));
    expect(streetItemCount(e.getState().scene, id)).toBe(0);
    e.execute(fillStreet('zone_missing' as Id, 'city'));
    const bare = planStreet(e.getState().scene, id, 'suburb', 1, { trees: false, life: false });
    expect(bare.every((p) => getAsset(p.asset)!.tags.includes('neighbour'))).toBe(true);
    const full = planStreet(e.getState().scene, id, 'suburb', 1);
    expect(full.length).toBeGreaterThan(bare.length);
  });
});

describe('weather', () => {
  it('is stored in the lighting, clear removes it, and undo restores', () => {
    const e = mk();
    expect(e.getState().scene.lighting.weather).toBeUndefined();
    e.execute(setWeather('rain'));
    expect(e.getState().scene.lighting.weather).toBe('rain');
    e.execute(setWeather('clear'));
    expect(e.getState().scene.lighting.weather).toBeUndefined();
    e.undo();
    expect(e.getState().scene.lighting.weather).toBe('rain');
  });

  it('the horizon defaults to hills; city and none are stored, hills clears', () => {
    const e = mk();
    e.execute(setHorizon('city'));
    expect(e.getState().scene.lighting.horizon).toBe('city');
    e.execute(setHorizon('none'));
    expect(e.getState().scene.lighting.horizon).toBe('none');
    e.execute(setHorizon('hills'));
    expect(e.getState().scene.lighting.horizon).toBeUndefined();
  });
});
