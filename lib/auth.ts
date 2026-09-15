import 'server-only';
import bcrypt from 'bcryptjs';
import {randomBytes} from 'node:crypto';
import admins from '@/config/admins.json';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {COOKIE_NAME, cookieOptions, verifySession} from './session';
import {resolveAccount} from './accounts';
export {createSession, verifySession} from './session';

type Admin = {username: string; name: string; passwordHash: string};
// Use equal bcrypt work for unknown users, without embedding any real credential.
const dummyHash = bcrypt.hash(randomBytes(32).toString('hex'), 12);
export async function verifyCredentials(username: unknown, password: unknown) {
  if (typeof username !== 'string' || typeof password !== 'string' || username.length > 64 || Buffer.byteLength(password) > 72) return null;
  const admin = (admins as Admin[]).find(a => a.username === username);
  const valid = await bcrypt.compare(password, admin?.passwordHash ?? await dummyHash);
  return valid && admin ? resolveAccount(admin.username) : null;
}
export async function currentUser() {
  const session = await verifySession((await cookies()).get(COOKIE_NAME)?.value);
  return session ? resolveAccount(session.username) : null;
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect('/login');
  return user;
}
export async function destroySession() {
  (await cookies()).set(COOKIE_NAME, '', {...cookieOptions, maxAge: 0, expires: new Date(0)});
}
export class AdminAuthorizationError extends Error {
  constructor(public readonly reason: 'unauthenticated' | 'unauthorized') { super(reason); }
}
export async function requireAdmin({ api = false }: { api?: boolean } = {}) {
  const user = await currentUser();
  if (!user) {
    if (api) throw new AdminAuthorizationError('unauthenticated');
    redirect('/login');
  }
  if (user.role !== 'super_admin') {
    if (api) throw new AdminAuthorizationError('unauthorized');
    redirect('/programs');
  }
  return user;
}
