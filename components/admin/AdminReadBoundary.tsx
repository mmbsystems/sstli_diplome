import type { ReactNode } from 'react';
import Link from 'next/link';
import type { AdminReadState, ReadFailure } from '@/lib/admin/read-source';
import { AdminProvider } from './AdminProvider';

const messages: Record<ReadFailure, string> = {
  configuration: 'إعدادات مصدر البيانات غير مكتملة أو غير صالحة. راجع إعدادات الاتصال ومصدر البيانات.',
  authentication: 'تعذر التحقق من جلسة تسجيل الدخول. يرجى تسجيل الدخول مجددًا.',
  authorization: 'لا تملك صلاحية قراءة البيانات، أو لم يُفعّل ملفك الإداري.',
  connection: 'تعذر الاتصال بمصدر البيانات. حاول مرة أخرى لاحقًا.',
  schema: 'بنية البيانات لا تطابق متطلبات القراءة. يلزم التحقق من المخطط والترحيلات.',
};

export function AdminReadBoundary({ state, userName, children }: { state: AdminReadState; userName: string; children: ReactNode }) {
  if (state.status === 'unavailable') return <main className="adm-root" dir="rtl"><section className="adm-section" role="alert">
    <h1>تعذرت قراءة بيانات الإدارة</h1><p>{messages[state.reason]}</p>
    <p>لم تُستبدل البيانات ببيانات ثابتة.</p><Link href="/programs">العودة إلى المستكشف</Link>
  </section></main>;
  return <AdminProvider initial={state.snapshot} userName={userName} persistentPrograms={state.source === 'supabase'}>
    {state.source === 'supabase' && <section className="adm-inline-note" role="status" dir="rtl">
      <p>مصدر الكتالوج: Supabase · تُحفظ الفروع والبرامج ومقرراتها ومساراتها الوظيفية عند الحفظ. تُحفظ خيارات الدراسة وأسعارها وسدادها عند اعتماد التعديل. المستخدمون وأمثلة النشاط توضيحية.</p>
      {state.snapshot.programs.length === 0 && state.snapshot.branches.length === 0 && <p>لا توجد بيانات كتالوج متاحة ضمن صلاحياتك الحالية.</p>}
    </section>}
    {children}
  </AdminProvider>;
}
