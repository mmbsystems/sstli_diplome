import {NextRequest, NextResponse} from 'next/server';
import {verifyCredentials, createSession} from '@/lib/auth';
import {COOKIE_NAME, cookieOptions, SESSION_SECONDS} from '@/lib/session';
import {isSameOrigin, readLoginBody} from '@/lib/auth-request';

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({error: 'طلب غير مسموح'}, {status: 403});
  }
  let body;
  try { body = await readLoginBody(request); }
  catch { return NextResponse.json({error: 'اسم المستخدم أو كلمة المرور غير صحيحة'}, {status: 400}); }
  try {
    const user = await verifyCredentials(body?.username, body?.password);
    if (!user) return NextResponse.json({error: 'اسم المستخدم أو كلمة المرور غير صحيحة'}, {status: 401});
    const token = await createSession(user.username);
    const response = NextResponse.json({redirect: '/programs?category=diploma'}, {headers: {'Cache-Control': 'no-store'}});
    response.cookies.set(COOKIE_NAME, token, {...cookieOptions, maxAge: SESSION_SECONDS});
    return response;
  } catch {
    console.error('SSTLI_AUTH_LOGIN_FAILED: check AUTH_SECRET and server account configuration.');
    return NextResponse.json({error: 'تعذر تسجيل الدخول حاليًا. يرجى المحاولة لاحقًا'}, {status: 500});
  }
}
