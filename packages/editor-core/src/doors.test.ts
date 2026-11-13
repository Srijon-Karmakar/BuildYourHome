import { describe, expect, it } from 'vitest';
import { createEmptyScene, doorOpenAmount, loadScene } from '@hd/scene-schema';
import { buildColliders, moveWithCollision } from '@hd/geometry';
import { addOpening, addWall, createEditor, nearestDoor, setDoorsOpen, type Editor } from './index';

const mk = () => createEditor(createEmptyScene());
const scene = (e: Editor) => e.getState().scene;

function house() {
  const e = mk();
  const L = e.getState().activeLevelId;
  e.execute(addWall({ levelId: L, from: [0, 0], to: [6, 0] }));
  const wallId = Object.keys(scene(e).walls)[0]!;
  e.execute(addOpening({ wallId, type: 'door', offset: 3 }));
  const id = Object.keys(scene(e).openings)[0]!;
  return { e, L, wallId, id };
}
const walls = (e: Editor) => buildColliders(scene(e).nodes, Object.values(scene(e).walls), Object.values(scene(e).openings));
// walking from z=1 (inside) toward the wall line z=0 at x=3, through the doorway
const walkThrough = (e: Editor) => moveWithCollision([3, 1], [0, -2], walls(e));

describe('door open / closed', () => {
  it('doors are open unless set otherwise; the field stays out of the file when open', () => {
    const { e, id } = house();
    expect(doorOpenAmount(scene(e).openings[id]!)).toBe(1);
    e.execute(setDoorsOpen([id], 0));
    expect(scene(e).openings[id]!.open).toBe(0);
    e.execute(setDoorsOpen([id], 1));
    expect('open' in scene(e).openings[id]!).toBe(false);
  });

  it('toggle flips closed <-> open, a half-open door counts as open; windows are ignored; undo works', () => {
    const { e, id, wallId } = house();
    e.execute(setDoorsOpen([id], 'toggle'));
    expect(scene(e).openings[id]!.open).toBe(0);
    e.execute(setDoorsOpen([id], 'toggle'));
    expect(scene(e).openings[id]!.open).toBeUndefined();
    e.execute(setDoorsOpen([id], 0.5));
    e.execute(setDoorsOpen([id], 'toggle'));
    expect(scene(e).openings[id]!.open).toBe(0);
    e.undo();
    expect(scene(e).openings[id]!.open).toBe(0.5);
    e.execute(addOpening({ wallId, type: 'window', offset: 5 }));
    const win = Object.values(scene(e).openings).find((o) => o.type === 'window')!;
    e.execute(setDoorsOpen([win.id], 0));
    expect(win.open).toBeUndefined();
    expect(loadScene(JSON.parse(JSON.stringify(scene(e)))).ok).toBe(true);
  });

  it('you can walk through an open door but not through a closed one', () => {
    const { e, id } = house();
    expect(walkThrough(e)[1]).toBeLessThan(-0.5);
    e.execute(setDoorsOpen([id], 0));
    expect(walkThrough(e)[1]).toBeGreaterThan(0.2); // stopped at the door
  });

  it('finds the door in front of you, not one behind you or too far away', () => {
    const { e, L, id } = house();
    const facingWall = Math.PI * 0; // yaw 0 looks toward -z, i.e. at the wall
    expect(nearestDoor(scene(e), L, [3, 1.2], facingWall)?.id).toBe(id);
    expect(nearestDoor(scene(e), L, [3, 1.2], Math.PI)).toBeNull(); // turned away
    expect(nearestDoor(scene(e), L, [3, 4], facingWall)).toBeNull(); // too far
    expect(nearestDoor(scene(e), L, [3, 1.2], facingWall)?.isOpen).toBe(true);
    e.execute(setDoorsOpen([id], 0));
    expect(nearestDoor(scene(e), L, [3, 1.2], facingWall)?.isOpen).toBe(false);
  });

  it('knows when you are standing in the doorway (so it will not close on you)', () => {
    const { e, L } = house();
    expect(nearestDoor(scene(e), L, [3, 0.1], 0)?.inDoorway).toBe(true);
    expect(nearestDoor(scene(e), L, [3, 1.2], 0)?.inDoorway).toBe(false);
  });
});
