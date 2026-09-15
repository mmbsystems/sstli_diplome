// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { randomUUID, randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
vi.mock('@/lib/auth', async original => ({ ...await original<typeof import('@/lib/auth')>(), requireAdmin: mocks.requireAdmin }));
import { AdminAuthorizationError } from '@/lib/auth';
import { POST } from '@/app/api/admin/probe/route';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseProbeInput, price, bool, uuid, expectedVersion, enumeration } from '@/lib/admin/mutations/validation';
const id = randomUUID();
const secret = `sb_secret_${randomBytes(24).toString('hex')}`;
const project = 'crzedkbjvujcmcikgvoe';
const input = () => ({ id, action: 'create', expectedVersion: 0, value: 'development probe' });
function request(body: unknown = input(), origin = 'http://localhost', method = 'POST') {
  return new NextRequest('http://localhost/api/admin/probe', { method, headers: { origin, 'content-type': 'application/json' }, ...(method === 'POST' ? { body: JSON.stringify(body) } : {}) });
}
beforeEach(() => {
  vi.stubEnv('SUPABASE_SECRET_KEY', secret); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', `https://${project}.supabase.co`);
  vi.stubEnv('ADMIN_WRITE_PROBE_ENABLED', 'true'); vi.stubEnv('ADMIN_WRITE_PROBE_PROJECT_REF', project);
  mocks.requireAdmin.mockResolvedValue({ username: 'admin', name: 'مدير النظام', role: 'super_admin' });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ id, version: 1, deleted: false }), { headers: { 'content-type': 'application/json' } })));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetAllMocks(); });
it.each([['unauthenticated', 401], ['unauthorized', 403]] as const)('rejects %s before database access', async (reason, status) => {
  mocks.requireAdmin.mockRejectedValue(new AdminAuthorizationError(reason));
  expect((await POST(request())).status).toBe(status);
  expect(fetch).not.toHaveBeenCalled();
});
it('rejects cross-origin, missing origin, and wrong method', async () => {
  expect((await POST(request(input(), 'https://attacker.invalid'))).status).toBe(403);
  expect((await POST(request(input(), ''))).status).toBe(403);
  expect((await POST(request(input(), 'http://localhost', 'GET'))).status).toBe(405);
  expect(fetch).not.toHaveBeenCalled();
});
it('enforces body size, exact fields, versions and IDs before database access', async () => {
  for (const body of [{ ...input(), role: 'super_admin' }, { ...input(), actor: 'other' }, { ...input(), id: 'bad' }, { ...input(), expectedVersion: -1 }, { ...input(), value: 'x'.repeat(5000) }]) {
    expect((await POST(request(body))).status).toBe(422);
  }
  expect(fetch).not.toHaveBeenCalled();
});
it('fails safely with no server key, a public key, or a mismatched target', async () => {
  for (const key of ['', 'sb_publishable_wrong']) {
    vi.stubEnv('SUPABASE_SECRET_KEY', key);
    expect(() => createAdminClient()).toThrow('configuration');
    expect((await POST(request())).status).toBe(503);
  }
  vi.stubEnv('SUPABASE_SECRET_KEY', secret);
  vi.stubEnv('ADMIN_WRITE_PROBE_PROJECT_REF', 'different-project');
  expect((await POST(request())).status).toBe(503);
  expect(fetch).not.toHaveBeenCalled();
});
it('is disabled unless explicitly opted in', async () => {
  vi.stubEnv('ADMIN_WRITE_PROBE_ENABLED', '');
  expect((await POST(request())).status).toBe(503);
  expect(fetch).not.toHaveBeenCalled();
});
it('sends only the controlled RPC with the server-resolved actor and returns no secret', async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  const [url, init] = vi.mocked(fetch).mock.calls[0];
  expect(String(url)).toContain('/rest/v1/rpc/legacy_admin_probe');
  expect(init?.method).toBe('POST');
  expect(JSON.parse(String(init?.body))).toMatchObject({ p_id: id, p_actor_username: 'admin', p_actor_name: 'مدير النظام', p_expected_version: 0 });
  expect(await response.json()).toEqual({ id, version: 1, deleted: false });
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
});
it.each([['PT409', 409, 'conflict'], ['40001', 409, 'conflict'], ['P0002', 404, 'not_found'], ['XX000', 500, 'database']])('sanitizes %s into %s', async (code, status, error) => {
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ code, message: secret }), { status: 400, headers: { 'content-type': 'application/json' } }));
  const response = await POST(request());
  expect(response.status).toBe(status);
  expect(await response.json()).toEqual({ error });
});
it('validates reusable primitives without coercion', () => {
  expect(uuid(id)).toBe(id);
  expect(price(0.29)).toBe(0.29);
  expect(bool(false)).toBe(false);
  expect(expectedVersion(4)).toBe(4);
  expect(enumeration('staff', ['staff', 'super_admin'])).toBe('staff');
  for (const invalid of [NaN, Infinity, -1, '10', 1.001]) expect(() => price(invalid)).toThrow();
  expect(() => bool('true')).toThrow();
  expect(() => expectedVersion(Number.MAX_SAFE_INTEGER + 1)).toThrow();
  expect(() => parseProbeInput({ ...input(), action: 'delete', expectedVersion: 0 })).toThrow();
});
