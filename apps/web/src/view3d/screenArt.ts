import type { Asset } from '@hd/assets';
import type { Item, ScreenOpts } from '@hd/scene-schema';

/**
 * LED screens: what a screen shows, drawn on a 2D canvas (no downloads, no video). The 3D view puts the canvas on
 * the screen's face (see furniture/ScreenFace.tsx); the plan only shows the footprint.
 */
export type ScreenShow = NonNullable<ScreenOpts['show']>;
export type ScreenDemo = NonNullable<ScreenOpts['demo']>;

/** A screen's settings with every default filled in. */
export interface ScreenLook {
  show: ScreenShow;
  color: string;
  color2: string;
  demo: ScreenDemo;
  text: string;
  textColor: string;
  scroll: boolean;
  image: string | null;
  fit: 'cover' | 'contain' | 'stretch';
  brightness: number;
  /** Degrees, + bulges out; 0 = flat. */
  curve: number;
  bezel: number;
  castLight: boolean;
}

export const SCREEN_DEFAULTS = {
  color: '#1f6fd1',
  color2: '#8a2be2',
  textColor: '#ffffff',
  text: 'Hello',
  bezel: 0.02,
} as const;

export function screenLook(item: Pick<Item, 'screen'>, asset: Pick<Asset, 'screen'>): ScreenLook {
  const s = item.screen ?? {};
  const face = asset.screen;
  return {
    show: s.show ?? face?.show ?? 'gradient',
    color: s.color ?? SCREEN_DEFAULTS.color,
    color2: s.color2 ?? SCREEN_DEFAULTS.color2,
    demo: s.demo ?? face?.demo ?? 'landscape',
    text: s.text ?? face?.text ?? SCREEN_DEFAULTS.text,
    textColor: s.textColor ?? SCREEN_DEFAULTS.textColor,
    scroll: s.scroll ?? face?.scroll ?? false,
    image: s.image ?? null,
    fit: s.fit ?? 'cover',
    brightness: s.brightness ?? 1,
    curve: asset.screen?.curvable ? (s.curve ?? face?.curve ?? 0) : 0,
    bezel: s.bezel ?? SCREEN_DEFAULTS.bezel,
    castLight: s.castLight ?? true,
  };
}

/** Rough average colour of what the screen shows: the colour of the light it throws at night. */
export function screenTone(look: ScreenLook): string {
  if (look.show === 'color' || look.show === 'text') return look.color;
  if (look.show === 'gradient') return mix(look.color, look.color2, 0.5);
  if (look.show === 'image') return '#dfe6f0';
  return DEMO_TONE[look.demo];
}

const DEMO_TONE: Record<ScreenDemo, string> = {
  landscape: '#8fb7d9',
  city: '#2a3a66',
  sports: '#3f8f4a',
  news: '#2c4f9e',
  bars: '#203040',
  stage: '#7a3fa8',
};

export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

/** Smallest bend that counts as curved (below it the screen is drawn flat). */
export const MIN_CURVE_DEG = 2;

/**
 * A screen of chord `w` (the straight distance between its two edges, so its footprint on the wall does not change)
 * bent by `deg` degrees: the circle radius, the arc length the picture is spread over and how far the middle sticks out.
 */
export function curveShape(w: number, deg: number): { radius: number; arc: number; bulge: number } {
  const a = (Math.min(180, Math.abs(deg)) * Math.PI) / 180;
  if (a < (MIN_CURVE_DEG * Math.PI) / 180) return { radius: Infinity, arc: w, bulge: 0 };
  const radius = w / (2 * Math.sin(a / 2));
  return { radius, arc: radius * a, bulge: radius * (1 - Math.cos(a / 2)) };
}

/** Canvas size for a face of `aspect` (width / height): the long side gets `long` pixels. */
export function canvasSize(aspect: number, long = 768): [number, number] {
  const a = Math.min(12, Math.max(1 / 12, aspect || 1));
  return a >= 1 ? [long, Math.max(16, Math.round(long / a))] : [Math.max(16, Math.round(long * a)), long];
}

/** Splits text into at most `maxLines` lines that fit `width` (words never break mid-way unless one is too long). */
export function wrapText(words: string, measure: (t: string) => number, width: number, maxLines: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const w of words.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${w}` : w;
    if (measure(next) <= width || !line) line = next;
    else {
      out.push(line);
      line = w;
    }
  }
  if (line) out.push(line);
  if (out.length <= maxLines) return out;
  const kept = out.slice(0, maxLines);
  kept[maxLines - 1] = out.slice(maxLines - 1).join(' ');
  return kept;
}

type Ctx = CanvasRenderingContext2D;
const FONT = (px: number, weight = 700) => `${weight} ${Math.round(px)}px 'Outfit Variable', system-ui, sans-serif`;

/** Seeded pseudo-random numbers, so a demo picture looks the same every time. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Draws one frame of the screen. `t` (seconds) only moves scrolling text; `img` is the decoded picture for
 * `show: 'image'` (null while it loads).
 */
export function drawScreen(ctx: Ctx, w: number, h: number, look: ScreenLook, t = 0, img: CanvasImageSource | null = null): void {
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  switch (look.show) {
    case 'off':
      ctx.fillStyle = '#050608';
      ctx.fillRect(0, 0, w, h);
      break;
    case 'color':
      ctx.fillStyle = look.color;
      ctx.fillRect(0, 0, w, h);
      break;
    case 'gradient': {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, look.color);
      g.addColorStop(1, look.color2);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      break;
    }
    case 'text':
      ctx.fillStyle = look.color;
      ctx.fillRect(0, 0, w, h);
      drawText(ctx, w, h, look, t);
      break;
    case 'image':
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      if (img) drawImage(ctx, w, h, img, look.fit);
      else {
        ctx.fillStyle = '#9aa3ad';
        ctx.font = FONT(Math.min(w, h) * 0.12, 500);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Add a picture', w / 2, h / 2);
      }
      break;
    case 'demo':
      DEMOS[look.demo](ctx, w, h);
      break;
  }
  ctx.restore();
}

function drawText(ctx: Ctx, w: number, h: number, look: ScreenLook, t: number) {
  const text = look.text.trim() || ' ';
  ctx.fillStyle = look.textColor;
  ctx.textBaseline = 'middle';
  if (look.scroll) {
    // One line, as tall as the strip allows, running right to left and wrapping round.
    const px = h * 0.62;
    ctx.font = FONT(px);
    const gap = px * 2;
    const span = ctx.measureText(text).width + gap;
    const speed = Math.max(w * 0.18, px * 2.2); // px per second
    const x0 = w - ((t * speed) % span);
    ctx.textAlign = 'left';
    for (let x = x0 - span * Math.ceil(x0 / span); x < w; x += span) ctx.fillText(text, x, h / 2);
    return;
  }
  // Fixed text: the biggest size that fits, on up to three lines.
  ctx.textAlign = 'center';
  let px = Math.min(h * 0.6, w * 0.3);
  let lines: string[] = [text];
  for (; px > 8; px *= 0.9) {
    ctx.font = FONT(px);
    const maxLines = Math.max(1, Math.min(3, Math.floor((h * 0.85) / (px * 1.15))));
    lines = wrapText(text, (s) => ctx.measureText(s).width, w * 0.9, maxLines);
    if (lines.every((l) => ctx.measureText(l).width <= w * 0.9) && lines.length * px * 1.15 <= h * 0.9) break;
  }
  const top = h / 2 - ((lines.length - 1) * px * 1.15) / 2;
  lines.forEach((l, i) => ctx.fillText(l, w / 2, top + i * px * 1.15));
}

function drawImage(ctx: Ctx, w: number, h: number, img: CanvasImageSource, fit: ScreenLook['fit']) {
  const iw = (img as HTMLImageElement).naturalWidth || (img as { width: number }).width;
  const ih = (img as HTMLImageElement).naturalHeight || (img as { height: number }).height;
  if (!iw || !ih) return;
  if (fit === 'stretch') return ctx.drawImage(img, 0, 0, w, h);
  const k = fit === 'cover' ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih);
  const dw = iw * k;
  const dh = ih * k;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

// ------------------------------------------------------------------------------------------------ demo pictures

const DEMOS: Record<ScreenDemo, (ctx: Ctx, w: number, h: number) => void> = {
  landscape(ctx, w, h) {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#3d7fd0');
    sky.addColorStop(0.6, '#a8d3f0');
    sky.addColorStop(1, '#f6d9a8');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff4c8';
    ctx.beginPath();
    ctx.arc(w * 0.75, h * 0.3, Math.min(w, h) * 0.09, 0, Math.PI * 2);
    ctx.fill();
    const hills = (base: number, amp: number, color: string, phase: number) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += w / 40) ctx.lineTo(x, h * base - Math.sin(x / w * 5 + phase) * h * amp - Math.sin(x / w * 13 + phase) * h * amp * 0.3);
      ctx.lineTo(w, h);
      ctx.fill();
    };
    hills(0.62, 0.1, '#6c8fae', 1);
    hills(0.72, 0.07, '#3f7a4a', 2.5);
    hills(0.86, 0.04, '#2e5f36', 0.4);
  },
  city(ctx, w, h) {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0b1230');
    sky.addColorStop(1, '#3b2a5c');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    const r = rng(7);
    let x = 0;
    while (x < w) {
      const bw = w * (0.05 + r() * 0.08);
      const bh = h * (0.3 + r() * 0.55);
      ctx.fillStyle = '#141a2e';
      ctx.fillRect(x, h - bh, bw - 2, bh);
      const cell = Math.max(4, bw / 6);
      for (let wy = h - bh + cell; wy < h - cell; wy += cell * 1.4)
        for (let wx = x + cell * 0.6; wx < x + bw - cell; wx += cell * 1.3) {
          if (r() < 0.55) continue;
          ctx.fillStyle = r() < 0.8 ? '#ffd27a' : '#9fd3ff';
          ctx.fillRect(wx, wy, cell * 0.6, cell * 0.7);
        }
      x += bw;
    }
  },
  sports(ctx, w, h) {
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = i % 2 ? '#3f8f4a' : '#46994f';
      ctx.fillRect((i * w) / 10, 0, w / 10 + 1, h);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(2, h * 0.012);
    ctx.strokeRect(w * 0.04, h * 0.08, w * 0.92, h * 0.84);
    ctx.beginPath();
    ctx.moveTo(w / 2, h * 0.08);
    ctx.lineTo(w / 2, h * 0.92);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, h * 0.16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(10,20,40,0.85)';
    ctx.fillRect(w * 0.05, h * 0.1, w * 0.3, h * 0.13);
    ctx.fillStyle = '#fff';
    ctx.font = FONT(h * 0.085);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText('HOME 2 – 1 AWAY', w * 0.2, h * 0.165);
  },
  news(ctx, w, h) {
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#1d3f8f');
    bg.addColorStop(1, '#0d1d45');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.arc(w * 0.7, h * 0.4, h * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c62828';
    ctx.fillRect(0, h * 0.7, w * 0.32, h * 0.13);
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(w * 0.32, h * 0.7, w * 0.68, h * 0.13);
    ctx.fillStyle = '#0d1d45';
    ctx.fillRect(0, h * 0.83, w, h * 0.09);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = FONT(h * 0.07);
    ctx.fillStyle = '#fff';
    ctx.fillText('BREAKING', w * 0.03, h * 0.765);
    ctx.fillStyle = '#111';
    ctx.font = FONT(h * 0.06, 600);
    ctx.fillText('New homes designed in 3D', w * 0.35, h * 0.765);
    ctx.fillStyle = '#cfd8e8';
    ctx.font = FONT(h * 0.045, 500);
    ctx.fillText('Weather 31° · Markets up · Live', w * 0.03, h * 0.875);
  },
  bars(ctx, w, h) {
    ctx.fillStyle = '#16212d';
    ctx.fillRect(0, 0, w, h);
    const r = rng(3);
    const n = 7;
    const colors = ['#4dd0e1', '#ffb74d', '#81c784', '#e57373'];
    const left = w * 0.1;
    const bottom = h * 0.85;
    const bw = (w * 0.8) / n;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(left, bottom - (i * h * 0.7) / 4);
      ctx.lineTo(w * 0.9, bottom - (i * h * 0.7) / 4);
      ctx.stroke();
    }
    for (let i = 0; i < n; i++) {
      const bh = h * (0.15 + r() * 0.55);
      ctx.fillStyle = colors[i % colors.length]!;
      ctx.fillRect(left + i * bw + bw * 0.15, bottom - bh, bw * 0.7, bh);
    }
    ctx.fillStyle = '#e8eef5';
    ctx.font = FONT(Math.min(h * 0.07, w * 0.08));
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Sales this week', left, h * 0.04);
  },
  stage(ctx, w, h) {
    const bg = ctx.createRadialGradient(w / 2, h * 1.1, h * 0.1, w / 2, h * 0.6, Math.max(w, h));
    bg.addColorStop(0, '#ff4fa3');
    bg.addColorStop(0.35, '#7a3fa8');
    bg.addColorStop(1, '#120a2a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    const beams = ['rgba(80,200,255,0.25)', 'rgba(255,220,90,0.22)', 'rgba(255,90,160,0.22)'];
    for (let i = 0; i < 6; i++) {
      const x = (w * (i + 0.5)) / 6;
      ctx.fillStyle = beams[i % beams.length]!;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x - w * 0.12 + i * w * 0.04, h);
      ctx.lineTo(x + w * 0.02 + i * w * 0.04, h);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#fff';
    ctx.font = FONT(Math.min(h * 0.18, w * 0.1), 800);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('LIVE', w / 2, h * 0.45);
  },
};

/**
 * Shrinks a picture the user picked so it fits in the home file: at most `maxSide` pixels on the long side,
 * re-encoded as JPEG. Resolves to a data URL.
 */
export async function shrinkPicture(file: Blob, maxSide = 1024, quality = 0.82): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('not a picture'));
      i.src = url;
    });
    const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * k));
    c.height = Math.max(1, Math.round(img.naturalHeight * k));
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    let q = quality;
    let out = c.toDataURL('image/jpeg', q);
    while (out.length > 380_000 && q > 0.4) out = c.toDataURL('image/jpeg', (q -= 0.12)); // stay under the scene limit
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}
