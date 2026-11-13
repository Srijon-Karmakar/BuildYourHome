import { describe, expect, it } from 'vitest';
import { getAsset } from '@hd/assets';
import { blindDrop, curtainLook, curtainPanel, foldAmplitude, isBlind, waveLength } from './curtainShape';

describe('curtain maths', () => {
  it('arc length of a wave: flat = the wavelength, deeper = longer', () => {
    expect(waveLength(0, 0.1)).toBeCloseTo(0.1);
    expect(waveLength(0.03, 0.1)).toBeGreaterThan(0.1);
    expect(waveLength(0.06, 0.1)).toBeGreaterThan(waveLength(0.03, 0.1));
  });

  it('the amplitude uses up exactly the spare cloth, and is zero when there is none', () => {
    expect(foldAmplitude(1, 1, 8)).toBe(0);
    const a = foldAmplitude(2, 1, 8); // twice the width into 8 folds
    expect(a).toBeGreaterThan(0);
    expect(waveLength(a, 1 / 8) * 8).toBeCloseTo(2, 2);
    expect(foldAmplitude(3, 1, 8)).toBeGreaterThan(a);
  });

  it('drawn closed a panel covers half the curtain with gentle folds; open it stacks narrow with deep folds', () => {
    const closed = curtainPanel(2, 'pleated', 0, 2);
    const open = curtainPanel(2, 'pleated', 1, 2);
    expect(closed.width).toBeCloseTo(1);
    expect(open.width).toBeLessThan(0.15);
    expect(open.amplitude).toBeGreaterThan(closed.amplitude);
    expect(open.folds).toBeGreaterThanOrEqual(2);
  });

  it('a fuller curtain has deeper folds; wider curtains get more folds, never fewer than 2', () => {
    expect(curtainPanel(2, 'pleated', 0, 3).amplitude).toBeGreaterThan(curtainPanel(2, 'pleated', 0, 1.5).amplitude);
    expect(curtainPanel(4, 'pleated', 0, 2).folds).toBeGreaterThan(curtainPanel(1, 'pleated', 0, 2).folds);
    expect(curtainPanel(0.2, 'pleated', 1, 2).folds).toBe(2);
  });

  it('a blind drops fully when down and stacks to a sliver when raised', () => {
    expect(blindDrop(1.4, 0)).toBeCloseTo(1.4);
    expect(blindDrop(1.4, 1)).toBeLessThan(0.3);
    expect(blindDrop(1.4, 1)).toBeGreaterThan(0.1);
  });

  it('catalog curtains carry their style; defaults suit the style', () => {
    expect(curtainLook({}, getAsset('curtain')!).style).toBe('pleated');
    expect(curtainLook({}, getAsset('curtain-sheer')!).style).toBe('sheer');
    expect(curtainLook({}, getAsset('blind-venetian')!)).toMatchObject({ style: 'venetian', rod: 'none', sheer: false });
    expect(isBlind('roman')).toBe(true);
    expect(curtainLook({ curtain: { style: 'eyelet', sheer: true } }, getAsset('curtain')!)).toMatchObject({ style: 'eyelet', rod: 'rod', sheer: true });
    // a sheer layer makes no sense on a sheer curtain or a blind
    expect(curtainLook({ curtain: { sheer: true } }, getAsset('curtain-sheer')!).sheer).toBe(false);
    expect(curtainLook({ curtain: { style: 'roman', sheer: true } }, getAsset('curtain')!).sheer).toBe(false);
  });
});
