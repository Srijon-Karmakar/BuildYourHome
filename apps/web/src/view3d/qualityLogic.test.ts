import { describe, expect, it } from 'vitest';
import {
  canStepDown,
  GOVERNOR_COOLDOWN_MS,
  GOVERNOR_WINDOW_FRAMES,
  initialTier,
  shouldStepDown,
  stepDown,
  TIERS,
} from './qualityLogic';
import { formatReport, summarize } from './perfStats';

describe('tiers', () => {
  it('steps down one level and stops at low', () => {
    expect(stepDown('high')).toBe('medium');
    expect(stepDown('medium')).toBe('low');
    expect(stepDown('low')).toBe('low');
    expect(canStepDown('low')).toBe(false);
  });

  it('get monotonically cheaper: dpr, textures, AO', () => {
    expect(TIERS.low.dpr[1]).toBeLessThanOrEqual(TIERS.medium.dpr[1]);
    expect(TIERS.medium.dpr[1]).toBeLessThanOrEqual(TIERS.high.dpr[1]);
    expect(TIERS.low.textureSize).toBeLessThan(TIERS.high.textureSize);
    expect(TIERS.low.ao).toBe(false);
    expect(TIERS.medium.ao && TIERS.high.ao).toBe(true);
    expect(TIERS.low.photoTextures).toBe(false);
    expect(TIERS.medium.photoTextures && TIERS.high.photoTextures).toBe(true);
    expect(TIERS.high.ao).toBe(true);
  });

  it('picks a starting tier from the device', () => {
    expect(initialTier({ coarsePointer: false, shortSide: 900 })).toBe('high');
    expect(initialTier({ coarsePointer: true, shortSide: 390, memoryGb: 8, cores: 8 })).toBe('medium');
    expect(initialTier({ coarsePointer: true, shortSide: 360, memoryGb: 2 })).toBe('low');
    expect(initialTier({ coarsePointer: true, shortSide: 360, cores: 4 })).toBe('low');
  });
});

describe('governor', () => {
  const slow = Array.from({ length: GOVERNOR_WINDOW_FRAMES }, () => 40); // 25 fps
  const fast = Array.from({ length: GOVERNOR_WINDOW_FRAMES }, () => 16); // 62 fps

  it('steps down only when slow, with enough samples, outside the cooldown', () => {
    expect(shouldStepDown(slow, 'high', GOVERNOR_COOLDOWN_MS + 1)).toBe(true);
    expect(shouldStepDown(fast, 'high', GOVERNOR_COOLDOWN_MS + 1)).toBe(false);
    expect(shouldStepDown(slow.slice(0, 10), 'high', GOVERNOR_COOLDOWN_MS + 1)).toBe(false);
    expect(shouldStepDown(slow, 'high', 500)).toBe(false);
    expect(shouldStepDown(slow, 'low', GOVERNOR_COOLDOWN_MS + 1)).toBe(false);
  });

  it('judges only the most recent window', () => {
    expect(shouldStepDown([...slow, ...fast], 'high', GOVERNOR_COOLDOWN_MS + 1)).toBe(false);
  });
});

describe('summarize / report', () => {
  it('computes fps and percentiles', () => {
    const s = summarize([10, 10, 10, 10, 10, 10, 10, 10, 10, 100]);
    expect(s.frames).toBe(10);
    expect(s.avgMs).toBeCloseTo(19);
    expect(s.fps).toBeCloseTo(1000 / 19);
    expect(s.p95Ms).toBe(100);
    expect(s.worstMs).toBe(100);
  });

  it('handles empty input', () => {
    expect(summarize([]).fps).toBe(0);
  });

  it('formats a readable table', () => {
    const r = summarize([16, 17, 16]);
    const txt = formatReport(
      { userAgent: 'UA', screen: '390x844', dpr: 3, gpu: 'Adreno', cores: 8 },
      [{ ...r, tier: 'high', drawCalls: 42, triangles: 12345 }],
      'sample home',
    );
    expect(txt).toContain('Adreno');
    expect(txt).toContain('high');
    expect(txt).toContain('12345');
    expect(txt.split('\n').length).toBeGreaterThan(8);
  });
});
