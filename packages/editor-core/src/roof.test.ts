import { describe, expect, it } from 'vitest';
import { createEmptyScene, loadScene } from '@hd/scene-schema';
import { addLevel, copyLevel, createEditor, removeLevel, setRoof, setLevelProps, type Editor } from './index';

const mk = () => createEditor(createEmptyScene());
const ground = (e: Editor) => e.getState().scene.levelOrder[0]!;
const roofs = (e: Editor) => Object.values(e.getState().scene.roofs);

describe('setRoof', () => {
  it('creates a default gable roof, then edits it in place (one roof per floor)', () => {
    const e = mk();
    e.execute(setRoof(ground(e), { style: 'gable' }));
    expect(roofs(e)).toHaveLength(1);
    expect(roofs(e)[0]).toMatchObject({ style: 'gable', pitchDeg: 25, overhang: 0.4, material: { id: 'roof-tile-terracotta' } });
    e.execute(setRoof(ground(e), { style: 'hip', pitchDeg: 35 }));
    expect(roofs(e)).toHaveLength(1);
    expect(roofs(e)[0]).toMatchObject({ style: 'hip', pitchDeg: 35, overhang: 0.4 });
  });

  it('clamps pitch and overhang; swap sets and clears the ridge turn', () => {
    const e = mk();
    e.execute(setRoof(ground(e), { style: 'gable', pitchDeg: 89, overhang: 9 }));
    expect(roofs(e)[0]).toMatchObject({ pitchDeg: 60, overhang: 1.5 });
    e.execute(setRoof(ground(e), { pitchDeg: 0, overhang: -2 }));
    expect(roofs(e)[0]).toMatchObject({ pitchDeg: 5, overhang: 0 });
    e.execute(setRoof(ground(e), { swap: true }));
    expect(roofs(e)[0]!.ridgeAngle).toBeCloseTo(Math.PI / 2);
    e.execute(setRoof(ground(e), { swap: false }));
    expect(roofs(e)[0]!.ridgeAngle).toBeUndefined();
  });

  it('changes the material and removes the roof; everything undoes', () => {
    const e = mk();
    const before = e.getState().scene;
    e.execute(setRoof(ground(e), { style: 'flat', materialId: 'roof-slate' }));
    expect(roofs(e)[0]!.material.id).toBe('roof-slate');
    e.execute(setRoof(ground(e), { style: 'none' }));
    expect(roofs(e)).toHaveLength(0);
    e.undo();
    e.undo();
    expect(e.getState().scene).toEqual(before);
  });

  it('ignores unknown floors; roofs validate and round-trip through save/load', () => {
    const e = mk();
    expect(e.execute(setRoof('nope', { style: 'gable' }))).toBe(false);
    e.execute(setRoof(ground(e), { style: 'shed', swap: true }));
    const r = loadScene(JSON.parse(JSON.stringify(e.getState().scene)));
    expect(r.ok && Object.values(r.scene.roofs)).toHaveLength(1);
  });

  it('adding or copying a floor moves the roof up to the new top floor', () => {
    const e = mk();
    e.execute(setRoof(ground(e), { style: 'hip', pitchDeg: 40 }));
    e.execute(addLevel());
    const top = e.getState().scene.levelOrder[1]!;
    expect(roofs(e)).toHaveLength(1);
    expect(roofs(e)[0]).toMatchObject({ levelId: top, style: 'hip', pitchDeg: 40 });
    e.execute(copyLevel(ground(e)));
    expect(roofs(e)).toHaveLength(1);
    expect(roofs(e)[0]!.levelId).toBe(e.getState().scene.levelOrder[2]);
    e.undo();
    expect(roofs(e)[0]!.levelId).toBe(top);
  });

  it('a deleted floor takes its roof along', () => {
    const e = mk();
    e.execute(addLevel());
    const top = e.getState().scene.levelOrder[1]!;
    e.execute(setRoof(top, { style: 'gable' }));
    e.execute(removeLevel(top));
    expect(roofs(e)).toHaveLength(0);
    e.execute(setLevelProps(ground(e), { height: 3.2 }));
  });
});
