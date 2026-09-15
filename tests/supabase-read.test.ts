// @vitest-environment node
import { expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { mapCatalog, mapActivity, mapProfile } from '@/lib/supabase/read-mappers';
import { createSupabaseReadRepository } from '@/lib/supabase/read-repository';

const time = '2026-09-10T12:00:00Z';
const program = { id: 'p1', legacy_id: 'law', name_ar: 'القانون', slug: 'law', program_type: 'diploma', description: '', duration_display: 'سنتان', duration_standard: null, duration_summer: null, specialization: null, searchable_keywords: [], accredited_hours: 84, accreditation_text: null, image_path: null, image_position: null, content_pending: true, classification_pending: false, is_active: false, publication_status: 'draft', catalog_visibility: false, is_featured: false, archived_at: null, updated_at: time };
const branch = { id: 'b1', name: 'حي الزهور', city: 'الدمام', source_region_label: null, directory_listed: false, address: null, is_active: true, archived_at: null, updated_at: time };
const offer = { id: 'o1', program_id: 'p1', branch_id: 'b1', study_mode: 'onsite', gender: 'both', price: 0, min_down_payment: 0, installment_months: 24, accredited_hours_override: 75, registration_state: 'unknown', is_active: true, archived_at: null, updated_at: time, sort_order: 0 };
const rows = () => ({ programs: [program], branches: [branch], offerings: [offer], curriculum: [{ id: 'c2', program_id: 'p1', title: 'الثاني', sort_order: 1 }, { id: 'c1', program_id: 'p1', title: 'الأول', sort_order: 0 }], careers: [] });

it('maps exact identities, zero amounts, independent publication state and flat ordering', () => {
  const snapshot = mapCatalog(rows());
  expect(snapshot.branches[0]).toMatchObject({ id: 'b1', name: 'حي الزهور', city: 'الدمام', address: '', directoryListed: false });
  expect(snapshot.programs[0]).toMatchObject({ id: 'p1', name: 'القانون', status: 'inactive', publication: 'draft', catalogVisible: false, accreditedHours: 84, curriculum: ['الأول', 'الثاني'], careerPaths: [] });
  expect(snapshot.programs[0].offerings[0]).toMatchObject({ id: 'o1', branchId: 'b1', branch: 'حي الزهور', price: 0, minDownPayment: 0, installments: 24, accreditedHours: 75, registration: 'unknown' });
  expect(snapshot.programs[0].catalogSlug).toBeUndefined();
  expect(snapshot.programs[0]).not.toHaveProperty('name_ar');
});
it('preserves null prices as unknown and archive state without making records active', () => {
  const input = rows();
  const result = mapCatalog({ ...input, offerings: [{ ...offer, price: null, min_down_payment: null, installment_months: null, is_active: false, archived_at: time }] });
  expect(result.programs[0].offerings[0]).toMatchObject({ price: undefined, minDownPayment: undefined, installments: undefined, active: false, archived: true });
});
it('rejects unsupported values and invisible relationships rather than fabricating domain data', () => {
  expect(() => mapCatalog({ ...rows(), offerings: [{ ...offer, study_mode: 'hybrid' }] })).toThrow();
  expect(() => mapCatalog({ ...rows(), branches: [] })).toThrow();
  expect(() => mapCatalog({ ...rows(), offerings: [{ ...offer, price: -1 }] })).toThrow();
});
it('maps empty data and retains audit restore/delete semantics without relabeling as session activity', () => {
  expect(mapCatalog({ programs: [], branches: [], offerings: [], curriculum: [], careers: [] })).toEqual({ programs: [], branches: [] });
  const audit = mapActivity({ id: 'a1', actor_user_id: null, actor_label: 'Database maintenance', action: 'restore', entity_type: 'program_offerings', entity_id: 'o1', entity_label: 'عرض', branch_id: 'b1', created_at: time, before_data: { price: 0 }, after_data: { price: 0 }, metadata: { system: true } });
  expect(audit).toMatchObject({ actorUserId: null, actorLabel: 'Database maintenance', action: 'restore', entityType: 'program_offerings', before: { price: 0 }, after: { price: 0 } });
  expect(mapProfile({ user_id: 'u1', display_name: 'مستخدم', role: 'viewer', is_active: true })).toEqual({ userId: 'u1', displayName: 'مستخدم', role: 'viewer', active: true });
});

function clientFor(handler: (url: URL) => Response) {
  return createClient<import('@/lib/supabase/database.generated').Database>('https://example.supabase.co', 'sb_publishable_test', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, init) => {
      const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
      if (method !== 'GET') throw new Error(`Unexpected database write: ${method}`);
      return handler(new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url));
    } },
  });
}
const json = (data: unknown, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });
const viewer = { user_id: 'u1', display_name: 'مشاهد', role: 'viewer', is_active: true };
it('requires a verified Supabase identity instead of borrowing legacy staff identity', async () => {
  const client = clientFor(() => { throw new Error('must not query without session'); });
  await expect(createSupabaseReadRepository(client).getSnapshot()).rejects.toMatchObject({ reason: 'authentication' });
});
it('reads an authorized empty catalog using GET only', async () => {
  const client = clientFor(url => url.pathname.endsWith('admin_profiles') ? json(viewer) : json([]));
  // Auth is external; supply its verified getUser result without creating any user.
  client.auth.getUser = async () => ({ data: { user: { id: 'u1' } }, error: null }) as Awaited<ReturnType<typeof client.auth.getUser>>;
  expect(await createSupabaseReadRepository(client).getSnapshot()).toEqual({ programs: [], branches: [] });
});
it('distinguishes denied access from an empty catalog', async () => {
  const client = clientFor(url => url.pathname.endsWith('admin_profiles') ? json(viewer) : json({ code: '42501', message: 'private diagnostic' }, 403));
  client.auth.getUser = async () => ({ data: { user: { id: 'u1' } }, error: null }) as Awaited<ReturnType<typeof client.auth.getUser>>;
  await expect(createSupabaseReadRepository(client).getSnapshot()).rejects.toMatchObject({ reason: 'authorization' });
});
it('rejects unprovisioned profiles even when RLS would return empty rows', async () => {
  const client = clientFor(() => json(null));
  client.auth.getUser = async () => ({ data: { user: { id: 'u1' } }, error: null }) as Awaited<ReturnType<typeof client.auth.getUser>>;
  await expect(createSupabaseReadRepository(client).getSnapshot()).rejects.toMatchObject({ reason: 'authorization' });
});
it.each([{ ...viewer, is_active: false }, { ...viewer, user_id: 'different-user' }])('rejects inactive or mismatched profiles before reading catalog tables', async profile => {
  const client = clientFor(url => {
    expect(url.pathname).toContain('admin_profiles');
    return json(profile);
  });
  client.auth.getUser = async () => ({ data: { user: { id: 'u1' } }, error: null }) as Awaited<ReturnType<typeof client.auth.getUser>>;
  await expect(createSupabaseReadRepository(client).getSnapshot()).rejects.toMatchObject({ reason: 'authorization' });
});
it('reads program children and activity with bounded GET requests', async () => {
  const client = clientFor(url => {
    if (url.pathname.endsWith('admin_profiles')) return json(viewer);
    if (url.pathname.endsWith('activity_logs')) {
      expect(url.searchParams.get('limit')).toBe('10');
      expect(url.searchParams.get('order')).toBe('created_at.desc,id.desc');
      return json([]);
    }
    expect(url.searchParams.get('program_id')).toBe('eq.p1');
    expect(url.searchParams.get('order')).toBe('sort_order.asc,id.asc');
    return json([{ id: 'c1', program_id: 'p1', title: 'بند', sort_order: 0 }]);
  });
  client.auth.getUser = async () => ({ data: { user: { id: 'u1' } }, error: null }) as Awaited<ReturnType<typeof client.auth.getUser>>;
  const repository = createSupabaseReadRepository(client);
  expect(await repository.getCurriculum('p1')).toEqual([{ id: 'c1', programId: 'p1', title: 'بند', sortOrder: 0 }]);
  expect(await repository.getCareerPaths('p1')).toHaveLength(1);
  expect(await repository.getActivity(10)).toEqual([]);
  await expect(repository.getActivity(101)).rejects.toMatchObject({ reason: 'configuration' });
});
it.each([['42P01', 'schema'], ['42703', 'schema'], ['PGRST205', 'schema'], ['08006', 'connection']])('classifies database error %s as %s', async (code, reason) => {
  const client = clientFor(url => url.pathname.endsWith('admin_profiles') ? json(viewer) : json({ code, message: 'private diagnostic' }, 500));
  client.auth.getUser = async () => ({ data: { user: { id: 'u1' } }, error: null }) as Awaited<ReturnType<typeof client.auth.getUser>>;
  await expect(createSupabaseReadRepository(client).getSnapshot()).rejects.toMatchObject({ reason });
});
it('paginates past the API row limit with deterministic ordering', async () => {
  const client = clientFor(url => {
    if (url.pathname.endsWith('admin_profiles')) return json(viewer);
    if (url.pathname.endsWith('branches')) {
      const offset = Number(url.searchParams.get('offset'));
      const batch = offset === 0 ? [{ ...branch, id: 'b1' }, { ...branch, id: 'b2' }] : [{ ...branch, id: 'b3' }];
      expect(url.searchParams.get('order')).toContain('id.asc');
      return json(batch, 200, { 'Content-Range': `${offset}-${offset + batch.length - 1}/3` });
    }
    return json([]);
  });
  client.auth.getUser = async () => ({ data: { user: { id: 'u1' } }, error: null }) as Awaited<ReturnType<typeof client.auth.getUser>>;
  const result = await createSupabaseReadRepository(client, { pageSize: 2 }).getSnapshot();
  expect(result.branches.map(b => b.id)).toEqual(['b1', 'b2', 'b3']);
});
