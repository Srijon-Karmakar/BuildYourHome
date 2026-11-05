import { describe, expect, it } from 'vitest';
import { createEmptyScene, loadScene, DOOR_STYLES, FRAME_COLORS } from '@hd/scene-schema';
import {
  addOpening,
  addWall,
  createEditor,
  createWallTool,
  setDefaults,
  setGround,
  setOpeningProps,
  setSceneName,
  setWallsProps,
  type Editor,
} from './index';

const mk = () => createEditor(createEmptyScene());
const L = (e: Editor) => e.getState().activeLevelId;
const scene = (e: Editor) => e.getState().scene;

function withDoor() {
  const e = mk();
  e.execute(addWall({ levelId: L(e), from: [0, 0], to: [8, 0] }));
  const wallId = Object.keys(scene(e).walls)[0]!;
  e.execute(addOpening({ wallId, type: 'door', offset: 4 }));
  return { e, wallId, id: Object.keys(scene(e).openings)[0]! };
}

describe('opening style and colours', () => {
  it('stores style, frame and leaf colour; the scene still validates', () => {
    const { e, id } = withDoor();
    e.execute(setOpeningProps(id, { style: 'panel', frameColor: FRAME_COLORS[1].id, leafColor: '#7a5238' }));
    expect(scene(e).openings[id]).toMatchObject({ style: 'panel', frameColor: '#2b2a28', leafColor: '#7a5238' });
    expect(loadScene(JSON.parse(JSON.stringify(scene(e)))).ok).toBe(true);
    expect(DOOR_STYLES).toContain('double');
  });

  it('old scenes without the new optional fields still load', () => {
    const { e } = withDoor();
    const plain = JSON.parse(JSON.stringify(scene(e)));
    const first = Object.values(plain.openings)[0] as { style?: string };
    expect(first.style).toBeUndefined();
    expect(loadScene(plain).ok).toBe(true);
  });

  it('a width that does not fit is skipped but the rest of the edit (style) still applies', () => {
    const { e, id } = withDoor();
    e.execute(addOpening({ wallId: Object.keys(scene(e).walls)[0]!, type: 'door', offset: 5.1 })); // neighbour
    const before = scene(e).openings[id]!.width;
    e.execute(setOpeningProps(id, { width: 6, style: 'glass' })); // 6 m cannot fit beside the neighbour
    const o = scene(e).openings[id]!;
    expect(o.width).toBe(before);
    expect(o.style).toBe('glass');
  });

  it('restyling is one undo step', () => {
    const { e, id } = withDoor();
    const before = scene(e);
    e.execute(setOpeningProps(id, { style: 'double', frameColor: '#2b2a28', leafColor: '#f1efea' }));
    e.undo();
    expect(scene(e)).toEqual(before);
  });
});

describe('per-side wall materials', () => {
  it('can paint one face without touching the other', () => {
    const e = mk();
    e.execute(addWall({ levelId: L(e), from: [0, 0], to: [4, 0] }));
    const id = Object.keys(scene(e).walls)[0]!;
    e.execute(setWallsProps([id], { materialA: { id: 'wall-brick-red' } }));
    expect(scene(e).walls[id]!.materialA.id).toBe('wall-brick-red');
    expect(scene(e).walls[id]!.materialB.id).toBe('paint-white');
  });
});

describe('home settings', () => {
  it('renames the home (trimmed, never empty)', () => {
    const e = mk();
    e.execute(setSceneName('  My villa  '));
    expect(scene(e).meta.name).toBe('My villa');
    expect(e.execute(setSceneName('   '))).toBe(false);
  });

  it('changes the ground', () => {
    const e = mk();
    e.execute(setGround({ id: 'ground-sand' }));
    expect(scene(e).terrain.groundMaterial.id).toBe('ground-sand');
  });

  it('new walls use the project thickness defaults; existing walls are untouched', () => {
    const e = mk();
    e.execute(addWall({ levelId: L(e), from: [0, 0], to: [4, 0] }));
    e.execute(setDefaults({ interiorThickness: 0.15, exteriorThickness: 0.3 }));
    e.execute(addWall({ levelId: L(e), from: [4, 0], to: [4, 3] }));
    e.execute(addWall({ levelId: L(e), from: [4, 3], to: [0, 3], kind: 'exterior' }));
    const t = Object.values(scene(e).walls).map((w) => [w.kind, w.thickness]);
    expect(t).toEqual([['interior', 0.115], ['interior', 0.15], ['exterior', 0.3]]);
  });

  it('clamps silly thickness defaults', () => {
    const e = mk();
    e.execute(setDefaults({ interiorThickness: 9 }));
    expect(scene(e).defaults!.interiorThickness).toBe(1);
  });
});

describe('wall tool kind', () => {
  it('draws Inside or Outside walls depending on the current setting', () => {
    const e = mk();
    let kind: 'interior' | 'exterior' = 'interior';
    const t = createWallTool(e, () => kind);
    t.click([0, 0], 'grid');
    t.click([4, 0], 'grid');
    kind = 'exterior';
    t.click([4, 3], 'grid');
    expect(Object.values(scene(e).walls).map((w) => w.kind)).toEqual(['interior', 'exterior']);
    expect(Object.values(scene(e).walls)[1]!.thickness).toBe(0.23);
  });
});
