import { describe, expect, it } from 'vitest';
import { createEmptyScene } from '@hd/scene-schema';
import { adsEnabled, accessFor, canUse, lockLabel, pruneUnlocks, REWARDED_UNLOCK_MS } from './entitlements';
import { DEMO_REDEEM_CODE, LocalBackend, memoryKV } from './localBackend';
import { NO_ENTITLEMENTS, normalizeCode } from './types';

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

describe('LocalBackend: password reset, change, delete', () => {
  it('reset opens the recovery step for a real account and reveals nothing for unknown ones', async () => {
    const b = new LocalBackend(memoryKV());
    await b.signUp('a@b.co', 'password123');
    await b.signOut();
    let recoveries = 0;
    b.onRecovery(() => recoveries++);
    expect((await b.resetPassword('nope')).ok).toBe(false); // malformed
    const unknown = await b.resetPassword('who@b.co');
    expect(unknown).toEqual({ ok: true, value: { demo: true } }); // same answer, no hint
    expect(recoveries).toBe(0);
    expect((await b.resetPassword('A@B.co')).ok).toBe(true);
    expect(recoveries).toBe(1);
    expect((await b.getSession())?.email).toBe('a@b.co');
  });

  it('changing the password works, is validated, and the old one stops working', async () => {
    const b = new LocalBackend(memoryKV());
    expect((await b.updatePassword('newpassword1')).ok).toBe(false); // signed out
    await b.signUp('a@b.co', 'password123');
    expect((await b.updatePassword('short')).ok).toBe(false);
    expect((await b.updatePassword('brand new pass')).ok).toBe(true);
    await b.signOut();
    expect((await b.signIn('a@b.co', 'password123')).ok).toBe(false);
    expect((await b.signIn('a@b.co', 'brand new pass')).ok).toBe(true);
  });

  it('deleting the account removes the user, their homes, links and entitlements — and nobody else’s', async () => {
    const kv = memoryKV();
    const b = new LocalBackend(kv);
    await b.signUp('other@b.co', 'password123');
    const keep = await b.saveProject(createEmptyScene({ name: 'Keep me' }));
    await b.signOut();
    await b.signUp('a@b.co', 'password123');
    const mine = await b.saveProject(createEmptyScene({ name: 'Mine' }));
    if (!mine.ok || !keep.ok) throw new Error('setup failed');
    const share = await b.createShare(mine.value.id);
    if (!share.ok) throw new Error('share failed');
    await b.setSubscription(true);
    expect((await b.deleteAccount()).ok).toBe(true);
    expect(await b.getSession()).toBeNull();
    expect(await b.getShared(share.value.token)).toBeNull();
    expect((await b.signIn('a@b.co', 'password123')).ok).toBe(false);
    expect(JSON.stringify([kv.get('hd.local.projects'), kv.get('hd.local.users')])).not.toContain('Mine');
    await b.signIn('other@b.co', 'password123');
    expect((await b.listProjects()).map((p) => p.name)).toEqual(['Keep me']);
    await b.signOut();
    expect((await b.deleteAccount()).ok).toBe(false); // signed out
  });
});

describe('LocalBackend: save conflicts', () => {
  it('a save based on an outdated copy is refused and overwrites nothing', async () => {
    let t = Date.parse('2026-01-01T00:00:00Z');
    const kv = memoryKV();
    const laptop = new LocalBackend(kv, () => (t += 1000));
    await laptop.signUp('a@b.co', 'password123');
    const first = await laptop.saveProject(createEmptyScene({ name: 'v1' }));
    if (!first.ok) throw new Error('save failed');
    const phone = new LocalBackend(kv, () => (t += 1000)); // same account, another device
    const phoneSave = await phone.saveProject(createEmptyScene({ name: 'phone edit' }), first.value.id, first.value.updatedAt);
    expect(phoneSave.ok).toBe(true);

    const stale = await laptop.saveProject(createEmptyScene({ name: 'laptop edit' }), first.value.id, first.value.updatedAt);
    expect(stale.ok).toBe(false);
    expect(!stale.ok && stale.conflict).toBe(true);
    expect((await laptop.loadProject(first.value.id))?.meta.name).toBe('phone edit');

    // choosing "keep mine" = save again without an expectation
    expect((await laptop.saveProject(createEmptyScene({ name: 'laptop edit' }), first.value.id)).ok).toBe(true);
    expect((await phone.loadProject(first.value.id))?.meta.name).toBe('laptop edit');
  });

  it('an up-to-date save succeeds and returns the new timestamp to expect next time', async () => {
    let t = Date.parse('2026-01-01T00:00:00Z');
    const b = new LocalBackend(memoryKV(), () => (t += 1000));
    await b.signUp('a@b.co', 'password123');
    const one = await b.saveProject(createEmptyScene({ name: 'v1' }));
    if (!one.ok) throw new Error('save failed');
    const two = await b.saveProject(createEmptyScene({ name: 'v2' }), one.value.id, one.value.updatedAt);
    if (!two.ok) throw new Error('save failed');
    expect(two.value.updatedAt > one.value.updatedAt).toBe(true);
    expect((await b.saveProject(createEmptyScene({ name: 'v3' }), one.value.id, two.value.updatedAt)).ok).toBe(true);
  });
});

describe('redeem codes', () => {
  const premium2 = { id: 'bed-double', tier: 'premium' as const };
  it('a gifted account can use every tier and sees no ads, without being a subscription', () => {
    const g = { subscribed: false, gifted: true, unlocks: {} };
    expect(canUse(premium2, g) && canUse(rewarded, g)).toBe(true);
    expect(adsEnabled(g)).toBe(false);
    expect(canUse(premium2, { subscribed: false, unlocks: {} })).toBe(false);
  });

  it('normalizeCode ignores case, spaces and dashes', () => {
    expect(normalizeCode(' ab-12 cd ')).toBe('AB12CD');
  });

  it('the demo backend needs a sign-in, refuses wrong codes and remembers a right one per account', async () => {
    const b = new LocalBackend(memoryKV());
    expect((await b.redeemCode(DEMO_REDEEM_CODE)).ok).toBe(false); // guest
    await b.signUp('gift@example.com', 'password one');
    expect((await b.redeemCode('nope')).ok).toBe(false);
    expect((await b.getEntitlements()).gifted).toBeUndefined();
    const r = await b.redeemCode(' home demo ');
    expect(r.ok && r.value.gifted).toBe(true);
    expect((await b.getEntitlements()).gifted).toBe(true);
    await b.signOut();
    expect((await b.getEntitlements()).gifted).toBeUndefined(); // a guest on the same browser gets nothing
    await b.signUp('other@example.com', 'password two');
    expect((await b.getEntitlements()).gifted).toBeUndefined(); // another account neither
  });
});
