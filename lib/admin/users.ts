import 'server-only';
import { requireAdmin } from '@/lib/auth';
import accounts from '@/config/admins.json';
import { resolveAccount, type AuthenticatedUser } from '@/lib/accounts';

/** Explicit projection excludes password hashes and future private config fields. */
export async function loadLegacyUsers(): Promise<AuthenticatedUser[]> {
  await requireAdmin();
  return [...new Set(accounts.map(account => account.username))].flatMap(username => {
    const user = resolveAccount(username);
    return user ? [user] : [];
  });
}
