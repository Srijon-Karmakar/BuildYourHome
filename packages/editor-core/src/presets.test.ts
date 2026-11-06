import { getAsset } from '@hd/assets';
import { describe, expect, it } from 'vitest';
import { createEmptyScene, loadScene } from '@hd/scene-schema';
import {
  addWall,
  applyEnvironment,
  batch,
  clearEnvironment,
  createEditor,
  ENVIRONMENTS,
  environmentPieces,
  hasEnvironment,
  layoutItems,
  placeRoomPreset,
  presetFootprint,
  ROOM_PRESETS,
  turnOffset,
  type Editor,
} from './index';

const mk = () => createEditor(createEmptyScene());
const scene = (e: Editor) => e.getState().scene;
const L = (e: Editor) => scene(e).levelOrder[0]!;

describe('room presets', () => {
  it('every preset uses real catalog items and fits its items inside its walls', () => {
    for (const p of ROOM_PRESETS) {
      expect(p.items.length, p.id).toBeGreaterThan(0);
      for (const it of p.items) expect(getAsset(it.asset), `${p.id}: ${it.asset}`).toBeTruthy();
      for (const it of layoutItems(p)) {
        const a = getAsset(it.asset)!;
        const half = Math.max(a.size[0], a.size[1]) / 2;
        expect(Math.abs(it.pos[0]), `${p.id} ${it.asset} x`).toBeLessThanOrEqual(p.w / 2 - 0.1 + 0.001 + (half > 1 ? half : 0));
        expect(Math.abs(it.pos[1]), `${p.id} ${it.asset} z`).toBeLessThanOrEqual(p.d / 2 - 0.1 + 0.001 + (half > 1 ? half : 0));
      }
    }
  });

  it('placing one makes 4 walls, a named room with its floor, doors / windows and its furniture, in ONE undo step', () => {
    const e = mk();
    e.execute(placeRoomPreset({ levelId: L(e), presetId: 'bedroom', center: [0, 0] }));
    const s = scene(e);
    expect(Object.keys(s.walls)).toHaveLength(4);
    const room = Object.values(s.rooms)[0]!;
    expect(room.name).toBe('Bedroom');
    expect(room.type).toBe('bedroom');
    expect(room.floorMaterial.id).toBe('floor-wood-oak');
    expect(Object.values(s.openings).map((o) => o.type).sort()).toEqual(['door', 'window']);
    const assets = Object.values(s.items).map((i) => i.assetId);
    expect(assets).toEqual(expect.arrayContaining(['bed-double', 'nightstand', 'wardrobe', 'ceiling-light']));
    expect(loadScene(JSON.parse(JSON.stringify(s))).ok).toBe(true);
    e.undo();
    expect(Object.keys(scene(e).walls)).toHaveLength(0);
    expect(Object.keys(scene(e).items)).toHaveLength(0);
    expect(Object.keys(scene(e).rooms)).toHaveLength(0);
  });

  it('every preset can be placed (walls, a room, at least one opening) and turned by quarter-turns', () => {
    for (const p of ROOM_PRESETS) {
      for (const q of [0, 1, 2, 3]) {
        const e = mk();
        e.execute(placeRoomPreset({ levelId: L(e), presetId: p.id, center: [3, -2], quarters: q }));
        const s = scene(e);
        expect(Object.keys(s.walls).length, `${p.id}/${q}`).toBeGreaterThanOrEqual(4);
        expect(Object.values(s.rooms).some((r) => r.name === p.name), `${p.id}/${q} room`).toBe(true);
        expect(Object.keys(s.openings).length, `${p.id}/${q} openings`).toBeGreaterThan(0);
        expect(Object.keys(s.items).length, `${p.id}/${q} items`).toBeGreaterThanOrEqual(p.items.length);
      }
    }
  });

  it('a quarter-turn swaps the footprint and turns the furniture with it', () => {
    const p = ROOM_PRESETS.find((x) => x.id === 'living')!;
    const f0 = presetFootprint(p, [0, 0], 0);
    const f1 = presetFootprint(p, [0, 0], 1);
    const width = (f: number[][]) => Math.max(...f.map((c) => c[0]!)) - Math.min(...f.map((c) => c[0]!));
    expect(width(f0 as number[][])).toBeCloseTo(p.w, 6);
    expect(width(f1 as number[][])).toBeCloseTo(p.d, 6);
    expect(turnOffset([2, 1], 1)).toEqual([-1, 2]);
    expect(turnOffset([2, 1], 4)).toEqual([2, 1]);
    const e = mk();
    e.execute(placeRoomPreset({ levelId: L(e), presetId: 'study', center: [0, 0], quarters: 1 }));
    const desk = Object.values(scene(e).items).find((i) => i.assetId === 'desk')!;
    expect(desk.rotationY).toBeCloseTo(Math.PI / 2, 6); // it faced south (0); a quarter turn makes it face west
  });

  it('two presets side by side share the wall between them and stay valid', () => {
    const e = mk();
    const bed = ROOM_PRESETS.find((p) => p.id === 'bedroom')!;
    const bath = ROOM_PRESETS.find((p) => p.id === 'bathroom')!;
    e.execute(placeRoomPreset({ levelId: L(e), presetId: 'bedroom', center: [0, 0] }));
    e.execute(placeRoomPreset({ levelId: L(e), presetId: 'bathroom', center: [bed.w / 2 + bath.w / 2, 0] }));
    const s = scene(e);
    expect(Object.values(s.rooms).map((r) => r.name).sort()).toEqual(['Bathroom', 'Bedroom']);
    expect(loadScene(JSON.parse(JSON.stringify(s))).ok).toBe(true);
  });

  it('unknown presets and floors are ignored', () => {
    const e = mk();
    e.execute(placeRoomPreset({ levelId: L(e), presetId: 'nope', center: [0, 0] }));
    e.execute(placeRoomPreset({ levelId: 'nope', presetId: 'bedroom', center: [0, 0] }));
    expect(Object.keys(scene(e).walls)).toHaveLength(0);
  });
});

describe('environments', () => {
  const house = (e: Editor) =>
    e.execute(
      batch('house', [
        addWall({ levelId: L(e), from: [0, 0], to: [8, 0], kind: 'exterior' }),
        addWall({ levelId: L(e), from: [8, 0], to: [8, 6], kind: 'exterior' }),
        addWall({ levelId: L(e), from: [8, 6], to: [0, 6], kind: 'exterior' }),
        addWall({ levelId: L(e), from: [0, 6], to: [0, 0], kind: 'exterior' }),
      ]),
    );

  it('every environment only uses real catalog items and none lands on top of the house', () => {
    for (const env of ENVIRONMENTS) {
      const pieces = environmentPieces(env.id, [0, 0], [8, 6]);
      expect(pieces.length, env.id).toBeGreaterThan(5);
      for (const p of pieces) {
        expect(getAsset(p.asset), `${env.id}: ${p.asset}`).toBeTruthy();
        const a = getAsset(p.asset)!;
        if (a.category === 'scenery' && !/(road|pond|pavement|hill|mound)/.test(p.asset)) {
          const clear = p.x < -1 || p.x > 9 || p.z < -1 || p.z > 7;
          expect(clear, `${env.id}: ${p.asset} at ${p.x},${p.z}`).toBe(true);
        }
      }
    }
  });

  it('applies ground + scenery in one step, replaces an earlier preset, keeps your own items, and clears', () => {
    const e = mk();
    house(e);
    e.execute(applyEnvironment('suburb'));
    expect(scene(e).terrain.groundMaterial.id).toBe('ground-grass');
    const n1 = Object.values(scene(e).items).filter((i) => i.tag === 'env').length;
    expect(n1).toBeGreaterThan(5);
    expect(hasEnvironment(scene(e))).toBe(true);
    e.execute(applyEnvironment('village'));
    expect(scene(e).terrain.groundMaterial.id).toBe('ground-soil');
    expect(Object.values(scene(e).items).some((i) => i.assetId === 'neighbour-modern')).toBe(false);
    expect(Object.values(scene(e).items).some((i) => i.assetId === 'neighbour-hut')).toBe(true);
    e.undo();
    expect(scene(e).terrain.groundMaterial.id).toBe('ground-grass');
    expect(Object.values(scene(e).items).filter((i) => i.tag === 'env')).toHaveLength(n1);
    e.execute(clearEnvironment());
    expect(hasEnvironment(scene(e))).toBe(false);
    expect(loadScene(JSON.parse(JSON.stringify(scene(e)))).ok).toBe(true);
  });

  it('works with nothing drawn (around the origin)', () => {
    const e = mk();
    e.execute(applyEnvironment('city'));
    expect(Object.keys(scene(e).items).length).toBeGreaterThan(5);
  });
});
