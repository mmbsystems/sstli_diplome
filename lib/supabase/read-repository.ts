import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.generated';
import { AdminReadError, type AdminReadRepository } from '@/lib/admin/read-source';
import { mapActivity, mapCatalog, mapOrderedItem, mapProfile } from './read-mappers';

// Explicit projections avoid selecting audit payloads or personnel data in catalog reads.
const columns = {
  programs: 'id,name_ar,slug,program_type,specialization,searchable_keywords,description,duration_display,duration_standard,duration_summer,accredited_hours,accreditation_text,image_path,image_position,content_pending,classification_pending,is_active,publication_status,catalog_visibility,is_featured,archived_at,updated_at',
  branches: 'id,name,city,directory_listed,address,is_active,updated_at',
  program_offerings: 'id,program_id,branch_id,study_mode,gender,price,min_down_payment,installment_months,accredited_hours_override,registration_state,is_active,sort_order,archived_at,updated_at',
  curriculum_items: 'id,program_id,title,sort_order',
  career_paths: 'id,program_id,title,sort_order',
} as const;
function failed(error: { code?: string } | null) {
  if (!error) return;
  throw new AdminReadError(error.code === '42501' ? 'authorization' : ['42P01', '42703', 'PGRST200', 'PGRST204', 'PGRST205'].includes(error.code ?? '') ? 'schema' : 'connection');
}

/** Server repository factory. All database requests are SELECT; Auth is never bridged. */
export function createSupabaseReadRepository(client: SupabaseClient<Database>, options: { pageSize?: number } = {}) {
  const pageSize = options.pageSize ?? 500;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 500) throw new AdminReadError('configuration');
  async function getCurrentProfile() {
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) throw new AdminReadError('authentication');
    const result = await client.from('admin_profiles').select('user_id,display_name,role,is_active').eq('user_id', data.user.id).maybeSingle();
    failed(result.error);
    if (!result.data) throw new AdminReadError('authorization');
    const profile = mapProfile(result.data);
    if (!profile.active || profile.userId !== data.user.id) throw new AdminReadError('authorization');
    return profile;
  }
  async function rows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { code?: string } | null; count: number | null }>): Promise<T[]> {
    const collected: T[] = [];
    // Bound total snapshot size; do not silently return truncated data.
    for (let offset = 0; offset < 10000;) {
      const result = await page(offset, offset + pageSize - 1);
      failed(result.error);
      if (!Array.isArray(result.data)) throw new AdminReadError('schema');
      collected.push(...result.data);
      if (result.count !== null && collected.length >= result.count || result.count === null && result.data.length < pageSize) return collected;
      if (!result.data.length) throw new AdminReadError('schema');
      offset += result.data.length;
    }
    throw new AdminReadError('schema');
  }
  const repository = {
    getCurrentProfile,
    async getSnapshot() {
      await getCurrentProfile();
      const [programs, branches, offerings, curriculum, careers] = await Promise.all([
        rows((from, to) => client.from('programs').select(columns.programs, { count: 'exact' }).order('id').range(from, to)),
        rows((from, to) => client.from('branches').select(columns.branches, { count: 'exact' }).order('id').range(from, to)),
        rows((from, to) => client.from('program_offerings').select(columns.program_offerings, { count: 'exact' }).order('sort_order').order('id').range(from, to)),
        rows((from, to) => client.from('curriculum_items').select(columns.curriculum_items, { count: 'exact' }).order('sort_order').order('id').range(from, to)),
        rows((from, to) => client.from('career_paths').select(columns.career_paths, { count: 'exact' }).order('sort_order').order('id').range(from, to)),
      ]);
      return mapCatalog({ programs, branches, offerings, curriculum, careers });
    },
    async getCurriculum(programId: string) {
      await getCurrentProfile();
      return (await rows((from, to) => client.from('curriculum_items').select(columns.curriculum_items, { count: 'exact' }).eq('program_id', programId).order('sort_order').order('id').range(from, to))).map(mapOrderedItem);
    },
    async getCareerPaths(programId: string) {
      await getCurrentProfile();
      return (await rows((from, to) => client.from('career_paths').select(columns.career_paths, { count: 'exact' }).eq('program_id', programId).order('sort_order').order('id').range(from, to))).map(mapOrderedItem);
    },
    async getActivity(limit = 50) {
      await getCurrentProfile();
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new AdminReadError('configuration');
      const result = await client.from('activity_logs').select('id,actor_user_id,actor_label,action,entity_type,entity_id,entity_label,branch_id,before_data,after_data,metadata,created_at').order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit);
      failed(result.error);
      if (!Array.isArray(result.data)) throw new AdminReadError('schema');
      return result.data.map(mapActivity);
    },
  } satisfies AdminReadRepository & Record<string, unknown>;
  return repository;
}
