import { create } from 'zustand';
import { getAsset } from '@hd/assets';
import { editor, useUi } from '../plan/session';
import { canUse, getBackend, NO_ENTITLEMENTS, type Backend, type Entitlements, type ProjectMeta, type Session } from './index';

export type UpsellIntent = 'place' | 'copy';

interface CloudState {
  ready: boolean;
  mode: Backend['mode'] | null;
  session: Session | null;
  ent: Entitlements;
  projects: ProjectMeta[];
  /** Cloud project the open home is attached to (it is then saved automatically). */
  projectId: string | null;
  shareToken: string | null;
  /** `updatedAt` of the cloud copy we last saved/loaded (guards against overwriting another device's changes). */
  projectUpdatedAt: string | null;
  /** The cloud copy changed elsewhere; syncing is paused until the user chooses. */
  conflict: boolean;
  /** Arrived from a password-reset link: must choose a new password. */
  recovery: boolean;
  notice: string | null;
  busy: boolean;
  message: string | null;
  syncedAt: number | null;
  accountOpen: boolean;
  upsell: { assetId: string; intent: UpsellIntent } | null;
  adPlaying: { assetId: string; intent: UpsellIntent } | null;

  init(): Promise<void>;
  setAccountOpen(open: boolean): void;
  signUp(email: string, password: string): Promise<boolean>;
  signIn(email: string, password: string): Promise<boolean>;
  signOut(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  updatePassword(password: string): Promise<boolean>;
  deleteAccount(): Promise<boolean>;
  resolveConflict(keepMine: boolean): Promise<void>;
  dismissRecovery(): void;
  refresh(): Promise<void>;
  saveNow(): Promise<boolean>;
  open(id: string): Promise<void>;
  remove(id: string): Promise<void>;
  detach(): void;
  share(): Promise<void>;
  unshare(): Promise<void>;
  openUpsell(assetId: string, intent: UpsellIntent): void;
  closeUpsell(): void;
  startAd(): void;
  finishAd(): Promise<void>;
  subscribe(active: boolean): Promise<void>;
  /** Redeem a code for the signed-in account. Returns an error text, or null on success. */
  redeem(code: string): Promise<string | null>;
  syncScene(scene: ReturnType<typeof editor.getState>['scene']): Promise<void>;
}

let backend: Backend | null = null;
const be = (): Backend => {
  if (!backend) throw new Error('cloud not initialised');
  return backend;
};

export const useCloud = create<CloudState>((set, get) => ({
  ready: false,
  mode: null,
  session: null,
  ent: NO_ENTITLEMENTS,
  projects: [],
  projectId: null,
  shareToken: null,
  projectUpdatedAt: null,
  conflict: false,
  recovery: false,
  notice: null,
  busy: false,
  message: null,
  syncedAt: null,
  accountOpen: false,
  upsell: null,
  adPlaying: null,

  async init() {
    if (get().ready) return;
    backend = await getBackend();
    backend.onSession((session) => {
      set({ session });
      void get().refresh();
    });
    backend.onRecovery(() => set({ recovery: true, accountOpen: false, message: null }));
    set({ mode: backend.mode, session: await backend.getSession(), ready: true });
    await get().refresh();
  },

  setAccountOpen: (accountOpen) => set({ accountOpen, message: null, notice: null }),

  async signUp(email, password) {
    set({ busy: true, message: null });
    const r = await be().signUp(email, password);
    set({ busy: false, message: r.ok ? null : r.error });
    if (r.ok) await get().refresh();
    return r.ok;
  },

  async signIn(email, password) {
    set({ busy: true, message: null });
    const r = await be().signIn(email, password);
    set({ busy: false, message: r.ok ? null : r.error });
    if (r.ok) await get().refresh();
    return r.ok;
  },

  async signOut() {
    await be().signOut();
    set({ session: null, projects: [], projectId: null, projectUpdatedAt: null, conflict: false, shareToken: null, message: null });
    await get().refresh();
  },

  async resetPassword(email) {
    set({ busy: true, message: null, notice: null });
    const r = await be().resetPassword(email);
    set({
      busy: false,
      message: r.ok ? null : r.error,
      notice: r.ok ? (r.value.demo ? null : 'If there is an account for this email, we have sent a reset link. Check your inbox.') : null,
    });
  },

  async updatePassword(password) {
    set({ busy: true, message: null });
    const r = await be().updatePassword(password);
    set({ busy: false, message: r.ok ? null : r.error, ...(r.ok ? { recovery: false, notice: 'Your password has been changed.' } : {}) });
    return r.ok;
  },

  async deleteAccount() {
    set({ busy: true, message: null });
    const r = await be().deleteAccount();
    set({ busy: false, message: r.ok ? null : r.error });
    if (!r.ok) return false;
    set({ session: null, projects: [], projectId: null, projectUpdatedAt: null, conflict: false, shareToken: null, accountOpen: false, notice: 'Your account and saved homes were deleted.' });
    await get().refresh();
    return true;
  },

  dismissRecovery: () => set({ recovery: false, message: null }),

  async resolveConflict(keepMine) {
    const id = get().projectId;
    if (!id) return set({ conflict: false });
    set({ busy: true });
    if (keepMine) {
      const r = await be().saveProject(editor.getState().scene, id); // no expectation: overwrite on purpose
      set({ busy: false, conflict: !r.ok, message: r.ok ? null : r.error, ...(r.ok ? { projectUpdatedAt: r.value.updatedAt, syncedAt: Date.now() } : {}) });
    } else {
      const scene = await be().loadProject(id);
      const meta = (await be().listProjects()).find((p) => p.id === id);
      set({ busy: false });
      if (!scene) return set({ message: 'Could not load the other version.' });
      editor.loadScene(scene);
      set({ conflict: false, projectUpdatedAt: meta?.updatedAt ?? null, message: null });
    }
    await get().refresh();
  },

  async refresh() {
    const b = be();
    const [projects, ent] = await Promise.all([b.listProjects(), b.getEntitlements()]);
    set({ projects, ent });
  },

  async saveNow() {
    set({ busy: true, message: null });
    const id = get().projectId ?? undefined;
    const r = await be().saveProject(editor.getState().scene, id, id ? (get().projectUpdatedAt ?? undefined) : undefined);
    set({
      busy: false,
      message: r.ok || r.conflict ? null : r.error,
      ...(r.ok ? { projectId: r.value.id, projectUpdatedAt: r.value.updatedAt, syncedAt: Date.now(), conflict: false } : {}),
      ...(!r.ok && r.conflict ? { conflict: true } : {}),
    });
    if (r.ok) await get().refresh();
    return r.ok;
  },

  async open(id) {
    set({ busy: true, message: null });
    const scene = await be().loadProject(id);
    set({ busy: false });
    if (!scene) return set({ message: 'Could not open this home.' });
    editor.loadScene(scene);
    set({ projectId: id, projectUpdatedAt: get().projects.find((p) => p.id === id)?.updatedAt ?? null, conflict: false, shareToken: null, accountOpen: false });
    const { activePlan } = await import('../plan/PlanCanvas');
    window.setTimeout(() => {
      activePlan?.fitToPlan();
      useUi.getState().bumpFit();
    }, 50);
  },

  async remove(id) {
    await be().deleteProject(id);
    if (get().projectId === id) set({ projectId: null, projectUpdatedAt: null, conflict: false, shareToken: null });
    await get().refresh();
  },

  detach: () => set({ projectId: null, projectUpdatedAt: null, conflict: false, shareToken: null }),

  async share() {
    if (!get().projectId && !(await get().saveNow())) return;
    const id = get().projectId;
    if (!id) return;
    const r = await be().createShare(id);
    set(r.ok ? { shareToken: r.value.token, message: null } : { message: r.error });
  },

  async unshare() {
    const id = get().projectId;
    if (id) await be().revokeShares(id);
    set({ shareToken: null });
  },

  openUpsell: (assetId, intent) => set({ upsell: { assetId, intent } }),
  closeUpsell: () => set({ upsell: null, adPlaying: null, message: null }),
  startAd() {
    const u = get().upsell;
    if (u) set({ adPlaying: u });
  },

  async finishAd() {
    const ad = get().adPlaying;
    if (!ad) return;
    const r = await be().unlockWithAd(ad.assetId);
    set({ adPlaying: null });
    if (!r.ok) return set({ message: r.error });
    set({ ent: r.value, upsell: null, message: null });
    if (ad.intent === 'place') useUi.getState().startPlacing(ad.assetId);
  },

  async redeem(code) {
    const r = await be().redeemCode(code);
    if (!r.ok) return r.error;
    set({ ent: r.value, message: null, upsell: null });
    return null;
  },

  async subscribe(active) {
    const r = await be().setSubscription(active);
    if (!r.ok) return set({ message: r.error });
    set({ ent: r.value, message: null, ...(active ? { upsell: null } : {}) });
  },

  async syncScene(scene) {
    const { projectId, session, conflict, projectUpdatedAt } = get();
    if (!projectId || !session || conflict) return; // paused while a conflict is unresolved
    const r = await be().saveProject(scene, projectId, projectUpdatedAt ?? undefined);
    if (r.ok) set({ syncedAt: Date.now(), projectUpdatedAt: r.value.updatedAt });
    else if (r.conflict) set({ conflict: true });
    else set({ message: r.error });
  },
}));

/**
 * Gate for ADDING or COPYING catalog items. Returns true when every item may be used; otherwise opens the upsell
 * for the first locked one. Placed items that are already in a home keep rendering regardless (FR-806).
 */
export function requireAccess(assetIds: readonly string[], intent: UpsellIntent): boolean {
  const { ent, upsell } = useCloud.getState();
  for (const id of new Set(assetIds)) {
    const a = getAsset(id);
    if (a && !canUse(a, ent)) {
      if (!upsell) useCloud.getState().openUpsell(id, intent);
      return false;
    }
  }
  return true;
}
