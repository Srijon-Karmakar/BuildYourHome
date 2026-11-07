/** Time-of-day lighting (pure, so it can be unit tested). Plan convention: +x east, −z north, +y up. */
export interface SunState {
  /** Unit vector from the scene towards the sun. */
  dir: [number, number, number];
  elevationDeg: number;
  /** Directional light intensity (0 at night). */
  intensity: number;
  /** Light colour (warm near the horizon). */
  color: string;
  /** Image-based (ambient) light strength. */
  env: number;
  /** Flat background colour for tiers without a sky shader. */
  background: string;
  /** Hours as a 0..24 number, clamped. */
  hour: number;
  night: boolean;
  /** 0 in daylight, 1 in the middle of the night, in between for the hour or so around sunset and sunrise. */
  darkness: number;
}

const MAX_ELEVATION_DEG = 62; // roughly the noon sun in India (latitudes 8–35°)
const SUNRISE = 6;
const SUNSET = 18;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const hex = (n: number) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0');
function mix(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => hex(v + (pb[i]! - v) * t)).join('')}`;
}

export function sunAt(hours: number): SunState {
  const hour = clamp(hours, 0, 24);
  const day = hour > SUNRISE && hour < SUNSET;
  // 0 at sunrise → π at sunset: the sun travels east (+x) → south (+z) → west (−x).
  const a = clamp((hour - SUNRISE) / (SUNSET - SUNRISE), 0, 1) * Math.PI;
  const el = day ? Math.sin(a) * MAX_ELEVATION_DEG : 0;
  const e = (el * Math.PI) / 180;
  const dir: [number, number, number] = [Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)];
  const low = day ? clamp(1 - el / 28, 0, 1) : 1; // 1 near the horizon
  const strength = day ? clamp(el / 14, 0, 1) : 0; // fades in over the first 14° of climb
  const twilight = clamp(1 - Math.abs(hour - (hour < 12 ? SUNRISE - 0.5 : SUNSET + 0.5)) / 1.2, 0, 1);
  const dayBg = mix('#e6e4e0', '#dfe9f1', 1 - low);
  const bg = day ? mix(dayBg, '#f0c9a8', low * 0.6) : mix('#0a1020', '#6b5a63', twilight);
  const ramp = hour >= SUNSET ? clamp((hour - SUNSET) / 1.5, 0, 1) : hour <= SUNRISE ? clamp((SUNRISE - hour) / 1.5, 0, 1) : 0;
  const darkness = ramp * ramp * (3 - 2 * ramp);
  return {
    dir,
    elevationDeg: el,
    intensity: 1.45 * strength * (0.72 + 0.28 * (el / MAX_ELEVATION_DEG)),
    color: mix('#fff4e2', '#ffa860', low),
    env: day ? 0.2 + 0.5 * strength : 0.2 + 0.08 * twilight,
    background: bg,
    hour,
    night: !day,
    darkness,
  };
}

/** "2:30 pm" style label. */
export function hourLabel(hours: number): string {
  const h = clamp(hours, 0, 24);
  let m = Math.round((h % 1) * 60);
  let hh = Math.floor(h);
  if (m === 60) {
    m = 0;
    hh += 1;
  }
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${hh % 24 < 12 ? 'am' : 'pm'}`;
}

/** Where the moon is: it crosses the sky from east to west between sunset and sunrise, highest at midnight. */
export function moonDirection(hour: number): [number, number, number] {
  const h = hour >= 12 ? hour - 18 : hour + 6; // 0 at 6 pm .. 12 at 6 am
  const a = (Math.min(12, Math.max(0, h)) / 12) * Math.PI;
  const v: [number, number, number] = [Math.cos(a), Math.sin(a) * 0.85 + 0.12, -0.5];
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
}
