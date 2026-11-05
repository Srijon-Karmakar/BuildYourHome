import type { Scene } from '@hd/scene-schema';

/** Outcome of an operation that can fail for reasons the user should read (never throws for those). */
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export interface Session {
  userId: string;
  email: string;
}

export interface ProjectMeta {
  id: string;
  name: string;
  updatedAt: string;
}

/** What the current user may use. `unlocks` maps an asset id to its expiry (ISO) or null for "forever". */
export interface Entitlements {
  subscribed: boolean;
  unlocks: Record<string, string | null>;
}

export const NO_ENTITLEMENTS: Entitlements = { subscribed: false, unlocks: {} };

/**
 * Everything the app needs from "the cloud". Two implementations: `LocalBackend` (works offline with no
 * account: demo, development, tests) and `SupabaseBackend` (real accounts, storage and entitlements).
 * The UI only ever talks to this interface (ADR-004, ADR-012, ADR-019).
 */
export interface Backend {
  readonly mode: 'local' | 'supabase';

  getSession(): Promise<Session | null>;
  onSession(cb: (s: Session | null) => void): () => void;
  signUp(email: string, password: string): Promise<Result<Session>>;
  signIn(email: string, password: string): Promise<Result<Session>>;
  signOut(): Promise<void>;

  listProjects(): Promise<ProjectMeta[]>;
  loadProject(id: string): Promise<Scene | null>;
  /** Create (no id) or update a project owned by the signed-in user. */
  saveProject(scene: Scene, id?: string): Promise<Result<ProjectMeta>>;
  deleteProject(id: string): Promise<void>;

  /** Public read-only link to a project owned by the user. */
  createShare(projectId: string): Promise<Result<{ token: string }>>;
  revokeShares(projectId: string): Promise<void>;
  /** Anyone with the token can read the shared project (no sign-in). */
  getShared(token: string): Promise<Scene | null>;

  getEntitlements(): Promise<Entitlements>;
  /** Reward for watching an ad. Real implementations must verify server-side (see docs). */
  unlockWithAd(assetId: string): Promise<Result<Entitlements>>;
  /** Demo billing only; the real flow goes through Stripe / the stores (ADR-011). */
  setSubscription(active: boolean): Promise<Result<Entitlements>>;
}

export const SHARE_PATH_PARAM = 'share';

export const shareUrl = (token: string, base: string = window.location.origin + window.location.pathname): string =>
  `${base}?${SHARE_PATH_PARAM}=${encodeURIComponent(token)}`;

export type SceneSource = () => Scene;
