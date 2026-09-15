"use client";
import { useRef, useState } from 'react';
import Link from 'next/link';
import { money } from '@/lib/admin/adapter';
import { modeLabel, genderLabel } from '@/lib/formatters';
import { normalizeSearch } from '@/lib/filters';
import type { AdminOffering } from '@/lib/admin/types';
import { useAdmin } from './AdminProvider';
import { PageHeader, SearchField, StatusBadge } from './ui';
import { DataTable, FilterSelect, Modified, Pagination } from './DataView';
import OfferingEditor from './OfferingEditor';
import { ConfirmDialog } from './EditorControls';

export default function PricingTable({ branchId }: { branchId?: string }) {
  const { programs, branches, saveOffering, persistentPrograms, persistOffering } = useAdmin();
  const inFlight=useRef(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const [query, setQuery] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [mode, setMode] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<{ programId: string; offering: AdminOffering } | null>(null);
  const [archive, setArchive] = useState<{ programId: string; offering: AdminOffering } | null>(null);
  const [message, setMessage] = useState('');
  async function lifecycle(programId:string,offering:AdminOffering,action:'archive'|'restore') {
    if(inFlight.current)return;
    if(!persistentPrograms){saveOffering(programId,{...offering,archived:action==='archive',active:false});setMessage(action==='restore'?'استُعيد الخيار كخيار متوقف.':'تمت أرشفة الخيار في هذه الجلسة.');return;}
    inFlight.current=true;setBusy(true);setError('');setMessage('');
    try{await persistOffering(offering,action);setMessage('تم حفظ حالة الخيار في قاعدة البيانات.');}
    catch(error){setError(error instanceof Error?error.message:'تعذر الحفظ.');}
    finally{inFlight.current=false;setBusy(false);}
  }
  const rows = programs.flatMap(program => program.offerings.map(offering => ({ ...offering, program, offering })));
  const filtered = rows.filter(o => (!branchId || o.branchId === branchId) && (!programFilter || o.program.id === programFilter) && (!branchFilter || o.branchId === branchFilter) && (!mode || o.studyMode === mode) && (status === 'archived' ? o.archived : !o.archived && (!status || (status === 'active' ? o.active : !o.active))) && normalizeSearch(`${o.program.name} ${o.city} ${o.branch}`).includes(normalizeSearch(query)));
  const current = Math.min(page, Math.max(1, Math.ceil(filtered.length / 10)));
  const program = editing && programs.find(p => p.id === editing.programId);
  const reset = () => { setQuery(''); setProgramFilter(''); setBranchFilter(''); setMode(''); setStatus(''); setPage(1); };
  const filter = (setter: (s: string) => void) => (value: string) => { setter(value); setPage(1); };
  return <>
    {!branchId && <PageHeader title="الأسعار والعروض" description="خيارات الدراسة والسداد لكل برنامج وفرع، في مكان واحد." />}
    <section className="adm-section adm-data-section" inert={busy}>
      <div className="adm-data-heading"><div><h2>{branchId ? 'برامج الفرع وأسعاره' : 'جميع خيارات الدراسة'}</h2><p>{filtered.length} خيار · الأسعار بالريال السعودي</p></div><SearchField label="البحث في الأسعار" value={query} onChange={filter(setQuery)} /></div>
      <div className="adm-filter-bar"><FilterSelect label="البرنامج" value={programFilter} onChange={filter(setProgramFilter)} options={programs.filter(p => !branchId || p.offerings.some(o => o.branchId === branchId)).map(p => ({ value: p.id, label: p.name }))} />{!branchId && <FilterSelect label="الفرع" value={branchFilter} onChange={filter(setBranchFilter)} options={branches.map(b => ({ value: b.id, label: `${b.city} · ${b.name}` }))} />}<FilterSelect label="نمط الدراسة" value={mode} onChange={filter(setMode)} options={Object.entries(modeLabel).map(([value, label]) => ({ value, label }))} /><FilterSelect label="حالة الخيار" value={status} onChange={filter(setStatus)} options={[{ value: 'active', label: 'متاح' }, { value: 'inactive', label: 'متوقف' }, { value: 'archived', label: 'مؤرشف' }]} />{(query || programFilter || branchFilter || mode || status) && <button className="adm-text-link" onClick={reset}>مسح الفلاتر</button>}</div>
      <DataTable rows={filtered.slice((current - 1) * 10, current * 10)} emptyTitle="لا توجد خيارات مطابقة" onReset={reset} columns={[
        { label: 'البرنامج / الفرع', render: o => <div className="adm-cell-title"><Link href={`/admin/programs/${o.program.id}`}>{o.program.name}</Link><Link className="adm-muted" href={`/admin/branches/${encodeURIComponent(o.branchId)}`}>{o.city} · {o.branch}</Link><small>{modeLabel[o.studyMode]} · {genderLabel[o.gender ?? 'both']}</small></div> },
        { label: 'السعر', render: o => <strong><bdi>{o.price === undefined ? 'غير محدد' : money(o.price)}</bdi></strong> },
        { label: 'الدفعة المقدمة', render: o => <bdi>{o.minDownPayment === undefined ? 'غير محدد' : money(o.minDownPayment)}</bdi> },
        { label: 'القسط الشهري', render: o => <div>{o.price !== undefined && o.minDownPayment !== undefined && (o.installments ?? 0) > 0 ? <><bdi>{money((o.price - o.minDownPayment) / o.installments!)}</bdi><small className="adm-cell-note">{o.installments} قسط · تقديري</small></> : <span className="adm-muted">غير مفعّل</span>}</div> },
        { label: 'الحالة', render: o => <div>{o.archived ? <span className="adm-badge">مؤرشف</span> : <StatusBadge status={o.active ? 'active' : 'inactive'} />}{(!branches.find(b => b.id === o.branchId)?.active || o.program.status === 'inactive' || o.program.archived) && <small className="adm-cell-note">البرنامج أو الفرع متوقف</small>}</div> },
        { label: 'آخر تعديل', render: o => <Modified time={o.updatedAt} /> },
        { label: 'الإجراءات', render: o => <div className="adm-row-actions"><button className="adm-text-link" aria-label={`تعديل سعر ${o.program.name} ${o.city} ${o.branch}`} onClick={() => setEditing({ programId: o.program.id, offering: o.offering })}>تعديل</button>{o.archived ? <button className="adm-text-link" onClick={() => { void lifecycle(o.program.id,o.offering,'restore'); }}>استعادة</button> : <button className="adm-text-link adm-muted" onClick={() => setArchive({ programId: o.program.id, offering: o.offering })}>أرشفة</button>}</div> },
      ]} />
      <Pagination count={filtered.length} page={current} onChange={setPage} />
    </section>
    {message && <p className="adm-save-message" role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
    {editing && program && <OfferingEditor key={editing.offering.id} program={program} initialOffering={editing.offering} dialogOnly onPersisted={() => setMessage("تم حفظ خيار الدراسة في قاعدة البيانات.")} onClose={() => setEditing(null)} onChange={next => { const updated = next.find(o => o.id === editing.offering.id); if (updated) saveOffering(program.id, updated); setMessage('تم حفظ خيار الدراسة في هذه الجلسة.'); }} />}
    <ConfirmDialog open={archive !== null} title="أرشفة خيار الدراسة؟" description="سيُوقف الخيار ويُنقل إلى الأرشيف. تبقى بياناته متاحة للاستعادة." confirmLabel="أرشفة الخيار" onCancel={() => setArchive(null)} onConfirm={() => { if (archive) void lifecycle(archive.programId,archive.offering,'archive'); setArchive(null); }} />
  </>;
}
