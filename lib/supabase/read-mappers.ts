import type { AdminBranch, AdminOffering, AdminProgram, AdminSnapshot } from '@/lib/admin/types';
import { AdminReadError } from '@/lib/admin/read-source';
import type { Tables } from './database.generated';

// Runtime projection validation, not a substitute for hosted generated Database types.
// Keep this validation after generation: SQL CHECK values are generated as strings.
type Row = Record<string, unknown>;
const invalid = (): never => { throw new AdminReadError('schema'); };
const row = (value: unknown): Row => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Row : invalid();
const text = (r: Row, key: string): string => typeof r[key] === 'string' ? r[key] as string : invalid();
const optionalText = (r: Row, key: string) => r[key] === null ? undefined : text(r, key);
const boolean = (r: Row, key: string): boolean => typeof r[key] === 'boolean' ? r[key] as boolean : invalid();
const number = (r: Row, key: string): number | undefined => r[key] === null ? undefined : typeof r[key] === 'number' && Number.isFinite(r[key]) && (r[key] as number) >= 0 ? r[key] as number : invalid();
const choice = <const T extends string>(r: Row, key: string, values: readonly T[]): T => values.includes(r[key] as T) ? r[key] as T : invalid();

export interface OrderedAdminItem { id: string; programId: string; title: string; sortOrder: number }
export function mapOrderedItem(value: unknown): OrderedAdminItem {
  const r = row(value); const order = number(r, 'sort_order');
  if (order === undefined || !Number.isInteger(order)) return invalid();
  return { id: text(r, 'id'), programId: text(r, 'program_id'), title: text(r, 'title'), sortOrder: order };
}
const ordered = (values: unknown[]) => values.map(mapOrderedItem).sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));

export function mapBranch(value: unknown): AdminBranch {
  const r = row(value);
  return { id: text(r, 'id'), name: text(r, 'name'), city: text(r, 'city'), active: boolean(r, 'is_active'), directoryListed: boolean(r, 'directory_listed'), address: optionalText(r, 'address') ?? '', updatedAt: text(r, 'updated_at'),
    version: r.version === undefined ? undefined : number(r, 'version'),
    legacyKey: r.legacy_key === undefined ? undefined : optionalText(r, 'legacy_key'),
    sourceRegionLabel: r.source_region_label === undefined ? undefined : optionalText(r, 'source_region_label'),
    archived: r.archived_at === undefined ? false : optionalText(r, 'archived_at') !== undefined };
}
export function mapOffering(value: unknown, program: Pick<AdminProgram, 'id' | 'category'>, branch: AdminBranch): AdminOffering {
  const r = row(value);
  if (text(r, 'program_id') !== program.id || text(r, 'branch_id') !== branch.id) return invalid();
  const price = number(r, 'price'); const deposit = number(r, 'min_down_payment'); const months = number(r, 'installment_months'); const hours = number(r, 'accredited_hours_override');
  if (months !== undefined && (!Number.isInteger(months) || months <= 0) || hours !== undefined && (!Number.isInteger(hours) || hours <= 0) || deposit !== undefined && (price === undefined || deposit > price || months === undefined)) return invalid();
  return { id: text(r, 'id'), programId: program.id, category: program.category, branchId: branch.id, city: branch.city, branch: branch.name,
    version: r.version === undefined ? undefined : number(r, 'version'), legacyId: r.legacy_id === undefined ? undefined : optionalText(r, 'legacy_id'), sortOrder: r.sort_order === undefined ? undefined : number(r, 'sort_order'),
    studyMode: choice(r, 'study_mode', ['onsite', 'online']), gender: choice(r, 'gender', ['male', 'female', 'both']), price, minDownPayment: deposit, installments: months, accreditedHours: hours,
    registration: choice(r, 'registration_state', ['unknown', 'open', 'closed']), active: boolean(r, 'is_active'), archived: optionalText(r, 'archived_at') !== undefined, updatedAt: text(r, 'updated_at') };
}
type OrderedRow = Pick<Tables<'curriculum_items'>, 'id' | 'program_id' | 'title' | 'sort_order'>;
export interface CatalogReadRows {
  programs: Omit<Tables<'programs'>, 'created_at' | 'version' | 'legacy_id' | 'name_en'>[];
  branches: Pick<Tables<'branches'>, 'id' | 'name' | 'city' | 'directory_listed' | 'address' | 'is_active' | 'updated_at'>[];
  offerings: Omit<Tables<'program_offerings'>, 'created_at' | 'version' | 'legacy_id'>[];
  curriculum: OrderedRow[];
  careers: Pick<Tables<'career_paths'>, keyof OrderedRow>[];
}
export function mapCatalog(data: CatalogReadRows): AdminSnapshot {
  const branches = data.branches.map(mapBranch); const branchById = new Map(branches.map(b => [b.id, b]));
  const curriculum = ordered(data.curriculum); const careers = ordered(data.careers);
  const programs: AdminProgram[] = data.programs.map(value => {
    const r = row(value); const id = text(r, 'id'); const hours = number(r, 'accredited_hours');
    if (hours !== undefined && (!Number.isInteger(hours) || hours <= 0)) return invalid();
    if (!Array.isArray(r.searchable_keywords) || !r.searchable_keywords.every(k => typeof k === 'string')) return invalid();
    return { id, version: r.version === undefined ? undefined : number(r, 'version'), nameEn: r.name_en === undefined ? undefined : optionalText(r, 'name_en'), name: text(r, 'name_ar'), slug: text(r, 'slug'), category: choice(r, 'program_type', ['diploma', 'qualifying-course', 'development-course']),
      specialization: optionalText(r, 'specialization'), searchableKeywords: [...r.searchable_keywords] as string[], description: text(r, 'description'),
      duration: { label: text(r, 'duration_display'), standard: optionalText(r, 'duration_standard'), withSummerTerm: optionalText(r, 'duration_summer') },
      accreditedHours: hours, accreditation: optionalText(r, 'accreditation_text') ?? '', image: optionalText(r, 'image_path'), imagePosition: optionalText(r, 'image_position'),
      contentPending: boolean(r, 'content_pending'), classificationPending: boolean(r, 'classification_pending'), status: boolean(r, 'is_active') ? 'active' : 'inactive',
      publication: choice(r, 'publication_status', ['draft', 'published']), catalogVisible: boolean(r, 'catalog_visibility'), featured: boolean(r, 'is_featured'),
      archived: optionalText(r, 'archived_at') !== undefined, updatedAt: text(r, 'updated_at'),
      curriculum: curriculum.filter(c => c.programId === id).map(c => c.title), careerPaths: careers.filter(c => c.programId === id).map(c => c.title), offerings: [],
      curriculumItems: curriculum.filter(c => c.programId === id).map(c => ({id:c.id,title:c.title})),
      careerItems: careers.filter(c => c.programId === id).map(c => ({id:c.id,title:c.title})),
      // No catalogSlug: a hosted preview row is not proof of a matching live static page.
    };
  });
  const programById = new Map(programs.map(p => [p.id, p]));
  if (programById.size !== programs.length || branchById.size !== branches.length) return invalid();
  for (const child of [...curriculum, ...careers]) if (!programById.has(child.programId)) return invalid();
  const offerIds = new Set<string>();
  for (const r of [...data.offerings].map(row).sort((a, b) => (number(a, 'sort_order') ?? 0) - (number(b, 'sort_order') ?? 0) || text(a, 'id').localeCompare(text(b, 'id')))) {
    const p = programById.get(text(r, 'program_id')); const b = branchById.get(text(r, 'branch_id')); const id = text(r, 'id');
    if (!p || !b || offerIds.has(id)) return invalid();
    offerIds.add(id); p.offerings.push(mapOffering(r, p, b));
  }
  return { programs, branches };
}

export function mapProfile(value: unknown) {
  const r = row(value);
  return { userId: text(r, 'user_id'), displayName: text(r, 'display_name'), role: choice(r, 'role', ['super_admin', 'content_manager', 'branch_manager', 'viewer']), active: boolean(r, 'is_active') };
}
export type AdminReadProfile = ReturnType<typeof mapProfile>;

/** Separate audit DTO preserves database actions; never mixes persistent audit with mock session events. */
export function mapActivity(value: unknown) {
  const r = row(value);
  return { id: text(r, 'id'), actorUserId: optionalText(r, 'actor_user_id') ?? null, actorLabel: text(r, 'actor_label'),
    action: choice(r, 'action', ['create', 'update', 'disable', 'archive', 'restore', 'delete']),
    entityType: choice(r, 'entity_type', ['programs', 'branches', 'program_offerings', 'curriculum_items', 'career_paths', 'admin_profiles', 'admin_branch_assignments']),
    entityId: text(r, 'entity_id'), entityLabel: text(r, 'entity_label'), branchId: optionalText(r, 'branch_id') ?? null,
    before: r.before_data, after: r.after_data, metadata: row(r.metadata), createdAt: text(r, 'created_at') };
}
