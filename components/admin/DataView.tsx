import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { EmptyState } from './ui';

export function FilterSelect({ label, value, onChange, options, all = 'الكل' }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; all?: string }) {
  return <label className="adm-filter-select"><span>{label}</span><select aria-label={label} value={value} onChange={e => onChange(e.target.value)}><option value="">{all}</option>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>;
}
export function DataTable<T extends { id: string }>({ rows, columns, emptyTitle, onReset }: { rows: T[]; columns: { label: string; render: (row: T) => ReactNode }[]; emptyTitle: string; onReset?: () => void }) {
  if (!rows.length) return <EmptyState title={emptyTitle} description="جرّب كلمة أخرى أو عدّل خيارات التصفية.">{onReset && <button className="adm-button" onClick={onReset}>مسح الفلاتر</button>}</EmptyState>;
  return <div className="adm-data-scroll"><table className="adm-data-table"><thead><tr>{columns.map(c => <th scope="col" key={c.label}>{c.label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.id}>{columns.map(c => <td key={c.label} data-label={c.label}>{c.render(row)}</td>)}</tr>)}</tbody></table></div>;
}
export function Pagination({ count, page, onChange, size = 10 }: { count: number; page: number; onChange: (page: number) => void; size?: number }) {
  const pages = Math.max(1, Math.ceil(count / size));
  return <div className="adm-data-pagination"><span role="status">{count ? `${(page - 1) * size + 1}–${Math.min(page * size, count)} من ${count}` : '0 نتائج'}</span><div><button type="button" className="adm-icon-button" aria-label="الصفحة السابقة" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronRight size={17} /></button><span>{page} / {pages}</span><button type="button" className="adm-icon-button" aria-label="الصفحة التالية" disabled={page >= pages} onClick={() => onChange(page + 1)}><ChevronLeft size={17} /></button></div></div>;
}
export function Modified({ time }: { time?: string | null }) {
  return time ? <time dateTime={time} title="بتوقيت الرياض">{new Date(time).toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh', calendar: 'gregory', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time> : <span className="adm-muted">غير مسجل</span>;
}
