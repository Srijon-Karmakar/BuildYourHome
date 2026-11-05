import { describe, expect, it } from 'vitest';
import { createEmptyScene, loadScene, newId, Scene, SCHEMA_VERSION } from './index';

const fixedNow = () => new Date('2026-01-01T00:00:00.000Z');

describe('createEmptyScene', () => {
  it('produces a scene that passes validation', () => {
    expect(Scene.safeParse(createEmptyScene()).success).toBe(true);
  });

  it('has exactly one ground level at elevation 0', () => {
    const s = createEmptyScene({ now: fixedNow });
    expect(s.levelOrder).toHaveLength(1);
    expect(s.levels[s.levelOrder[0]!]?.elevation).toBe(0);
    expect(s.meta.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('is deterministic with injected rng/clock', () => {
    const mk = () => createEmptyScene({ now: fixedNow, rng: () => 0.5 });
    expect(mk()).toEqual(mk());
  });
});

describe('newId', () => {
  it('uses the prefix and is unique enough', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newId('wall')));
    expect(ids.size).toBe(1000);
    expect([...ids][0]).toMatch(/^wall_[a-z0-9]{8}$/);
  });
});

describe('loadScene', () => {
  it('round-trips through JSON', () => {
    const s = createEmptyScene();
    const r = loadScene(JSON.parse(JSON.stringify(s)));
    expect(r.ok && r.scene).toEqual(s);
  });

  it('rejects non-objects and missing version', () => {
    expect(loadScene(null).ok).toBe(false);
    expect(loadScene({}).ok).toBe(false);
  });

  it('rejects scenes from a newer version', () => {
    const r = loadScene({ ...createEmptyScene(), schemaVersion: SCHEMA_VERSION + 1 });
    expect(r.ok).toBe(false);
  });

  it('reports invalid structure with a path', () => {
    const bad = { ...createEmptyScene(), lighting: { timeOfDay: 99 } };
    const r = loadScene(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('lighting.timeOfDay');
  });
});
