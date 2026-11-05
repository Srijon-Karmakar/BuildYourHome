import { LocalBackend } from './localBackend';
import type { Backend } from './types';

let instance: Promise<Backend> | null = null;

/**
 * The backend for this session: Supabase when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
 * (apps/web/.env.local), otherwise the browser-only LocalBackend. Supabase code is loaded lazily, so builds without
 * keys never download it.
 */
export function getBackend(): Promise<Backend> {
  instance ??= (async () => {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    // Dev/test escape hatch: force the browser-only demo backend even when Supabase keys are configured
    // (used by the browser tests so they never touch a real project). Ignored in production builds.
    let forceLocal = false;
    try {
      forceLocal = import.meta.env.DEV && localStorage.getItem('hd.backend') === 'local';
    } catch {
      /* storage unavailable */
    }
    if (url && key && !forceLocal) {
      const { SupabaseBackend } = await import('./supabaseBackend');
      return new SupabaseBackend(url, key);
    }
    return new LocalBackend();
  })();
  return instance;
}

export * from './types';
export * from './entitlements';
