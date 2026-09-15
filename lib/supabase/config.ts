/** Explicit, lazy configuration. Importing infrastructure never starts a connection. */
export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim();
  if (!url || !key) return null;
  const parsed = new URL(url);
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Invalid Supabase URL protocol');
  if (key.startsWith('sb_secret_')) throw new Error('A Supabase secret key must never be used as a public key');
  if (!key.startsWith('sb_publishable_')) {
    // This is a configuration guard, not JWT authentication or signature verification.
    let role: unknown;
    try { role = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role; }
    catch { throw new Error('Expected a publishable key or legacy anon key'); }
    if (role !== 'anon') throw new Error('Only a legacy anon key is permitted in public configuration');
  }
  return { url, key };
}

export function requireSupabaseConfig() {
  const config = getSupabaseConfig();
  if (!config) throw new Error('Supabase is not configured. The current static admin preview remains available.');
  return config;
}
