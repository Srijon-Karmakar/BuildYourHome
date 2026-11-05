const STEPS_M = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 25, 50];

/** Smallest "nice" grid step (metres) whose on-screen spacing is at least `minPx`. */
export function niceGridStep(pxPerMetre: number, minPx = 20): number {
  for (const s of STEPS_M) if (s * pxPerMetre >= minPx) return s;
  return STEPS_M[STEPS_M.length - 1]!;
}
