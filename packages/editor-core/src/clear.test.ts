import { describe, expect, it } from 'vitest';
import { createEmptyScene } from '@hd/scene-schema';
import { addWall, batch, clearHome, createEditor, deleteRoom, type Editor } from './index';

const mk = () => createEditor(createEmptyScene());
const L = (e: Editor) => e.getState().activeLevelId;
function rect(e: Editor, x0: number, z0: number, x1: number, z1: number) {
  e.execute(
    batch('Rect', [
      addWall({ levelId: L(e), from: [x0, z0], to: [x1, z0] }),
      addWall({ levelId: L(e), from: [x1, z0], to: [x1, z1] }),
      addWall({ levelId: L(e), from: [x1, z1], to: [x0, z1] }),
      addWall({ levelId: L(e), from: [x0, z1], to: [x0, z0] }),
    ]),
  );
}
const count = (e: Editor, k: 'walls' | 'rooms' | 'nodes') => Object.keys(e.getState().scene[k]).length;

describe('clear and delete', () => {
  it('clearHome empties walls, nodes and rooms in one undo step', () => {
    const e = mk();
    rect(e, 0, 0, 4, 3);
    expect(count(e, 'walls')).toBe(4);
    e.execute(clearHome(null));
    expect(count(e, 'walls')).toBe(0);
    expect(count(e, 'rooms')).toBe(0);
    expect(count(e, 'nodes')).toBe(0);
    e.undo();
    expect(count(e, 'walls')).toBe(4);
    expect(count(e, 'rooms')).toBe(1);
  });

  it('deleteRoom keeps walls shared with a neighbour', () => {
    const e = mk();
    rect(e, 0, 0, 4, 3);
    rect(e, 4, 0, 8, 3);
    expect(count(e, 'rooms')).toBe(2);
    const first = Object.values(e.getState().scene.rooms)[0]!.id;
    e.execute(deleteRoom(first));
    expect(count(e, 'rooms')).toBe(1);
    expect(count(e, 'walls')).toBe(4);
  });
});
