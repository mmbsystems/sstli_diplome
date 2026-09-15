import 'server-only';
import accounts from '@/config/admins.json';

export type AccountRole = 'staff' | 'super_admin';
export interface AuthenticatedUser { username: string; name: string; role: AccountRole }
/** Resolve trusted config on every request; never accept a role from a JWT/body. */
export function resolveAccount(username: string): AuthenticatedUser | null {
  const matches = accounts.filter(account => account.username === username);
  if (matches.length !== 1) return null;
  const account = matches[0] as { username: string; name: string; role?: string };
  return { username: account.username, name: account.name, role: account.role === 'super_admin' ? 'super_admin' : 'staff' };
}
