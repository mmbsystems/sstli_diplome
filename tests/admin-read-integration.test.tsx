// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), createClient: vi.fn() }));
vi.mock('@/lib/auth', () => ({ requireAdmin: mocks.requireUser }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createClient }));
import AdminLayout from '@/app/admin/layout';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.generated';
const { createAdminClient: realCreateAdminClient } = await vi.importActual<typeof import('@/lib/supabase/admin')>('@/lib/supabase/admin');
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });
it('loads static records by default without constructing a hosted client', async () => {
  vi.stubEnv('ADMIN_DATA_SOURCE', '');
  mocks.requireUser.mockResolvedValue({ name: 'Staff' });
  const element = await AdminLayout({ children: null });
  expect(element.props.state).toMatchObject({ status: 'ready', source: 'static' });
  expect(element.props.state.snapshot.programs).toHaveLength(53);
  expect(mocks.createClient).not.toHaveBeenCalled();
});
it.each(['not-a-url', 'ftp://example.com'])('reports invalid URL %s as configuration failure', async url => {
  vi.stubEnv('ADMIN_DATA_SOURCE', 'supabase');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', url);
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
  mocks.createClient.mockImplementation(realCreateAdminClient);
  mocks.requireUser.mockResolvedValue({ name: 'Staff' });
  const element = await AdminLayout({ children: null });
  expect(element.props.state).toEqual({ status: 'unavailable', source: 'supabase', reason: 'configuration' });
});
it('routes Supabase mode through the typed repository and preserves its empty result', async () => {
  vi.stubEnv('ADMIN_DATA_SOURCE', 'supabase');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
  mocks.requireUser.mockResolvedValue({ name: 'Staff' });
  const client = createClient<Database>('https://example.supabase.co', 'sb_publishable_test', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (url, init) => {
      expect(init?.method).toBe('GET');
      return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json', 'Content-Range': '*/0' } });
    } },
  });
  vi.spyOn(client.auth, 'getUser').mockResolvedValue({ data: { user: { id: 'u1' } }, error: null } as Awaited<ReturnType<typeof client.auth.getUser>>);
  mocks.createClient.mockReturnValue(client);
  const element = await AdminLayout({ children: null });
  expect(element.props.state).toEqual({ status: 'ready', source: 'supabase', snapshot: { programs: [], branches: [] } });
});
it('keeps staff authorization ahead of hosted reads', async () => {
  vi.stubEnv('ADMIN_DATA_SOURCE', 'supabase');
  mocks.requireUser.mockRejectedValue(new Error('staff denied'));
  await expect(AdminLayout({ children: null })).rejects.toThrow('staff denied');
  expect(mocks.createClient).not.toHaveBeenCalled();
});
it('reports missing hosted configuration without substituting static records', async () => {
  vi.stubEnv('ADMIN_DATA_SOURCE', 'supabase');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
  mocks.createClient.mockImplementation(realCreateAdminClient);
  mocks.requireUser.mockResolvedValue({ name: 'Staff' });
  const element = await AdminLayout({ children: null });
  expect(element.props.state).toEqual({ status: 'unavailable', source: 'supabase', reason: 'configuration' });
});
