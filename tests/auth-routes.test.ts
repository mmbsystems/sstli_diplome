// @vitest-environment node
import {beforeAll, expect, it, vi} from 'vitest';
import {randomBytes} from 'node:crypto';
import bcrypt from 'bcryptjs';
import {NextRequest} from 'next/server';
vi.mock('server-only', () => ({}));
const fixture = vi.hoisted(() => ({admins: [] as {username:string;name:string;passwordHash:string}[], jar: new Map<string,string>()}));
vi.mock('@/config/admins.json', () => ({default: fixture.admins}));
vi.mock('next/headers', () => ({cookies: async () => ({get: (key:string) => ({value:fixture.jar.get(key)}), set: (key:string,value:string) => fixture.jar.set(key,value)})}));
import {POST as login} from '@/app/api/auth/login/route';
import {POST as logout} from '@/app/api/auth/logout/route';
import {middleware} from '@/middleware';
import {COOKIE_NAME} from '@/lib/session';
import {currentUser} from '@/lib/auth';
const password = randomBytes(24).toString('hex');
const origin = 'http://localhost:3000';
function request(path: string, body?: unknown, cookie?: string) {
  return new NextRequest(origin + path, {method: body ? 'POST' : 'GET', headers: {origin, 'Content-Type':'application/json', ...(cookie ? {cookie: `${COOKIE_NAME}=${cookie}`} : {})}, ...(body ? {body: JSON.stringify(body)} : {})});
}
beforeAll(async () => {
  process.env.AUTH_SECRET = randomBytes(48).toString('hex');
  fixture.admins.push({username:'test-staff',name:'موظف تجريبي',passwordHash:await bcrypt.hash(password,12)});
});
it('uses the same generic response for unknown usernames and wrong passwords', async () => {
  const unknown = await login(request('/api/auth/login',{username:'missing',password}));
  const incorrect = await login(request('/api/auth/login',{username:'test-staff',password:randomBytes(16).toString('hex')}));
  expect(unknown.status).toBe(401); expect(incorrect.status).toBe(401);
  expect(await unknown.json()).toEqual(await incorrect.json());
});
it('logs in, navigates, refreshes and logs out without returning hashes', async () => {
  const response = await login(request('/api/auth/login',{username:'test-staff',password}));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({redirect:'/programs?category=diploma'});
  const cookie = response.cookies.get(COOKIE_NAME)!;
  expect(cookie.httpOnly).toBe(true); expect(cookie.sameSite).toBe('lax'); expect(cookie.path).toBe('/');
  fixture.jar.set(COOKIE_NAME, cookie.value);
  expect(await currentUser()).toEqual({username:'test-staff',name:'موظف تجريبي'});
  for (const path of ['/', '/programs', '/programs/law', '/programs?category=diploma']) {
    expect((await middleware(request(path, undefined, cookie.value))).headers.get('location')).toBeNull();
  }
  expect((await middleware(request('/programs', undefined, cookie.value))).headers.get('location')).toBeNull();
  const out = await logout(request('/api/auth/logout', {}));
  expect(out.status).toBe(303); expect(out.headers.get('location')).toBe(origin+'/login');
  expect(await currentUser()).toBeNull();
  expect((await middleware(request('/programs',undefined,fixture.jar.get(COOKIE_NAME)))).headers.get('location')).toBe(origin+'/login');
});
it('protects direct URLs, unknown APIs, images and malformed cookies', async () => {
  for (const path of ['/', '/programs', '/programs/law', '/api/private', '/config/admins.json', '/images/private.jpg']) {
    for (const token of [undefined,'bad.cookie']) expect((await middleware(request(path,undefined,token))).headers.get('location')).toBe(origin+'/login');
  }
});
it('allows only the public login resources', async () => {
  for (const path of ['/login','/robots.txt','/sstli_logo.jpg','/_next/static/chunks/main.js']) expect((await middleware(request(path))).headers.get('location')).toBeNull();
});
it('rejects cross-origin authentication requests', async () => {
  for (const handler of [login,logout]) {
    const req = new NextRequest(origin+'/api/auth/login',{method:'POST',headers:{origin:'https://other.invalid'}});
    expect((await handler(req)).status).toBe(403);
  }
});
it('reports a missing signing secret as a server problem without setting a cookie', async () => {
  const original = process.env.AUTH_SECRET;
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  delete process.env.AUTH_SECRET;
  try {
    const response = await login(request('/api/auth/login', {username:'test-staff',password}));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({error:'تعذر تسجيل الدخول حاليًا. يرجى المحاولة لاحقًا'});
    expect(response.cookies.get(COOKIE_NAME)).toBeUndefined();
  } finally { process.env.AUTH_SECRET = original; log.mockRestore(); }
});
it('accepts same-origin loopback requests without trusting forwarded hosts', async () => {
  const url = 'http://127.0.0.1:3000/api/auth/login';
  const response = await login(new NextRequest(url, {method:'POST', headers:{origin:'http://127.0.0.1:3000',host:'127.0.0.1:3000','content-type':'application/json'},body:JSON.stringify({username:'test-staff',password})}));
  expect(response.status).toBe(200);
  const forged = await login(new NextRequest(url, {method:'POST',headers:{origin:'https://attacker.invalid',host:'sstli.example','x-forwarded-host':'attacker.invalid'}}));
  expect(forged.status).toBe(403);
});
it('rejects malformed and oversized JSON before credential verification', async () => {
  for (const body of ['{', JSON.stringify({username:'test-staff',password:'x'.repeat(5000)})]) {
    const response = await login(new NextRequest(origin+'/api/auth/login',{method:'POST',headers:{origin,'content-type':'application/json'},body}));
    expect(response.status).toBe(400);
    expect(response.cookies.get(COOKIE_NAME)).toBeUndefined();
  }
});
