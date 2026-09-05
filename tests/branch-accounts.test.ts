// @vitest-environment node
import {expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {offerings} from '@/data/offerings';

it('keeps exactly one branch account per branch recorded in active offerings', () => {
  const accounts = JSON.parse(readFileSync('config/admins.json', 'utf8')) as {username:string;branch?:string;passwordHash:string}[];
  const expected = [...new Set(offerings.filter(o => o.active && o.branch).map(o => `${o.city} — ${o.branch}`))].sort();
  expect(accounts.filter(a => a.branch).map(a => a.branch).sort()).toEqual(expected);
  expect(new Set(accounts.map(a => a.username)).size).toBe(accounts.length);
  expect(accounts.some(a => a.username === 'bahaa')).toBe(true);
  for (const account of accounts) {
    expect(Object.keys(account).every(key => ['username','name','passwordHash','branch'].includes(key))).toBe(true);
    expect(/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/.test(account.passwordHash)).toBe(true);
  }
});
