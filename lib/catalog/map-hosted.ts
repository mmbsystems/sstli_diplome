import 'server-only';
import manifest from '@/migration/catalog-import-manifest.json';
import { mapCatalog } from '@/lib/supabase/read-mappers';
import { AdminReadError } from '@/lib/admin/read-source';
import type { Program, Offering } from '@/types/program';
import type { HostedCatalogRows, CatalogSnapshot } from './types';

/** Manifest preserves imported ordering only; database rows define live completeness. */
export function mapHostedCatalog(rows: HostedCatalogRows): CatalogSnapshot {
  const admin=mapCatalog({programs:rows.programs,branches:rows.branches,offerings:rows.program_offerings,curriculum:rows.curriculum_items,careers:rows.career_paths});
  if(Object.values(rows).every(items=>items.length===0)) return {admin,staff:{programs:[],offerings:[],branches:[]}};
  const invalid=():never=>{throw new AdminReadError('schema');};
  const programRows=new Map(rows.programs.map(p=>[p.id,p]));
  const branchRows=new Map(rows.branches.map(b=>[b.id,b]));
  const offeringRows=new Map(rows.program_offerings.map(o=>[o.id,o]));
  if(programRows.size!==rows.programs.length||branchRows.size!==rows.branches.length||offeringRows.size!==rows.program_offerings.length) invalid();
  const programOrder=new Map(manifest.programs.map((p,i)=>[p.uuid,i]));
  const branchOrder=new Map(manifest.branches.map((b,i)=>[b.uuid,i]));
  admin.programs.sort((a,b)=>(programOrder.get(a.id)??Infinity)-(programOrder.get(b.id)??Infinity));
  admin.branches.sort((a,b)=>(branchOrder.get(a.id)??Infinity)-(branchOrder.get(b.id)??Infinity));
  const programs:Program[]=admin.programs.flatMap(p=>{
    const row=programRows.get(p.id)!;
    if(row.archived_at!==null) return [];
    return [{id:row.legacy_id??row.id,name:p.name,slug:p.slug,category:p.category,specialization:p.specialization,searchableKeywords:p.searchableKeywords,description:p.description,duration:p.duration,accreditedHours:p.accreditedHours,image:p.image,imagePosition:p.imagePosition,contentPending:p.contentPending,classificationPending:p.classificationPending,curriculum:p.curriculum,careerPaths:p.careerPaths}];
  });
  const branches=admin.branches.filter(b=>!b.archived).map(b=>{
    const row=branchRows.get(b.id)!;
    return {id:row.legacy_key??row.id,city:b.city,name:b.name,directoryListed:b.directoryListed,region:row.source_region_label??undefined};
  });
  const offerings:Offering[]=[...rows.program_offerings].sort((a,b)=>a.sort_order-b.sort_order||a.id.localeCompare(b.id)).flatMap(r=>{
    const parent=programRows.get(r.program_id),b=branchRows.get(r.branch_id);
    if(!parent||!b) return invalid();
    const p=admin.programs.find(p=>p.id===r.program_id),o=p?.offerings.find(o=>o.id===r.id);
    if(!p||!o) return invalid();
    if(r.archived_at!==null||parent.archived_at!==null||b.archived_at!==null) return [];
    return [{id:r.legacy_id??r.id,programId:parent.legacy_id??parent.id,category:p.category,city:b.city,branch:b.name,region:b.source_region_label??undefined,studyMode:o.studyMode,gender:o.gender,price:o.price,minDownPayment:o.minDownPayment,installments:o.installments,accreditedHours:o.accreditedHours,active:true}];
  });
  return {admin,staff:{programs,branches,offerings}};
}
