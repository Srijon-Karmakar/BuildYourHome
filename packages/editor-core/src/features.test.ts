import { describe, expect, it } from 'vitest';
import { createEmptyScene, loadScene } from '@hd/scene-schema';
import { addItem, createEditor, setItemsProps, setItemsSize, type Editor } from './index';

const mk = () => createEditor(createEmptyScene());
const scene = (e: Editor) => e.getState().scene;
const place = (e: Editor, assetId: string) => {
  e.execute(addItem({ levelId: e.getState().activeLevelId, assetId, position: [2, 0, 2] }));
  return Object.keys(scene(e).items).at(-1)!;
};

describe('wall features and curtains on items', () => {
  it('feature settings merge, null drops one, null resets all, and the scene validates', () => {
    const e = mk();
    const id = place(e, 'feature-curved');
    e.execute(setItemsProps([id], { feature: { material: 'wall-brick-grey', curve: -60, cap: true } }));
    expect(scene(e).items[id]!.feature).toEqual({ material: 'wall-brick-grey', curve: -60, cap: true });
    e.execute(setItemsProps([id], { feature: { cap: null } }));
    expect(scene(e).items[id]!.feature).toEqual({ material: 'wall-brick-grey', curve: -60 });
    expect(loadScene(JSON.parse(JSON.stringify(scene(e)))).ok).toBe(true);
    const bad = JSON.parse(JSON.stringify(scene(e)));
    bad.items[id].feature.curve = 400;
    expect(loadScene(bad).ok).toBe(false);
    e.execute(setItemsProps([id], { feature: null }));
    expect(scene(e).items[id]!.feature).toBeUndefined();
  });

  it('thickness is the depth axis, width and height their own, all within 0.1-8', () => {
    const e = mk();
    const id = place(e, 'feature-box');
    e.execute(setItemsSize([id], { panelWidth: 2, panelHeight: 1.5, panelDepth: 3 }));
    expect(scene(e).items[id]!.scale).toEqual([2, 1.5, 3]);
    e.execute(setItemsSize([id], { panelDepth: 99 }));
    expect(scene(e).items[id]!.scale[2]).toBe(8);
  });

  it('curtain settings merge, reset, validate; a bad colour or fullness is refused', () => {
    const e = mk();
    const id = place(e, 'curtain');
    e.execute(setItemsProps([id], { curtain: { style: 'eyelet', open: 0.6, fullness: 2.8, rod: 'track', sheer: true, sheerColor: '#e0e8f0', rodColor: '#2b2a28' } }));
    expect(scene(e).items[id]!.curtain).toMatchObject({ style: 'eyelet', open: 0.6, rod: 'track', sheer: true });
    e.execute(setItemsProps([id], { curtain: { open: null, sheer: null } }));
    expect(scene(e).items[id]!.curtain).not.toHaveProperty('open');
    expect(loadScene(JSON.parse(JSON.stringify(scene(e)))).ok).toBe(true);
    const bad = JSON.parse(JSON.stringify(scene(e)));
    bad.items[id].curtain.rodColor = 'gold';
    expect(loadScene(bad).ok).toBe(false);
    bad.items[id].curtain.rodColor = '#c9a47a';
    bad.items[id].curtain.fullness = 9;
    expect(loadScene(bad).ok).toBe(false);
    e.execute(setItemsProps([id], { curtain: null }));
    expect(scene(e).items[id]!.curtain).toBeUndefined();
  });
});
