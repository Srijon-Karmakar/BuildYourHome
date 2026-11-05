import { useState } from 'react';
import { benchReport, copyText } from '../view3d/benchmark';
import { resolveTier, useBench, usePerf, useQuality } from '../view3d/qualityStore';

const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)));

/** Live stats and benchmark progress/results, kept small and out of the way (top-left). */
export function PerfPanel() {
  const showStats = useQuality((s) => s.showStats);
  const tier = useQuality(resolveTier);
  const setting = useQuality((s) => s.setting);
  const perf = usePerf();
  const bench = useBench();
  const [copied, setCopied] = useState(false);

  if (!showStats && bench.phase === 'idle') return null;

  return (
    <aside className="perf" aria-live="polite">
      {bench.phase === 'running' && (
        <>
          <div className="perf-title">{bench.label}</div>
          <div className="bar">
            <div style={{ width: `${Math.round(bench.progress * 100)}%` }} />
          </div>
          <button type="button" className="pill quiet small" onClick={() => bench.cancel()}>
            Cancel
          </button>
        </>
      )}

      {bench.phase === 'done' && (
        <>
          <div className="perf-title">Benchmark ({bench.sceneNote})</div>
          <table>
            <thead>
              <tr>
                <th>Tier</th>
                <th>FPS</th>
                <th>p95 ms</th>
                <th>Calls</th>
              </tr>
            </thead>
            <tbody>
              {bench.results.map((r) => (
                <tr key={r.tier}>
                  <td>{r.tier}</td>
                  <td>{r.fps.toFixed(0)}</td>
                  <td>{r.p95Ms.toFixed(1)}</td>
                  <td>{r.drawCalls}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="perf-actions">
            <button
              type="button"
              className="pill solid small"
              onClick={async () => {
                setCopied(await copyText(benchReport()));
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? 'Copied' : 'Copy report'}
            </button>
            <button type="button" className="pill quiet small" onClick={() => bench.cancel()}>
              Close
            </button>
          </div>
        </>
      )}

      {showStats && bench.phase !== 'running' && (
        <dl>
          <div>
            <dt>Quality</dt>
            <dd>
              {tier}
              {setting === 'auto' ? ' (auto)' : ''}
            </dd>
          </div>
          <div>
            <dt>FPS</dt>
            <dd>{perf.fps ? perf.fps.toFixed(0) : '–'}</dd>
          </div>
          <div>
            <dt>Frame</dt>
            <dd>{perf.ms ? `${perf.ms.toFixed(1)} ms` : '–'}</dd>
          </div>
          <div>
            <dt>p95</dt>
            <dd>{perf.p95 ? `${perf.p95.toFixed(1)} ms` : '–'}</dd>
          </div>
          <div>
            <dt>Draw calls</dt>
            <dd>{compact(perf.calls)}</dd>
          </div>
          <div>
            <dt>Triangles</dt>
            <dd>{compact(perf.tris)}</dd>
          </div>
          <div>
            <dt>Pixel ratio</dt>
            <dd>{perf.dpr.toFixed(2)}</dd>
          </div>
          <small>{perf.gpu}</small>
        </dl>
      )}
    </aside>
  );
}
