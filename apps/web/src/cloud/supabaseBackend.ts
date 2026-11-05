import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadScene, type Scene } from '@hd/scene-schema';
import { pruneUnlocks } from './entitlements';
import type { Backend, Entitlements, ProjectMeta, Result, Session } from './types';

/**
 * Real accounts + storage on Supabase (ADR-004). Table layout, row-level security and the public
 * `get_shared_project` function live in services/supabase/migrations/0001_init.sql.
 *
 * STATUS: written against the supabase-js v2 API and type-checked, but NOT yet exercised against a live
 * project — run the migration, set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in apps/web/.env.local, and test.
 * Entitlements are READ-ONLY here: subscriptions and ad unlocks may only be written by trusted server code
 * (billing webhooks / ad verification), so a browser can never grant itself premium access.
 */
const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = (error: string, conflict?: boolean): Result<never> => ({ ok: false, error, ...(conflict ? { conflict } : {}) });

/** Turn Supabase's technical errors into something a person can act on. */
function friendly(message: string | undefined): string {
  const m = (message ?? '').toLowerCase();
  if (m.includes('invalid login')) return 'Email or password is not right.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'An account with this email already exists. Try signing in.';
  if (m.includes('password')) return 'Use a stronger password (at least 8 characters).';
  if (m.includes('email')) return 'Enter a valid email address.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Wait a minute and try again.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'Could not reach the server. Check your connection.';
  return 'Something went wrong. Please try again.';
}

export class SupabaseBackend implements Backend {
  readonly mode = 'supabase' as const;
  private sb: SupabaseClient;

  constructor(url: string, anonKey: string) {
    this.sb = createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
  }

  private toSession(u: { id: string; email?: string | null } | null | undefined): Session | null {
    return u ? { userId: u.id, email: u.email ?? '' } : null;
  }

  async getSession(): Promise<Session | null> {
    const { data } = await this.sb.auth.getSession();
    return this.toSession(data.session?.user);
  }

  onSession(cb: (s: Session | null) => void): () => void {
    const { data } = this.sb.auth.onAuthStateChange((_e, session) => cb(this.toSession(session?.user)));
    return () => data.subscription.unsubscribe();
  }

  async signUp(email: string, password: string): Promise<Result<Session>> {
    const { data, error } = await this.sb.auth.signUp({ email: email.trim(), password });
    if (error) return fail(friendly(error.message));
    const s = this.toSession(data.session?.user);
    // With email confirmation enabled there is no session until the link in the email is opened.
    return s ? ok(s) : fail('Check your email to confirm your account, then sign in.');
  }

  async signIn(email: string, password: string): Promise<Result<Session>> {
    const { data, error } = await this.sb.auth.signInWithPassword({ email: email.trim(), password });
    const s = this.toSession(data.session?.user);
    return error || !s ? fail(friendly(error?.message)) : ok(s);
  }

  async signOut(): Promise<void> {
    await this.sb.auth.signOut();
  }

  async resetPassword(email: string): Promise<Result<{ demo: boolean }>> {
    const { error } = await this.sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + window.location.pathname });
    // Don't reveal whether the address has an account: only report problems that aren't about that.
    if (error && /rate|too many|network|fetch/i.test(error.message)) return fail(friendly(error.message));
    return ok({ demo: false });
  }

  onRecovery(cb: () => void): () => void {
    const { data } = this.sb.auth.onAuthStateChange((event) => event === 'PASSWORD_RECOVERY' && cb());
    return () => data.subscription.unsubscribe();
  }

  async updatePassword(newPassword: string): Promise<Result<true>> {
    const { error } = await this.sb.auth.updateUser({ password: newPassword });
    return error ? fail(friendly(error.message)) : ok(true);
  }

  async deleteAccount(): Promise<Result<true>> {
    // Needs services/supabase/migrations/0002_delete_account.sql (a security-definer function that removes the caller).
    const { error } = await this.sb.rpc('delete_my_account');
    if (error) return fail('Account deletion is not set up on this project yet (run migration 0002).');
    await this.sb.auth.signOut();
    return ok(true);
  }

  async listProjects(): Promise<ProjectMeta[]> {
    const { data, error } = await this.sb.from('projects').select('id, name, updated_at').order('updated_at', { ascending: false }).limit(100);
    if (error || !data) return [];
    return data.map((r) => ({ id: r.id as string, name: r.name as string, updatedAt: r.updated_at as string }));
  }

  async loadProject(id: string): Promise<Scene | null> {
    const { data, error } = await this.sb.from('projects').select('scene').eq('id', id).maybeSingle();
    if (error || !data) return null;
    const r = loadScene(data.scene);
    return r.ok ? r.scene : null;
  }

  async saveProject(scene: Scene, id?: string, expectedUpdatedAt?: string): Promise<Result<ProjectMeta>> {
    const session = await this.getSession();
    if (!session) return fail('Sign in to save to your account.');
    const row = { name: scene.meta.name.slice(0, 80) || 'My home', scene, schema_version: scene.schemaVersion };
    if (id) {
      // Optimistic concurrency: only overwrite the copy we last saw / loaded.
      let upd = this.sb.from('projects').update(row).eq('id', id);
      if (expectedUpdatedAt) upd = upd.eq('updated_at', expectedUpdatedAt);
      const { data, error } = await upd.select('id, name, updated_at').maybeSingle();
      if (error) return fail(error.message.includes('size') ? 'This home is too large to save.' : 'Could not save your home. Please try again.');
      if (!data) return expectedUpdatedAt ? fail('This home was changed somewhere else since you opened it.', true) : fail('This home no longer exists.');
      return ok({ id: data.id as string, name: data.name as string, updatedAt: data.updated_at as string });
    }
    const { data, error } = await this.sb.from('projects').insert({ ...row, owner_id: session.userId }).select('id, name, updated_at').single();
    if (error || !data) return fail(error?.message.includes('size') ? 'This home is too large to save.' : 'Could not save your home. Please try again.');
    return ok({ id: data.id as string, name: data.name as string, updatedAt: data.updated_at as string });
  }

  async deleteProject(id: string): Promise<void> {
    await this.sb.from('projects').delete().eq('id', id);
  }

  async createShare(projectId: string): Promise<Result<{ token: string }>> {
    const { data, error } = await this.sb.from('shares').insert({ project_id: projectId }).select('token').single();
    return error || !data ? fail('Could not create a link. Save this home to your account first.') : ok({ token: data.token as string });
  }

  async revokeShares(projectId: string): Promise<void> {
    await this.sb.from('shares').update({ revoked_at: new Date().toISOString() }).eq('project_id', projectId).is('revoked_at', null);
  }

  async getShared(token: string): Promise<Scene | null> {
    const { data, error } = await this.sb.rpc('get_shared_project', { p_token: token });
    if (error || !data) return null;
    const r = loadScene(data);
    return r.ok ? r.scene : null;
  }

  async getEntitlements(): Promise<Entitlements> {
    const session = await this.getSession();
    if (!session) return { subscribed: false, unlocks: {} };
    const [sub, unl] = await Promise.all([
      this.sb.from('subscriptions').select('status, plan, current_period_end').eq('user_id', session.userId).maybeSingle(),
      this.sb.from('unlocks').select('asset_id, expires_at').eq('user_id', session.userId),
    ]);
    const end = sub.data?.current_period_end ? Date.parse(sub.data.current_period_end as string) : Infinity;
    const subscribed = (sub.data?.status === 'active' || sub.data?.status === 'trialing') && end > Date.now();
    const unlocks: Entitlements['unlocks'] = {};
    for (const r of unl.data ?? []) unlocks[r.asset_id as string] = (r.expires_at as string | null) ?? null;
    // A 'gift' plan row (created by the `redeem_code` function, see migration 0003) unlocks everything.
    const gifted = subscribed && sub.data?.plan === 'gift';
    return pruneUnlocks({ subscribed: subscribed && !gifted, gifted, unlocks });
  }

  async redeemCode(code: string): Promise<Result<Entitlements>> {
    if (!(await this.getSession())) return fail('Sign in to redeem a code.');
    const { data, error } = await this.sb.rpc('redeem_code', { p_code: code });
    if (error) return fail('Could not check the code. Please try again.');
    switch (data as string) {
      case 'ok':
        return ok(await this.getEntitlements());
      case 'throttled':
        return fail('Too many tries. Please wait a while and try again.');
      case 'expired':
        return fail('That code has expired.');
      case 'used_up':
        return fail('That code has already been used up.');
      default:
        return fail('That code isn’t valid.');
    }
  }

  async unlockWithAd(): Promise<Result<Entitlements>> {
    return fail('Rewarded unlocks need server-side ad verification, which is not switched on yet.');
  }

  async setSubscription(): Promise<Result<Entitlements>> {
    return fail('Subscriptions are managed through billing, which is not switched on yet.');
  }
}
