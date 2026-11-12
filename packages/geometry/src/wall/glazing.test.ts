import { describe, expect, it } from 'vitest';
import type { Vec2, Wall, WallNode } from '@hd/scene-schema';
import { buildGlazing, computeFootprints, glazingCuts, glazingRun, validCuts } from '../index';

/** A closed 6 × 4 box: walls meet at mitered corners, like a real house. */
function box(): ReturnType<typeof computeFootprints> {
  const pts: Vec2[] = [[0, 0], [6, 0], [6, 4], [0, 4]];
  const nodes: Record<string, WallNode> = Object.fromEntries(pts.map((p, i) => [`n${i}`, { id: `n${i}`, levelId: 'L', p }]));
  const walls: Wall[] = pts.map((_, i) => ({ id: `w${i}`, levelId: 'L', a: `n${i}`, b: `n${(i + 1) % 4}`, thickness: 0.23, height: 3, kind: 'exterior', materialA: { id: 'm' }, materialB: { id: 'm' } }));
  return computeFootprints(nodes, walls);
}

describe('full glass walls', () => {
  it('the glass run clears the corners and the wall builder keeps its cut', () => {
    const fp = box().w0!;
    const run = glazingRun(fp, 3, 0)!;
    expect(run.from).toBeGreaterThan(0.115);
    expect(run.to).toBeLessThan(6 - 0.115);
    expect(run.top).toBeCloseTo(2.9);
    const cuts = glazingCuts(run, []);
    expect(cuts).toHaveLength(1);
    expect(validCuts(fp, cuts, 3)).toHaveLength(1); // not dropped (the bug this guards against)
  });

  it('with a low wall under the glass, a door gets its own full cut beside the glass cuts, none overlapping', () => {
    const fp = box().w0!;
    const run = glazingRun(fp, 3, 0.6)!;
    const door = { offset: 3, width: 0.9, sill: 0, height: 2.1 };
    const cuts = glazingCuts(run, [door]);
    expect(cuts).toHaveLength(3);
    expect(validCuts(fp, cuts, 3)).toHaveLength(3);
    const d = cuts.find((c) => c.sill === 0)!;
    expect(d.width).toBeCloseTo(0.9);
    expect(d.sill + d.height).toBeCloseTo(run.top);
    // a window inside the glass needs no cut of its own
    expect(glazingCuts(run, [{ offset: 1.5, width: 1, sill: 0.9, height: 1.2 }])).toHaveLength(1);
  });

  it('builds panes and a frame, splitting the run into bays and leaving a gap at a door', () => {
    const fp = box().w0!;
    const run = glazingRun(fp, 3, 0)!;
    const plain = buildGlazing(fp.origin, fp.dir, 0.23, 0, run, { pane: 1.2 });
    expect(plain.groups.map((g) => g.slot)).toEqual(['frame', 'glass']);
    const panes = plain.groups.find((g) => g.slot === 'glass')!.count / 36; // a panel is 6 quads = 36 vertices
    expect(panes).toBe(Math.round((run.to - run.from) / 1.2));
    const withDoor = buildGlazing(fp.origin, fp.dir, 0.23, 0, run, { pane: 1.2 }, [{ offset: 3, width: 0.9, sill: 0, height: 2.1 }]);
    const glassVerts = withDoor.groups.find((g) => g.slot === 'glass')!.count;
    expect(glassVerts % 36).toBe(0);
    expect(withDoor.positions.every(Number.isFinite)).toBe(true);
  });
});
