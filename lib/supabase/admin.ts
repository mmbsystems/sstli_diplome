import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.current.generated';
import { MutationError } from '@/lib/admin/mutations/errors';

/** Bypasses RLS. Every caller MUST authorize on the server before constructing it.
 * Never attach browser cookies, a user access token, or an SSR auth storage adapter.
 */
export function createAdminClient(fetchOverride?: typeof fetch) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
    if (!url || !key) throw new Error();
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') throw new Error();
    if (!key.startsWith('sb_secret_')) {
      const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'));
      if (payload.role !== 'service_role' || payload.sub) throw new Error();
    }
    return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, ...(fetchOverride ? { global: { fetch: fetchOverride } } : {}) });
  } catch { throw new MutationError('configuration'); }
}
