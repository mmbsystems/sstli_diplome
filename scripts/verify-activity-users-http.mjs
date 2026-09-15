// Read-only Phase C proof. The existing admin password enters via stdin only.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
process.loadEnvFile('.env.local');
const base = process.env.PHASE_C_TEST_URL || 'http://127.0.0.1:3216';
if (process.stdin.isTTY) process.stdin.setRawMode(true);
const input = createInterface({ input: process.stdin, terminal: false });
let password;
for await (const line of input) { password = JSON.parse(line).password; input.close(); break; }
assert(typeof password === 'string' && password.length > 0, 'Private credential required');
const configBefore = readFileSync('config/admins.json');
const accounts = JSON.parse(configBefore);
const forbidden = [password, process.env.AUTH_SECRET, process.env.SUPABASE_SECRET_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY, ...accounts.map(a => a.passwordHash)].filter(Boolean);
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const tables = ['programs', 'branches', 'program_offerings', 'curriculum_items', 'career_paths', 'activity_logs'];
async function snapshot() {
  const result = {};
  for (const table of tables) {
    const { data, error } = await db.from(table).select('*').order('id').abortSignal(AbortSignal.timeout(20000));
    assert(!error, `Hosted read failed: ${table}`); result[table] = data;
  }
  return result;
}
let scanned = 0;
async function request(path, cookie, body, headers = {}) {
  const response = await fetch(base + path, { redirect: 'manual', method: body ? 'POST' : 'GET', headers: { origin: base, ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
  const text = await response.text(); scanned++;
  assert(!forbidden.some(value => text.includes(value)), 'Sensitive value in HTTP response');
  return { status: response.status, text, cookie: response.headers.get('set-cookie')?.split(';')[0], location: response.headers.get('location'), cache: response.headers.get('cache-control') };
}
try {
  assert.equal(process.env.ADMIN_DATA_SOURCE, 'supabase');
  const before = await snapshot();
  for (const path of ['/admin/activity', '/admin/users']) {
    const response = await request(path); assert.equal(response.status, 307); assert(response.location.includes('/login'));
  }
  const staffRow = readFileSync('STAFF_CREDENTIALS.txt', 'utf8').split(/\r?\n/).find(line => line.startsWith('bahaa |')).split('|').map(value => value.trim());
  forbidden.push(staffRow[1]);
  const staff = await request('/api/auth/login', null, { username: staffRow[0], password: staffRow[1], role: 'super_admin', actor: 'admin' });
  assert.equal(staff.status, 200);
  for (const path of ['/admin/activity', '/admin/users']) {
    const response = await request(path, staff.cookie); assert.equal(response.status, 307); assert(response.location.includes('/programs'));
  }
  const admin = await request('/api/auth/login', null, { username: 'admin', password }); password = undefined;
  assert.equal(admin.status, 200);
  let path = '/admin/activity'; const seen = []; let pages = 0;
  while (path) {
    assert(pages < 20, 'Unexpected page cycle');
    const page = await request(path, admin.cookie); assert.equal(page.status, 200);
    assert(page.cache?.includes('no-store'), 'Audit must not be publicly cached');
    const ids = [...page.text.matchAll(/data-audit-id="([^"]+)"/g)].map(match => match[1]);
    assert(ids.length <= 25); seen.push(...ids); pages++;
    for (const id of ids) {
      const row = before.activity_logs.find(item => item.id === id); assert(row, 'UI row absent from hosted audit');
      assert(page.text.includes(row.entity_id));
      if (row.metadata?.legacy_actor?.request_id) assert(page.text.includes(row.metadata.legacy_actor.request_id));
    }
    const next = page.text.match(/href="(\/admin\/activity\?cursor=[^"]+)"/);
    path = next ? next[1].replaceAll('&amp;', '&') : null;
  }
  assert.equal(new Set(seen).size, seen.length, 'Duplicate audit across pages');
  assert.deepEqual([...seen].sort(), before.activity_logs.map(row => row.id).sort());
  for (const entity of ['programs', 'branches', 'program_offerings']) assert(before.activity_logs.some(row => row.entity_type === entity), `Missing hosted ${entity} coverage`);
  assert(before.activity_logs.some(row => row.action === 'delete'), 'Missing retained cleanup audit');
  const rsc = await request('/admin/activity', admin.cookie, null, { RSC: '1' }); assert.equal(rsc.status, 200);
  const users = await request('/admin/users', admin.cookie); assert.equal(users.status, 200);
  for (const account of accounts) assert(users.text.includes(account.username));
  assert(!users.text.includes('content_manager')); assert(!users.text.includes('branch_manager'));
  const invalid = await request('/admin/activity?cursor=bad', admin.cookie); assert.equal(invalid.status, 200); assert(invalid.text.includes('رابط الصفحة غير صالح'));
  assert.deepEqual(await snapshot(), before, 'Read-only proof changed hosted rows');
  assert(configBefore.equals(readFileSync('config/admins.json')), 'Account configuration changed');
  const report = { phase: 'C', verifiedAt: new Date().toISOString(), anonymous: 'activity/users redirected to login', staff: 'actual login with spoofed role/actor; activity/users denied', admin: 'actual legacy login; hosted activity/users and activity RSC 200', pagination: { pages, auditRows: seen.length, duplicateRows: 0 }, counts: Object.fromEntries(tables.map(table => [table, before[table].length])), auditHash: createHash('sha256').update(JSON.stringify(before.activity_logs)).digest('hex'), hostedRowsUnchanged: true, legacyConfigUnchanged: true, responsesScanned: scanned, secretHits: 0, mutations: 0 };
  writeFileSync('scripts/activity-users-proof-result.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} catch { console.error('Phase C HTTP proof failed; no credentials or raw response were logged.'); process.exitCode = 1; }
finally { password = undefined; forbidden.fill(''); }
