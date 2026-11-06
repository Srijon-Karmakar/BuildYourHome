import { useEffect, useLayoutEffect, useRef, type HTMLAttributes, type ReactNode } from 'react';

/**
 * Gooey highlight for button groups (tool bar, view switch, floors, wall type).
 *
 * The pressed button gets a frosted-white "blob" behind it. Two blobs travel to a new button at different speeds and
 * the SVG filter in <GooFilter /> merges them into one liquid shape, so the highlight stretches like a drop of water
 * between buttons. The host bar also gives a small jelly wobble (`.goo-jelly`). Styles: "Glass + goo" in styles.css.
 */

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Hidden SVG that holds the goo filter (blur, then push the alpha to a hard edge). Render once. */
export function GooFilter() {
  return (
    <svg
      width="0"
      height="0"
      aria-hidden="true"
      focusable="false"
      style={{ position: 'absolute', pointerEvents: 'none' }}
    >
      <defs>
        <filter
          id="hd-goo"
          x="-25%"
          y="-25%"
          width="150%"
          height="150%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceGraphic" stdDeviation="4.5" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9"
          />
        </filter>
      </defs>
    </svg>
  );
}

const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const place = (el: HTMLElement, b: Box) => {
  el.style.left = `${b.x}px`;
  el.style.top = `${b.y}px`;
  el.style.width = `${b.w}px`;
  el.style.height = `${b.h}px`;
};

const frame = (b: Box) => ({
  left: `${b.x}px`,
  top: `${b.y}px`,
  width: `${b.w}px`,
  height: `${b.h}px`,
});

/** Where the blob currently is on screen (also correct in the middle of an animation). */
function current(el: HTMLElement): Box {
  const cs = getComputedStyle(el);
  return {
    x: parseFloat(cs.left) || 0,
    y: parseFloat(cs.top) || 0,
    w: parseFloat(cs.width) || 0,
    h: parseFloat(cs.height) || 0,
  };
}

type GooProps = HTMLAttributes<HTMLElement> & { as?: 'div' | 'nav'; children: ReactNode };

export function GooGroup({ as = 'div', className = '', children, ...rest }: GooProps) {
  const ref = useRef<HTMLElement>(null);
  const last = useRef<Box | null>(null);
  const jellyTimer = useRef<number>(0);

  const sync = () => {
    const el = ref.current;
    const layer = el?.querySelector<HTMLElement>(':scope > .goo-layer');
    if (!el || !layer) return;
    const [lead, trail] = Array.from(layer.children) as HTMLElement[];
    if (!lead || !trail) return;

    // The layer covers the whole scrollable area, so blobs scroll with the buttons.
    layer.style.width = '0px';
    layer.style.height = '0px';
    layer.style.width = `${el.scrollWidth}px`;
    layer.style.height = `${el.scrollHeight}px`;

    const active = el.querySelector<HTMLElement>(
      ':scope > .tool[aria-pressed="true"]:not(:disabled), :scope > .seg[aria-pressed="true"]:not(:disabled)',
    );
    if (!active) {
      layer.dataset.idle = '1';
      last.current = null;
      return;
    }
    delete layer.dataset.idle;

    const er = el.getBoundingClientRect();
    const ar = active.getBoundingClientRect();
    const to: Box = {
      x: ar.left - er.left - el.clientLeft + el.scrollLeft,
      y: ar.top - er.top - el.clientTop + el.scrollTop,
      w: ar.width,
      h: ar.height,
    };
    const from = last.current;
    last.current = to;
    const same = from && from.x === to.x && from.y === to.y && from.w === to.w && from.h === to.h;
    if (same) return;

    if (!from || reducedMotion() || typeof lead.animate !== 'function') {
      place(lead, to);
      place(trail, to);
      return;
    }

    // Both blobs start from where they are now; the leader arrives fast (with a little overshoot), the trailer slowly.
    const leadFrom = current(lead);
    const trailFrom = current(trail);
    lead.getAnimations().forEach((a) => a.cancel());
    trail.getAnimations().forEach((a) => a.cancel());
    place(lead, to);
    place(trail, to);
    lead.animate([frame(leadFrom), frame(to)], {
      duration: 300,
      easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.25)',
    });
    trail.animate([frame(trailFrom), frame(to)], {
      duration: 620,
      easing: 'cubic-bezier(0.25, 0.8, 0.25, 1)',
    });

    // Jelly wobble of the whole bar.
    const host = el.closest<HTMLElement>('[data-goo-host]') ?? el;
    host.classList.remove('goo-jelly');
    void host.offsetWidth;
    host.classList.add('goo-jelly');
    window.clearTimeout(jellyTimer.current);
    jellyTimer.current = window.setTimeout(() => host.classList.remove('goo-jelly'), 700);
  };

  // After every render: the pressed button may have changed.
  useLayoutEffect(sync);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => sync()) : null;
    ro?.observe(el);
    void document.fonts?.ready.then(sync);
    return () => {
      ro?.disconnect();
      window.clearTimeout(jellyTimer.current);
    };
  }, []);

  const Tag = as as 'div';
  return (
    <Tag
      ref={ref as React.RefObject<HTMLDivElement>}
      className={`goo ${className}`.trim()}
      {...rest}
    >
      <span className="goo-layer" aria-hidden="true">
        <i className="goo-blob" />
        <i className="goo-blob" />
      </span>
      {children}
    </Tag>
  );
}
