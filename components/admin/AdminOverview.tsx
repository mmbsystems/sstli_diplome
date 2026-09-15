"use client";
import Link from 'next/link';
import { ArrowLeft, BookOpen, CheckCircle2, MapPin, CircleAlert } from 'lucide-react';
import { reviewReasons } from '@/lib/admin/adapter';
import { branchIssues, isProgramAvailable } from '@/lib/admin/session';
import { sampleActivity } from '@/lib/admin/mock-data';
import { useAdmin } from './AdminProvider';
import { AddProgramButton, EmptyState, PageHeader, SectionCard } from './ui';
import { ActivityRows } from './Activity';
export default function AdminOverview() {
  const { programs, branches, activity, userName } = useAdmin();
  const review = programs.filter(p => !p.archived && reviewReasons(p, branches).length);
  const branchReview = branches.filter(b => branchIssues(b, programs).length);
  const metrics = [
    { label: 'إجمالي البرامج', value: programs.length, note: 'جميع أنواع التدريب', icon: BookOpen, href: '/admin/programs' },
    { label: 'البرامج المتاحة', value: programs.filter(p => isProgramAvailable(p, branches)).length, note: 'برنامج نشط بخيار دراسة متاح', icon: CheckCircle2, href: '/admin/programs' },
    { label: 'الفروع', value: branches.length, note: `${branches.filter(b => b.active).length} فروع نشطة في المعاينة`, icon: MapPin, href: '/admin/branches' },
    { label: 'تحتاج إلى مراجعة', value: review.length, note: `برامج · و${branchReview.length} فروع عليها ملاحظات`, icon: CircleAlert, href: '/admin/programs?attention=true' },
  ];
  return <><PageHeader title="نظرة عامة" description={`مرحبًا، ${userName}. تابع البرامج والفروع وأولويات العمل.`}><AddProgramButton /></PageHeader><div className="adm-metric-strip">{metrics.map(({label,value,note,icon:Icon,href}) => <Link key={label} href={href}><div><span>{label}</span><Icon size={19} strokeWidth={1.6} /></div><strong>{value}</strong><small>{note}</small></Link>)}</div>
    <div className="adm-overview-columns"><SectionCard title="أولويات المراجعة" description="ملاحظات مشتقة من البيانات الحالية" action={<Link className="adm-text-link" href="/admin/programs?attention=true">عرض الكل <ArrowLeft size={15} /></Link>}>
      {review.length ? <ul className="adm-review-list">{review.slice(0,5).map(p => <li key={p.id}><span className="adm-review-dot" /><div><Link href={`/admin/programs/${p.id}`}>{p.name}</Link><p>{reviewReasons(p, branches).join(' · ')}</p></div><ArrowLeft size={16} /></li>)}</ul> : <EmptyState title="لا توجد برامج تحتاج إلى مراجعة" description="الملاحظات المكتشفة على المحتوى والروابط مكتملة." />}
      {branchReview.length > 0 && <div className="adm-overview-footnote"><MapPin size={18} /><div><strong>{branchReview.length} فروع تحتاج إلى مراجعة</strong><p>أسماء غير مطابقة أو خيارات دراسة غير مكتملة.</p></div><Link className="adm-text-link" href="/admin/branches">مراجعة الفروع</Link></div>}
    </SectionCard><SectionCard title="آخر التعديلات" description={activity.length ? 'نشاط هذه الجلسة وأمثلة توضيحية' : 'أمثلة توضيحية لشكل السجل'} action={<Link className="adm-text-link" href="/admin/activity">السجل <ArrowLeft size={15} /></Link>}><ActivityRows items={[...activity, ...sampleActivity].slice(0,4)} compact /><div className="adm-overview-footnote"><p>تظهر التعديلات التي تحفظها هنا أثناء الجلسة.</p></div></SectionCard></div>
  </>;
}
