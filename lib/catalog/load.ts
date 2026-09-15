import 'server-only';
import { cache } from 'react';
import { requireUser, requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { MutationError } from '@/lib/admin/mutations/errors';
import { AdminReadError, readDataSource, type AdminReadState, type ReadFailure } from '@/lib/admin/read-source';
import type { CatalogSnapshot, StaffReadState } from './types';
import { readHostedCatalog } from './hosted';

// React cache deduplicates metadata/page reads within one server render only.
// Authorization remains outside the cache and runs for every entry point.
const snapshot=cache(async(source:'static'|'supabase'):Promise<CatalogSnapshot>=>{
  if(source==='supabase') return readHostedCatalog(createAdminClient((input,init)=>fetch(input,{...init,cache:'no-store'})));
  const [{programs},{offerings},{branches},{createAdminSnapshot}]=await Promise.all([import('@/data/programs'),import('@/data/offerings'),import('@/data/branches'),import('@/lib/admin/adapter')]);
  const admin=createAdminSnapshot(programs,offerings,branches);
  return {admin,staff:{programs,offerings,branches:admin.branches.map(b=>({id:b.id,city:b.city,name:b.name,directoryListed:b.directoryListed??false,region:offerings.find(o=>o.city===b.city&&o.branch===b.name)?.region}))}};
});
async function selected() {
  let source:'static'|'supabase';
  try {source=readDataSource(process.env.ADMIN_DATA_SOURCE);}catch{return {status:'unavailable' as const,source:'configuration' as const,reason:'configuration' as const};}
  try {
    const data=await snapshot(source);
    if(process.env.CATALOG_READ_DIAGNOSTICS==='true')console.info(`SSTLI_CATALOG_READ source=${source} programs=${data.staff.programs.length} offerings=${data.staff.offerings.length}`);
    return {status:'ready' as const,source,data};
  } catch(error) {
    const reason:ReadFailure=error instanceof AdminReadError?error.reason:error instanceof MutationError&&error.reason==='configuration'?'configuration':'connection';
    console.error(`SSTLI_CATALOG_READ_FAILED source=${source} reason=${reason}`);
    return {status:'unavailable' as const,source,reason};
  }
}
export async function loadStaffCatalog():Promise<StaffReadState> {
  await requireUser();
  const state=await selected();
  return state.status==='ready'?{status:'ready',source:state.source,catalog:state.data.staff}:state;
}
export async function loadAdminCatalog():Promise<AdminReadState> {
  await requireAdmin();
  const state=await selected();
  return state.status==='ready'?{status:'ready',source:state.source,snapshot:state.data.admin}:state;
}
