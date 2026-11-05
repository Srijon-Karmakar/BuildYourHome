import { create } from 'zustand';
import { initialTier, TIER_ORDER, type QualitySetting, type Tier } from './qualityLogic';
import type { BenchResult } from './perfStats';

const STORE_KEY = 'hd.quality';

function readSetting(): QualitySetting {
  try {
    const v = localStorage.getItem(STORE_KEY);
    if (v === 'auto' || v === 'low' || v === 'medium' || v === 'high') return v;
  } catch {
    /* storage unavailable (private mode) — default */
  }
  return 'auto';
}

function guessTier(): Tier {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return initialTier({
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    shortSide: Math.min(window.screen.width, window.screen.height),
    memoryGb: nav.deviceMemory,
    cores: nav.hardwareConcurrency,
  });
}

interface QualityState {
  /** What the user picked. "auto" lets the frame-rate governor choose. */
  setting: QualitySetting;
  /** Tier used while setting === 'auto'; only ever steps DOWN automatically. */
  autoTier: Tier;
  /** Benchmark override. */
  forced: Tier | null;
  showStats: boolean;
  setSetting(s: QualitySetting): void;
  setAutoTier(t: Tier): void;
  setForced(t: Tier | null): void;
  toggleStats(): void;
}

export const useQuality = create<QualityState>((set) => ({
  setting: readSetting(),
  autoTier: guessTier(),
  forced: null,
  showStats: new URLSearchParams(window.location.search).has('perf'),
  setSetting: (setting) => {
    try {
      localStorage.setItem(STORE_KEY, setting);
    } catch {
      /* ignore */
    }
    // Picking Auto again restarts from the device guess.
    set(setting === 'auto' ? { setting, autoTier: guessTier() } : { setting });
  },
  setAutoTier: (autoTier) => set({ autoTier }),
  setForced: (forced) => set({ forced }),
  toggleStats: () => set((s) => ({ showStats: !s.showStats })),
}));

export const resolveTier = (s: Pick<QualityState, 'setting' | 'autoTier' | 'forced'>): Tier =>
  s.forced ?? (s.setting === 'auto' ? s.autoTier : s.setting);

export const useTier = (): Tier => useQuality(resolveTier);

// ------------------------------------------------------------------ live stats

/** Per-frame renderer counters, written by PerfProbe (no React re-render). */
export const frameInfo = { calls: 0, tris: 0 };

interface PerfState {
  fps: number;
  ms: number;
  p95: number;
  calls: number;
  tris: number;
  dpr: number;
  gpu: string;
}

export const usePerf = create<PerfState>(() => ({ fps: 0, ms: 0, p95: 0, calls: 0, tris: 0, dpr: 1, gpu: 'unknown' }));

// ------------------------------------------------------------------- benchmark

export const BENCH_TIERS: readonly Tier[] = [...TIER_ORDER].reverse(); // high → low
export const BENCH_PHASE_MS = 6000;
export const BENCH_WARMUP_MS = 1500;

interface BenchState {
  phase: 'idle' | 'running' | 'done';
  progress: number;
  label: string;
  results: BenchResult[];
  sceneNote: string;
  begin(sceneNote: string): void;
  finish(results: BenchResult[]): void;
  cancel(): void;
}

export const useBench = create<BenchState>((set) => ({
  phase: 'idle',
  progress: 0,
  label: '',
  results: [],
  sceneNote: '',
  begin: (sceneNote) => set({ phase: 'running', progress: 0, label: 'Starting…', results: [], sceneNote }),
  finish: (results) => set({ phase: 'done', progress: 1, label: 'Done', results }),
  cancel: () => set({ phase: 'idle', progress: 0, label: '' }),
}));
