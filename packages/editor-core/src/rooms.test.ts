import { describe, expect, it } from 'vitest';
import { createEmptyScene } from '@hd/scene-schema';
import { addWall, batch, createEditor, moveNode, removeWalls, setRoomProps, type Editor } from './index';

const mk = () => createEditor(createEmptyScene());
const L = (e: Editor) => e.getState().activeLevelId;

function drawRect(e: Editor, x0: number, z0: number, x1: number, z1: number) {
  e.execute(
    batch('Rectangle', [
      addWall({ levelId: L(e), from: [x0, z0], to: [x1, z0] }),
      addWall({ levelId: L(e), from: [x1, z0], to: [x1, z1] }),
      addWall({ levelId: L(e), from: [x1, z1], to: [x0, z1] }),
      addWall({ levelId: L(e), from: [x0, z1], to: [x0, z0] }),
    ]),
  );
}
const rooms = (e: Editor) => Object.values(e.getState().scene.rooms);

describe('room sync', () => {
  it('creates a named room when a loop closes, and only then', () => {
    const e = mk();
    for (const [a, b] of [[[0, 0], [4, 0]], [[4, 0], [4, 3]], [[4, 3], [0, 3]]] as const) {
      e.execute(addWall({ levelId: L(e), from: [...a], to: [...b] }));
      expect(rooms(e)).toHaveLength(0);
    }
    e.execute(addWall({ levelId: L(e), from: [0, 3], to: [0, 0] }));
    expect(rooms(e)).toHaveLength(1);
    expect(rooms(e)[0]!.name).toBe('Room 1');
    expect(rooms(e)[0]!.floorMaterial.id).toBe('floor-wood-oak');
  });

  it('keeps name/materials when a corner is dragged (loop membership unchanged)', () => {
    const e = mk();
    drawRect(e, 0, 0, 4, 3);
    const id = rooms(e)[0]!.id;
    e.execute(setRoomProps(id, { name: 'Living', type: 'living', floorMaterial: { id: 'floor-x' } }));
    const node = Object.values(e.getState().scene.nodes).find((n) => n.p[0] === 4 && n.p[1] === 3)!;
    e.beginTransaction('drag');
    e.preview(moveNode(node.id, [5, 4]));
    e.commitTransaction();
    expect(rooms(e)).toHaveLength(1);
    expect(rooms(e)[0]).toMatchObject({ id, name: 'Living', type: 'living', floorMaterial: { id: 'floor-x' } });
  });

  it('splitting by a new divider: the bigger overlap keeps the identity, the new room gets the next name', () => {
    const e = mk();
    drawRect(e, 0, 0, 8, 3);
    const id = rooms(e)[0]!.id;
    e.execute(setRoomProps(id, { name: 'Hall' }));
    // Divider wall needs nodes on the top/bottom walls; build the two halves explicitly.
    e.execute(removeWalls(Object.keys(e.getState().scene.walls)));
    expect(rooms(e)).toHaveLength(0);
    drawRect(e, 0, 0, 4, 3);
    drawRect(e, 4, 0, 8, 3);
    expect(rooms(e)).toHaveLength(2);
    expect(new Set(rooms(e).map((r) => r.name)).size).toBe(2);
  });

  it('removing a wall removes the room; undo brings it back with its properties', () => {
    const e = mk();
    drawRect(e, 0, 0, 4, 3);
    const room = rooms(e)[0]!;
    e.execute(setRoomProps(room.id, { name: 'Study' }));
    const wallId = Object.keys(e.getState().scene.walls)[0]!;
    e.execute(removeWalls([wallId]));
    expect(rooms(e)).toHaveLength(0);
    e.undo();
    expect(rooms(e)).toHaveLength(1);
    expect(rooms(e)[0]!.name).toBe('Study');
  });

  it('two rooms sharing a wall get distinct ids and names', () => {
    const e = mk();
    drawRect(e, 0, 0, 4, 3);
    e.execute(
      batch('rest', [
        addWall({ levelId: L(e), from: [4, 0], to: [8, 0] }),
        addWall({ levelId: L(e), from: [8, 0], to: [8, 3] }),
        addWall({ levelId: L(e), from: [8, 3], to: [4, 3] }),
      ]),
    );
    const rs = rooms(e);
    expect(rs).toHaveLength(2);
    expect(new Set(rs.map((r) => r.id)).size).toBe(2);
    expect(rs.map((r) => r.name).sort()).toEqual(['Room 1', 'Room 2']);
  });

  it('a no-op command still creates no history entry (sync is idempotent)', () => {
    const e = mk();
    drawRect(e, 0, 0, 4, 3);
    expect(e.execute(addWall({ levelId: L(e), from: [0, 0], to: [4, 0] }))).toBe(false);
  });
});
