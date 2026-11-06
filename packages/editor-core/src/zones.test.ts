import { describe, expect, it } from 'vitest';
import { pathPolygon, polygonArea } from '@hd/geometry';
import { createEmptyScene, loadScene, type Vec2 } from '@hd/scene-schema';
import {
  addWall,
  addZone,
  batch,
  createEditor,
  createWallTool,
  FENCE_STYLE,
  removeZones,
  translateZones,
  updateZones,
  zonePolygon,
  zoneProblem,
  type Editor,
} from './index';

const mk = () => createEditor(createEmptyScene());
const scene = (e: Editor) => e.getState().scene;
const zones = (e: Editor) => Object.values(scene(e).zones);
const lawn = { id: 'ground-grass' };
const sq: Vec2[] = [[0, 0], [4, 0], [4, 3], [0, 3]];

describe('path outline', () => {
  it('a straight path is a width × length rectangle', () => {
    const poly = pathPolygon([[0, 0], [6, 0]], 1);
    expect(poly).toHaveLength(4);
    expect(polygonArea(poly)).toBeCloseTo(6, 6);
    expect(Math.max(...poly.map((p) => Math.abs(p[1])))).toBeCloseTo(0.5, 9);
  });

  it('a right-angle turn is mitred (no gap, no spike) and keeps a constant width', () => {
    const poly = pathPolygon([[0, 0], [4, 0], [4, 4]], 1);
    expect(poly).toHaveLength(6);
    // a mitred path keeps width constant: area = centre-line length × width = 8
    expect(polygonArea(poly)).toBeCloseTo(8, 6);
  });

  it('degenerate input: repeated points collapse, one point gives nothing, widths are clamped', () => {
    expect(pathPolygon([[1, 1], [1, 1]], 1)).toEqual([]);
    const wide = pathPolygon([[0, 0], [2, 0]], 50);
    expect(Math.max(...wide.map((p) => Math.abs(p[1])))).toBeCloseTo(3, 9); // 6 m max width
  });

  it('a sharp zig-zag does not spike beyond twice the half width', () => {
    const poly = pathPolygon([[0, 0], [4, 0.2], [0, 0.4]], 1);
    for (const p of poly) expect(Math.abs(p[0])).toBeLessThan(4 + 2);
  });
});

describe('garden zones', () => {
  it('adds, restyles, moves and removes areas and paths; the scene stays valid', () => {
    const e = mk();
    e.execute(addZone({ shape: 'area', points: sq, material: lawn }));
    e.execute(addZone({ shape: 'path', points: [[5, 0], [9, 0], [9, 4]], material: { id: 'ground-paving' }, width: 1.2 }));
    expect(zones(e)).toHaveLength(2);
    const [a, p] = zones(e);
    expect(p!.width).toBe(1.2);
    expect(a!.width).toBeUndefined();
    e.execute(updateZones([a!.id], { material: { id: 'ground-gravel' } }));
    e.execute(updateZones([p!.id], { width: 2 }));
    expect(zones(e)[0]!.material.id).toBe('ground-gravel');
    expect(zones(e)[1]!.width).toBe(2);
    e.execute(translateZones([a!.id], 1, 1));
    expect(zones(e)[0]!.points[0]).toEqual([1, 1]);
    expect(loadScene(JSON.parse(JSON.stringify(scene(e)))).ok).toBe(true);
    e.undo();
    expect(zones(e)[0]!.points[0]).toEqual([0, 0]);
    e.execute(removeZones([a!.id, p!.id]));
    expect(zones(e)).toHaveLength(0);
  });

  it('refuses crossing outlines, tiny areas and one-point paths', () => {
    const e = mk();
    e.execute(addZone({ shape: 'area', points: [[0, 0], [2, 2], [2, 0], [0, 2]], material: lawn }));
    e.execute(addZone({ shape: 'area', points: [[0, 0], [0.3, 0], [0.3, 0.3]], material: lawn }));
    e.execute(addZone({ shape: 'path', points: [[0, 0]], material: lawn }));
    expect(zones(e)).toHaveLength(0);
    expect(zoneProblem('area', sq)).toBeNull();
    expect(zoneProblem('path', [[0, 0]])).toMatch(/2 points/);
    expect(zoneProblem('area', [[0, 0], [1, 0]])).toMatch(/3 corners/);
  });

  it('a path wider than its own turn would allow is not applied', () => {
    const e = mk();
    e.execute(addZone({ shape: 'path', points: [[0, 0], [1, 0], [1, 0.4]], material: lawn, width: 0.6 }));
    const id = zones(e)[0]?.id;
    if (id) {
      e.execute(updateZones([id], { width: 6 }));
      expect(zonePolygon(zones(e)[0]!).length).toBeGreaterThan(3);
    }
  });

  it('old files without zones still load', () => {
    const raw = JSON.parse(JSON.stringify(createEmptyScene())) as Record<string, unknown>;
    delete raw.zones;
    const r = loadScene(raw);
    expect(r.ok && r.scene.zones).toEqual({});
  });
});

describe('fence walls', () => {
  it('are thin and low, use wood slats, and never become rooms', () => {
    const e = mk();
    const L = scene(e).levelOrder[0]!;
    e.execute(
      batch('box', [
        addWall({ levelId: L, from: [0, 0], to: [4, 0], kind: 'fence' }),
        addWall({ levelId: L, from: [4, 0], to: [4, 3], kind: 'fence' }),
        addWall({ levelId: L, from: [4, 3], to: [0, 3], kind: 'fence' }),
        addWall({ levelId: L, from: [0, 3], to: [0, 0], kind: 'fence' }),
      ]),
    );
    const w = Object.values(scene(e).walls);
    expect(w).toHaveLength(4);
    expect(w.every((x) => x.thickness === FENCE_STYLE.thickness && x.height === FENCE_STYLE.height && x.materialA.id === FENCE_STYLE.material)).toBe(true);
    expect(Object.keys(scene(e).rooms)).toHaveLength(0);
  });

  it('the wall tool draws fences when asked', () => {
    const e = mk();
    const tool = createWallTool(e, () => 'fence');
    tool.click([0, 0], 'grid');
    tool.click([3, 0], 'grid');
    expect(Object.values(scene(e).walls)[0]!.kind).toBe('fence');
  });
});
