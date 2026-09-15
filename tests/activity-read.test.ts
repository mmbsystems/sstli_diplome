// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({ role: 'super_admin', requests: [] as { url: URL; method: string }[], rows: [] as unknown[], fail: false }));
vi.mock('@/lib/auth', () => ({ requireAdmin: async () => { if (state.role !== 'super_admin') throw new Error(state.role === 'anonymous' ? 'unauthenticated' : 'unauthorized'); return { username: 'admin', name: 'Admin', role: state.role }; } }));
import { loadActivity } from '@/lib/admin/activity';
import { loadLegacyUsers } from '@/lib/admin/users';
const row = (n: number) => ({ id: `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`, created_at: '2026-09-13T10:00:00.123456+00:00', actor_label: 'Admin', action: 'update', entity_type: 'programs', entity_id: 'program-id', entity_label: 'Program', metadata: { legacy_actor: { username: 'admin', name: 'Admin', role: 'super_admin', request_id: 'request-id' } } });
beforeEach(() => {
  state.role = 'super_admin'; state.requests = []; state.rows = []; state.fail = false;
  vi.stubEnv('ADMIN_DATA_SOURCE', 'supabase'); vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co'); vi.stubEnv('SUPABASE_SECRET_KEY', 'sb_secret_test');
  vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
    state.requests.push({ url: new URL(String(input)), method: init?.method ?? 'GET' });
    return new Response(JSON.stringify(state.fail ? { message: 'private database error' } : state.rows), { status: state.fail ? 500 : 200, headers: { 'content-type': 'application/json' } });
  });
});
it('reads real audit fields using one bounded GET and no mutation', async () => {
  state.rows = [row(1)];
  const result = await loadActivity();
  expect(result).toMatchObject({ status: 'ready', items: [{ username: 'admin', role: 'super_admin', requestId: 'request-id', entity: 'programs', label: 'Program' }], nextCursor: null });
  expect(state.requests).toHaveLength(1);
  expect(state.requests[0].method).toBe('GET');
  expect(state.requests[0].url.searchParams.get('limit')).toBe('26');
  expect(state.requests[0].url.searchParams.get('select')).not.toContain('before_data');
});
it('paginates with timestamp precision and UUID tie breaker without offsets', async () => {
  state.rows = Array.from({ length: 26 }, (_, i) => row(100-i));
  const first = await loadActivity();
  expect(first.status).toBe('ready'); if (first.status !== 'ready') return;
  expect(first.items).toHaveLength(25); expect(first.nextCursor).toBeTruthy();
  state.rows = [row(75)];
  const second = await loadActivity(first.nextCursor!);
  expect(second).toMatchObject({ status: 'ready', nextCursor: null });
  expect(state.requests[1].url.searchParams.get('or')).toContain('created_at.eq.2026-09-13T10:00:00.123456+00:00');
  expect(state.requests[1].url.searchParams.get('or')).toContain('id.lt.00000000-0000-4000-8000-000000000076');
  expect(state.requests[1].url.searchParams.has('offset')).toBe(false);
});
it.each(['staff', 'anonymous'])('denies %s before audit or account reads', async role => {
  state.role = role;
  await expect(loadActivity()).rejects.toThrow(); await expect(loadLegacyUsers()).rejects.toThrow();
  expect(state.requests).toHaveLength(0);
});
it('rejects invalid cursor without issuing a query', async () => {
  expect(await loadActivity('bad,(or)')).toMatchObject({ status: 'invalid' }); expect(state.requests).toHaveLength(0);
});
it('handles empty data and sanitizes errors', async () => {
  expect(await loadActivity()).toEqual({ status: 'ready', items: [], nextCursor: null });
  state.fail = true; expect(await loadActivity()).toEqual({ status: 'unavailable' });
});
it('handles malformed optional metadata without trusting its structure', async () => {
  state.rows = [{ ...row(1), metadata: { legacy_actor: ['invalid'] }, actor_label: null, entity_label: { bad: true } }];
  expect(await loadActivity()).toMatchObject({ status: 'ready', items: [{ username: '—', role: '—', label: 'program-id' }] });
  state.rows = [{ ...row(1), created_at: 'invalid' }];
  expect(await loadActivity()).toEqual({ status: 'unavailable' });
});
it('lists only public legacy account fields and enforced roles', async () => {
  const users = await loadLegacyUsers(); expect(users.length).toBeGreaterThan(0);
  for (const user of users) { expect(Object.keys(user).sort()).toEqual(['name','role','username']); expect(['staff','super_admin']).toContain(user.role); }
  expect(users.find(u => u.username === 'admin')?.role).toBe('super_admin');
});
