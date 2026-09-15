// @vitest-environment node
import { expect, it } from 'vitest';
import { mkdtemp, mkdir, copyFile, symlink, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';

it('bootstraps idempotently with bcrypt 12, preserves staff, and resets only explicitly', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'sstli-bootstrap-test-'));
  try {
    await mkdir(path.join(root, 'scripts')); await mkdir(path.join(root, 'config'));
    await copyFile('scripts/bootstrap-super-admin.mjs', path.join(root, 'scripts/bootstrap-super-admin.mjs'));
    await symlink(path.resolve('node_modules'), path.join(root, 'node_modules'), 'junction');
    const staff = { username: 'staff', name: 'Staff', passwordHash: await bcrypt.hash(randomBytes(24).toString('hex'), 12) };
    await writeFile(path.join(root, 'config/admins.json'), JSON.stringify([staff]));
    const password = randomBytes(24).toString('base64url');
    const run = (secret: string, args: string[] = []) => execFileSync(process.execPath, ['scripts/bootstrap-super-admin.mjs', ...args], { cwd: root, env: { ...process.env, SSTLI_ADMIN_PASSWORD: secret }, encoding: 'utf8', windowsHide: true, stdio: 'pipe' });
    expect(run(password)).not.toContain(password);
    const initial = await readFile(path.join(root, 'config/admins.json'), 'utf8');
    expect(initial).not.toContain(password);
    const accounts = JSON.parse(initial);
    expect(accounts[0]).toEqual(staff);
    expect(accounts[1]).toMatchObject({ username: 'admin', name: 'مدير النظام', role: 'super_admin' });
    expect(await bcrypt.compare(password, accounts[1].passwordHash)).toBe(true);
    expect(bcrypt.getRounds(accounts[1].passwordHash)).toBe(12);
    run(password);
    expect(await readFile(path.join(root, 'config/admins.json'), 'utf8')).toBe(initial);
    const replacement = randomBytes(24).toString('base64url');
    expect(() => run(replacement)).toThrow();
    run(replacement, ['--reset']);
    const reset = JSON.parse(await readFile(path.join(root, 'config/admins.json'), 'utf8'));
    expect(reset[0]).toEqual(staff);
    expect(await bcrypt.compare(replacement, reset[1].passwordHash)).toBe(true);
    expect(() => run(randomBytes(4).toString('hex'), ['--reset'])).toThrow();
  } finally {
    await rm(path.join(root, 'node_modules'), { recursive: true, force: true });
    await rm(root, { recursive: true, force: true });
  }
}, 15000);
