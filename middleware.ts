import {NextRequest, NextResponse} from 'next/server';
import {COOKIE_NAME, verifySession} from '@/lib/session';
import {resolveAccount} from '@/lib/accounts';

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const publicRoute = path === '/login' || path === '/api/auth/login' || path === '/api/auth/logout' || path === '/robots.txt' || path === '/favicon.ico' || path === '/sstli_logo.jpg' || path.startsWith('/_next/static/') || (process.env.NODE_ENV !== 'production' && path.startsWith('/_next/'));
  if (publicRoute) return NextResponse.next();
  const session = await verifySession(request.cookies.get(COOKIE_NAME)?.value);
  const adminApi = path === '/api/admin' || path.startsWith('/api/admin/');
  if (adminApi || path === '/admin' || path.startsWith('/admin/')) {
    const user = session ? resolveAccount(session.username) : null;
    if (!user || user.role !== 'super_admin') {
      const denied = adminApi
        ? NextResponse.json({ error: user ? 'unauthorized' : 'unauthenticated' }, { status: user ? 403 : 401 })
        : NextResponse.redirect(new URL(user ? '/programs' : '/login', request.url));
      denied.headers.set('Cache-Control', 'private, no-store');
      return denied;
    }
  }
  const response = session ? NextResponse.next() : NextResponse.redirect(new URL('/login', request.url));
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const config = {matcher: '/:path*'};
