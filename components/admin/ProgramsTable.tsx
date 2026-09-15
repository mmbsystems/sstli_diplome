"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  MoreHorizontal,
  Pencil,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { categoryLabel, modeLabel } from "@/lib/formatters";
import { filterAdminPrograms, minimumPrice, money } from "@/lib/admin/adapter";
import type { AdminFilters, AdminProgram } from "@/lib/admin/types";
import { useAdmin } from "./AdminProvider";
import {
  AddProgramButton,
  EmptyState,
  PageHeader,
  SearchField,
  StatusBadge,
} from "./ui";

function ProgramIdentity({ program }: { program: AdminProgram }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="adm-program-identity">
      <span className="adm-thumbnail">
        {program.image && !failed ? (
          <Image
            src={program.image}
            alt=""
            width={44}
            height={44}
            onError={() => setFailed(true)}
          />
        ) : (
          <BookOpen size={20} />
        )}
      </span>
      <div>
        <Link
          href={`/admin/programs/${program.id}`}
          className="adm-program-name"
        >
          {program.name}
        </Link>
        <small>
          {[...new Set(program.offerings.map((o) => o.studyMode))]
            .map((mode) => modeLabel[mode])
            .join(" و") || "لم يُربط بفرع"}
        </small>
      </div>
    </div>
  );
}
function Price({ program }: { program: AdminProgram }) {
  const price = minimumPrice(program);
  return (
    <span className="adm-price">
      {price === undefined ? (
        "غير محدد"
      ) : (
        <>
          {program.offerings.filter((o) => o.active).length > 1 && (
            <small>يبدأ من </small>
          )}
          <bdi>{money(price)}</bdi>
        </>
      )}
    </span>
  );
}
function RegistrationSummary({ program }: { program: AdminProgram }) {
  const active = program.offerings.filter((o) => o.active);
  return (
    <span className="adm-registration">
      {active.some((o) => o.registration === "open")
        ? "متاح"
        : active.length && active.every((o) => o.registration === "closed")
          ? "مغلق"
          : "غير محدد"}
    </span>
  );
}

export default function ProgramsTable() {
  const { programs, branches } = useAdmin();
  const params = useSearchParams();
  const router = useRouter();
  const [filters, setFilters] = useState<AdminFilters>(() => ({
    attention: params.get("attention") === "1",
  }));
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(1);
  const filtered = useMemo(
    () => filterAdminPrograms(programs, filters),
    [programs, filters],
  );
  const pageSize = 10;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const filterCount = [
    filters.type,
    filters.status,
    filters.mode,
    filters.branch,
    filters.attention,
  ].filter(Boolean).length;
  function update(patch: Partial<AdminFilters>) {
    setFilters((previous) => ({ ...previous, ...patch }));
    setPage(1);
  }
  function clear() {
    setFilters({});
    setPage(1);
  }
  return (
    <>
      <PageHeader
        title="البرامج"
        description="إدارة الدبلومات والدورات ومعلومات ظهورها في الموقع."
      >
        <AddProgramButton />
      </PageHeader>
      <section className="adm-catalog" aria-label="إدارة البرامج">
        <div className="adm-table-toolbar">
          <SearchField
            value={filters.search ?? ""}
            onChange={(search) => update({ search })}
          />
          <div className="adm-toolbar-actions">
            <button
              className={`adm-button${expanded ? " adm-button-selected" : ""}`}
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
              aria-controls="admin-filters"
            >
              <SlidersHorizontal size={16} />
              تصفية
              {filterCount > 0 && (
                <span className="adm-count">{filterCount}</span>
              )}
            </button>
            <label className="adm-sort">
              <ArrowDownUp size={16} />
              <span className="adm-sr-only">ترتيب البرامج</span>
              <select
                aria-label="ترتيب البرامج"
                value={filters.sort ?? ""}
                onChange={(e) =>
                  update({ sort: e.target.value as AdminFilters["sort"] })
                }
              >
                <option value="">الترتيب الافتراضي</option>
                <option value="name">الاسم</option>
                <option value="price">الأقل سعرًا</option>
                <option value="updated">آخر تحديث</option>
              </select>
            </label>
          </div>
        </div>
        {expanded && (
          <div className="adm-filter-grid" id="admin-filters">
            <label>
              النوع
              <select
                aria-label="النوع"
                value={filters.type ?? ""}
                onChange={(e) =>
                  update({ type: e.target.value as AdminFilters["type"] })
                }
              >
                <option value="">جميع الأنواع</option>
                {Object.entries(categoryLabel).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              الحالة
              <select
                aria-label="الحالة"
                value={filters.status ?? ""}
                onChange={(e) =>
                  update({ status: e.target.value as AdminFilters["status"] })
                }
              >
                <option value="">جميع الحالات</option>
                <option value="active">نشط</option>
                <option value="draft">مسودة</option>
                <option value="inactive">غير نشط</option>
              </select>
            </label>
            <label>
              نمط الدراسة
              <select
                aria-label="نمط الدراسة"
                value={filters.mode ?? ""}
                onChange={(e) =>
                  update({ mode: e.target.value as AdminFilters["mode"] })
                }
              >
                <option value="">جميع الأنماط</option>
                <option value="onsite">حضوري</option>
                <option value="online">عن بُعد</option>
              </select>
            </label>
            <label>
              الفرع
              <select
                aria-label="الفرع"
                value={filters.branch ?? ""}
                onChange={(e) => update({ branch: e.target.value })}
              >
                <option value="">جميع الفروع</option>
                {branches.map((b) => (
                  <option value={b.id} key={b.id}>
                    {b.city} · {b.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        <div className="adm-table-caption">
          <span>
            <strong>{filtered.length}</strong> برنامج
            {filterCount ? " مطابق للتصفية" : " في القائمة"}
          </span>
          {filters.attention && (
            <span className="adm-review-chip">
              يحتاج مراجعة
              <button
                onClick={() => update({ attention: false })}
                aria-label="إلغاء تصفية المراجعة"
              >
                <X size={14} />
              </button>
            </span>
          )}
          {(filterCount > 0 || filters.search) && (
            <button className="adm-clear" onClick={clear}>
              مسح الفلاتر
            </button>
          )}
          <span className="adm-caption-note">حالة التسجيل تحتاج إلى تأكيد</span>
        </div>
        {visible.length ? (
          <>
            <div className="adm-table-scroll">
              <table className="adm-table">
                <caption className="adm-sr-only">
                  برامج المعهد وأسعارها وحالاتها
                </caption>
                <thead>
                  <tr>
                    <th scope="col">البرنامج</th>
                    <th scope="col">النوع</th>
                    <th scope="col">الفروع</th>
                    <th scope="col">السعر</th>
                    <th scope="col">التسجيل</th>
                    <th scope="col">آخر تحديث</th>
                    <th scope="col">الحالة</th>
                    <th scope="col">
                      <span className="adm-sr-only">الإجراءات</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((program) => (
                    <tr
                      key={program.id}
                      onClick={(e) => {
                        if (
                          !(e.target as HTMLElement).closest(
                            "a,button,summary,details",
                          )
                        )
                          router.push(`/admin/programs/${program.id}`);
                      }}
                    >
                      <td>
                        <ProgramIdentity program={program} />
                      </td>
                      <td>
                        <span className="adm-type-label">
                          {categoryLabel[program.category]}
                        </span>
                      </td>
                      <td>
                        {new Set(program.offerings.map((o) => o.branchId)).size}
                      </td>
                      <td>
                        <Price program={program} />
                      </td>
                      <td>
                        <RegistrationSummary program={program} />
                      </td>
                      <td className="adm-date">
                        {program.updatedAt ? "هذه الجلسة" : "—"}
                      </td>
                      <td>
                        <StatusBadge status={program.status} />
                      </td>
                      <td>
                        <details className="adm-row-menu">
                          <summary aria-label={`إجراءات ${program.name}`}>
                            <MoreHorizontal size={20} />
                          </summary>
                          <div>
                            <Link href={`/admin/programs/${program.id}`}>
                              <Pencil size={14} />
                              تعديل البرنامج
                            </Link>
                            {program.catalogSlug && (
                              <Link href={`/programs/${program.catalogSlug}`}>
                                <ArrowUpLeftIcon />
                                عرض في المستكشف
                              </Link>
                            )}
                          </div>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="adm-program-mobile-list">
              {visible.map((program) => (
                <article key={program.id} className="adm-program-mobile">
                  <ProgramIdentity program={program} />
                  <div className="adm-mobile-row-meta">
                    <StatusBadge status={program.status} />
                    <span>
                      {new Set(program.offerings.map((o) => o.branchId)).size}{" "}
                      فروع
                    </span>
                    <Price program={program} />
                  </div>
                  <Link
                    className="adm-mobile-edit"
                    href={`/admin/programs/${program.id}`}
                  >
                    تفاصيل البرنامج <ArrowLeft size={15} />
                  </Link>
                </article>
              ))}
            </div>
            <div className="adm-pagination">
              <span>
                عرض {(currentPage - 1) * pageSize + 1}–
                {Math.min(currentPage * pageSize, filtered.length)} من{" "}
                {filtered.length}
              </span>
              <div>
                <button
                  className="adm-icon-button"
                  disabled={currentPage === 1}
                  onClick={() => setPage((value) => value - 1)}
                  aria-label="الصفحة السابقة"
                >
                  <ArrowRight size={16} />
                </button>
                <span>
                  صفحة {currentPage} من {pages}
                </span>
                <button
                  className="adm-icon-button"
                  disabled={currentPage === pages}
                  onClick={() => setPage((value) => value + 1)}
                  aria-label="الصفحة التالية"
                >
                  <ArrowLeft size={16} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <EmptyState>
            <button className="adm-button" onClick={clear}>
              مسح الفلاتر
            </button>
          </EmptyState>
        )}
      </section>
      <p className="adm-page-footnote">
        الأسعار مأخوذة من خيارات الفروع الحالية. لا توجد عروض تخفيض مؤكدة في
        البيانات.
      </p>
    </>
  );
}

function ArrowUpLeftIcon() {
  return <ArrowLeft size={14} style={{ transform: "rotate(45deg)" }} />;
}
