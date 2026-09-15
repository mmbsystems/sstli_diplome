import 'server-only';
import { randomUUID } from 'node:crypto';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { MutationError, throwDatabaseError } from './errors';
import { parseProbeInput, object, uuid, expectedVersion, bool } from './validation';

/** The sole mutation command: only isolated private development-probe records. */
export async function runProbeCommand(body: unknown) {
  const actor = await requireAdmin({ api: true });
  const input = parseProbeInput(body);
  if (process.env.ADMIN_WRITE_PROBE_ENABLED !== 'true') throw new MutationError('disabled');
  const project = process.env.ADMIN_WRITE_PROBE_PROJECT_REF;
  if (!project || !/^[a-z]{20}$/.test(project) || process.env.NEXT_PUBLIC_SUPABASE_URL !== `https://${project}.supabase.co`) throw new MutationError('configuration');
  const client = createAdminClient();
  const { data, error } = await client.rpc('legacy_admin_probe', {
    p_id: input.id, p_action: input.action, p_expected_version: input.expectedVersion,
    p_value: input.value ?? undefined, p_actor_username: actor.username, p_actor_name: actor.name, p_request_id: randomUUID(),
  });
  throwDatabaseError(error);
  try {
    const result = object(data);
    const output = { id: uuid(result.id), version: expectedVersion(result.version), deleted: bool(result.deleted) };
    if (output.id !== input.id || output.version !== input.expectedVersion + 1 || output.deleted !== (input.action === 'delete')) throw new Error();
    return output;
  } catch { throw new MutationError('database'); }
}
