// @vitest-environment node
import {beforeEach, expect, it, vi} from 'vitest';
import {randomBytes} from 'node:crypto';
vi.mock('server-only', () => ({}));
import {createSession, verifySession} from '@/lib/session';

beforeEach(() => { process.env.AUTH_SECRET = randomBytes(48).toString('hex'); });
it('accepts a signed session and exposes only its username', async () => {
  const token = await createSession('staff');
  expect((await verifySession(token))?.username).toBe('staff');
});
it('rejects forged, malformed, absent and expired sessions', async () => {
  const token = await createSession('staff');
  for (const value of [undefined, '', 'garbage', token.slice(0, -12) + 'forged']) {
    expect(await verifySession(value)).toBeNull();
  }
  vi.useFakeTimers();
  vi.setSystemTime(Date.now() + 9 * 60 * 60 * 1000);
  expect(await verifySession(token)).toBeNull();
  vi.useRealTimers();
});
it('fails closed when the signing secret is missing or too short', async () => {
  const token = await createSession('staff');
  process.env.AUTH_SECRET = '';
  expect(await verifySession(token)).toBeNull();
  await expect(createSession('staff')).rejects.toThrow();
});
