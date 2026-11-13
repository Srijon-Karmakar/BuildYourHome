import { describe, expect, it } from 'vitest';
import {
  dprRange,
  nextScale,
  SCALE_MIN,
  SLOW_FRAME_MS,
  FAST_FRAME_MS,
  MAX_RENDER_PIXELS,
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

describe('pixel budget', () => {
  it('a small window keeps the tier pixel ratio; a big or hi-DPI one is held under the budget', () => {
    expect(dprRange('high', 1000, 600)).toEqual([1, 1.75]);
    expect(dprRange('high', 2560, 1440)).toEqual([1, 1]); // 3.7 M pixels already: no extra sharpening
    const [, max] = dprRange('high', 1440, 800); // a laptop at pixel ratio 2 would be 4.6 M pixels
    expect(max).toBeGreaterThan(1.5);
    expect(max).toBeLessThan(1.75);
    expect(max * max * 1440 * 800).toBeLessThanOrEqual(MAX_RENDER_PIXELS.high * 1.01);
  });
  it('never goes below the tier minimum, and lower tiers get a lower budget', () => {
    expect(dprRange('high', 7680, 4320)).toEqual([1, 1]);
    expect(dprRange('low', 1920, 1080)[1]).toBe(1);
    expect(MAX_RENDER_PIXELS.low).toBeLessThan(MAX_RENDER_PIXELS.medium);
    expect(MAX_RENDER_PIXELS.medium).toBeLessThan(MAX_RENDER_PIXELS.high);
  });
});

describe('dynamic resolution', () => {
  it('shrinks when frames are slow, grows back when fast, holds in between', () => {
    expect(nextScale(1, SLOW_FRAME_MS + 5)).toBe(0.95);
    expect(nextScale(0.8, FAST_FRAME_MS - 3)).toBeCloseTo(0.825);
    expect(nextScale(0.8, (SLOW_FRAME_MS + FAST_FRAME_MS) / 2)).toBe(0.8);
  });
  it('never goes below the floor or above full size', () => {
    let s = 1;
    for (let i = 0; i < 50; i++) s = nextScale(s, 60);
    expect(s).toBe(SCALE_MIN);
    for (let i = 0; i < 100; i++) s = nextScale(s, 5);
    expect(s).toBe(1);
  });
  it('High uses SMAA, not MSAA (MSAA with AO is very costly); the other tiers use neither', () => {
    expect(TIERS.high.smaa).toBe(true);
    expect(TIERS.high.msaa).toBe(0);
    expect(TIERS.medium.smaa || TIERS.low.smaa).toBe(false);
  });
});
