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
    if (url && key) {
      const { SupabaseBackend } = await import('./supabaseBackend');
      return new SupabaseBackend(url, key);
    }
    return new LocalBackend();
  })();
  return instance;
}

export * from './types';
export * from './entitlements';
