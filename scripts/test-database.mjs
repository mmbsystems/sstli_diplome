// Runs real PostgreSQL constraints/RLS on synthetic data. NEVER accepts a remote URL.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import net from 'node:net';
import { catalogImportTests } from '../tests/database/catalog-import.mjs';
const bin = process.env.PG_BIN || (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/18/bin' : '');
const root = mkdtempSync(join(tmpdir(), 'sstli-db-test-'));
const data = join(root, 'data');
const executable = name => bin ? join(bin, name + (process.platform === 'win32' ? '.exe' : '')) : name;
const run = (name, args) => execFileSync(executable(name), args, { encoding: 'utf8', windowsHide: true, timeout: 120000, stdio: name === 'pg_ctl' ? 'ignore' : 'pipe' });
const port = await new Promise((resolve, reject) => { const server = net.createServer(); server.on('error', reject); server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); }); });
const bootstrap = join(root, 'bootstrap.sql');
writeFileSync(bootstrap, `create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to anon, authenticated, service_role; grant execute on function auth.uid() to anon, authenticated, service_role;
-- Minimal Storage relation contract for migration/RLS tests; HTTP proof tests the real service.
create schema storage;
create table storage.buckets(id text primary key,name text not null,public boolean default false,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text not null);
alter table storage.buckets enable row level security; alter table storage.objects enable row level security;
grant usage on schema storage to anon,authenticated,service_role;
grant all on all tables in schema storage to anon,authenticated,service_role;`);
const sql = file => run('psql', ['-X', '-q', '-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-f', file]);
let started = false;
try {
  run('initdb', ['-D', data, '-U', 'postgres', '--auth=trust', '--encoding=UTF8', '--no-locale']);
  run('pg_ctl', ['-D', data, '-l', join(root, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start']);
  started = true;
  sql(bootstrap);
  for (const file of readdirSync('supabase/migrations').filter(x => x.endsWith('.sql')).sort()) sql(join('supabase/migrations', file));
  sql('tests/database/foundation.sql');
  sql('tests/database/legacy-admin.sql');
  sql('tests/database/program-crud.sql');
  sql('tests/database/program-atomicity.sql');
  sql('tests/database/program-images.sql');
  sql('tests/database/program-image-storage.sql');
  sql('tests/database/branch-crud.sql');
  sql('tests/database/offering-crud.sql');
  sql('tests/database/offering-safety.sql');
  const importTest = join(root, 'catalog-import.sql');
  writeFileSync(importTest, catalogImportTests());
  sql(importTest);
  console.log('PASS: catalog transaction, exact reconciliation, partial-target refusal, receipt rollback/immutability, retry and audit restoration.');
  console.log('PASS: migrations, constraints, RLS role matrix, append-only audit, timestamps and archive/restore.');
} catch (error) {
  console.error(error.stderr?.toString() || error.message);
  process.exitCode = 1;
} finally {
  if (started) run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']);
  console.log(`Disposable cluster stopped; diagnostic files retained at ${root}`);
}
