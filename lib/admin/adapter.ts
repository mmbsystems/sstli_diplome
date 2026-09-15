import type { Offering, Program } from "@/types/program";
import { normalizeSearch } from "@/lib/filters";
import type {
  AdminBranch,
  AdminFilters,
  AdminProgram,
  AdminSnapshot,
} from "./types";

export function createAdminSnapshot(
  programs: Program[],
  offerings: Offering[],
  directory: Record<string, readonly string[]>,
): AdminSnapshot {
  const branchMap = new Map<string, AdminBranch>();
  const key = (city = "", name = "") => `${city}::${name}`;
  const add = (city: string, name: string, directoryListed = false) => {
    if (!branchMap.has(key(city, name))) branchMap.set(key(city, name), {
      id: key(city, name), city, name, active: true, directoryListed,
      address: "", updatedAt: null,
    });
  };
  Object.entries(directory).forEach(([city, names]) =>
    names.forEach((name) => add(city, name, true)),
  );
  offerings.forEach((o) => add(o.city ?? "", o.branch ?? ""));
  return {
    branches: [...branchMap.values()],
    programs: programs.map((program) => ({
      ...structuredClone(program),
      catalogSlug: program.slug,
      status: offerings.some(o => o.programId === program.id && o.active) ? "active" : "inactive",
      publication: program.contentPending ? "draft" : "published",
      catalogVisible: !program.contentPending,
      updatedAt: null,
      accreditation: "",
      featured: false,
      offerings: offerings
        .filter((o) => o.programId === program.id)
        .map((o) => ({
          ...o,
          branchId: key(o.city, o.branch),
          registration: "unknown",
        })),
    })),
  };
}

/** This focused review queue excludes unknown registration, which affects all legacy rows. */
export function reviewReasons(program: AdminProgram, branches?: AdminBranch[]): string[] {
  return [
    !program.offerings.some(o => !o.archived) ? "لم يُربط بفرع" : "",
    program.contentPending ? "المحتوى قيد الاستكمال" : "",
    !program.description.trim() ? "الوصف غير مكتمل" : "",
    program.category === "diploma" && !program.curriculum?.length ? "المقررات غير مكتملة" : "",
    program.category === "diploma" && !program.careerPaths?.length ? "المسارات الوظيفية غير مكتملة" : "",
    branches && program.offerings.some(o => !o.archived && !branches.find(b => b.id === o.branchId)?.directoryListed) ? "بيانات الفرع تحتاج إلى مراجعة" : "",
    program.classificationPending ? "النوع يحتاج إلى تأكيد" : "",
    !program.image ? "لم تُضف صورة" : "",
    program.offerings.some((o) => o.price === undefined)
      ? "سعر يحتاج إلى تأكيد"
      : "",
  ].filter(Boolean);
}

export function minimumPrice(program: AdminProgram): number | undefined {
  const prices = program.offerings
    .filter((o) => o.active && !o.archived)
    .flatMap((o) => (o.price === undefined ? [] : [o.price]));
  return prices.length ? Math.min(...prices) : undefined;
}

export function filterAdminPrograms(
  programs: AdminProgram[],
  filters: AdminFilters,
): AdminProgram[] {
  const query = normalizeSearch(filters.search ?? "");
  const result = programs.filter((program) => {
    const text = normalizeSearch(
      [
        program.name,
        program.slug,
        program.specialization,
        ...(program.searchableKeywords ?? []),
      ].join(" "),
    );
    return (
      (!query || query.split(" ").every((token) => text.includes(token))) &&
      (!filters.type || program.category === filters.type) &&
      (!filters.status || (filters.status === "draft" ? program.publication === "draft" : program.status === filters.status)) &&
      (!filters.attention || reviewReasons(program).length > 0) &&
      ((!filters.mode && !filters.branch) ||
        program.offerings.some(
          (o) =>
            (!filters.mode || o.studyMode === filters.mode) &&
            (!filters.branch || o.branchId === filters.branch),
        ))
    );
  });
  const scoped =
    filters.branch || filters.mode
      ? result.map((program) => ({
          ...program,
          offerings: program.offerings.filter(
            (o) =>
              (!filters.branch || o.branchId === filters.branch) &&
              (!filters.mode || o.studyMode === filters.mode),
          ),
        }))
      : result;
  return scoped.sort((a, b) => {
    if (filters.sort === "name") return a.name.localeCompare(b.name, "ar");
    if (filters.sort === "price")
      return (minimumPrice(a) ?? Infinity) - (minimumPrice(b) ?? Infinity);
    if (filters.sort === "updated")
      return (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
    return 0;
  });
}

export function validateAdminProgram(
  program: AdminProgram,
  all: AdminProgram[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!program.name.trim()) errors.name = "أدخل اسم البرنامج.";
  if (!program.slug.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(program.slug))
    errors.slug = "استخدم حروفًا إنجليزية صغيرة وأرقامًا، وافصل الكلمات بشرطة.";
  if (all.some((p) => p.id !== program.id && p.slug === program.slug))
    errors.slug = "هذا الرابط مستخدم لبرنامج آخر.";
  if (
    program.accreditedHours !== undefined &&
    (!Number.isInteger(program.accreditedHours) || program.accreditedHours <= 0)
  )
    errors.accreditedHours = "أدخل عدد ساعات صحيحًا أكبر من صفر.";
  const identities = new Set<string>();
  for (const o of program.offerings) {
    if (o.archived) continue;
    const identity = `${o.branchId}|${o.studyMode}|${o.gender}`;
    if (identities.has(identity))
      errors.offerings = "يوجد خيار دراسة مكرر للفرع ونمط الدراسة والفئة.";
    identities.add(identity);
    if (!o.branchId) errors.offerings = "اختر فرعًا لكل خيار دراسة.";
    if (o.price !== undefined && (!Number.isFinite(o.price) || o.price < 0))
      errors.offerings = "السعر يجب أن يكون صفرًا أو أكثر.";
    if (
      o.accreditedHours !== undefined &&
      (!Number.isInteger(o.accreditedHours) || o.accreditedHours <= 0)
    )
      errors.offerings = "ساعات الفرع يجب أن تكون عددًا صحيحًا أكبر من صفر.";
    if (
      o.minDownPayment !== undefined &&
      (o.price === undefined ||
        !Number.isFinite(o.minDownPayment) ||
        o.minDownPayment < 0 ||
        o.minDownPayment > o.price ||
        !Number.isInteger(o.installments) ||
        (o.installments ?? 0) < 1)
    )
      errors.offerings =
        "راجع الدفعة المقدمة وعدد الأقساط: الدفعة لا تتجاوز السعر، وعدد الأقساط أكبر من صفر.";
  }
  for (const key of ["curriculum", "careerPaths"] as const) {
    if (program[key]?.some(item => !item.trim())) errors[key] = "أكمل البنود الفارغة أو احذفها قبل الحفظ.";
  }
  return errors;
}

export const money = (value: number) =>
  `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)} ر.س`;
export const statusLabels = {
  active: "نشط",
  draft: "مسودة",
  inactive: "غير نشط",
} as const;
export const registrationLabels = {
  unknown: "غير محدد",
  open: "متاح",
  closed: "مغلق",
} as const;
