import {NextRequest, NextResponse} from 'next/server';
import {COOKIE_NAME, verifySession} from '@/lib/session';

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const publicRoute = path === '/login' || path === '/api/auth/login' || path === '/api/auth/logout' || path === '/robots.txt' || path === '/favicon.ico' || path === '/sstli_logo.jpg' || path.startsWith('/_next/static/') || (process.env.NODE_ENV !== 'production' && path.startsWith('/_next/'));
  if (publicRoute) return NextResponse.next();
  const session = await verifySession(request.cookies.get(COOKIE_NAME)?.value);
  const response = session ? NextResponse.next() : NextResponse.redirect(new URL('/login', request.url));
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const config = {matcher: '/:path*'};
