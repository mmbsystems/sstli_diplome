import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { requireSupabaseConfig } from './config';
import type { Database } from './database.generated';

/** Request-scoped user client for opt-in admin reads; never a service-role client. */
export async function createClient() {
  const { url, key } = requireSupabaseConfig();
  const cookieStore = await cookies();
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(values) {
        try { values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
        catch {
          // Server Components cannot write cookies. Future auth integration must
          // compose the refresh helper with the existing middleware first.
        }
      },
    },
  });
}
