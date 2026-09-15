import type { AdminSnapshot } from './types';

export interface AdminReadRepository { getSnapshot(): Promise<AdminSnapshot> }
export type ReadFailure = 'configuration' | 'authentication' | 'authorization' | 'connection' | 'schema';
export class AdminReadError extends Error {
  constructor(public readonly reason: ReadFailure) { super(`Admin read unavailable: ${reason}`); }
}
export type AdminReadState =
  | { status: 'ready'; source: 'static' | 'supabase'; snapshot: AdminSnapshot }
  | { status: 'unavailable'; source: 'static' | 'supabase' | 'configuration'; reason: ReadFailure };

export function readDataSource(value?: string): 'static' | 'supabase' {
  if (value === undefined || value === '' || value === 'static') return 'static';
  if (value === 'supabase') return 'supabase';
  throw new AdminReadError('configuration');
}

/** Explicit opt-in only. A hosted error is never replaced with static records. */
export async function loadAdminData(
  value: string | undefined,
  fallback: AdminReadRepository,
  hosted: () => Promise<AdminReadRepository>,
): Promise<AdminReadState> {
  let source: 'static' | 'supabase';
  try { source = readDataSource(value); }
  catch { return { status: 'unavailable', source: 'configuration', reason: 'configuration' }; }
  try {
    const repository = source === 'static' ? fallback : await hosted();
    return { status: 'ready', source, snapshot: await repository.getSnapshot() };
  } catch (error) {
    return { status: 'unavailable', source, reason: error instanceof AdminReadError ? error.reason : 'connection' };
  }
}
