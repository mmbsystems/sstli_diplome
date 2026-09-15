// @vitest-environment node
import { expect, it } from 'vitest';
import { readFileSync, mkdtempSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { filterPrograms, getAvailableCities } from '../lib/filters.ts';
import { calculateInstallment } from '../lib/installments.ts';
import { loadSource, prepare, materialize, validatePayload, fingerprint, EXPECTED_FINGERPRINT } from '../scripts/catalog-import-lib.mjs';
const source = loadSource();
const clone = value => JSON.parse(JSON.stringify(value));

it('reruns the offline CLI without changing manifest, payload or mapping bytes', () => {
  const root=mkdtempSync(join(tmpdir(),'sstli-import-dry-run-'));
  try {
    for(const path of ['data/programs.ts','data/offerings.ts','data/branches.ts','data/regions.ts','lib/installments.ts','lib/supabase/migration-validation.ts','lib/supabase/database.generated.ts','supabase/migrations/20260910000100_catalog_foundation.sql']) {
      mkdirSync(dirname(join(root,path)),{recursive:true}); copyFileSync(path,join(root,path));
    }
    const run=()=>execFileSync(process.execPath,[resolve('scripts/prepare-catalog-import.mjs')],{cwd:root,encoding:'utf8',windowsHide:true});
    run();
    const paths=['migration/catalog-import-manifest.json','migration/generated/catalog-import-payload.json','migration/reports/reconciliation.json','migration/reports/program-map.csv','migration/reports/branch-map.csv','migration/reports/offering-map.csv'];
    const before=paths.map(p=>readFileSync(join(root,p),'utf8'));
    run(); expect(paths.map(p=>readFileSync(join(root,p),'utf8'))).toEqual(before);
  } finally { rmSync(root,{recursive:true,force:true}); }
},15000);

it('binds a frozen manifest to the exact approved source and reuses every UUID', () => {
  expect(fingerprint(source)).toBe(EXPECTED_FINGERPRINT);
  const first = prepare(source);
  const second = prepare(source, clone(first.manifest));
  expect(second).toEqual(first);
  const changed = clone(source); changed.programs[0].name += '!';
  expect(() => prepare(changed, first.manifest)).toThrow(/fingerprint/);
  const bad = clone(first.manifest); bad.sourceFingerprint = 'wrong';
  expect(() => prepare(source, bad)).toThrow(/fingerprint/);
});
it('rejects corrupt, missing and duplicated manifest identities instead of regenerating IDs', () => {
  const { manifest } = prepare(source);
  for (const mutate of [m => m.programs.pop(), m => m.programs[0].uuid = m.programs[1].uuid, m => m.offerings[0].identity = 'changed']) {
    const bad = clone(manifest); mutate(bad);
    expect(() => prepare(source, bad)).toThrow();
  }
});
it('materializes all source records with safe unpublished controls and no invented timestamps', () => {
  const { payload } = prepare(source);
  expect(Object.fromEntries(Object.entries(payload).map(([k,v]) => [k,v.length]))).toEqual({ programs:53, branches:16, program_offerings:83, curriculum_items:80, career_paths:124 });
  for (const row of payload.programs) {
    expect(row).toMatchObject({publication_status:'draft', catalog_visibility:false, is_active:false});
    for (const key of ['name_en','accreditation_text','created_at','updated_at','is_featured']) expect(row).not.toHaveProperty(key);
  }
});
it('preserves exact branches including directory-only and unresolved Dammam identities', () => {
  const { payload } = prepare(source);
  for (const name of ['فرع الدمام','حي الشاطئ','حي الشاطئ الغربي','حي الزهور','حي الزهور 1','حي الزهور 2']) expect(payload.branches.some(b => b.legacy_key === `الدمام::${name}`)).toBe(true);
  for (const name of ['سكوير','حي الضيافة']) expect(payload.branches.some(b => b.legacy_key === `خميس مشيط::${name}`)).toBe(true);
  expect(payload.branches.filter(b => b.directory_listed)).toHaveLength(13);
});
it('preserves all unique offering contexts, source order and deposit/month semantics', () => {
  const { payload, manifest } = prepare(source);
  expect(new Set(manifest.offerings.map(o => o.identity)).size).toBe(83);
  payload.program_offerings.forEach((r,i) => {
    expect(r.legacy_id).toBe(source.offerings[i].id);
    expect(r.sort_order).toBe(i);
    expect(r.min_down_payment).toBe(source.offerings[i].minDownPayment ?? null);
    expect(r.installment_months).toBe(source.offerings[i].installments ?? null);
    expect(r.registration_state).toBe('unknown'); expect(r.is_active).toBe(false);
  });
});
it('keeps accounting without offerings, NEBOSH distinct and law base/override hours', () => {
  const { payload } = prepare(source);
  const accounting = payload.programs.find(p => p.legacy_id === 'accounting');
  expect(accounting).toBeDefined();
  expect(payload.program_offerings.filter(o => o.program_id === accounting.id)).toHaveLength(0);
  const nebosh = payload.programs.filter(p => p.legacy_id.includes('nebosh'));
  expect(nebosh).toHaveLength(2); expect(new Set(nebosh.map(p => p.id)).size).toBe(2);
  const law = payload.programs.find(p => p.legacy_id === 'law'); expect(law.accredited_hours).toBe(84);
  expect(payload.program_offerings.some(o => o.program_id === law.id && o.accredited_hours_override === 75)).toBe(true);
});
it('preserves zero versus unknown prices without manufacturing deposits', () => {
  const { manifest } = prepare(source);
  const sample = clone(source); sample.offerings[0].price = 0; delete sample.offerings[0].minDownPayment; delete sample.offerings[0].installments;
  delete sample.offerings[1].price; delete sample.offerings[1].minDownPayment; delete sample.offerings[1].installments;
  const rows = materialize(sample, manifest).program_offerings;
  expect(rows[0].price).toBe(0); expect(rows[1].price).toBeNull(); expect(rows[0].min_down_payment).toBeNull();
});
it('reconstructs static catalog content and ordering from the actual frozen payload', () => {
  const manifest = JSON.parse(readFileSync('migration/catalog-import-manifest.json','utf8'));
  const payload = JSON.parse(readFileSync('migration/generated/catalog-import-payload.json','utf8'));
  expect(prepare(source, manifest).payload).toEqual(payload);
  source.programs.forEach((p,i) => {
    const r=payload.programs[i];
    expect([r.legacy_id,r.name_ar,r.slug,r.program_type,r.description,r.duration_display,r.accredited_hours]).toEqual([p.id,p.name,p.slug,p.category,p.description,p.duration.label,p.accreditedHours??null]);
    expect([r.specialization,r.searchable_keywords,r.duration_standard,r.duration_summer,r.image_path,r.image_position,r.content_pending,r.classification_pending]).toEqual([p.specialization??null,p.searchableKeywords??[],p.duration.standard??null,p.duration.withSummerTerm??null,p.image??null,p.imagePosition??null,p.contentPending??false,p.classificationPending??false]);
    for(const [table,key] of [['curriculum_items','curriculum'],['career_paths','careerPaths']]) {
      const rows=payload[table].filter(x=>x.program_id===r.id);
      expect(rows.map(x=>x.title)).toEqual(p[key]??[]); expect(rows.map(x=>x.sort_order)).toEqual(rows.map((_,i)=>i));
    }
  });
  source.offerings.forEach((o,i)=> {
    const r=payload.program_offerings[i], b=payload.branches.find(b=>b.id===r.branch_id), p=payload.programs.find(p=>p.id===r.program_id);
    expect([p.legacy_id,p.program_type,b.city,b.name,b.source_region_label,r.study_mode,r.gender,r.price,r.accredited_hours_override]).toEqual([o.programId,o.category,o.city,o.branch,o.region??null,o.studyMode,o.gender??'both',o.price??null,o.accreditedHours??null]);
  });
});
it('reconstructs explorer searches, categories, cities, modes, price/duration sorts and installments', () => {
  const {payload,manifest}=prepare(source);
  // Content projection only: source activity is restored from frozen provenance
  // for comparison, NOT from the intentionally inactive import controls.
  const programs=payload.programs.map(p=>({id:p.legacy_id,name:p.name_ar,slug:p.slug,category:p.program_type,description:p.description,specialization:p.specialization??undefined,searchableKeywords:p.searchable_keywords,duration:{label:p.duration_display,standard:p.duration_standard??undefined,withSummerTerm:p.duration_summer??undefined},accreditedHours:p.accredited_hours??undefined,curriculum:payload.curriculum_items.filter(c=>c.program_id===p.id).map(c=>c.title),careerPaths:payload.career_paths.filter(c=>c.program_id===p.id).map(c=>c.title)}));
  const offerings=payload.program_offerings.map((o,i)=>{
    const p=payload.programs.find(p=>p.id===o.program_id),b=payload.branches.find(b=>b.id===o.branch_id);
    return {id:o.legacy_id,programId:p.legacy_id,category:p.program_type,city:b.city,branch:b.name,region:b.source_region_label??undefined,studyMode:o.study_mode,gender:o.gender,price:o.price??undefined,minDownPayment:o.min_down_payment??undefined,installments:o.installment_months??undefined,accreditedHours:o.accredited_hours_override??undefined,active:manifest.offerings[i].sourceActive};
  });
  const summary=rows=>rows.map(r=>({id:r.program.id,offerings:r.offerings}));
  for(const category of [undefined,'diploma','qualifying-course','development-course']) for(const studyMode of [undefined,'online','onsite']) {
    expect(getAvailableCities(offerings,category,studyMode,programs)).toEqual(getAvailableCities(source.offerings,category,studyMode,source.programs));
    for(const city of [undefined,...Object.keys(source.branches)]) for(const sort of [undefined,'price-asc','price-desc','duration-asc','duration-desc']) {
      const options={category,studyMode,city,sort};
      expect(summary(filterPrograms(programs,offerings,options))).toEqual(summary(filterPrograms(source.programs,source.offerings,options)));
    }
  }
  for(const search of ['القانون','HR','NEBOSH','English','محاسبة','مبادئ القانون']) expect(summary(filterPrograms(programs,offerings,{search}))).toEqual(summary(filterPrograms(source.programs,source.offerings,{search})));
  offerings.forEach((o,i)=>{if(o.minDownPayment!==undefined){const original=source.offerings[i];expect(calculateInstallment(o.price,o.minDownPayment,o.minDownPayment,o.installments)).toEqual(calculateInstallment(original.price,original.minDownPayment,original.minDownPayment,original.installments));}});
});
it.each([
  p=>p.programs[1].id=p.programs[0].id,
  p=>p.programs[1].slug=p.programs[0].slug,
  p=>p.programs[0].accredited_hours=0,
  p=>p.branches[1].legacy_key=p.branches[0].legacy_key,
  p=>p.program_offerings[0].program_id='bad',
  p=>p.program_offerings[0].price=-1,
  p=>p.program_offerings[0].price=0.001,
  p=>p.program_offerings[0].price=10000000000,
  p=>p.program_offerings[0].price=NaN,
  p=>p.program_offerings[0].min_down_payment=9999999,
  p=>p.program_offerings[0].installment_months=0,
  p=>p.program_offerings[0].study_mode='hybrid',
  p=>p.program_offerings[0].gender='invalid',
  p=>p.program_offerings[0].accredited_hours_override=0,
  p=>p.curriculum_items[0].sort_order=-1,
  p=>p.career_paths[0].title=' ',
])('rejects destination constraint violations before any future insertion (%#)', mutate => {
  const {payload}=prepare(source); mutate(payload); expect(()=>validatePayload(payload)).toThrow();
});
