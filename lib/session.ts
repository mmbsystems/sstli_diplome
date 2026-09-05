import 'server-only';
import {SignJWT} from 'jose/jwt/sign';
import {jwtVerify} from 'jose/jwt/verify';

export const COOKIE_NAME = 'sstli_session';
export const SESSION_SECONDS = 8 * 60 * 60;
export const cookieOptions = {
  httpOnly: true, secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const, path: '/',
};
function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32 || value === 'replace-with-a-long-random-secret') {
    throw new Error('AUTH_SECRET must contain at least 32 random characters');
  }
  return new TextEncoder().encode(value);
}
export async function createSession(username: string) {
  return new SignJWT({username}).setProtectedHeader({alg: 'HS256'})
    .setIssuedAt().setExpirationTime(`${SESSION_SECONDS}s`)
    .setIssuer('sstli').setAudience('sstli-staff').sign(secret());
}
export async function verifySession(token?: string) {
  if (!token || token.length > 2048) return null;
  try {
    const {payload} = await jwtVerify(token, secret(), {
      algorithms: ['HS256'], issuer: 'sstli', audience: 'sstli-staff',
      requiredClaims: ['exp', 'iat', 'username'], maxTokenAge: `${SESSION_SECONDS}s`,
    });
    return typeof payload.username === 'string' ? {username: payload.username} : null;
  } catch { return null; }
}
