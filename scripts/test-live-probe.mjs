// Opt-in integration regression against a running production server and its DB.
// Supply {"password": "..."} on stdin from a secure prompt/secret manager.
// Credentials and cookies are never logged or written to disk.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
let input = '';
for await (const chunk of process.stdin) input += chunk;
let { password } = JSON.parse(input);
input = '';
const base = process.env.PROBE_TEST_URL || 'http://127.0.0.1:3210';
const id = randomUUID();
let cookie;
let version = 0;
async function post(path, body, timeout = 10000) {
  const start = performance.now();
  const response = await fetch(base + path, {
    method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(timeout),
    headers: { origin: base, 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  return { response, data, ms: Math.round(performance.now() - start) };
}
async function command(action, expectedVersion, value) {
  return post('/api/admin/probe', { id, action, expectedVersion, ...(value === undefined ? {} : { value }) }, 5000);
}
try {
  const login = await post('/api/auth/login', { username: 'admin', password });
  password = undefined;
  assert.equal(login.response.status, 200, 'admin login');
  cookie = login.response.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);
  const created = await command('create', 0, 'HTTP concurrency regression');
  assert.equal(created.response.status, 200);
  version = 1;
  console.log(JSON.stringify({ id, step: 'create', ...created.data, ms: created.ms }));
  const updated = await command('update', 1, 'current version');
  assert.equal(updated.response.status, 200);
  assert.equal(updated.data.version, 2);
  version = 2;
  console.log(JSON.stringify({ id, step: 'update', status: updated.response.status, ms: updated.ms }));
  // Must finish before cleanup: deleting the row must never unblock this test.
  for (let attempt = 0; attempt < 3; attempt++) {
    const stale = await command('update', 1, 'must not persist');
    assert.equal(stale.response.status, 409);
    assert.deepEqual(stale.data, { error: 'conflict' });
    assert.ok(stale.ms < 5000);
    console.log(JSON.stringify({ id, step: 'stale', status: 409, ms: stale.ms }));
  }
  // A successful write at version 2 proves stale requests did not advance it.
  const next = await command('update', 2, 'after conflicts');
  assert.equal(next.response.status, 200);
  assert.equal(next.data.version, 3);
  version = 3;
  console.log(JSON.stringify({ id, step: 'after-conflicts', status: 200, ms: next.ms }));
} catch (error) {
  console.error(JSON.stringify({ id, failure: error.name, message: error.message }));
  process.exitCode = 1;
} finally {
  password = undefined;
  if (version) {
    const cleanup = await command('delete', version);
    assert.equal(cleanup.response.status, 200, 'cleanup');
    assert.equal(cleanup.data.deleted, true);
    console.log(JSON.stringify({ id, step: 'cleanup', ...cleanup.data, ms: cleanup.ms }));
  }
}
