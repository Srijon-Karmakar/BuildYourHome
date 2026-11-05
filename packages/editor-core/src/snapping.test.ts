import { describe, expect, it } from 'vitest';
import { createEmptyScene, type Vec2 } from '@hd/scene-schema';
import {
  addWall,
  createEditor,
  createWallTool,
  DEFAULT_SNAP,
  niceGridStep,
  snapPoint,
  type SnapOptions,
} from './index';

function setup() {
  const e = createEditor(createEmptyScene());
  const L = e.getState().activeLevelId;
  e.execute(addWall({ levelId: L, from: [0, 0], to: [4, 0] }));
  return { e, L };
}
const opts = (o: Partial<SnapOptions> = {}): SnapOptions => ({
  settings: DEFAULT_SNAP,
  gridStep: 0.5,
  thresholdM: 0.2,
  ...o,
});

describe('snapPoint', () => {
  it('prefers an existing node within threshold', () => {
    const { e, L } = setup();
    const r = snapPoint([3.9, 0.1], e.getState().scene, L, opts());
    expect(r.kind).toBe('node');
    expect(r.point).toEqual([4, 0]);
    expect(r.nodeId).toBeDefined();
  });

  it('ignores excluded nodes', () => {
    const { e, L } = setup();
    const id = Object.values(e.getState().scene.nodes).find((n) => n.p[0] === 4)!.id;
    const r = snapPoint([3.95, 0], e.getState().scene, L, opts({ excludeNodeIds: [id] }));
    expect(r.kind).not.toBe('node');
  });

  it('snaps to 90° from the previous point and rounds length to grid', () => {
    const { e, L } = setup();
    const r = snapPoint([4.05, 3.1], e.getState().scene, L, opts({ from: [4, 0], thresholdM: 0.3 }));
    expect(r.kind).toBe('angle');
    expect(r.point[0]).toBeCloseTo(4, 9);
    expect(r.point[1]).toBeCloseTo(3, 9);
    expect(r.guide).toBeDefined();
  });

  it('snaps to 45°', () => {
    const { e, L } = setup();
    const r = snapPoint([6.05, 1.98], e.getState().scene, L, opts({ from: [4, 0], gridStep: 0.1, thresholdM: 0.15 }));
    expect(r.kind).toBe('angle');
    expect(r.point[0] - 4).toBeCloseTo(r.point[1], 6);
  });

  it('falls back to grid, then to raw', () => {
    const { e, L } = setup();
    const s = e.getState().scene;
    expect(snapPoint([7.2, 5.3], s, L, opts()).point).toEqual([7, 5.5]);
    const raw: Vec2 = [7.2, 5.3];
    const r = snapPoint(raw, s, L, opts({ settings: { ...DEFAULT_SNAP, grid: false } }));
    expect(r.kind).toBe('none');
    expect(r.point).toEqual(raw);
  });

  it('does not angle-snap backwards or when disabled', () => {
    const { e, L } = setup();
    const s = e.getState().scene;
    const off = snapPoint([4.02, 3], s, L, opts({ from: [4, 0], settings: { ...DEFAULT_SNAP, angle: false } }));
    expect(off.kind).toBe('grid');
  });
});

describe('niceGridStep', () => {
  it('gets finer as you zoom in and coarser as you zoom out', () => {
    expect(niceGridStep(60)).toBe(0.5);
    expect(niceGridStep(400)).toBe(0.05);
    expect(niceGridStep(5)).toBe(5);
  });
});

describe('wall tool', () => {
  it('chains walls, one undo step each, and closes on a node', () => {
    const e = createEditor(createEmptyScene());
    const t = createWallTool(e);
    expect(t.click([0, 0], 'grid')).toBe('started');
    expect(t.click([4, 0], 'grid')).toBe('added');
    expect(t.click([4, 3], 'angle')).toBe('added');
    expect(t.click([0, 3], 'grid')).toBe('added');
    expect(t.click([0, 0], 'node')).toBe('closed');
    expect(t.last).toBeNull();
    const s = e.getState().scene;
    expect(Object.keys(s.walls)).toHaveLength(4);
    expect(Object.keys(s.nodes)).toHaveLength(4);
    e.undo();
    expect(Object.keys(e.getState().scene.walls)).toHaveLength(3);
  });

  it('ignores zero-length clicks and finish() ends the chain', () => {
    const e = createEditor(createEmptyScene());
    const t = createWallTool(e);
    t.click([1, 1], 'grid');
    expect(t.click([1, 1], 'grid')).toBe('ignored');
    t.finish();
    expect(t.last).toBeNull();
    expect(Object.keys(e.getState().scene.walls)).toHaveLength(0);
  });
});
