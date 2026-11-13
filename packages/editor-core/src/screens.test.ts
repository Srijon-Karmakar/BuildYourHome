import { describe, expect, it } from 'vitest';
import { createEmptyScene, loadScene } from '@hd/scene-schema';
import { addItem, createEditor, setItemsProps, setItemsSize, type Editor } from './index';

const mk = () => createEditor(createEmptyScene());
const L = (e: Editor) => e.getState().activeLevelId;
const scene = (e: Editor) => e.getState().scene;
const place = (e: Editor, assetId: string, y = 1.5) => {
  e.execute(addItem({ levelId: L(e), assetId, position: [2, y, 2] }));
  return Object.keys(scene(e).items).at(-1)!;
};

describe('LED screen settings', () => {
  it('merges settings, drops a key set to null and clears the block when empty', () => {
    const e = mk();
    const id = place(e, 'led-screen');
    e.execute(setItemsProps([id], { screen: { show: 'text', text: 'SALE', scroll: true, color: '#112233' } }));
    expect(scene(e).items[id]!.screen).toEqual({ show: 'text', text: 'SALE', scroll: true, color: '#112233' });
    e.execute(setItemsProps([id], { screen: { text: 'OPEN', scroll: null } }));
    expect(scene(e).items[id]!.screen).toEqual({ show: 'text', text: 'OPEN', color: '#112233' });
    e.execute(setItemsProps([id], { screen: null }));
    expect(scene(e).items[id]!.screen).toBeUndefined();
    e.undo();
    expect(scene(e).items[id]!.screen?.text).toBe('OPEN');
  });

  it('the scene with screen settings still validates, and bad values are rejected', () => {
    const e = mk();
    const id = place(e, 'led-ticker');
    e.execute(setItemsProps([id], { screen: { show: 'gradient', color: '#ff0000', color2: '#0000ff', brightness: 1.5, bezel: 0.05, fit: 'contain' } }));
    expect(loadScene(JSON.parse(JSON.stringify(scene(e)))).ok).toBe(true);
    const bad = JSON.parse(JSON.stringify(scene(e)));
    bad.items[id].screen.brightness = 9;
    expect(loadScene(bad).ok).toBe(false);
    const evil = JSON.parse(JSON.stringify(scene(e)));
    evil.items[id].screen = { show: 'image', image: 'https://example.com/x.png' };
    expect(loadScene(evil).ok).toBe(false); // only embedded pictures, never a link that would be fetched on open
  });

  it('stretches width and height on their own, within 0.1-8, leaving the depth', () => {
    const e = mk();
    const id = place(e, 'led-video-wall');
    e.execute(setItemsSize([id], { panelWidth: 2.5, panelHeight: 0.5 }));
    expect(scene(e).items[id]!.scale).toEqual([2.5, 0.5, 1]);
    e.execute(setItemsSize([id], { panelWidth: 50, panelHeight: 0 }));
    expect(scene(e).items[id]!.scale).toEqual([8, 0.1, 1]);
  });

  it('height above the floor is clamped and ignores nonsense', () => {
    const e = mk();
    const id = place(e, 'ac-outdoor', 1.6);
    e.execute(setItemsProps([id], { elevation: 2.4 }));
    expect(scene(e).items[id]!.position).toEqual([2, 2.4, 2]);
    e.execute(setItemsProps([id], { elevation: 999 }));
    expect(scene(e).items[id]!.position[1]).toBe(40);
    e.execute(setItemsProps([id], { elevation: Number.NaN }));
    expect(scene(e).items[id]!.position[1]).toBe(40);
  });
});
