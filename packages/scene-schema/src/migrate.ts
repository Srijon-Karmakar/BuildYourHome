import { SCHEMA_VERSION, Scene } from './schema';

/** Each entry upgrades a raw scene from version N to N+1. Add one per schema change + a fixture test. */
const MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {};

export type LoadResult =
  | { ok: true; scene: Scene }
  | { ok: false; error: string };

/** Parse untrusted JSON (file, IndexedDB, network): migrate to current version, then validate. */
export function loadScene(raw: unknown): LoadResult {
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'Scene is not an object' };
  let cur = raw as Record<string, unknown>;
  let v = cur.schemaVersion;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) {
    return { ok: false, error: 'Missing or invalid schemaVersion' };
  }
  if (v > SCHEMA_VERSION) {
    return { ok: false, error: `Scene is from a newer app version (v${v}); please update` };
  }
  while (v < SCHEMA_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) return { ok: false, error: `No migration from schema v${v}` };
    cur = { ...step(cur), schemaVersion: v + 1 };
    v += 1;
  }
  const parsed = Scene.safeParse(cur);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
  }
  return { ok: true, scene: parsed.data };
}
