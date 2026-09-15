// @vitest-environment node
import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';
vi.mock('server-only', () => ({}));
const fixture = vi.hoisted(() => ({ accounts: [] as { username: string; name: string; role?: string; passwordHash: string }[], token: '' }));
vi.mock('@/config/admins.json', () => ({ default: fixture.accounts }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: fixture.token }) }) }));
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
import { currentUser, requireAdmin } from '@/lib/auth';
import { createSession, COOKIE_NAME } from '@/lib/session';
import { middleware } from '@/middleware';
import { POST as login } from '@/app/api/auth/login/route';
import { loadActivity } from '@/lib/admin/activity';
import { loadLegacyUsers } from '@/lib/admin/users';
const password = randomBytes(24).toString('hex');
beforeAll(async () => {
  process.env.AUTH_SECRET = randomBytes(48).toString('hex');
  const passwordHash = await bcrypt.hash(password, 12);
  fixture.accounts.push({ username: 'admin', name: 'مدير النظام', role: 'super_admin', passwordHash }, { username: 'staff', name: 'Staff', passwordHash });
});
beforeEach(() => { fixture.token = ''; fixture.accounts[0].role = 'super_admin'; });
it('logs in an admin through the existing route without returning sensitive account data', async () => {
  const response = await login(new NextRequest('http://localhost/api/auth/login', { method: 'POST', headers: { origin: 'http://localhost', 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin', password }) }));
  expect(response.status).toBe(200);
  fixture.token = response.cookies.get(COOKIE_NAME)!.value;
  expect(await currentUser()).toEqual({ username: 'admin', name: 'مدير النظام', role: 'super_admin' });
  expect(await response.text()).not.toContain('passwordHash');
  expect((await requireAdmin()).role).toBe('super_admin');
});
it('resolves roles from trusted config and immediately respects demotion', async () => {
  fixture.token = await createSession('admin');
  fixture.accounts[0].role = 'staff';
  expect((await currentUser())?.role).toBe('staff');
  await expect(requireAdmin()).rejects.toThrow('redirect:/programs');
});
it('denies staff and anonymous users at the server helper', async () => {
  await expect(requireAdmin()).rejects.toThrow('redirect:/login');
  fixture.token = await createSession('staff');
  await expect(requireAdmin({ api: true })).rejects.toMatchObject({ reason: 'unauthorized' });
});
it('protects activity and account reads with the real legacy session guard', async () => {
  await expect(loadActivity()).rejects.toThrow('redirect:/login');
  await expect(loadLegacyUsers()).rejects.toThrow('redirect:/login');
  fixture.token = await createSession('staff');
  await expect(loadActivity()).rejects.toThrow('redirect:/programs');
  await expect(loadLegacyUsers()).rejects.toThrow('redirect:/programs');
  fixture.token = await createSession('admin');
  expect(await loadLegacyUsers()).toEqual([
    { username: 'admin', name: 'مدير النظام', role: 'super_admin' },
    { username: 'staff', name: 'Staff', role: 'staff' },
  ]);
});
it('ignores roles submitted to login', async () => {
  const response = await login(new NextRequest('http://localhost/api/auth/login', { method: 'POST', headers: { origin: 'http://localhost', 'content-type': 'application/json' }, body: JSON.stringify({ username: 'staff', password, role: 'super_admin' }) }));
  fixture.token = response.cookies.get(COOKIE_NAME)!.value;
  expect((await currentUser())?.role).toBe('staff');
});
it('protects every nested admin URL while preserving the explorer', async () => {
  for (const username of ['admin', 'staff']) {
    const token = await createSession(username);
    for (const path of ['/admin', '/admin/programs/new', '/admin/branches/id', '/admin/pricing', '/admin/users', '/admin/activity']) {
      const response = await middleware(new NextRequest(`http://localhost${path}`, { headers: { cookie: `${COOKIE_NAME}=${token}` } }));
      expect(response.headers.get('location')).toBe(username === 'admin' ? null : 'http://localhost/programs');
    }
    expect((await middleware(new NextRequest('http://localhost/programs', { headers: { cookie: `${COOKIE_NAME}=${token}` } }))).headers.get('location')).toBeNull();
  }
});
