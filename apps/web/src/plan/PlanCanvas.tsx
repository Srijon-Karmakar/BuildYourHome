import { useEffect, useRef } from 'react';
import { PlanController } from './PlanController';

export let activePlan: PlanController | null = null;

export function PlanCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const c = new PlanController(canvas);
    activePlan = c;
    return () => {
      c.dispose();
      if (activePlan === c) activePlan = null;
    };
  }, []);

  return <canvas ref={ref} className="plan-canvas" />;
}
