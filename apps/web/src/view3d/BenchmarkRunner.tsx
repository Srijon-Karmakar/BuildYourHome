import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { OrbitControls as OrbitControlsImpl } from 'three/examples/jsm/controls/OrbitControls.js';
import { editor, useUi } from '../plan/session';
import { computeFraming, type Framing } from './framing';
import { summarize, type BenchResult } from './perfStats';
import { BENCH_PHASE_MS, BENCH_TIERS, BENCH_WARMUP_MS, frameInfo, useBench, useQuality } from './qualityStore';

interface Run {
  tierIdx: number;
  t0: number;
  samples: number[];
  calls: number[];
  tris: number[];
  angle: number;
  framing: Framing;
  results: BenchResult[];
}

const ELEVATION = 0.62; // rad above the horizon
const ORBIT_SPEED = 0.6; // rad/s

const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);

/**
 * One-tap benchmark (inside the Canvas): orbits the camera around the building at full interaction for
 * {high, medium, low} in turn — fixed route, fixed scene, no regress — and records frame-time statistics, so
 * numbers from different devices are directly comparable.
 */
export function BenchmarkRunner() {
  const phase = useBench((s) => s.phase);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const invalidate = useThree((s) => s.invalidate);
  const run = useRef<Run | null>(null);

  useEffect(() => {
    if (phase !== 'running') return;
    const framing = computeFraming(editor.getState().scene, camera);
    run.current = {
      tierIdx: 0,
      t0: performance.now(),
      samples: [],
      calls: [],
      tris: [],
      angle: Math.atan2(camera.position.z - framing.target.z, camera.position.x - framing.target.x),
      framing,
      results: [],
    };
    useQuality.getState().setForced(BENCH_TIERS[0]!);
    if (controls) controls.enabled = false;
    invalidate();
    return () => {
      run.current = null;
      useQuality.getState().setForced(null);
      if (controls) controls.enabled = true;
      useUi.getState().bumpFit();
    };
  }, [phase, camera, controls, invalidate]);

  useFrame((_, delta) => {
    const r = run.current;
    if (!r || useBench.getState().phase !== 'running') return;

    const t = performance.now() - r.t0;
    r.angle += delta * ORBIT_SPEED;
    const { target, distance } = r.framing;
    camera.position.set(
      target.x + Math.cos(r.angle) * Math.cos(ELEVATION) * distance,
      target.y + Math.sin(ELEVATION) * distance,
      target.z + Math.sin(r.angle) * Math.cos(ELEVATION) * distance,
    );
    camera.lookAt(target);

    const tier = BENCH_TIERS[r.tierIdx]!;
    if (t > BENCH_WARMUP_MS && delta > 0 && delta < 0.5) {
      r.samples.push(delta * 1000);
      r.calls.push(frameInfo.calls);
      r.tris.push(frameInfo.tris);
    }
    useBench.setState({
      progress: (r.tierIdx + Math.min(1, t / BENCH_PHASE_MS)) / BENCH_TIERS.length,
      label: `Testing ${tier} quality…`,
    });

    if (t >= BENCH_PHASE_MS) {
      r.results.push({
        ...summarize(r.samples),
        tier,
        drawCalls: Math.round(mean(r.calls)),
        triangles: Math.round(mean(r.tris)),
      });
      r.tierIdx += 1;
      if (r.tierIdx >= BENCH_TIERS.length) {
        useBench.getState().finish(r.results);
        return;
      }
      r.samples = [];
      r.calls = [];
      r.tris = [];
      r.t0 = performance.now();
      useQuality.getState().setForced(BENCH_TIERS[r.tierIdx]!);
    }
    invalidate();
  });

  return null;
}
