import { describe, expect, it } from 'vitest';
import { createEmptyScene } from '@hd/scene-schema';
import { createEditor, MAX_VIEWPOINTS, removeViewpoint, renameViewpoint, saveViewpoint } from './index';

describe('saved views', () => {
  it('saves, renames, deletes and undoes', () => {
    const e = createEditor(createEmptyScene());
    const cmd = saveViewpoint('  Front  ', [8, 7, 10], [0, 0, 0], 50);
    e.execute(cmd);
    const v = e.getState().scene.viewpoints[cmd.viewId]!;
    expect(v.name).toBe('Front');
    expect(v.position).toEqual([8, 7, 10]);
    e.execute(renameViewpoint(cmd.viewId, 'Garden side'));
    expect(e.getState().scene.viewpoints[cmd.viewId]!.name).toBe('Garden side');
    e.execute(removeViewpoint(cmd.viewId));
    expect(Object.keys(e.getState().scene.viewpoints)).toHaveLength(0);
    e.undo();
    expect(Object.keys(e.getState().scene.viewpoints)).toHaveLength(1);
  });

  it('names an unnamed view, refuses bad numbers and caps the count', () => {
    const e = createEditor(createEmptyScene());
    const c = saveViewpoint('', [1, 2, 3], [0, 0, 0], 50);
    e.execute(c);
    expect(e.getState().scene.viewpoints[c.viewId]!.name).toBe('View 1');
    const bad = saveViewpoint('x', [NaN, 0, 0], [0, 0, 0], 50);
    e.execute(bad);
    expect(e.getState().scene.viewpoints[bad.viewId]).toBeUndefined();
    for (let i = 0; i < MAX_VIEWPOINTS + 3; i++) e.execute(saveViewpoint(`v${i}`, [i, 1, 1], [0, 0, 0], 50));
    expect(Object.keys(e.getState().scene.viewpoints).length).toBe(MAX_VIEWPOINTS);
  });
});
