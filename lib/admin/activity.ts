import 'server-only';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export interface HostedActivity {
  id: string; time: string; actor: string; username: string; role: string;
  action: string; entity: string; entityId: string; label: string; requestId: string;
}
export type ActivityResult = { status: 'ready'; items: HostedActivity[]; nextCursor: string | null }
  | { status: 'invalid' | 'unavailable' | 'disabled' };
const pageSize = 25;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Preserve PostgreSQL microseconds; Date.toISOString would lose cursor precision.
const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown, fallback = '—'): string => typeof value === 'string' && value.length > 0 ? value.slice(0, 300) : fallback;
function validPosition(value: unknown): value is { id: string; time: string } {
  const v = object(value);
  return typeof v.id === 'string' && uuid.test(v.id) && typeof v.time === 'string' && timestamp.test(v.time) && Number.isFinite(Date.parse(v.time));
}
/** One bounded SELECT; audit rows and actor metadata are never written here. */
export async function loadActivity(cursor?: string): Promise<ActivityResult> {
  await requireAdmin();
  if (process.env.ADMIN_DATA_SOURCE !== 'supabase') return { status: 'disabled' };
  let position: { id: string; time: string } | undefined;
  if (cursor !== undefined) {
    try {
      if (cursor.length > 512 || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error();
      const decoded: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
      if (!validPosition(decoded)) throw new Error();
      position = decoded;
    } catch { return { status: 'invalid' }; }
  }
  try {
    let query = createAdminClient().from('activity_logs')
      .select('id,created_at,actor_label,action,entity_type,entity_id,entity_label,metadata')
      .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(pageSize + 1);
    if (position) query = query.or(`created_at.lt.${position.time},and(created_at.eq.${position.time},id.lt.${position.id})`);
    const { data, error } = await query.abortSignal(AbortSignal.timeout(10000));
    if (error || !Array.isArray(data)) return { status: 'unavailable' };
    const items = data.slice(0, pageSize).map(row => {
      if (!validPosition({ id: row.id, time: row.created_at })) throw new Error();
      const metadata = object(row.metadata); const actor = object(metadata.legacy_actor);
      return { id: row.id, time: row.created_at, actor: text(actor.name, text(row.actor_label)),
        username: text(actor.username), role: text(actor.role, metadata.system === true ? 'system' : '—'),
        action: text(row.action), entity: text(row.entity_type), entityId: text(row.entity_id),
        label: text(row.entity_label, text(row.entity_id)), requestId: text(actor.request_id) };
    });
    const last = items.at(-1);
    return { status: 'ready', items, nextCursor: data.length > pageSize && last ? Buffer.from(JSON.stringify({ id: last.id, time: last.time })).toString('base64url') : null };
  } catch { return { status: 'unavailable' }; }
}
