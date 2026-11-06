/** Pure frame-time statistics and report formatting (no React/Three) — unit tested. */
import type { Tier } from './qualityLogic';

export interface FrameSummary {
  frames: number;
  fps: number;
  avgMs: number;
  p95Ms: number;
  p99Ms: number;
  worstMs: number;
}

const percentile = (sorted: readonly number[], p: number): number => {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[i]!;
};

/** Summarize frame durations (ms). fps is derived from the mean; p95/p99 expose stutter. */
export function summarize(frameMs: readonly number[]): FrameSummary {
  if (frameMs.length === 0) return { frames: 0, fps: 0, avgMs: 0, p95Ms: 0, p99Ms: 0, worstMs: 0 };
  const sorted = [...frameMs].sort((a, b) => a - b);
  const avg = frameMs.reduce((s, v) => s + v, 0) / frameMs.length;
  return {
    frames: frameMs.length,
    fps: avg > 0 ? 1000 / avg : 0,
    avgMs: avg,
    p95Ms: percentile(sorted, 0.95),
    p99Ms: percentile(sorted, 0.99),
    worstMs: sorted[sorted.length - 1]!,
  };
}

export interface BenchResult extends FrameSummary {
  tier: Tier;
  drawCalls: number;
  triangles: number;
}

export interface DeviceInfo {
  userAgent: string;
  screen: string;
  dpr: number;
  cores?: number;
  memoryGb?: number;
  gpu: string;
}

/** Plain-text report the owner can paste back (one row per tier). */
export function formatReport(device: DeviceInfo, results: readonly BenchResult[], sceneNote: string): string {
  const lines = [
    'PlotFramer - performance report',
    `Scene: ${sceneNote}`,
    `Device: ${device.screen} @${device.dpr}x, cores ${device.cores ?? '?'}, memory ${device.memoryGb ?? '?'} GB`,
    `GPU: ${device.gpu}`,
    `UA: ${device.userAgent}`,
    '',
    'tier    | fps  | avg ms | p95 ms | p99 ms | worst ms | draw calls | triangles',
    '--------|------|--------|--------|--------|----------|------------|----------',
  ];
  for (const r of results) {
    lines.push(
      [
        r.tier.padEnd(7),
        r.fps.toFixed(0).padStart(4),
        r.avgMs.toFixed(1).padStart(6),
        r.p95Ms.toFixed(1).padStart(6),
        r.p99Ms.toFixed(1).padStart(6),
        r.worstMs.toFixed(1).padStart(8),
        String(r.drawCalls).padStart(10),
        String(r.triangles).padStart(9),
      ].join(' | '),
    );
  }
  return lines.join('\n');
}
