import type { Item } from '@hd/scene-schema';
import type { Asset } from '@hd/assets';

/** Pure curtain maths (no Three.js): how a curtain or blind is laid out for its size and how open it is. */
export type CurtainStyle = 'pleated' | 'eyelet' | 'sheer' | 'roman' | 'venetian';

export interface CurtainLook {
  style: CurtainStyle;
  open: number;
  fullness: number;
  rod: 'rod' | 'track' | 'none';
  rodColor: string;
  sheer: boolean;
  sheerColor: string;
}

export const CURTAIN_DEFAULT_ROD = '#c9a47a';
export const CURTAIN_DEFAULT_SHEER = '#f4f1ea';

export const isBlind = (s: CurtainStyle): boolean => s === 'roman' || s === 'venetian';

export function curtainLook(item: Pick<Item, 'curtain'>, asset: Pick<Asset, 'curtain'>): CurtainLook {
  const c = item.curtain ?? {};
  const style = (c.style ?? asset.curtain?.style ?? 'pleated') as CurtainStyle;
  return {
    style,
    open: c.open ?? 0,
    fullness: c.fullness ?? (style === 'sheer' ? 2.2 : style === 'eyelet' ? 2 : 2.2),
    rod: c.rod ?? (isBlind(style) ? 'none' : 'rod'),
    rodColor: c.rodColor ?? CURTAIN_DEFAULT_ROD,
    sheer: !!c.sheer && !isBlind(style) && style !== 'sheer',
    sheerColor: c.sheerColor ?? CURTAIN_DEFAULT_SHEER,
  };
}

/** Distance between the crests of the folds (m): eyelet curtains have wide, regular waves; sheers are finer. */
export const foldPitch = (style: CurtainStyle): number => (style === 'eyelet' ? 0.17 : style === 'sheer' ? 0.1 : 0.12);

/** Arc length of `a * sin(2 pi x / lambda)` over one wavelength. */
export function waveLength(a: number, lambda: number): number {
  const steps = 48;
  let len = 0;
  let px = 0;
  let py = 0;
  for (let i = 1; i <= steps; i++) {
    const x = (lambda * i) / steps;
    const y = a * Math.sin((2 * Math.PI * x) / lambda);
    len += Math.hypot(x - px, y - py);
    px = x;
    py = y;
  }
  return len;
}

/**
 * The fold amplitude (m) that squeezes `fabric` metres of cloth into `width` metres across `folds` folds (so a curtain
 * pulled open into a narrow stack gets deep folds, a drawn one gentle waves). 0 when the cloth is no longer than the width.
 */
export function foldAmplitude(fabric: number, width: number, folds: number): number {
  const lambda = width / Math.max(1, folds);
  const target = fabric / Math.max(1, folds);
  if (target <= lambda + 1e-9) return 0;
  let lo = 0;
  let hi = lambda; // deeper than a wavelength is not a fold any more
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (waveLength(mid, lambda) < target) lo = mid;
    else hi = mid;
  }
  return Math.min(0.22, (lo + hi) / 2);
}

export interface PanelLayout {
  /** Left panel spans x in [-W/2, -W/2 + width]; the right one mirrors it. A blind has one panel, `width` = W. */
  width: number;
  folds: number;
  amplitude: number;
}

/**
 * Layout of one curtain panel: the cloth of one half is `fullness` x half the width; open pulls it into a stack of
 * 12 % of the half width at the side.
 */
export function curtainPanel(W: number, style: CurtainStyle, open: number, fullness: number): PanelLayout {
  const half = W / 2;
  const width = Math.max(0.06, half * (1 - 0.88 * Math.min(1, Math.max(0, open))));
  const fabric = half * fullness;
  const folds = Math.max(2, Math.round(width / foldPitch(style)));
  return { width, folds, amplitude: foldAmplitude(fabric, width, folds) };
}

/** How much of a blind's height still hangs down (the rest is stacked at the top). */
export const blindDrop = (H: number, open: number): number => Math.max(0.12, H * (1 - 0.86 * Math.min(1, Math.max(0, open))));
