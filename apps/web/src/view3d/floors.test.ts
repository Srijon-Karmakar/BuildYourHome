import { describe, expect, it } from 'vitest';
import { levelVisibility } from './floors';

const levels = [
  { id: 'g', elevation: 0 },
  { id: 'f1', elevation: 3 },
  { id: 'f2', elevation: 6 },
];
const shown = (v: ReturnType<typeof levelVisibility>) => Object.entries(v).filter(([, x]) => x.visible).map(([k]) => k);

describe('levelVisibility', () => {
  it('all floors by default, nothing cut', () => {
    const v = levelVisibility(levels, 'f1', 'all', false, false);
    expect(shown(v)).toEqual(['g', 'f1', 'f2']);
    expect(Object.values(v).some((x) => x.cut)).toBe(false);
  });

  it('"this floor and below" hides the floors above', () => {
    expect(shown(levelVisibility(levels, 'f1', 'below', false, false))).toEqual(['g', 'f1']);
    expect(shown(levelVisibility(levels, 'g', 'below', false, false))).toEqual(['g']);
  });

  it('"this floor only"', () => {
    expect(shown(levelVisibility(levels, 'f1', 'single', false, false))).toEqual(['f1']);
  });

  it('cutaway hides floors above, cuts only the current floor, keeps floors below whole', () => {
    const v = levelVisibility(levels, 'f1', 'all', true, false);
    expect(shown(v)).toEqual(['g', 'f1']);
    expect(v.f1!.cut).toBe(true);
    expect(v.g!.cut).toBe(false);
  });

  it('cutaway combined with "single" still shows only the current floor', () => {
    const v = levelVisibility(levels, 'f1', 'single', true, false);
    expect(shown(v)).toEqual(['f1']);
    expect(v.f1!.cut).toBe(true);
  });

  it('cutaway is ignored while walking', () => {
    const v = levelVisibility(levels, 'f1', 'all', true, true);
    expect(shown(v)).toEqual(['g', 'f1', 'f2']);
    expect(Object.values(v).some((x) => x.cut)).toBe(false);
  });

  it('an unknown active id does not crash', () => {
    expect(shown(levelVisibility(levels, 'nope', 'all', false, false))).toEqual(['g', 'f1', 'f2']);
  });
});
