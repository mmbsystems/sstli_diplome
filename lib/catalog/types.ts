import type { Program, Offering } from '@/types/program';
import type { AdminSnapshot } from '@/lib/admin/types';
import type { Tables } from '@/lib/supabase/database.generated';
import type { ReadFailure } from '@/lib/admin/read-source';
export interface StaffBranch { id: string; city: string; name: string; directoryListed: boolean; region?: string }
export interface StaffCatalog { programs: Program[]; offerings: Offering[]; branches: StaffBranch[] }
export interface CatalogSnapshot { staff: StaffCatalog; admin: AdminSnapshot }
export interface HostedCatalogRows {
  programs: Tables<'programs'>[];
  branches: Tables<'branches'>[];
  program_offerings: Tables<'program_offerings'>[];
  curriculum_items: Tables<'curriculum_items'>[];
  career_paths: Tables<'career_paths'>[];
}
export type StaffReadState = {status:'ready';source:'static'|'supabase';catalog:StaffCatalog} | {status:'unavailable';source:'static'|'supabase'|'configuration';reason:ReadFailure};
