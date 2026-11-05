import { describe, expect, it } from 'vitest';
import { edgesAgainstWalls, railingRuns } from '../index';

const wall = { a: [0, 0] as [number, number], b: [8, 0] as [number, number] };
// A 4 × 2 balcony hanging off the north wall (z from −2 to 0), wall running along z = 0.
const slab: [number, number][] = [[2, -2], [6, -2], [6, 0], [2, 0]];

describe('balcony railings', () => {
  it('the edge along the house wall needs no railing; the other three do', () => {
    const against = edgesAgainstWalls(slab, [wall]);
    expect(against).toEqual([false, false, true, false]);
    const runs = railingRuns(slab, against, 'glass');
    expect(runs).toHaveLength(3);
    expect(runs.some((r) => r.a[1] === 0 && r.b[1] === 0)).toBe(false);
  });

  it('an edge only counts when it lies along the wall (not merely touching its end)', () => {
    const touching: [number, number][] = [[7, -2], [11, -2], [11, 0], [7, 0]]; // overhangs past the wall end
    const against = edgesAgainstWalls(touching, [wall]);
    expect(against[2]).toBe(false);
  });

  it('a few centimetres off the wall still counts as against it; half a metre does not', () => {
    expect(edgesAgainstWalls([[2, -2], [6, -2], [6, -0.1], [2, -0.1]], [wall])[2]).toBe(true);
    expect(edgesAgainstWalls([[2, -2], [6, -2], [6, -0.5], [2, -0.5]], [wall])[2]).toBe(false);
  });

  it('railing "none" and no walls', () => {
    expect(railingRuns(slab, [false, false, true, false], 'none')).toEqual([]);
    expect(railingRuns(slab, edgesAgainstWalls(slab, []), 'metal')).toHaveLength(4);
  });
});
