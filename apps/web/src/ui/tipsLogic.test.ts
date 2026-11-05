import { describe, expect, it } from 'vitest';
import { createEmptyScene } from '@hd/scene-schema';
import { buildFamilyHome, buildQuickRoom } from '../plan/templates';
import { buildDemoScene } from '../plan/demo';
import { nextTip } from './tipsLogic';

describe('nextTip', () => {
  it('walks a beginner through the basics in order', () => {
    expect(nextTip(createEmptyScene(), false)?.id).toBe('wall');
    expect(nextTip(buildQuickRoom(4, 4), false)?.id).not.toBe('wall');
  });

  it('asks to close the loop while walls exist but no room does', () => {
    const s = buildQuickRoom(4, 4);
    const open = { ...s, rooms: {} };
    expect(nextTip(open, false)?.id).toBe('close');
  });

  it('suggests a door, then furniture, then a walk', () => {
    const s = buildFamilyHome(); // doors yes, furniture no
    expect(nextTip({ ...s, openings: {} }, false)?.id).toBe('door');
    expect(nextTip(s, false)?.id).toBe('furnish');
    const furnished = buildDemoScene();
    expect(nextTip(furnished, false)?.id).toBe('walk');
    expect(nextTip(furnished, true)).toBeNull();
  });

  it('the tips that need a button offer one', () => {
    expect(nextTip(createEmptyScene(), false)?.action).toBeTruthy();
    expect(nextTip(buildQuickRoom(4, 4), true)?.id).toBe('furnish');
  });
});
