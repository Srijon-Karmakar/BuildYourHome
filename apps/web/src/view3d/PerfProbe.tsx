import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useUi } from '../plan/session';
import { summarize } from './perfStats';
import { nextScale, SCALE_WINDOW_FRAMES, shouldStepDown, stepDown } from './qualityLogic';
import { frameInfo, useBench, usePerf, useQuality } from './qualityStore';

/**
 * Frame-time probe + auto-quality governor (inside the Canvas).
 *  - Only samples while the user is actually interacting (orbit regress, walking, benchmark), because the
 *    canvas renders on demand and idle gaps would look like a terrible frame rate.
 *  - In "Auto", steps the tier DOWN when the recent frame rate stays under ~38 fps (never up on its own,
 *    so it can't oscillate; the user can re-pick Auto/High at any time).
 * Runs at priority −100: negative priorities don't take over rendering from R3F.
 */
export function PerfProbe() {
  const gl = useThree((s) => s.gl);
  const samples = useRef<number[]>([]);
  const lastPublish = useRef(0);
  const lastStep = useRef(performance.now());
  // Dynamic resolution (see nextScale): 1 = full, lowered while the frame time is too long.
  const scale = useRef(1);
  const sinceScale = useRef(0);
  const walk = useUi((s) => s.walk);
  const setDpr = useThree((s) => s.setDpr);
  const initialDpr = useThree((s) => s.viewport.initialDpr);
  const performanceState = useThree((s) => s.performance);

  // Leaving walk mode (or changing the base pixel ratio): back to the full ratio; orbit has its own floor below.
  useEffect(() => {
    if (!walk) setDpr(initialDpr);
  }, [walk, initialDpr, setDpr]);

  useEffect(() => {
    gl.info.autoReset = false; // we reset once per frame so multi-pass frames are counted whole
    const ctx = gl.getContext();
    const ext = ctx.getExtension('WEBGL_debug_renderer_info');
    usePerf.setState({ gpu: ext ? String(ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'unknown' });
    return () => {
      gl.info.autoReset = true;
    };
  }, [gl]);

  useFrame((state, delta) => {
    // Counters of the previous frame (all passes), then reset for this one.
    frameInfo.calls = gl.info.render.calls;
    frameInfo.tris = gl.info.render.triangles;
    gl.info.reset();

    const benching = useBench.getState().phase === 'running';
    const active = benching || state.performance.current < 1 || useUi.getState().walk;
    if (!active || delta <= 0 || delta > 0.25) return;

    const buf = samples.current;
    buf.push(delta * 1000);
    if (buf.length > 300) buf.shift();

    const now = performance.now();
    if (now - lastPublish.current > 250) {
      lastPublish.current = now;
      const s = summarize(buf.slice(-60));
      usePerf.setState({
        fps: s.fps,
        ms: s.avgMs,
        p95: s.p95Ms,
        calls: frameInfo.calls,
        tris: frameInfo.tris,
        dpr: state.gl.getPixelRatio(),
      });
    }

    // Dynamic resolution. Orbit: how far the drag-time regress goes down. Walk: the pixel ratio itself.
    sinceScale.current += 1;
    if (sinceScale.current >= SCALE_WINDOW_FRAMES && !benching) {
      const recent = buf.slice(-SCALE_WINDOW_FRAMES);
      const next = nextScale(scale.current, recent.reduce((s, v) => s + v, 0) / recent.length);
      sinceScale.current = 0;
      if (next !== scale.current) {
        scale.current = next;
        performanceState.min = Math.max(0.4, 0.6 * next);
        if (useUi.getState().walk) setDpr(initialDpr * next);
      }
    }

    const q = useQuality.getState();
    if (q.setting === 'auto' && q.forced === null && !benching && shouldStepDown(buf, q.autoTier, now - lastStep.current)) {
      q.setAutoTier(stepDown(q.autoTier));
      lastStep.current = now;
      buf.length = 0;
    }
  }, -100);

  return null;
}
