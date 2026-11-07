import { describe, expect, it } from 'vitest';
import { createEmptyScene, Scene, type Id } from '@hd/scene-schema';
import {
  addItem,
  addZone,
  applyEnvironmentLook,
  COMPASS_SIDES,
  createEditor,
  ENVIRONMENT_LOOKS,
  encodeEnvironment,
  planTreeRing,
  resetEnvironment,
  resolveEnvironment,
  setPlot,
  setScenery,
  updateEnvironment,
} from './index';

const mk = () => createEditor(createEmptyScene());
const env = (e: ReturnType<typeof mk>) => resolveEnvironment(e.getState().scene.lighting);

describe('environment defaults', () => {
  it('a new home is open flat land: no hills or mountains anywhere, a little haze, birds, some ground detail', () => {
    const r = env(mk());
    for (const s of COMPASS_SIDES) expect(r.sides[s].kind).toBe('plains');
    expect(r).toMatchObject({ clouds: null, haze: 'light', sky: 'natural', birds: true, detail: 'some', trees: 'none' });
    expect(encodeEnvironment(r)).toBeUndefined(); // nothing stored for the defaults
  });

  it('older homes keep what they showed: a stored horizon becomes the scenery on all sides', () => {
    const scene = createEmptyScene();
    scene.lighting.horizon = 'hills';
    expect(resolveEnvironment(scene.lighting).sides.south.kind).toBe('hills');
    scene.lighting.horizon = 'city';
    expect(resolveEnvironment(scene.lighting).sides.north.kind).toBe('city');
    scene.lighting.horizon = 'none';
    expect(resolveEnvironment(scene.lighting).sides.east.kind).toBe('plains');
    // once an environment exists the old horizon is ignored
    scene.lighting.horizon = 'hills';
    scene.lighting.environment = { birds: false };
    expect(resolveEnvironment(scene.lighting).sides.west.kind).toBe('plains');
  });

  it('the schema accepts the new fields and rejects bad ones', () => {
    const scene = createEmptyScene();
    scene.lighting.environment = { sides: { north: { kind: 'mountains', height: 1.3, tone: 'rocky', snow: true } }, clouds: 'many', trees: 'dense', treeKind: 'pine' };
    expect(Scene.safeParse(scene).success).toBe(true);
    scene.lighting.environment = { sides: { north: { kind: 'volcano' as never } } };
    expect(Scene.safeParse(scene).success).toBe(false);
  });
});

describe('environment commands', () => {
  it('scenery is set per side, or on all sides, and undo restores', () => {
    const e = mk();
    e.execute(setScenery('north', { kind: 'mountains', snow: true }));
    expect(env(e).sides.north).toMatchObject({ kind: 'mountains', snow: true });
    expect(env(e).sides.south.kind).toBe('plains');
    e.execute(setScenery('all', { kind: 'forest' }));
    expect(COMPASS_SIDES.every((s) => env(e).sides[s].kind === 'forest')).toBe(true);
    expect(env(e).sides.north.snow).toBe(true); // other settings of a side are kept when its kind changes
    e.undo();
    expect(env(e).sides.south.kind).toBe('plains');
    expect(env(e).sides.north.kind).toBe('mountains');
  });

  it('height is clamped, defaults are not stored, and going back to defaults removes the setting', () => {
    const e = mk();
    e.execute(setScenery('east', { kind: 'hills', height: 9 }));
    expect(env(e).sides.east.height).toBe(1.8);
    e.execute(setScenery('east', { height: 0.01 }));
    expect(env(e).sides.east.height).toBe(0.4);
    e.execute(setScenery('east', { height: 1 }));
    expect(e.getState().scene.lighting.environment?.sides?.east).toEqual({ kind: 'hills' });
    e.execute(setScenery('east', { kind: 'plains' }));
    expect(e.getState().scene.lighting.environment).toBeUndefined();
  });

  it('sky, haze, clouds, birds, detail and trees are stored; null clouds hands the sky back to the weather', () => {
    const e = mk();
    e.execute(updateEnvironment({ clouds: 'many', haze: 'misty', sky: 'deep', birds: false, detail: 'lots', trees: 'dense', treeKind: 'palm' }));
    expect(env(e)).toMatchObject({ clouds: 'many', haze: 'misty', sky: 'deep', birds: false, detail: 'lots', trees: 'dense', treeKind: 'palm' });
    e.execute(updateEnvironment({ clouds: null }));
    expect(env(e).clouds).toBeNull();
  });

  it('changing the environment takes the old horizon over, so nothing changes by surprise', () => {
    const scene = createEmptyScene();
    scene.lighting.horizon = 'hills';
    const e2 = createEditor(scene);
    e2.execute(updateEnvironment({ birds: false }));
    const lighting = e2.getState().scene.lighting;
    expect(lighting.horizon).toBeUndefined();
    expect(resolveEnvironment(lighting).sides.north.kind).toBe('hills');
  });

  it('every ready-made look is valid; applying one replaces the environment (not the weather or ground); reset goes back to flat land', () => {
    const e = mk();
    for (const look of ENVIRONMENT_LOOKS) {
      const scene = createEmptyScene();
      scene.lighting.environment = look.settings;
      expect(Scene.safeParse(scene).success, look.id).toBe(true);
    }
    e.execute(updateEnvironment({ birds: false, detail: 'lots' }));
    const ground = e.getState().scene.terrain.groundMaterial.id;
    e.execute(applyEnvironmentLook('hills'));
    expect(env(e).sides.north).toMatchObject({ kind: 'mountains', snow: true });
    expect(env(e).birds).toBe(true); // replaced, not merged
    expect(e.getState().scene.terrain.groundMaterial.id).toBe(ground);
    e.execute(applyEnvironmentLook('plains'));
    expect(e.getState().scene.lighting.environment).toBeUndefined();
    e.execute(applyEnvironmentLook('desert'));
    e.execute(resetEnvironment());
    expect(e.getState().scene.lighting.environment).toBeUndefined();
    e.execute(applyEnvironmentLook('nope'));
    expect(e.getState().scene.lighting.environment).toBeUndefined();
  });
});

describe('ring of trees', () => {
  const plot: Array<[number, number]> = [[-10, -8], [10, -8], [10, 8], [-10, 8]];
  const inPlot = (x: number, z: number) => x > -10 && x < 10 && z > -8 && z < 8;

  it('none = no trees; sparse and dense stand outside the plot, dense has more, the same home gives the same trees', () => {
    const e = mk();
    e.execute(setPlot(plot));
    const scene = e.getState().scene;
    expect(planTreeRing(scene, { trees: 'none', treeKind: 'mixed' })).toHaveLength(0);
    const sparse = planTreeRing(scene, { trees: 'sparse', treeKind: 'mixed' });
    const dense = planTreeRing(scene, { trees: 'dense', treeKind: 'mixed' });
    expect(sparse.length).toBeGreaterThan(6);
    expect(dense.length).toBeGreaterThan(sparse.length * 1.5);
    for (const t of dense) expect(inPlot(t.x, t.z), `${t.x},${t.z}`).toBe(false);
    expect(planTreeRing(scene, { trees: 'dense', treeKind: 'mixed' })).toEqual(dense);
  });

  it('the kind of tree is respected', () => {
    const e = mk();
    e.execute(setPlot(plot));
    expect(new Set(planTreeRing(e.getState().scene, { trees: 'dense', treeKind: 'palm' }).map((t) => t.asset))).toEqual(new Set(['tree-palm']));
    expect(planTreeRing(e.getState().scene, { trees: 'dense', treeKind: 'mixed' }).some((t) => t.asset !== 'tree-palm')).toBe(true);
  });

  it('keeps off roads, their pavements and buildings', () => {
    const e = mk();
    e.execute(setPlot(plot));
    e.execute(addZone({ shape: 'road', points: [[-40, 13], [40, 13]], material: { id: 'ground-asphalt' }, width: 6 }));
    e.execute(addItem({ levelId: e.getState().scene.levelOrder[0]! as Id, assetId: 'neighbour-villa', position: [-16, 0, 0] }));
    const trees = planTreeRing(e.getState().scene, { trees: 'dense', treeKind: 'mixed' });
    expect(trees.length).toBeGreaterThan(5);
    for (const t of trees) {
      expect(Math.abs(t.z - 13) > 3 + 1.5, 'on the road or pavement').toBe(true);
      expect(Math.hypot(t.x + 16, t.z) > 5, 'on the building').toBe(true);
    }
  });
});
