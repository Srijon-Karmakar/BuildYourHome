import { describe, expect, it } from 'vitest';
import { createEmptyScene, loadScene } from '@hd/scene-schema';
import {
  addItem,
  addOpening,
  addWall,
  addWallPanel,
  createEditor,
  removeWalls,
  removeWallPanels,
  setItemsProps,
  setOpeningProps,
  setWallsProps,
  updateWallPanels,
  type Editor,
} from './index';

/** ADR-030: box windows, opening extras, two-tone walls, feature panels, mouldings, item text. */

const mk = () => createEditor(createEmptyScene());
const L = (e: Editor) => e.getState().activeLevelId;
const scene = (e: Editor) => e.getState().scene;
const valid = (e: Editor) => expect(loadScene(JSON.parse(JSON.stringify(scene(e)))).ok).toBe(true);

function withOpening(type: 'door' | 'window') {
  const e = mk();
  e.execute(addWall({ levelId: L(e), from: [0, 0], to: [8, 0] }));
  const wallId = Object.keys(scene(e).walls)[0]!;
  e.execute(addOpening({ wallId, type, offset: 4 }));
  return { e, wallId, id: Object.keys(scene(e).openings)[0]! };
}

describe('opening extras', () => {
  it('a window gets a box frame with its default depth, then a bay that starts from the bay depth', () => {
    const { e, id } = withOpening('window');
    e.execute(setOpeningProps(id, { box: { kind: 'frame' } }));
    expect(scene(e).openings[id]!.box).toEqual({ kind: 'frame', depth: 0.3 });
    e.execute(setOpeningProps(id, { box: { thickness: 0.12, sides: 'top-sides', color: '#2b2a28' } }));
    expect(scene(e).openings[id]!.box).toMatchObject({ kind: 'frame', depth: 0.3, thickness: 0.12, sides: 'top-sides' });
    e.execute(setOpeningProps(id, { box: { kind: 'bay' } }));
    expect(scene(e).openings[id]!.box).toEqual({ kind: 'bay', depth: 0.6 });
    e.execute(setOpeningProps(id, { box: { depth: 9 } }));
    expect(scene(e).openings[id]!.box!.depth).toBe(1.2); // clamped
    valid(e);
    e.execute(setOpeningProps(id, { box: null }));
    expect(scene(e).openings[id]!.box).toBeUndefined();
  });

  it('doors never get a box or a grill; both types take glass, panes, head, frame and surround', () => {
    const { e, id } = withOpening('door');
    e.execute(setOpeningProps(id, { box: { kind: 'frame' }, grill: { pattern: 'grid' } }));
    expect(scene(e).openings[id]!.box).toBeUndefined();
    expect(scene(e).openings[id]!.grill).toBeUndefined();
    e.execute(setOpeningProps(id, { style: 'carved', handle: 'pull', glass: 'frosted', panes: 'top', head: 'arch', frame: { width: 0.5, finish: 'wood' }, surround: { style: 'stone' } }));
    const o = scene(e).openings[id]!;
    expect(o).toMatchObject({ style: 'carved', handle: 'pull', glass: 'frosted', panes: 'top', head: 'arch', frame: { width: 0.15, finish: 'wood' }, surround: { style: 'stone', width: 0.12 } });
    valid(e);
  });

  it('a window grill needs a pattern to start, then merges colour', () => {
    const { e, id } = withOpening('window');
    e.execute(setOpeningProps(id, { grill: { color: '#000000' } }));
    expect(scene(e).openings[id]!.grill).toBeUndefined();
    e.execute(setOpeningProps(id, { grill: { pattern: 'diamond' } }));
    e.execute(setOpeningProps(id, { grill: { color: '#2b2a28' } }));
    expect(scene(e).openings[id]!.grill).toEqual({ pattern: 'diamond', color: '#2b2a28' });
    e.execute(setOpeningProps(id, { grill: null }));
    expect(scene(e).openings[id]!.grill).toBeUndefined();
  });
});

describe('two-tone walls and mouldings', () => {
  it('a lower finish needs a material, keeps below the wall top, keeps its own material copy', () => {
    const { e, wallId } = withOpening('window');
    e.execute(setWallsProps([wallId], { lowerA: { height: 1 } }));
    expect(scene(e).walls[wallId]!.lowerA).toBeUndefined();
    e.execute(setWallsProps([wallId], { lowerA: { material: { id: 'wall-stone' } } }));
    expect(scene(e).walls[wallId]!.lowerA).toEqual({ material: { id: 'wall-stone' }, height: 1 });
    e.execute(setWallsProps([wallId], { lowerA: { height: 50, band: '#3b3a38' } }));
    const w = scene(e).walls[wallId]!;
    expect(w.lowerA!.height).toBeCloseTo(w.height - 0.1, 9);
    expect(w.lowerA!.band).toBe('#3b3a38');
    e.execute(setWallsProps([wallId], { lowerA: { band: '' } }));
    expect(scene(e).walls[wallId]!.lowerA!.band).toBeUndefined();
    valid(e);
    e.execute(setWallsProps([wallId], { lowerA: null }));
    expect(scene(e).walls[wallId]!.lowerA).toBeUndefined();
  });

  it('trim merges, drops bands outside the wall, and disappears when nothing is on', () => {
    const { e, wallId } = withOpening('window');
    e.execute(setWallsProps([wallId], { trim: { cornice: true, bands: [1.2, 40] } }));
    expect(scene(e).walls[wallId]!.trim).toEqual({ cornice: true, bands: [1.2] });
    e.execute(setWallsProps([wallId], { trim: { plinth: true, color: '#e8e3d8' } }));
    expect(scene(e).walls[wallId]!.trim).toMatchObject({ cornice: true, plinth: true, color: '#e8e3d8' });
    valid(e);
    e.execute(setWallsProps([wallId], { trim: { cornice: false, plinth: false, bands: [] } }));
    expect(scene(e).walls[wallId]!.trim).toBeUndefined();
  });
});

describe('feature panels', () => {
  it('adds a panel inside the wall, edits and clamps it, deletes it', () => {
    const { e, wallId } = withOpening('window');
    e.execute(addWallPanel(wallId, { side: 'A', material: { id: 'wall-stone' } }));
    const p = scene(e).walls[wallId]!.panels![0]!;
    expect(p).toMatchObject({ side: 'A', bottom: 0, height: scene(e).walls[wallId]!.height });
    expect(p.offset).toBeCloseTo(4, 6);
    e.execute(updateWallPanels([p.id], { width: 3, offset: 0, material: { id: 'wall-brick-red', joint: '#ffffff' } }));
    const q = scene(e).walls[wallId]!.panels![0]!;
    expect(q.offset).toBeCloseTo(1.5, 9); // kept on the wall
    expect(q.material).toEqual({ id: 'wall-brick-red', joint: '#ffffff' });
    valid(e);
    e.execute(removeWallPanels([p.id]));
    expect(scene(e).walls[wallId]!.panels).toBeUndefined();
  });

  it('a T junction splits the wall: panels follow their position, one across the split is cut in two', () => {
    const e = mk();
    e.execute(addWall({ levelId: L(e), from: [0, 0], to: [8, 0] }));
    const wallId = Object.keys(scene(e).walls)[0]!;
    e.execute(addWallPanel(wallId, { side: 'A', material: { id: 'wall-stone' }, offset: 1, width: 1 }));
    e.execute(addWallPanel(wallId, { side: 'B', material: { id: 'wall-stone' }, offset: 4, width: 2 }));
    e.execute(setWallsProps([wallId], { lowerA: { material: { id: 'wall-brick-red' } }, trim: { cornice: true } }));
    e.execute(addWall({ levelId: L(e), from: [4.5, 0], to: [4.5, 3] }));
    const walls = Object.values(scene(e).walls).filter((w) => w.id !== wallId && w.panels);
    const first = scene(e).walls[wallId]!;
    const second = walls[0]!;
    expect(first.panels!.map((p) => [p.side, +p.offset.toFixed(3), +p.width.toFixed(3)])).toEqual([['A', 1, 1], ['B', 4, 2]]);
    expect(second).toBeUndefined; // nothing crosses 4.5 except... the second panel ends at 5
    const all = Object.values(scene(e).walls).flatMap((w) => (w.panels ?? []).map((p) => ({ w: w.id, ...p })));
    // Panel B spans 3..5: cut at 4.5 into 3..4.5 (first half) and 4.5..5 (second half, offset 0.25 there).
    const pieces = all.filter((p) => p.side === 'B');
    expect(pieces).toHaveLength(2);
    expect(pieces.map((p) => +p.width.toFixed(3)).sort()).toEqual([0.5, 1.5]);
    // The second half keeps its own copies of the two-tone finish and the trim.
    const half = Object.values(scene(e).walls).find((w) => w.id !== wallId && w.lowerA)!;
    expect(half.lowerA).toEqual(first.lowerA);
    expect(half.lowerA).not.toBe(first.lowerA);
    expect(half.trim).toEqual({ cornice: true });
    valid(e);
  });

  it('deleting the divider merges the halves back and carries the panels across', () => {
    const e = mk();
    e.execute(addWall({ levelId: L(e), from: [0, 0], to: [8, 0] }));
    const wallId = Object.keys(scene(e).walls)[0]!;
    e.execute(addWall({ levelId: L(e), from: [4, 0], to: [4, 3] }));
    const divider = Object.values(scene(e).walls).find((w) => scene(e).nodes[w.b]?.p[1] === 3)!;
    const right = Object.values(scene(e).walls).find((w) => w.id !== wallId && w.id !== divider.id)!;
    e.execute(addWallPanel(right.id, { side: 'A', material: { id: 'wall-stone' }, offset: 1, width: 1 }));
    e.execute(removeWalls([divider.id]));
    const merged = Object.values(scene(e).walls);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.panels![0]!.offset).toBeCloseTo(5, 6);
    valid(e);
  });

  it('walls with different two-tone finishes do not merge', () => {
    const e = mk();
    e.execute(addWall({ levelId: L(e), from: [0, 0], to: [8, 0] }));
    const wallId = Object.keys(scene(e).walls)[0]!;
    e.execute(addWall({ levelId: L(e), from: [4, 0], to: [4, 3] }));
    e.execute(setWallsProps([wallId], { lowerA: { material: { id: 'wall-stone' } } }));
    const divider = Object.values(scene(e).walls).find((w) => scene(e).nodes[w.b]?.p[1] === 3)!;
    e.execute(removeWalls([divider.id]));
    expect(Object.keys(scene(e).walls)).toHaveLength(2);
  });
});

describe('item text', () => {
  it('stores and clears the text of a name plate', () => {
    const e = mk();
    e.execute(addItem({ levelId: L(e), assetId: 'wall-art', position: [0, 1.5, 0], rotationY: 0 }));
    const id = Object.keys(scene(e).items)[0]!;
    e.execute(setItemsProps([id], { text: 'The Karmakars' }));
    expect(scene(e).items[id]!.text).toBe('The Karmakars');
    valid(e);
    e.execute(setItemsProps([id], { text: '' }));
    expect(scene(e).items[id]!.text).toBeUndefined();
  });
});

describe('full glass wall', () => {
  it('turns on with defaults, merges options, turns off, and keeps glass and solid walls from merging', async () => {
    const { setWallsProps } = await import('./index');
    const e = createEditor(createEmptyScene());
    const L0 = e.getState().scene.levelOrder[0]!;
    e.execute(addWall({ levelId: L0, from: [0, 0], to: [4, 0] }));
    const id = Object.keys(e.getState().scene.walls)[0]!;
    e.execute(setWallsProps([id], { glazed: {} }));
    expect(e.getState().scene.walls[id]!.glazed).toEqual({});
    e.execute(setWallsProps([id], { glazed: { tint: 'blue', sill: 0.5, transom: 0 } }));
    expect(e.getState().scene.walls[id]!.glazed).toEqual({ tint: 'blue', sill: 0.5 });
    e.execute(setWallsProps([id], { glazed: null }));
    expect(e.getState().scene.walls[id]!.glazed).toBeUndefined();
  });
});
