// @vitest-environment node
// Captured by a fresh read-only hosted SELECT after the committed import.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { mapCatalog } from '../lib/supabase/read-mappers.ts';
import { filterPrograms, getAvailableCities } from '../lib/filters.ts';
import { loadSource } from '../scripts/catalog-import-lib.mjs';
import { loadApproved, reconcile } from '../scripts/catalog-execution-lib.mjs';
const rows=JSON.parse(readFileSync('migration/reports/phase-3d2-hosted-snapshot.json','utf8'));
const source=loadSource(), approved=loadApproved();
const snapshot=mapCatalog({programs:rows.programs,branches:rows.branches,offerings:rows.program_offerings,curriculum:rows.curriculum_items,careers:rows.career_paths});
it('reconciles every captured hosted row against all approved payload fields',()=>{
  expect(reconcile(approved.payload,rows)).toBe(true);
});
it('projects hosted content through the real Supabase mapper with safe states intact',()=>{
  expect(snapshot.programs).toHaveLength(53);expect(snapshot.branches).toHaveLength(16);
  for(const p of snapshot.programs){
    const id=approved.manifest.programs.find(m=>m.uuid===p.id).identity;
    const original=source.programs.find(s=>s.id===id);
    expect([p.name,p.slug,p.category,p.description,p.duration,p.accreditedHours,p.curriculum,p.careerPaths]).toEqual([original.name,original.slug,original.category,original.description,{label:original.duration.label,standard:original.duration.standard,withSummerTerm:original.duration.withSummerTerm},original.accreditedHours,original.curriculum??[],original.careerPaths??[]]);
    expect(p.status).toBe('inactive');expect(p.publication).toBe('draft');expect(p.catalogVisible).toBe(false);
    for(const o of p.offerings){expect(o.active).toBe(false);expect(o.registration).toBe('unknown');}
    if(id==='accounting') expect(p.offerings).toHaveLength(0);
  }
});
it('preserves current explorer results using hosted mapped content and frozen activity provenance',()=>{
  const ids=new Map(approved.manifest.programs.map(m=>[m.uuid,m.identity]));
  const programs=approved.manifest.programs.map(m=>({...snapshot.programs.find(p=>p.id===m.uuid),id:m.identity}));
  const all=snapshot.programs.flatMap(p=>p.offerings);
  const offerings=approved.manifest.offerings.map(m=>{const o=all.find(o=>o.id===m.uuid);return {...o,id:m.legacyId,programId:ids.get(o.programId),active:m.sourceActive};});
  const summarize=items=>items.map(({program,offerings})=>({id:program.id,category:program.category,offers:offerings.map(o=>[o.id,o.city,o.branch,o.studyMode,o.gender,o.price,o.minDownPayment,o.installments,o.accreditedHours])}));
  for(const category of [undefined,'diploma','qualifying-course','development-course']) for(const studyMode of [undefined,'onsite','online']) {
    expect(getAvailableCities(offerings,category,studyMode,programs)).toEqual(getAvailableCities(source.offerings,category,studyMode,source.programs));
    for(const city of [undefined,...Object.keys(source.branches)]) {
      const filters={category,studyMode,city};
      expect(summarize(filterPrograms(programs,offerings,filters))).toEqual(summarize(filterPrograms(source.programs,source.offerings,filters)));
    }
  }
});
