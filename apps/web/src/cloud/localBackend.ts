import { loadScene, type Scene } from '@hd/scene-schema';
import { pruneUnlocks, REWARDED_UNLOCK_MS } from './entitlements';
import { NO_ENTITLEMENTS, normalizeCode, type Backend, type Entitlements, type ProjectMeta, type Result, type Session } from './types';
import { getAsset } from '@hd/assets';

/** Minimal key-value storage so the backend can be tested without a browser. */
export interface KV {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export function browserKV(): KV {
  const mem = new Map<string, string>();
  return {
    get: (k) => {
      try {
        return localStorage.getItem(k) ?? mem.get(k) ?? null;
      } catch {
        return mem.get(k) ?? null;
      }
    },
    set: (k, v) => {
      try {
        localStorage.setItem(k, v);
      } catch {
        mem.set(k, v);
      }
    },
    remove: (k) => {
      try {
        localStorage.removeItem(k);
      } catch {
        /* ignore */
      }
      mem.delete(k);
    },
  };
}

export const memoryKV = (): KV => {
  const m = new Map<string, string>();
  return { get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v), remove: (k) => void m.delete(k) };
};

interface UserRec {
  id: string;
  email: string;
  hash: string;
}
interface ProjectRec {
  id: string;
  owner: string;
  name: string;
  updatedAt: string;
  scene: Scene;
}

const K = { users: 'hd.local.users', session: 'hd.local.session', projects: 'hd.local.projects', shares: 'hd.local.shares', ent: 'hd.local.ent.' };
export const MIN_PASSWORD = 8;
/** The demo backend has no server, so it accepts one public code (the real check is the `redeem_code` SQL function). */
export const DEMO_REDEEM_CODE = 'HOME-DEMO';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function hash(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`hd-local:${text}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const randomId = (prefix: string): string => {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return `${prefix}_${[...a].map((b) => b.toString(36).padStart(2, '0')).join('')}`;
};

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = (error: string, conflict?: boolean): Result<never> => ({ ok: false, error, ...(conflict ? { conflict } : {}) });

/**
 * Browser-only stand-in for the cloud: accounts, projects, share links, subscription and ad unlocks stored in
 * localStorage. It lets the whole product (sign-in, saving, sharing, free vs premium) run and be tested with no
 * server. It is NOT secure and does not sync between devices — that is what SupabaseBackend is for.
 */
export class LocalBackend implements Backend {
  readonly mode = 'local' as const;
  private listeners = new Set<(s: Session | null) => void>();
  private recoveryListeners = new Set<() => void>();

  constructor(
    private kv: KV = browserKV(),
    private now: () => number = Date.now,
  ) {}

  private read<T>(key: string, fallback: T): T {
    try {
      const raw = this.kv.get(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }
  private write(key: string, v: unknown): void {
    this.kv.set(key, JSON.stringify(v));
  }
  private emit(s: Session | null): void {
    this.listeners.forEach((f) => f(s));
  }

  async getSession(): Promise<Session | null> {
    return this.read<Session | null>(K.session, null);
  }
  onSession(cb: (s: Session | null) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  async signUp(emailRaw: string, password: string): Promise<Result<Session>> {
    const email = emailRaw.trim().toLowerCase();
    if (!EMAIL.test(email)) return fail('Enter a valid email address.');
    if (password.length < MIN_PASSWORD) return fail(`Use a password of at least ${MIN_PASSWORD} characters.`);
    const users = this.read<UserRec[]>(K.users, []);
    if (users.some((u) => u.email === email)) return fail('An account with this email already exists. Try signing in.');
    const user: UserRec = { id: randomId('user'), email, hash: await hash(password) };
    this.write(K.users, [...users, user]);
    return ok(this.startSession(user));
  }

  async signIn(emailRaw: string, password: string): Promise<Result<Session>> {
    const email = emailRaw.trim().toLowerCase();
    const user = this.read<UserRec[]>(K.users, []).find((u) => u.email === email);
    // Same message for "no such user" and "wrong password" (don't reveal which emails exist).
    if (!user || user.hash !== (await hash(password))) return fail('Email or password is not right.');
    return ok(this.startSession(user));
  }

  private startSession(u: UserRec): Session {
    const s = { userId: u.id, email: u.email };
    this.write(K.session, s);
    this.emit(s);
    return s;
  }

  async signOut(): Promise<void> {
    this.kv.remove(K.session);
    this.emit(null);
  }

  async resetPassword(emailRaw: string): Promise<Result<{ demo: boolean }>> {
    const email = emailRaw.trim().toLowerCase();
    if (!EMAIL.test(email)) return fail('Enter a valid email address.');
    const user = this.read<UserRec[]>(K.users, []).find((u) => u.email === email);
    // Demo only: no email can be sent, so "opening the link" is simulated by signing in and asking for a new password.
    // (This backend is not secure by design — see the class comment.)
    if (user) {
      this.startSession(user);
      this.recoveryListeners.forEach((f) => f());
    }
    return ok({ demo: true });
  }

  onRecovery(cb: () => void): () => void {
    this.recoveryListeners.add(cb);
    return () => this.recoveryListeners.delete(cb);
  }

  async updatePassword(newPassword: string): Promise<Result<true>> {
    const s = await this.getSession();
    if (!s) return fail('Sign in first.');
    if (newPassword.length < MIN_PASSWORD) return fail(`Use a password of at least ${MIN_PASSWORD} characters.`);
    const users = this.read<UserRec[]>(K.users, []);
    const h = await hash(newPassword);
    this.write(K.users, users.map((u) => (u.id === s.userId ? { ...u, hash: h } : u)));
    return ok(true);
  }

  async deleteAccount(): Promise<Result<true>> {
    const s = await this.getSession();
    if (!s) return fail('Sign in first.');
    const projects = this.read<ProjectRec[]>(K.projects, []);
    const mine = new Set(projects.filter((p) => p.owner === s.userId).map((p) => p.id));
    this.write(K.projects, projects.filter((p) => !mine.has(p.id)));
    const shares = this.read<Record<string, string>>(K.shares, {});
    this.write(K.shares, Object.fromEntries(Object.entries(shares).filter(([, pid]) => !mine.has(pid))));
    this.write(K.users, this.read<UserRec[]>(K.users, []).filter((u) => u.id !== s.userId));
    this.kv.remove(K.ent + s.userId);
    this.kv.remove(K.session);
    this.emit(null);
    return ok(true);
  }

  // ------------------------------------------------------------------ projects
  private async requireUser(): Promise<Session | null> {
    return this.getSession();
  }

  async listProjects(): Promise<ProjectMeta[]> {
    const s = await this.requireUser();
    if (!s) return [];
    return this.read<ProjectRec[]>(K.projects, [])
      .filter((p) => p.owner === s.userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(({ id, name, updatedAt }) => ({ id, name, updatedAt }));
  }

  async loadProject(id: string): Promise<Scene | null> {
    const s = await this.requireUser();
    const p = this.read<ProjectRec[]>(K.projects, []).find((x) => x.id === id && x.owner === s?.userId);
    if (!p) return null;
    const r = loadScene(p.scene);
    return r.ok ? r.scene : null;
  }

  async saveProject(scene: Scene, id?: string, expectedUpdatedAt?: string): Promise<Result<ProjectMeta>> {
    const s = await this.requireUser();
    if (!s) return fail('Sign in to save to your account.');
    const all = this.read<ProjectRec[]>(K.projects, []);
    const updatedAt = new Date(this.now()).toISOString();
    const existing = id ? all.find((p) => p.id === id) : undefined;
    if (id && (!existing || existing.owner !== s.userId)) return fail('This home belongs to another account.');
    if (existing && expectedUpdatedAt && existing.updatedAt !== expectedUpdatedAt) {
      return fail('This home was changed somewhere else since you opened it.', true);
    }
    const rec: ProjectRec = { id: existing?.id ?? randomId('proj'), owner: s.userId, name: scene.meta.name, updatedAt, scene };
    this.write(K.projects, [...all.filter((p) => p.id !== rec.id), rec]);
    return ok({ id: rec.id, name: rec.name, updatedAt });
  }

  async deleteProject(id: string): Promise<void> {
    const s = await this.requireUser();
    if (!s) return;
    this.write(K.projects, this.read<ProjectRec[]>(K.projects, []).filter((p) => !(p.id === id && p.owner === s.userId)));
    await this.revokeShares(id);
  }

  // ------------------------------------------------------------------- sharing
  async createShare(projectId: string): Promise<Result<{ token: string }>> {
    const s = await this.requireUser();
    if (!s) return fail('Sign in to share a home.');
    const p = this.read<ProjectRec[]>(K.projects, []).find((x) => x.id === projectId && x.owner === s.userId);
    if (!p) return fail('Save this home to your account first.');
    const token = randomId('share');
    this.write(K.shares, { ...this.read<Record<string, string>>(K.shares, {}), [token]: projectId });
    return ok({ token });
  }

  async revokeShares(projectId: string): Promise<void> {
    const shares = this.read<Record<string, string>>(K.shares, {});
    this.write(K.shares, Object.fromEntries(Object.entries(shares).filter(([, pid]) => pid !== projectId)));
  }

  async getShared(token: string): Promise<Scene | null> {
    const pid = this.read<Record<string, string>>(K.shares, {})[token];
    const p = pid ? this.read<ProjectRec[]>(K.projects, []).find((x) => x.id === pid) : undefined;
    if (!p) return null;
    const r = loadScene(p.scene);
    return r.ok ? r.scene : null;
  }

  // -------------------------------------------------------------- entitlements
  private entKey = async (): Promise<string> => K.ent + ((await this.getSession())?.userId ?? 'guest');

  private async stored(): Promise<Entitlements> {
    const ent = this.read<Entitlements>(await this.entKey(), NO_ENTITLEMENTS);
    return pruneUnlocks({ subscribed: !!ent.subscribed, ...(ent.gifted ? { gifted: true } : {}), unlocks: ent.unlocks ?? {} }, this.now());
  }

  async getEntitlements(): Promise<Entitlements> {
    return this.stored();
  }

  async redeemCode(code: string): Promise<Result<Entitlements>> {
    if (!(await this.getSession())) return fail('Sign in to redeem a code.');
    if (normalizeCode(code) !== normalizeCode(DEMO_REDEEM_CODE)) return fail('That code isn’t valid.');
    const next = { ...(await this.stored()), gifted: true };
    this.write(await this.entKey(), next);
    return ok(next);
  }

  async unlockWithAd(assetId: string): Promise<Result<Entitlements>> {
    const asset = getAsset(assetId);
    if (!asset || asset.tier !== 'rewarded') return fail('This item cannot be unlocked with an ad.');
    const ent = await this.stored();
    const next: Entitlements = { ...ent, unlocks: { ...ent.unlocks, [assetId]: new Date(this.now() + REWARDED_UNLOCK_MS).toISOString() } };
    this.write(await this.entKey(), next);
    return ok(next);
  }

  async setSubscription(active: boolean): Promise<Result<Entitlements>> {
    if (!(await this.getSession())) return fail('Sign in to manage a subscription.');
    const ent = await this.stored();
    const next = { ...ent, subscribed: active };
    this.write(await this.entKey(), next);
    return ok(next);
  }
}
