// Offline dry run only: writes review artifacts, never database rows.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { loadSource, prepare, csv } from './catalog-import-lib.mjs';
try {
  const manifestPath='migration/catalog-import-manifest.json';
  const source=loadSource();
  const previous=existsSync(manifestPath)?JSON.parse(readFileSync(manifestPath,'utf8')):undefined;
  const {manifest,payload,reconciliation}=prepare(source,previous);
  for(const dir of ['migration','migration/generated','migration/reports']) mkdirSync(dir,{recursive:true});
  const json=value=>JSON.stringify(value,null,2)+'\n';
  if(!previous) writeFileSync(manifestPath,json(manifest),{flag:'wx'});
  writeFileSync('migration/generated/catalog-import-payload.json',json(payload));
  writeFileSync('migration/reports/reconciliation.json',json(reconciliation));
  writeFileSync('migration/reports/program-map.csv',csv(['source_id','destination_uuid','name','slug'],payload.programs.map(p=>[p.legacy_id,p.id,p.name_ar,p.slug])));
  writeFileSync('migration/reports/branch-map.csv',csv(['legacy_key','destination_uuid','city','branch','directory_listed'],payload.branches.map(b=>[b.legacy_key,b.id,b.city,b.name,b.directory_listed])));
  const programs=new Map(payload.programs.map(p=>[p.id,p.legacy_id])),branches=new Map(payload.branches.map(b=>[b.id,b.legacy_key]));
  writeFileSync('migration/reports/offering-map.csv',csv(['legacy_id','destination_uuid','program_source_id','branch_legacy_key','study_mode','gender','price','source_index'],payload.program_offerings.map(o=>[o.legacy_id,o.id,programs.get(o.program_id),branches.get(o.branch_id),o.study_mode,o.gender,o.price,o.sort_order])));
  console.log(json({mode:'OFFLINE REVIEW ONLY',...reconciliation}));
} catch(error) { console.error(`Dry-run failed: ${error.message}`);process.exitCode=1; }
