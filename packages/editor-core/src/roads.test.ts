import { describe, expect, it } from 'vitest';
import { createEmptyScene } from '@hd/scene-schema';
import { addZone, createEditor, roadStyleFor, ROAD_PRESETS, translateZones, updateZones, zonePolygon, zoneProblem } from './index';

const mk = () => createEditor(createEmptyScene());
const road = (e: ReturnType<typeof mk>) => Object.values(e.getState().scene.zones).find((z) => z.shape === 'road')!;

describe('roads', () => {
  it('a road is drawn like a path, keeps a width and starts from the Street look', () => {
    const e = mk();
    e.execute(addZone({ shape: 'road', points: [[0, 0], [20, 0], [20, 15]], material: { id: 'ground-asphalt' }, width: 7 }));
    const r = road(e);
    expect(r.width).toBe(7);
    expect(r.road).toMatchObject({ lanes: 2, centre: 'dashed', kerb: 0.12, pavLeft: 1.5, pavRight: 1.5 });
    expect(r.material.id).toBe('ground-asphalt');
    e.undo();
    expect(Object.keys(e.getState().scene.zones)).toHaveLength(0);
  });

  it('presets give a width and the usual markings; main roads and avenues get street lights', () => {
    expect(ROAD_PRESETS.map((p) => p.id)).toEqual(['lane', 'street', 'main', 'avenue']);
    const lane = roadStyleFor('lane');
    expect(lane.width).toBe(3.5);
    expect(lane.style.pavLeft).toBe(0);
    expect(lane.style.extras).toHaveLength(0);
    const avenue = roadStyleFor('avenue');
    expect(avenue.style.lanes).toBe(4);
    expect(avenue.style.extras[0]).toMatchObject({ kind: 'light', side: 'both' });
  });

  it('width and style edits are clamped and merged, one undo step each', () => {
    const e = mk();
    e.execute(addZone({ shape: 'road', points: [[0, 0], [30, 0]], material: { id: 'ground-asphalt' } }));
    const id = road(e).id;
    e.execute(updateZones([id], { width: 99 }));
    expect(road(e).width).toBe(24);
    e.execute(updateZones([id], { width: 1 }));
    expect(road(e).width).toBe(2.5);
    e.execute(updateZones([id], { road: { lanes: 9, kerb: 5, pavLeft: -3, crossings: [0.5, 2], extras: [{ kind: 'tree', side: 'alternate', spacing: 1, asset: 'tree-neem' }] } }));
    expect(road(e).road).toMatchObject({ lanes: 6, kerb: 0.25, pavLeft: 0, crossings: [0.5, 1], centre: 'dashed' });
    expect(road(e).road!.extras[0]!.spacing).toBe(3);
    e.undo();
    expect(road(e).road!.lanes).toBe(2);
  });

  it('the selectable outline includes the pavements; moving a road moves its points; a folded road is refused', () => {
    const e = mk();
    e.execute(addZone({ shape: 'road', points: [[0, 0], [30, 0]], material: { id: 'ground-asphalt' }, width: 6 }));
    const r = road(e);
    const poly = zonePolygon(r);
    const zs = poly.map((p) => p[1]);
    expect(Math.max(...zs)).toBeCloseTo(3 + 1.5);
    expect(Math.min(...zs)).toBeCloseTo(-3 - 1.5);
    e.execute(translateZones([r.id], 5, 2));
    expect(road(e).points[0]).toEqual([5, 2]);
    expect(zoneProblem('road', [[0, 0]])).toMatch(/at least 2/);
    expect(zoneProblem('road', [[0, 0], [10, 0], [0, 0.4]], 8)).toMatch(/folds/);
    e.execute(addZone({ shape: 'road', points: [[0, 0]], material: { id: 'ground-asphalt' } }));
    expect(Object.keys(e.getState().scene.zones)).toHaveLength(1); // the one-point road was ignored
  });

  it('roads validate and survive save / load', async () => {
    const { loadScene } = await import('@hd/scene-schema');
    const e = mk();
    e.execute(addZone({ shape: 'road', points: [[0, 0], [30, 0]], material: { id: 'ground-asphalt' } }));
    const r = loadScene(JSON.parse(JSON.stringify(e.getState().scene)));
    expect(r.ok).toBe(true);
  });
});
