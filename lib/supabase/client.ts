'use client';
import { createBrowserClient } from '@supabase/ssr';
import { requireSupabaseConfig } from './config';
import type { Database } from './database.generated';

/** Dormant factory. Not imported by any current UI. */
export function createClient() {
  const { url, key } = requireSupabaseConfig();
  return createBrowserClient<Database>(url, key);
}
