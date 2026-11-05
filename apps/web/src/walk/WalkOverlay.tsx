import { useEffect, useRef } from 'react';
import { resetWalkInput, walkInput } from './walkState';

const STICK_RADIUS_PX = 56;
const MOUSE_LOOK = 0.0035; // rad per px
const TOUCH_LOOK = 0.0055;

interface Active {
  role: 'stick' | 'look';
  originX: number;
  originY: number;
  lastX: number;
  lastY: number;
}

/**
 * Input layer over the 3D pane while walking.
 * Touch: left ~45% of the pane is a floating stick (move), the rest is look-drag.
 * Mouse/pen: drag anywhere to look (keyboard moves).
 */
export function WalkOverlay() {
  const root = useRef<HTMLDivElement>(null);
  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Active>());

  useEffect(() => () => resetWalkInput(), []);

  const showStick = (visible: boolean, x = 0, y = 0, kx = 0, ky = 0) => {
    const b = base.current, k = knob.current;
    if (!b || !k) return;
    b.style.display = visible ? 'block' : 'none';
    b.style.transform = `translate(${x - STICK_RADIUS_PX}px, ${y - STICK_RADIUS_PX}px)`;
    k.style.transform = `translate(${kx}px, ${ky}px)`;
  };

  const local = (e: React.PointerEvent) => {
    const r = root.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width };
  };

  return (
    <div
      ref={root}
      className="walk-overlay"
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const p = local(e);
        const isStick = e.pointerType === 'touch' && p.x < p.w * 0.45 && ![...pointers.current.values()].some((a) => a.role === 'stick');
        pointers.current.set(e.pointerId, { role: isStick ? 'stick' : 'look', originX: p.x, originY: p.y, lastX: p.x, lastY: p.y });
        if (isStick) showStick(true, p.x, p.y);
      }}
      onPointerMove={(e) => {
        const a = pointers.current.get(e.pointerId);
        if (!a) return;
        const p = local(e);
        if (a.role === 'stick') {
          let vx = p.x - a.originX;
          let vy = p.y - a.originY;
          const d = Math.hypot(vx, vy);
          if (d > STICK_RADIUS_PX) {
            vx = (vx / d) * STICK_RADIUS_PX;
            vy = (vy / d) * STICK_RADIUS_PX;
          }
          walkInput.joyX = vx / STICK_RADIUS_PX;
          walkInput.joyY = -vy / STICK_RADIUS_PX;
          showStick(true, a.originX, a.originY, vx, vy);
        } else {
          const k = e.pointerType === 'touch' ? TOUCH_LOOK : MOUSE_LOOK;
          walkInput.lookYaw -= (p.x - a.lastX) * k;
          walkInput.lookPitch -= (p.y - a.lastY) * k;
          a.lastX = p.x;
          a.lastY = p.y;
        }
      }}
      onPointerUp={(e) => end(e.pointerId)}
      onPointerCancel={(e) => end(e.pointerId)}
    >
      <div ref={base} className="stick-base" style={{ display: 'none' }}>
        <div ref={knob} className="stick-knob" />
      </div>
    </div>
  );

  function end(id: number) {
    const a = pointers.current.get(id);
    pointers.current.delete(id);
    if (a?.role === 'stick') {
      walkInput.joyX = walkInput.joyY = 0;
      showStick(false);
    }
  }
}
