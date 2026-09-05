import {NextRequest, NextResponse} from 'next/server';
import {verifyCredentials, createSession} from '@/lib/auth';
import {COOKIE_NAME, cookieOptions, SESSION_SECONDS} from '@/lib/session';

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({error: 'طلب غير مسموح'}, {status: 403});
  }
  try {
    if (Number(request.headers.get('content-length')) > 4096) return NextResponse.json({error: 'طلب غير صالح'}, {status: 400});
    const body = await request.json();
    const user = await verifyCredentials(body?.username, body?.password);
    if (!user) return NextResponse.json({error: 'اسم المستخدم أو كلمة المرور غير صحيحة'}, {status: 401});
    const token = await createSession(user.username);
    const response = NextResponse.json({redirect: '/programs?category=diploma'}, {headers: {'Cache-Control': 'no-store'}});
    response.cookies.set(COOKIE_NAME, token, {...cookieOptions, maxAge: SESSION_SECONDS});
    return response;
  } catch {
    return NextResponse.json({error: 'تعذر تسجيل الدخول. يرجى المحاولة لاحقًا'}, {status: 400});
  }
}
