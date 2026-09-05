import {NextRequest, NextResponse} from 'next/server';
import {destroySession} from '@/lib/auth';
export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) return NextResponse.json({error: 'طلب غير مسموح'}, {status: 403});
  await destroySession();
  return NextResponse.redirect(new URL('/login', request.url), {status: 303, headers: {'Cache-Control': 'no-store'}});
}
