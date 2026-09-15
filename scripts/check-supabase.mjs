// Explicit opt-in, anonymous, read-only network probe. Not part of app startup/build.
import { existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.log('SKIPPED: no Supabase project configured. Static application is unaffected.');
} else {
  if (key.startsWith('sb_secret_') || (key.startsWith('eyJ') && JSON.parse(Buffer.from(key.split('.')[1], 'base64url')).role !== 'anon')) throw new Error('Only a publishable or anon key may be used');
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { error } = await client.from('programs').select('id').limit(1);
  if (error?.code === '42501') console.log('PASS: Supabase reached; anonymous catalog access denied as designed.');
  else { console.error(error ? `Connection/schema check failed (${error.code || 'network error'}). Check migrations and project configuration.` : 'FAIL: anonymous table read was unexpectedly allowed.'); process.exitCode = 1; }
}
