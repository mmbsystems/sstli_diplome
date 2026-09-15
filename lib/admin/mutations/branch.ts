import 'server-only';
import { randomUUID } from 'node:crypto';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { mapBranch } from '@/lib/supabase/read-mappers';
import { parseBranchInput } from './branch-validation';
import { MutationError, throwDatabaseError } from './errors';
export async function runBranchCommand(body: unknown) {
  const actor = await requireAdmin({ api: true });
  const input = parseBranchInput(body);
  if (process.env.ADMIN_DATA_SOURCE !== 'supabase') throw new MutationError('disabled');
  const { data, error } = await createAdminClient().rpc('legacy_admin_save_branch', {
    p_id: input.id as string, p_expected_version: input.expectedVersion, p_branch: input.branch,
    p_archive: input.action === 'save' ? 'keep' : input.action,
    p_actor_username: actor.username, p_actor_name: actor.name, p_request_id: randomUUID(),
  }).abortSignal(AbortSignal.timeout(15000));
  throwDatabaseError(error);
  try {
    const saved = mapBranch(data);
    if (saved.version !== input.expectedVersion + 1 || (input.id && saved.id !== input.id)) throw new Error();
    return saved;
  } catch { throw new MutationError('database'); }
}
