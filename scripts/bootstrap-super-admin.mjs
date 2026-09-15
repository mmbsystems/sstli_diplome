// Passwords enter through the process environment, never command-line arguments.
import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';

const args = process.argv.slice(2);
let password = process.env.SSTLI_ADMIN_PASSWORD;
delete process.env.SSTLI_ADMIN_PASSWORD;
const file = new URL('../config/admins.json', import.meta.url);
let temporary;
try {
  if (args.some(arg => !['--reset', '--initial'].includes(arg)) || new Set(args).size !== args.length || args.length > 1) throw new Error();
  const accounts = JSON.parse(await readFile(file, 'utf8'));
  if (!Array.isArray(accounts)) throw new Error();
  const matches = accounts.filter(account => account.username === 'admin');
  if (matches.length > 1 || accounts.some(account => account.username !== 'admin' && account.role === 'super_admin')) throw new Error();
  // The explicitly requested initial credential is shorter than the staff script's
  // minimum. Permit it only for first creation with --initial; resets require 12+.
  const minimum = args.includes('--initial') ? 9 : 12;
  if (!password || password.length < minimum || Buffer.byteLength(password) > 72) throw new Error();
  const existing = matches[0];
  if (existing && !args.includes('--reset')) {
    if (existing.role !== 'super_admin' || existing.name !== 'مدير النظام' || !await bcrypt.compare(password, existing.passwordHash)) throw new Error();
    console.log('Admin already provisioned; no account changed.');
  } else {
    const record = { username: 'admin', name: 'مدير النظام', role: 'super_admin', passwordHash: await bcrypt.hash(password, 12) };
    if (existing) accounts[accounts.indexOf(existing)] = record; else accounts.push(record);
    temporary = fileURLToPath(file) + `.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(accounts, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    await rename(temporary, file); temporary = undefined;
    console.log('Admin provisioned: admin (super_admin); only bcrypt hash stored.');
  }
} catch {
  console.error('Admin bootstrap failed. Check the account config, password environment variable, and --reset/--initial usage. No credential is logged.');
  process.exitCode = 1;
} finally {
  password = undefined;
  if (temporary) await unlink(temporary).catch(() => {});
}
