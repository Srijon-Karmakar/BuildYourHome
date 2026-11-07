/** Pure quality-tier logic (no React/Three) so it can be unit tested. See ADR-010. */
export type Tier = 'low' | 'medium' | 'high';
export type QualitySetting = 'auto' | Tier;

export const TIER_ORDER: readonly Tier[] = ['low', 'medium', 'high'];

export interface TierConfig {
  /** Device-pixel-ratio range handed to the canvas ([min, max]). */
  dpr: [number, number];
  /** Directional light casts shadows. */
  shadows: boolean;
  shadowMapSize: number;
  /** Procedural environment (image-based lighting) resolution. */
  envResolution: number;
  /** Screen-space ambient occlusion + MSAA via the post-processing composer. */
  ao: boolean;
  msaa: number;
  /** Procedural texture size in px (plaster / wood). */
  textureSize: number;
  normalMaps: boolean;
  /** Photo-scan PBR textures are downloaded and used (Medium and up). */
  photoTextures: boolean;
  /** Ambient occlusion quality when `ao` is on (lighter on Medium so desktops stay fast). */
  aoQuality: 'performance' | 'medium';
  /** Sky shader instead of a flat background colour. */
  sky: boolean;
  /** Glossy floors (polished tile, marble) get a clear-coat layer that mirrors the room's lights and windows. */
  gloss: boolean;
  /** Soft glow around bright lamps at night (needs the post-processing composer). */
  bloom: boolean;
  /** Real point lights spent on the lamps nearest the camera (the rest only glow). */
  lamps: number;
  /** Real spot lights (downlights, panels, picture lights) spent on the nearest fittings. */
  spots: number;
}

export const TIERS: Record<Tier, TierConfig> = {
  low: { dpr: [1, 1], shadows: false, shadowMapSize: 1024, envResolution: 64, ao: false, msaa: 0, textureSize: 256, normalMaps: false, photoTextures: false, aoQuality: 'performance', sky: false, gloss: false, bloom: false, lamps: 0, spots: 0 },
  medium: { dpr: [1, 1.5], shadows: true, shadowMapSize: 1024, envResolution: 128, ao: true, msaa: 0, textureSize: 512, normalMaps: true, photoTextures: true, aoQuality: 'performance', sky: true, gloss: true, bloom: true, lamps: 3, spots: 2 },
  high: { dpr: [1, 2], shadows: true, shadowMapSize: 2048, envResolution: 256, ao: true, msaa: 4, textureSize: 1024, normalMaps: true, photoTextures: true, aoQuality: 'medium', sky: true, gloss: true, bloom: true, lamps: 6, spots: 3 },
};

export const stepDown = (t: Tier): Tier => TIER_ORDER[Math.max(0, TIER_ORDER.indexOf(t) - 1)]!;
export const canStepDown = (t: Tier): boolean => TIER_ORDER.indexOf(t) > 0;

export interface DeviceHints {
  coarsePointer: boolean;
  /** CSS pixels of the shorter screen side. */
  shortSide: number;
  /** navigator.deviceMemory in GB when exposed (Chromium), else undefined. */
  memoryGb?: number;
  cores?: number;
}

/** Starting tier for "Auto" — a guess, corrected by the frame-rate governor. */
export function initialTier(d: DeviceHints): Tier {
  if (!d.coarsePointer) return 'high';
  if ((d.memoryGb !== undefined && d.memoryGb <= 2) || (d.cores !== undefined && d.cores <= 4)) return 'low';
  return 'medium';
}

/** Frame rate below which the auto governor steps the tier down (while interacting). */
export const GOVERNOR_MIN_FPS = 38;
export const GOVERNOR_WINDOW_FRAMES = 45;
export const GOVERNOR_COOLDOWN_MS = 3000;

export function shouldStepDown(samplesMs: readonly number[], tier: Tier, sinceLastStepMs: number): boolean {
  if (!canStepDown(tier)) return false;
  if (sinceLastStepMs < GOVERNOR_COOLDOWN_MS) return false;
  if (samplesMs.length < GOVERNOR_WINDOW_FRAMES) return false;
  const recent = samplesMs.slice(-GOVERNOR_WINDOW_FRAMES);
  const avg = recent.reduce((s, v) => s + v, 0) / recent.length;
  return 1000 / avg < GOVERNOR_MIN_FPS;
}
