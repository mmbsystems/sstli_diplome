"use client";
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MapPin, ArrowRight } from 'lucide-react';
import { normalizeSearch } from '@/lib/filters';
import { branchIssues } from '@/lib/admin/session';
import type { AdminBranch } from '@/lib/admin/types';
import { useAdmin } from './AdminProvider';
import { EmptyState, FormField, PageHeader, SearchField, StatusBadge } from './ui';
import { DataTable, FilterSelect, Modified, Pagination } from './DataView';
import { ConfirmDialog, SaveBar, useUnsavedChanges } from './EditorControls';
import PricingTable from './PricingTable';

export default function Branches() {
  const { programs, branches, persistentPrograms } = useAdmin();
  const [query, setQuery] = useState(''); const [city, setCity] = useState(''); const [status, setStatus] = useState(''); const [review, setReview] = useState(''); const [page, setPage] = useState(1);
  const rows = branches.filter(b => normalizeSearch(`${b.name} ${b.city}`).includes(normalizeSearch(query)) && (!city || b.city === city) && (!status || (status === 'archived' ? b.archived : !b.archived && (status === 'active' ? b.active : !b.active))) && (!review || branchIssues(b, programs).length > 0));
  const reset = () => { setQuery(''); setCity(''); setStatus(''); setReview(''); setPage(1); };
  const filter = (setter: (value: string) => void) => (value: string) => { setter(value); setPage(1); };
  const current = Math.min(page, Math.max(1, Math.ceil(rows.length / 10)));
  return <><PageHeader title="الفروع" description="هوية كل فرع، برامجه المتاحة، وما يحتاج إلى استكمال.">{persistentPrograms && <Link className="adm-button adm-primary" href="/admin/branches/new">إضافة فرع</Link>}</PageHeader><section className="adm-section adm-data-section"><div className="adm-data-heading"><div><h2>دليل الفروع</h2><p>{branches.length} فرعًا · {[...new Set(branches.map(b => b.city))].length} مدن</p></div><SearchField value={query} onChange={filter(setQuery)} label="البحث عن فرع أو مدينة" /></div><div className="adm-filter-bar"><FilterSelect label="المدينة" value={city} onChange={filter(setCity)} options={[...new Set(branches.map(b => b.city))].map(value => ({ value, label: value }))} /><FilterSelect label="حالة الفرع" value={status} onChange={filter(setStatus)} options={[{ value: 'active', label: 'نشط' }, { value: 'inactive', label: 'غير نشط' }, { value: 'archived', label: 'مؤرشف' }]} /><FilterSelect label="المراجعة" value={review} onChange={filter(setReview)} options={[{ value: 'issues', label: 'يحتاج إلى مراجعة' }]} />{(query || city || status || review) && <button className="adm-text-link" onClick={reset}>مسح الفلاتر</button>}</div><DataTable rows={rows.slice((current - 1) * 10, current * 10)} emptyTitle="لا توجد فروع مطابقة" onReset={reset} columns={[
    { label: 'الفرع', render: b => <div className="adm-cell-title"><Link href={`/admin/branches/${encodeURIComponent(b.id)}`}>{b.name || 'اسم غير محدد'}</Link><small>{b.directoryListed ? 'وارد في دليل الفروع' : 'اسم من بيانات العروض'}</small></div> },
    { label: 'المدينة', render: b => b.city || 'غير محددة' },
    { label: 'البرامج المرتبطة', render: b => programs.filter(p => p.offerings.some(o => o.branchId === b.id && !o.archived)).length },
    { label: 'الحالة', render: b => b.archived ? <span className="adm-badge adm-inactive">مؤرشف</span> : <StatusBadge status={b.active ? 'active' : 'inactive'} /> },
    { label: 'الملاحظات', render: b => { const issues = branchIssues(b, programs); return issues.length ? <span className="adm-review-label">{issues.length} ملاحظة للمراجعة</span> : <span className="adm-muted">لا توجد ملاحظات</span>; } },
    { label: 'الإجراءات', render: b => <Link className="adm-text-link" href={`/admin/branches/${encodeURIComponent(b.id)}`}>عرض التفاصيل</Link> },
  ]} /><Pagination page={current} count={rows.length} onChange={setPage} /></section><p className="adm-source-note">الأسماء غير المطابقة محفوظة كما وردت، ولم تُدمج تلقائيًا.</p></>;
}

export function BranchDetail({ id }: { id: string }) {
  const { branches, persistentPrograms } = useAdmin();
  const branch = id === 'new' && persistentPrograms ? { id: 'new', name: '', city: '', address: '', active: false, directoryListed: false, updatedAt: null } : branches.find(b => b.id === id);
  if (!branch) return <EmptyState title="لم نجد هذا الفرع" description="قد يكون الرابط غير صالح أو انتهت جلسة المعاينة."><Link className="adm-button" href="/admin/branches">العودة إلى الفروع</Link></EmptyState>;
  return <BranchForm key={id} branch={branch} />;
}
function BranchForm({ branch }: { branch: AdminBranch }) {
  const { programs, branches, saveBranch, acceptBranch, persistentPrograms } = useAdmin();
  const router = useRouter(); const inFlight = useRef(false); const [busy, setBusy] = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [draft, setDraft] = useState(branch); const [baseline, setBaseline] = useState(branch); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [disable, setDisable] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline); useUnsavedChanges(dirty);
  const issues = branchIssues(branch, programs);
  const count = programs.filter(p => p.offerings.some(o => o.branchId === branch.id && !o.archived)).length;
  function change(patch: Partial<AdminBranch>) { setDraft(previous => ({ ...previous, ...patch })); setMessage(''); setError(''); }
  async function save(action: 'save' | 'archive' | 'restore' = 'save') {
    if (inFlight.current) return;
    if (!draft.name.trim() || !draft.city.trim()) { setError('أدخل اسم الفرع والمدينة.'); document.getElementById(!draft.name.trim() ? 'branch-name' : 'branch-city')?.focus(); return; }
    if ((baseline.id === 'new' || baseline.name !== draft.name || baseline.city !== draft.city) && branches.some(b => b.id !== draft.id && b.name === draft.name && b.city === draft.city)) { setError('يوجد فرع بهذا الاسم في المدينة. راجع الهوية قبل الحفظ؛ لن ندمج الفرعين تلقائيًا.'); return; }
    if (persistentPrograms) {
      inFlight.current = true; setBusy(true); setError(''); setMessage('');
      try {
        const response = await fetch('/api/admin/branches', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
          ...(baseline.id === 'new' ? {} : { id: baseline.id }), action, expectedVersion: baseline.id === 'new' ? 0 : baseline.version,
          branch: { name: draft.name, city: draft.city, address: draft.address || null, source_region_label: draft.sourceRegionLabel ?? null, directory_listed: draft.directoryListed, is_active: draft.active },
        }) });
        if (!response.ok) {
          setError(response.status === 409 ? 'تعارض في النسخة أو هوية الفرع أو وجود عروض نشطة مرتبطة. أعد تحميل النسخة الحالية للمراجعة؛ تغييراتك لم تُحفظ.' : 'تعذر حفظ الفرع. تحقق من البيانات وأعد المحاولة.');
          return;
        }
        const { branch: saved } = await response.json();
        acceptBranch(saved); setDraft(saved); setBaseline(saved); setMessage('تم حفظ التغييرات في قاعدة البيانات.');
        if (baseline.id === 'new') router.replace('/admin/branches/' + saved.id);
        router.refresh();
      } catch { setError('تعذر الاتصال بالخادم. تغييراتك غير المحفوظة محفوظة في النموذج.'); }
      finally { inFlight.current = false; setBusy(false); }
      return;
    }
    const saved = { ...draft };
    saveBranch(saved); setDraft(saved); setBaseline(saved); setMessage('تم حفظ بيانات الفرع في هذه الجلسة.');
  }
  return <><Link className="adm-back" href="/admin/branches"><ArrowRight size={15} />الفروع</Link><PageHeader title={`${baseline.city} · ${baseline.name}`} description={`${count} برامج مرتبطة · إدارة هوية الفرع وخيارات الدراسة`}><span aria-label="حالة سجل الفرع">{baseline.archived ? <span className="adm-badge adm-inactive">مؤرشف</span> : <StatusBadge status={draft.active ? 'active' : 'inactive'} />}</span></PageHeader>
    <div className="adm-branch-layout"><section className="adm-section"><div className="adm-section-heading"><div><h2>بيانات الفرع</h2><p>الاسم والمدينة كما يظهران في خيارات البرامج.</p></div><MapPin size={22} /></div><form className="adm-branch-form" inert={busy} onSubmit={e => { e.preventDefault(); save(); }}><div className="adm-form-grid"><FormField id="branch-name" label="اسم الفرع" error={error} hint="مطلوب"><input id="branch-name" aria-required="true" aria-invalid={!!error} aria-describedby={error ? 'branch-name-error' : undefined} value={draft.name} onChange={e => change({ name: e.target.value })} /></FormField><FormField id="branch-city" label="المدينة" hint="مطلوب"><input id="branch-city" aria-required="true" value={draft.city} onChange={e => change({ city: e.target.value })} /></FormField><FormField id="branch-address" label="العنوان التفصيلي" hint="اختياري؛ لا يوجد عنوان تفصيلي مؤكد في المصدر." wide><input id="branch-address" value={draft.address} placeholder="لم يُضف عنوان تفصيلي" onChange={e => change({ address: e.target.value })} /></FormField><FormField id="branch-active" label="حالة الفرع" hint="إيقاف الفرع لا يحذف البرامج أو أسعارها."><select id="branch-active" disabled={baseline.archived} value={draft.active ? 'yes' : 'no'} onChange={e => e.target.value === 'no' ? setDisable(true) : change({ active: true })}><option value="yes">نشط</option><option value="no">غير نشط</option></select></FormField></div></form></section><section className="adm-section"><div className="adm-section-heading"><div><h2>حالة البيانات</h2><p>{issues.length ? 'تحتاج إلى مراجعة بشرية' : 'لا توجد ملاحظات على الروابط والأسعار'}</p></div></div><div className="adm-branch-notes">{issues.length ? <ul>{issues.map(issue => <li key={issue}>{issue}</li>)}</ul> : <p>جميع الخيارات المرتبطة تتضمن أسعارًا، والاسم وارد في الدليل.</p>}<p className="adm-hint">{branch.directoryListed ? 'هوية من دليل الفروع الأصلي.' : 'الهوية الأصلية غير مطابقة للدليل. تعديل الاسم لا يثبت مطابقتها.'}</p><p>آخر تعديل: <Modified time={branch.updatedAt} /></p></div></section></div>
    <PricingTable branchId={branch.id} />{busy && <p role="status">جارٍ الحفظ…</p>}{persistentPrograms && baseline.id !== "new" && <button type="button" className="adm-button" disabled={busy || dirty} onClick={() => setArchiveConfirm(true)}>{baseline.archived ? "استعادة الفرع" : "أرشفة الفرع"}</button>}{message && <p role="status" className="adm-save-message">{message}</p>}{dirty && !busy && <SaveBar onSave={() => void save()} onCancel={() => { setDraft(baseline); setError(''); }} />}
    <ConfirmDialog open={archiveConfirm} title={baseline.archived ? "استعادة الفرع؟" : "أرشفة الفرع؟"} description="لن تتغير العروض المرتبطة. تمنع العروض النشطة أرشفة الفرع. تتم الاستعادة بحالة غير نشطة." onCancel={() => setArchiveConfirm(false)} onConfirm={() => { setArchiveConfirm(false); void save(baseline.archived ? "restore" : "archive"); }} />
    <ConfirmDialog open={disable} title="إيقاف هذا الفرع؟" description={`يرتبط هذا الفرع بـ ${count} برامج. لن تتغير سجلات العروض أو أسعارها.`} onCancel={() => setDisable(false)} onConfirm={() => { change({ active: false }); setDisable(false); }} />
  </>;
}
