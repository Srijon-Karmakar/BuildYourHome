export type IdPrefix = 'scene' | 'level' | 'node' | 'wall' | 'open' | 'room' | 'item' | 'roof' | 'stair' | 'balcony' | 'view';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Prefixed random id, e.g. `wall_k3j9x2ab`. Injectable RNG keeps tests deterministic. */
export function newId(prefix: IdPrefix, rng: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < 8; i++) s += ALPHABET[Math.floor(rng() * ALPHABET.length)];
  return `${prefix}_${s}`;
}
