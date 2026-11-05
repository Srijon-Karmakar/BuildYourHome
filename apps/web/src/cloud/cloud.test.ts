import { describe, expect, it } from 'vitest';
import { createEmptyScene } from '@hd/scene-schema';
import { adsEnabled, accessFor, canUse, lockLabel, pruneUnlocks, REWARDED_UNLOCK_MS } from './entitlements';
import { LocalBackend, memoryKV } from './localBackend';
import { NO_ENTITLEMENTS } from './types';

const free = { id: 'a', tier: 'free' as const };
const premium = { id: 'bed-double', tier: 'premium' as const };
const rewarded = { id: 'armchair', tier: 'rewarded' as const };

describe('entitlement rules', () => {
  it('free is always usable; premium and rewarded are locked for guests', () => {
    expect(canUse(free, NO_ENTITLEMENTS)).toBe(true);
    expect(accessFor(premium, NO_ENTITLEMENTS)).toBe('locked-premium');
    expect(accessFor(rewarded, NO_ENTITLEMENTS)).toBe('locked-rewarded');
    expect(lockLabel('locked-premium')).toBe('Premium');
    expect(lockLabel('locked-rewarded')).toBe('Watch ad');
    expect(lockLabel('free')).toBeNull();
  });

  it('a subscription unlocks everything and turns ads off', () => {
    const ent = { subscribed: true, unlocks: {} };
    expect(canUse(premium, ent) && canUse(rewarded, ent)).toBe(true);
    expect(adsEnabled(ent)).toBe(false);
    expect(adsEnabled(NO_ENTITLEMENTS)).toBe(true);
  });

  it('an ad unlock opens only that rewarded item, only until it expires; it never opens premium items', () => {
    const now = Date.parse('2026-01-01T00:00:00Z');
    const live = { subscribed: false, unlocks: { armchair: new Date(now + 1000).toISOString() } };
    expect(accessFor(rewarded, live, now)).toBe('unlocked');
    expect(accessFor(rewarded, live, now + 2000)).toBe('locked-rewarded');
    expect(accessFor({ id: 'floor-lamp', tier: 'rewarded' }, live, now)).toBe('locked-rewarded');
    expect(canUse(premium, { subscribed: false, unlocks: { 'bed-double': null } }, now)).toBe(false);
    expect(accessFor(rewarded, { subscribed: false, unlocks: { armchair: null } }, now)).toBe('unlocked');
  });

  it('prunes expired unlocks', () => {
    const now = Date.parse('2026-01-01T00:00:00Z');
    const p = pruneUnlocks({ subscribed: false, unlocks: { a: new Date(now - 1).toISOString(), b: new Date(now + 1).toISOString(), c: null } }, now);
    expect(Object.keys(p.unlocks).sort()).toEqual(['b', 'c']);
  });
});

describe('LocalBackend: accounts', () => {
  const mk = () => new LocalBackend(memoryKV());

  it('signs up, rejects bad input and duplicates, signs in and out', async () => {
    const b = mk();
    expect((await b.signUp('nope', 'longenough')).ok).toBe(false);
    expect((await b.signUp('a@b.co', 'short')).ok).toBe(false);
    const up = await b.signUp('  Owner@Example.com ', 'correct horse');
    expect(up.ok && up.value.email).toBe('owner@example.com');
    expect((await b.getSession())?.email).toBe('owner@example.com');
    expect((await b.signUp('owner@example.com', 'another one')).ok).toBe(false);
    await b.signOut();
    expect(await b.getSession()).toBeNull();
    const wrong = await b.signIn('owner@example.com', 'wrong password');
    const unknown = await b.signIn('who@example.com', 'whatever one');
    expect(!wrong.ok && !unknown.ok && wrong.error === unknown.error).toBe(true); // same message either way
    expect((await b.signIn('OWNER@example.com', 'correct horse')).ok).toBe(true);
  });

  it('never stores the password itself', async () => {
    const kv = memoryKV();
    await new LocalBackend(kv).signUp('a@b.co', 'my secret pass');
    expect(kv.get('hd.local.users')).not.toContain('my secret pass');
  });

  it('notifies listeners of session changes', async () => {
    const b = mk();
    const seen: Array<string | null> = [];
    const off = b.onSession((s) => seen.push(s?.email ?? null));
    await b.signUp('a@b.co', 'password123');
    await b.signOut();
    off();
    await b.signIn('a@b.co', 'password123');
    expect(seen).toEqual(['a@b.co', null]);
  });
});

describe('LocalBackend: projects and sharing', () => {
  it('saves, lists (newest first), loads, updates and deletes only your own homes', async () => {
    let t = Date.parse('2026-01-01T00:00:00Z');
    const kv = memoryKV();
    const b = new LocalBackend(kv, () => (t += 1000));
    expect((await b.saveProject(createEmptyScene())).ok).toBe(false); // signed out
    await b.signUp('a@b.co', 'password123');
    const one = await b.saveProject(createEmptyScene({ name: 'One' }));
    const two = await b.saveProject(createEmptyScene({ name: 'Two' }));
    expect(one.ok && two.ok).toBe(true);
    if (!one.ok || !two.ok) return;
    expect((await b.listProjects()).map((p) => p.name)).toEqual(['Two', 'One']);
    await b.saveProject(createEmptyScene({ name: 'One v2' }), one.value.id);
    expect((await b.listProjects()).map((p) => p.name)).toEqual(['One v2', 'Two']);
    expect((await b.loadProject(one.value.id))?.meta.name).toBe('One v2');

    const other = new LocalBackend(kv);
    await other.signUp('c@d.co', 'password123');
    expect(await other.listProjects()).toEqual([]);
    expect(await other.loadProject(one.value.id)).toBeNull();
    expect((await other.saveProject(createEmptyScene(), one.value.id)).ok).toBe(false);

    // (one browser = one session: signing in as someone else replaced ours)
    await b.signIn('a@b.co', 'password123');
    await b.deleteProject(one.value.id);
    expect((await b.listProjects()).map((p) => p.name)).toEqual(['Two']);
  });

  it('share links work without signing in and die when revoked or deleted', async () => {
    const kv = memoryKV();
    const b = new LocalBackend(kv);
    await b.signUp('a@b.co', 'password123');
    const p = await b.saveProject(createEmptyScene({ name: 'Shared home' }));
    if (!p.ok) throw new Error('save failed');
    const s = await b.createShare(p.value.id);
    if (!s.ok) throw new Error('share failed');
    const stranger = new LocalBackend(kv); // fresh session state, same storage
    await stranger.signOut();
    expect((await stranger.getShared(s.value.token))?.meta.name).toBe('Shared home');
    expect(await stranger.getShared('share_nope')).toBeNull();
    await b.signIn('a@b.co', 'password123');
    await b.revokeShares(p.value.id);
    expect(await stranger.getShared(s.value.token)).toBeNull();
    const s2 = await b.createShare(p.value.id);
    if (!s2.ok) throw new Error('share failed');
    await b.deleteProject(p.value.id);
    expect(await stranger.getShared(s2.value.token)).toBeNull();
    expect((await b.createShare('proj_missing')).ok).toBe(false);
  });
});

describe('LocalBackend: entitlements', () => {
  it('guests can unlock a rewarded item with an ad for 24 h; premium items refuse', async () => {
    let t = Date.parse('2026-01-01T00:00:00Z');
    const b = new LocalBackend(memoryKV(), () => t);
    expect((await b.getEntitlements()).subscribed).toBe(false);
    const r = await b.unlockWithAd('armchair');
    expect(r.ok && Object.keys(r.value.unlocks)).toEqual(['armchair']);
    expect(canUse(rewarded, await b.getEntitlements(), t)).toBe(true);
    t += REWARDED_UNLOCK_MS + 1;
    expect(canUse(rewarded, await b.getEntitlements(), t)).toBe(false);
    expect((await b.unlockWithAd('bed-double')).ok).toBe(false);
    expect((await b.unlockWithAd('nope')).ok).toBe(false);
  });

  it('a subscription needs an account and is per user', async () => {
    const kv = memoryKV();
    const b = new LocalBackend(kv);
    expect((await b.setSubscription(true)).ok).toBe(false);
    await b.signUp('a@b.co', 'password123');
    await b.setSubscription(true);
    expect((await b.getEntitlements()).subscribed).toBe(true);
    await b.signOut();
    expect((await b.getEntitlements()).subscribed).toBe(false);
    await b.signIn('a@b.co', 'password123');
    expect((await b.getEntitlements()).subscribed).toBe(true);
    await b.setSubscription(false);
    expect((await b.getEntitlements()).subscribed).toBe(false);
  });
});
