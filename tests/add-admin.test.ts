// @vitest-environment node
import {expect, it} from 'vitest';
import {mkdtemp, mkdir, copyFile, symlink, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import bcrypt from 'bcryptjs';

it('creates and updates a hashed account without printing credentials', async () => {
  const root = await mkdtemp(path.join(tmpdir(),'sstli-admin-test-'));
  try {
    await mkdir(path.join(root,'scripts'));
    await copyFile('scripts/add-admin.mjs',path.join(root,'scripts/add-admin.mjs'));
    await copyFile('package.json',path.join(root,'package.json'));
    await copyFile('.npmrc',path.join(root,'.npmrc'));
    await symlink(path.resolve('node_modules'),path.join(root,'node_modules'),'junction');
    const run = (password:string, branch?:string) => execFileSync(process.execPath,[process.env.npm_execpath!,'run','add-admin','--','test-staff',password,'موظف تجريبي',...(branch ? [branch] : [])],{encoding:'utf8',cwd:root});
    const first = randomBytes(24).toString('hex');
    const second = randomBytes(24).toString('hex');
    const output = run(first,'فرع تجريبي');
    expect(output).toContain('test-staff'); expect(output).not.toContain(first);
    expect(run(second)).not.toContain(second);
    const content = await readFile(path.join(root,'config/admins.json'),'utf8');
    expect(content).not.toContain(first); expect(content).not.toContain(second);
    const accounts = JSON.parse(content);
    expect(accounts).toHaveLength(1);
    expect(accounts[0].branch).toBe('فرع تجريبي');
    expect(await bcrypt.compare(second,accounts[0].passwordHash)).toBe(true);
    expect(await bcrypt.compare(first,accounts[0].passwordHash)).toBe(false);
  } finally {
    // Remove the junction first so cleanup cannot traverse workspace dependencies.
    await rm(path.join(root,'node_modules'),{recursive:true,force:true});
    await rm(root,{recursive:true,force:true});
  }
},15000);
