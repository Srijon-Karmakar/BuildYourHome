import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmptyScene, type Scene } from '@hd/scene-schema';
import { fileNameFor, parseSceneFile, serializeScene, startAutosave, useSaveStatus } from './persistence';

afterEach(() => vi.useRealTimers());

describe('file round trip', () => {
  it('serialises and parses back to an equal scene', () => {
    const s = createEmptyScene({ name: 'Villa' });
    const r = parseSceneFile(serializeScene(s));
    expect(r.ok && r.scene).toEqual(s);
  });

  it('rejects garbage and invalid structures with a readable message', () => {
    const a = parseSceneFile('not json');
    expect(a.ok).toBe(false);
    const b = parseSceneFile(JSON.stringify({ ...createEmptyScene(), levels: 5 }));
    expect(b.ok).toBe(false);
    if (!b.ok) expect(b.error).toContain('levels');
    expect(parseSceneFile('{}').ok).toBe(false);
  });

  it('builds safe file names', () => {
    expect(fileNameFor(createEmptyScene({ name: 'My Villa / 2nd try!' }))).toBe('my-villa-2nd-try.homedesign.json');
    expect(fileNameFor(createEmptyScene({ name: '???' }))).toBe('home.homedesign.json');
  });
});

describe('autosave', () => {
  function setup() {
    vi.useFakeTimers();
    let scene: Scene = createEmptyScene();
    const subs = new Set<() => void>();
    const save = vi.fn<(s: Scene) => Promise<undefined>>(async () => undefined);
    const as = startAutosave((f) => (subs.add(f), () => subs.delete(f)), () => scene, save, 500);
    const change = () => {
      scene = { ...scene, meta: { ...scene.meta, name: scene.meta.name + '!' } };
      subs.forEach((f) => f());
    };
    return { as, save, change };
  }

  it('saves once after a burst of changes (debounced) and reports the status', async () => {
    const { save, change } = setup();
    change();
    change();
    change();
    expect(useSaveStatus.getState().status).toBe('saving');
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(600);
    expect(save).toHaveBeenCalledTimes(1);
    expect(useSaveStatus.getState().status).toBe('saved');
  });

  it('stamps updatedAt on what it saves', async () => {
    const { save, change } = setup();
    change();
    await vi.advanceTimersByTimeAsync(600);
    const saved = save.mock.calls[0]![0];
    expect(Date.parse(saved.meta.updatedAt)).toBeGreaterThan(Date.parse(saved.meta.createdAt) - 1);
  });

  it('flush() saves immediately and does nothing when nothing changed', async () => {
    const { as, save, change } = setup();
    await as.flush();
    expect(save).not.toHaveBeenCalled();
    change();
    await as.flush();
    expect(save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('a failing save reports an error and editing continues', async () => {
    vi.useFakeTimers();
    let scene = createEmptyScene();
    const subs = new Set<() => void>();
    startAutosave((f) => (subs.add(f), () => subs.delete(f)), () => scene, async () => { throw new Error('quota'); }, 100);
    scene = { ...scene, id: 'x' };
    subs.forEach((f) => f());
    await vi.advanceTimersByTimeAsync(200);
    expect(useSaveStatus.getState().status).toBe('error');
  });

  it('stop() cancels a pending save', async () => {
    const { as, save, change } = setup();
    change();
    as.stop();
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).not.toHaveBeenCalled();
  });
});
