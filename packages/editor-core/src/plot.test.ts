import { describe, expect, it } from 'vitest';
import { isSimplePolygon, pointInPolygon } from '@hd/geometry';
import { createEmptyScene, loadScene, type Vec2 } from '@hd/scene-schema';
import {
  addLevel,
  addWall,
  batch,
  boundaryKind,
  cleanPolygon,
  createEditor,
  nodesOutsidePlot,
  plotAroundHouse,
  plotProblem,
  setBoundary,
  setPlot,
  setPlotAroundHouse,
  type Editor,
} from './index';

const mk = () => createEditor(createEmptyScene());
const scene = (e: Editor) => e.getState().scene;
const L = (e: Editor) => e.getState().activeLevelId;
const house = (e: Editor, x0 = 5, z0 = 4, x1 = 13, z1 = 10) =>
  e.execute(
    batch('house', [
      addWall({ levelId: L(e), from: [x0, z0], to: [x1, z0], kind: 'exterior' }),
      addWall({ levelId: L(e), from: [x1, z0], to: [x1, z1], kind: 'exterior' }),
      addWall({ levelId: L(e), from: [x1, z1], to: [x0, z1], kind: 'exterior' }),
      addWall({ levelId: L(e), from: [x0, z1], to: [x0, z0], kind: 'exterior' }),
    ]),
  );
const rect = (w: number, d: number): Vec2[] => [[0, 0], [w, 0], [w, d], [0, d]];

describe('polygon helpers', () => {
  it('isSimplePolygon: rectangles and L-shapes yes, bow-ties and spikes no', () => {
    expect(isSimplePolygon(rect(4, 3))).toBe(true);
    expect(isSimplePolygon([[0, 0], [6, 0], [6, 2], [2, 2], [2, 5], [0, 5]])).toBe(true);
    expect(isSimplePolygon([[0, 0], [4, 4], [4, 0], [0, 4]])).toBe(false); // bow-tie
    expect(isSimplePolygon([[0, 0], [2, 0]])).toBe(false);
    expect(isSimplePolygon([[0, 0], [4, 0], [4, 4], [2, 0], [0, 4]])).toBe(false); // touches itself
  });

  it('pointInPolygon: inside, outside, on the edge, concave notch', () => {
    const r = rect(4, 3);
    expect(pointInPolygon([2, 1.5], r)).toBe(true);
    expect(pointInPolygon([5, 1], r)).toBe(false);
    expect(pointInPolygon([4, 1], r)).toBe(true); // on the edge counts
    const l: Vec2[] = [[0, 0], [6, 0], [6, 2], [2, 2], [2, 5], [0, 5]];
    expect(pointInPolygon([1, 4], l)).toBe(true);
    expect(pointInPolygon([4, 4], l)).toBe(false); // the notch
  });

  it('cleanPolygon drops repeated points and a closing copy of the first', () => {
    expect(cleanPolygon([[0, 0], [0, 0], [4, 0], [4, 3], [0, 3], [0, 0]])).toEqual(rect(4, 3));
  });
});

describe('plot commands', () => {
  it('sets a valid plot, refuses invalid ones, removes it; everything undoes', () => {
    const e = mk();
    e.execute(setPlot(rect(20, 15)));
    expect(scene(e).plot?.boundary).toEqual(rect(20, 15));
    expect(e.execute(setPlot([[0, 0], [4, 4], [4, 0], [0, 4]]))).toBe(false); // self-crossing
    expect(e.execute(setPlot([[0, 0], [1, 0], [1, 1]]))).toBe(false); // < 4 m²
    expect(e.execute(setPlot([[0, 0], [5, 0]]))).toBe(false);
    expect(scene(e).plot?.boundary).toEqual(rect(20, 15));
    e.execute(setPlot(null));
    expect(scene(e).plot).toBeUndefined();
    e.undo();
    expect(scene(e).plot?.boundary).toEqual(rect(20, 15));
    expect(loadScene(JSON.parse(JSON.stringify(scene(e)))).ok).toBe(true);
  });

  it('plotProblem explains what is wrong', () => {
    expect(plotProblem(rect(10, 10))).toBeNull();
    expect(plotProblem([[0, 0], [1, 1]])).toMatch(/3 corners/);
    expect(plotProblem([[0, 0], [4, 4], [4, 0], [0, 4]])).toMatch(/crosses/);
    expect(plotProblem([[0, 0], [1, 0], [1, 1]])).toMatch(/small/);
  });

  it('plot around the house leaves the margin on every side, on a 5 cm grid', () => {
    const e = mk();
    house(e); // 5..13 x 4..10
    expect(plotAroundHouse(scene(e), 3)).toEqual([[2, 1], [16, 1], [16, 13], [2, 13]]);
    e.execute(setPlotAroundHouse(2.5));
    expect(scene(e).plot?.boundary).toEqual([[2.5, 1.5], [15.5, 1.5], [15.5, 12.5], [2.5, 12.5]]);
    expect(nodesOutsidePlot(scene(e))).toEqual([]);
  });

  it('with nothing drawn, "plot around the house" makes a default 20 × 15 m plot', () => {
    const e = mk();
    e.execute(setPlotAroundHouse());
    const [a, , c] = scene(e).plot!.boundary;
    expect([c![0] - a![0], c![1] - a![1]]).toEqual([20, 15]);
  });

  it('flags house points that stick out of the plot', () => {
    const e = mk();
    house(e);
    expect(nodesOutsidePlot(scene(e))).toEqual([]); // no plot, nothing to flag
    e.execute(setPlot([[0, 0], [10, 0], [10, 12], [0, 12]])); // house reaches x = 13
    const out = nodesOutsidePlot(scene(e)).map((id) => scene(e).nodes[id]!.p[0]);
    expect(out.sort()).toEqual([13, 13]);
  });
});

describe('boundary wall / fence', () => {
  it('adds boundary walls along every plot edge on the ground floor', () => {
    const e = mk();
    house(e);
    e.execute(setPlotAroundHouse(3));
    e.execute(setBoundary('wall'));
    const b = Object.values(scene(e).walls).filter((w) => w.kind === 'boundary');
    expect(b).toHaveLength(4);
    expect(b.every((w) => w.levelId === L(e) && w.thickness === 0.2 && w.height === 1.8 && w.materialA.id === 'wall-stone')).toBe(true);
    expect(boundaryKind(scene(e))).toBe('wall');
  });

  it('boundary walls never create rooms (and the house still has its own)', () => {
    const e = mk();
    house(e);
    expect(Object.keys(scene(e).rooms)).toHaveLength(1);
    e.execute(setPlotAroundHouse(3));
    e.execute(setBoundary('fence'));
    expect(Object.keys(scene(e).rooms)).toHaveLength(1);
  });

  it('switching wall → fence replaces the old boundary; none removes it and its points', () => {
    const e = mk();
    house(e);
    e.execute(setPlotAroundHouse(3));
    e.execute(setBoundary('wall'));
    e.execute(setBoundary('fence'));
    const b = Object.values(scene(e).walls).filter((w) => w.kind === 'boundary');
    expect(b).toHaveLength(4);
    expect(b.every((w) => w.height === 1.2 && w.thickness === 0.06 && w.materialA.id === 'wall-wood-panel')).toBe(true);
    expect(boundaryKind(scene(e))).toBe('fence');
    const nodesBefore = Object.keys(scene(e).nodes).length;
    e.execute(setBoundary('none'));
    expect(Object.values(scene(e).walls).filter((w) => w.kind === 'boundary')).toHaveLength(0);
    expect(Object.keys(scene(e).nodes).length).toBe(nodesBefore - 4);
    expect(boundaryKind(scene(e))).toBe('none');
  });

  it('does nothing without a plot; one undo step reverts it', () => {
    const e = mk();
    expect(e.execute(setBoundary('wall'))).toBe(false);
    e.execute(setPlot(rect(20, 15)));
    const before = scene(e);
    e.execute(setBoundary('wall'));
    e.undo();
    expect(scene(e)).toEqual(before);
  });

  it('the house is not counted as "outside" because of boundary points, and houseBounds ignores the boundary', () => {
    const e = mk();
    house(e);
    e.execute(setPlotAroundHouse(3));
    e.execute(setBoundary('wall'));
    e.execute(setPlotAroundHouse(3)); // recomputed from the house only: same rectangle, not bigger
    expect(scene(e).plot?.boundary).toEqual([[2, 1], [16, 1], [16, 13], [2, 13]]);
    e.execute(addLevel());
  });
});
