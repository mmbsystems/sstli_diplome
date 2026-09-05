import {NextRequest, NextResponse} from 'next/server';
import {destroySession} from '@/lib/auth';
import {isSameOrigin} from '@/lib/auth-request';
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({error: 'طلب غير مسموح'}, {status: 403});
  await destroySession();
  return NextResponse.redirect(new URL('/login', request.url), {status: 303, headers: {'Cache-Control': 'no-store'}});
}
