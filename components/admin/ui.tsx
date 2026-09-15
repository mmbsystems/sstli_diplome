import Link from "next/link";
import { ArrowRight, BookOpen, Plus, Search } from "lucide-react";
import type { ReactNode } from "react";
import { statusLabels } from "@/lib/admin/adapter";
import type { AdminStatus } from "@/lib/admin/types";

export function PageHeader({
  title,
  description,
  children,
  back,
}: {
  title: string;
  description: string;
  children?: ReactNode;
  back?: boolean;
}) {
  return (
    <div className="adm-page-heading">
      {back && (
        <Link href="/admin/programs" className="adm-back">
          <ArrowRight size={15} /> البرامج
        </Link>
      )}
      <div className="adm-heading-row">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
export function AddProgramButton() {
  return (
    <Link className="adm-button adm-primary" href="/admin/programs/new">
      <Plus size={18} />
      إضافة برنامج
    </Link>
  );
}
export function StatusBadge({ status }: { status: AdminStatus }) {
  return (
    <span className={`adm-badge adm-${status}`}>
      <span aria-hidden="true" />
      {statusLabels[status]}
    </span>
  );
}
export function EmptyState({
  title = "لا توجد برامج مطابقة",
  description = "جرّب كلمة أخرى أو عدّل خيارات التصفية.",
  children,
}: {
  title?: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="adm-empty">
      <span className="adm-empty-icon">
        <BookOpen size={26} strokeWidth={1.4} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function SearchField({
  value,
  onChange,
  label = "البحث عن برنامج",
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  return (
    <label className="adm-search">
      <Search size={18} aria-hidden="true" />
      <span className="adm-sr-only">{label}</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`${label}…`}
      />
    </label>
  );
}
export function SectionCard({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="adm-section">
      <div className="adm-section-heading">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function FormField({
  label,
  id,
  hint,
  error,
  children,
  wide,
}: {
  label: string;
  id: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`adm-field${wide ? " adm-field-wide" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? (
        <p className="adm-field-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="adm-hint">{hint}</p>
      ) : null}
    </div>
  );
}
export function AdminSkeleton() {
  return (
    <div
      className="adm-loading"
      role="status"
      aria-label="جارٍ تحميل لوحة الإدارة"
    >
      <div className="adm-skeleton adm-skeleton-title" />
      <div className="adm-metrics">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="adm-skeleton adm-skeleton-metric" />
        ))}
      </div>
      <div className="adm-skeleton adm-skeleton-table" />
      <span className="adm-sr-only">جارٍ التحميل</span>
    </div>
  );
}
