// Offline preparation only. No database client, network calls or SQL execution.
import ts from 'typescript';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';

export const EXPECTED_FINGERPRINT = '61b1cb418837450e3a35dbc0f9b92a0a67c808ca5e473dcdd785ed7303b2cf5b';
export const PROJECT = 'crzedkbjvujcmcikgvoe';
export const SCHEMA_VERSION = '20260912105826';
const hash = value => createHash('sha256').update(value).digest('hex');
export function loadTS(path) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(path,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(source,{exports},{filename:path,timeout:5000});
  return exports;
}
export function loadSource() {
  return {programs:loadTS('data/programs.ts').programs,offerings:loadTS('data/offerings.ts').offerings,branches:loadTS('data/branches.ts').branches};
}
export const fingerprint = source => hash(JSON.stringify({programs:source.programs,offerings:source.offerings,branches:source.branches}));
const {validateCatalogSource, offeringIdentity, branchLegacyKey} = loadTS('lib/supabase/migration-validation.ts');
const tables = ['programs','branches','program_offerings','curriculum_items','career_paths'];
const allowedWarnings = new Set(['program without offerings: accounting','unresolved branch: الدمام::فرع الدمام','unresolved branch: الدمام::حي الشاطئ','unresolved branch: الدمام::حي الزهور']);
const fail = message => { throw new Error(message); };
const check = (ok,message) => { if(!ok) fail(message); };
function identities(source) {
  const branches=[];
  const add=(city,branch,directoryListed)=> {
    check(city && branch && !city.includes('::') && !branch.includes('::'),'Ambiguous branch delimiter');
    const identity=branchLegacyKey(city,branch);
    const existing=branches.find(b=>b.identity===identity);
    if(existing) return;
    const labels=[...new Set(source.offerings.filter(o=>o.city===city && o.branch===branch).map(o=>o.region).filter(x=>x!==undefined))];
    check(labels.length<=1,`Conflicting region labels: ${identity}`);
    branches.push({identity,city,branch,directoryListed,sourceRegionLabel:labels[0]??null,sourceIndex:branches.length});
  };
  Object.entries(source.branches).forEach(([city,names])=>names.forEach(name=>add(city,name,true)));
  source.offerings.forEach(o=>add(o.city,o.branch,false));
  const children=key=>source.programs.flatMap(p=>(p[key]??[]).map((title,sourceIndex)=>({identity:JSON.stringify([p.id,sourceIndex,title]),programId:p.id,sourceIndex,title})));
  return {
    programs:source.programs.map((p,sourceIndex)=>({identity:p.id,sourceIndex})),
    branches,
    offerings:source.offerings.map((o,sourceIndex)=>({identity:offeringIdentity(o),legacyId:o.id,sourceIndex,sourceActive:o.active})),
    curriculum:children('curriculum'),careers:children('careerPaths'),
  };
}
function auxiliaryHashes() {
  return Object.fromEntries(['data/regions.ts','lib/installments.ts','lib/supabase/database.generated.ts','supabase/migrations/20260910000100_catalog_foundation.sql'].map(path=>[path,hash(readFileSync(path))]));
}
const manifestDigest = m => { const {integritySha256,...body}=m; return hash(JSON.stringify(body)); };
export function prepare(source, existing) {
  const sourceFingerprint=fingerprint(source);
  check(sourceFingerprint===EXPECTED_FINGERPRINT,'Source fingerprint changed: stop and review a new manifest');
  const validation=validateCatalogSource(source.programs,source.offerings,source.branches);
  check(!validation.errors.length,validation.errors.join('; '));
  check(validation.warnings.every(w=>allowedWarnings.has(w)),'Unapproved source warning');
  const expected=identities(source);
  let manifest=existing;
  if(!manifest) {
    manifest={manifestVersion:1,createdAt:new Date().toISOString(),sourceFingerprint,sourceCounts:validation.counts,schemaTargetVersion:SCHEMA_VERSION,supabaseProjectRef:PROJECT,auxiliarySourceHashes:auxiliaryHashes(),policy:'draft-hidden-inactive-registration-unknown',...Object.fromEntries(Object.entries(expected).map(([key,rows])=>[key,rows.map(row=>({...row,uuid:randomUUID()}))]))};
    manifest.integritySha256=manifestDigest(manifest);
  }
  check(manifest.sourceFingerprint===sourceFingerprint,'Manifest fingerprint mismatch');
  check(manifest.manifestVersion===1 && manifest.schemaTargetVersion===SCHEMA_VERSION && manifest.supabaseProjectRef===PROJECT,'Manifest metadata mismatch');
  check(manifest.integritySha256===manifestDigest(manifest),'Manifest integrity mismatch; do not regenerate IDs');
  check(JSON.stringify(manifest.auxiliarySourceHashes)===JSON.stringify(auxiliaryHashes()),'Auxiliary source/schema changed');
  for(const [key,rows] of Object.entries(expected)) {
    check(Array.isArray(manifest[key]) && manifest[key].length===rows.length,`Manifest count mismatch: ${key}`);
    rows.forEach((row,i)=> {
      const {uuid,...identity}=manifest[key][i];
      check(JSON.stringify(identity)===JSON.stringify(row),`Manifest identity mismatch: ${key}/${i}`);
    });
  }
  const payload=materialize(source,manifest);
  validatePayload(payload);
  const counts=Object.fromEntries(tables.map(table=>[table,payload[table].length]));
  check(JSON.stringify(Object.values(counts))===JSON.stringify([53,16,83,80,124]),'Payload count mismatch');
  return {manifest,payload,reconciliation:{sourceFingerprint,counts,sourceValidation:validation,errors:[],preservedWarnings:validation.warnings,policy:manifest.policy,payloadSha256:hash(JSON.stringify(payload,null,2)+'\n')}};
}
export function materialize(source, manifest) {
  const programs=new Map(manifest.programs.map(p=>[p.identity,p.uuid]));
  const branches=new Map(manifest.branches.map(b=>[b.identity,b.uuid]));
  return {
    programs:source.programs.map(p=>({id:programs.get(p.id),legacy_id:p.id,name_ar:p.name,slug:p.slug,program_type:p.category,specialization:p.specialization??null,searchable_keywords:p.searchableKeywords??[],description:p.description,duration_display:p.duration.label,duration_standard:p.duration.standard??null,duration_summer:p.duration.withSummerTerm??null,accredited_hours:p.accreditedHours??null,image_path:p.image??null,image_position:p.imagePosition??null,content_pending:p.contentPending??false,classification_pending:p.classificationPending??false,publication_status:'draft',catalog_visibility:false,is_active:false})),
    branches:manifest.branches.map(b=>({id:b.uuid,legacy_key:b.identity,name:b.branch,city:b.city,directory_listed:b.directoryListed,source_region_label:b.sourceRegionLabel,is_active:false})),
    program_offerings:source.offerings.map((o,i)=>({id:manifest.offerings[i].uuid,legacy_id:o.id,program_id:programs.get(o.programId),branch_id:branches.get(branchLegacyKey(o.city,o.branch)),study_mode:o.studyMode,gender:o.gender??'both',price:o.price??null,min_down_payment:o.minDownPayment??null,installment_months:o.installments??null,accredited_hours_override:o.accreditedHours??null,sort_order:i,registration_state:'unknown',is_active:false})),
    curriculum_items:manifest.curriculum.map(c=>({id:c.uuid,program_id:programs.get(c.programId),title:c.title,sort_order:c.sourceIndex})),
    career_paths:manifest.careers.map(c=>({id:c.uuid,program_id:programs.get(c.programId),title:c.title,sort_order:c.sourceIndex})),
  };
}
export function validatePayload(payload) {
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const ids=new Set();
  const nonblank=x=>typeof x==='string' && x.trim().length>0;
  const integer=(x,min)=>Number.isInteger(x)&&x>=min&&x<=2147483647;
  const money=x=>x===null || typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=9999999999.99&&Math.abs(x*100-Math.round(x*100))<0.00001;
  const unique=(rows,key,label)=>{const values=rows.map(key);check(new Set(values).size===values.length,`Duplicate ${label}`);};
  for(const table of tables) {
    check(Array.isArray(payload[table]),`Missing ${table}`);
    for(const row of payload[table]) {check(uuid.test(row.id)&&!ids.has(row.id),`Invalid/duplicate UUID: ${table}`);ids.add(row.id);}
  }
  const programs=new Set(payload.programs.map(p=>p.id)), branches=new Set(payload.branches.map(b=>b.id));
  unique(payload.programs,p=>p.legacy_id,'program legacy ID'); unique(payload.programs,p=>p.slug,'slug');
  for(const p of payload.programs) {
    check(nonblank(p.legacy_id)&&nonblank(p.name_ar)&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug),'Invalid program identity');
    check(['diploma','qualifying-course','development-course'].includes(p.program_type),'Invalid program type');
    check(Array.isArray(p.searchable_keywords)&&p.searchable_keywords.every(x=>typeof x==='string'),'Invalid keywords');
    check(typeof p.description==='string'&&typeof p.duration_display==='string','Invalid program text');
    for(const key of ['specialization','duration_standard','duration_summer','image_path','image_position']) check(p[key]===null||typeof p[key]==='string',`Invalid ${key}`);
    for(const key of ['content_pending','classification_pending']) check(typeof p[key]==='boolean',`Invalid ${key}`);
    check(p.accredited_hours===null||integer(p.accredited_hours,1),'Invalid program hours');
    check(p.publication_status==='draft'&&p.catalog_visibility===false&&p.is_active===false,'Unsafe program controls');
  }
  unique(payload.branches,b=>b.legacy_key,'branch legacy key');
  for(const b of payload.branches) check(nonblank(b.name)&&nonblank(b.city)&&b.legacy_key===branchLegacyKey(b.city,b.name)&&typeof b.directory_listed==='boolean'&&(b.source_region_label===null||typeof b.source_region_label==='string')&&b.is_active===false,'Invalid branch');
  unique(payload.program_offerings,o=>o.legacy_id,'offering legacy ID');
  unique(payload.program_offerings,o=>JSON.stringify([o.program_id,o.branch_id,o.study_mode,o.gender]),'offering context');
  payload.program_offerings.forEach((o,i)=>{
    check(nonblank(o.legacy_id)&&programs.has(o.program_id)&&branches.has(o.branch_id),'Invalid offering FK/identity');
    check(['onsite','online'].includes(o.study_mode)&&['male','female','both'].includes(o.gender),'Invalid mode/gender');
    check(money(o.price)&&money(o.min_down_payment),'Invalid numeric(12,2) money');
    check(o.installment_months===null||integer(o.installment_months,1),'Invalid installment months');
    check(o.min_down_payment===null||o.price!==null&&o.min_down_payment<=o.price&&o.installment_months!==null,'Invalid deposit bounds');
    check(o.accredited_hours_override===null||integer(o.accredited_hours_override,1),'Invalid offering hours');
    check(integer(o.sort_order,0)&&o.sort_order===i,'Invalid offering order');
    check(o.registration_state==='unknown'&&o.is_active===false,'Unsafe offering controls');
  });
  for(const table of ['curriculum_items','career_paths']) {
    const next=new Map();
    for(const c of payload[table]) {
      check(programs.has(c.program_id)&&nonblank(c.title)&&integer(c.sort_order,0),'Invalid child FK/title/order');
      check(c.sort_order===(next.get(c.program_id)??0),'Noncontiguous child order'); next.set(c.program_id,c.sort_order+1);
    }
  }
  // Initial rows deliberately omit timestamps/version/archive and unapproved fields.
  for(const row of tables.flatMap(t=>payload[t])) for(const key of ['created_at','updated_at','archived_at','version','name_en','accreditation_text','is_featured','address']) check(!(key in row),`Unapproved generated field: ${key}`);
  return true;
}
export function csv(headers,rows) {
  const cell=x=>'"'+String(x??'').replaceAll('"','""')+'"';
  return [headers,...rows].map(row=>row.map(cell).join(',')).join('\n')+'\n';
}
