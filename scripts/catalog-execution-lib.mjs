import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { loadSource, prepare, PROJECT, EXPECTED_FINGERPRINT } from './catalog-import-lib.mjs';
export const MANIFEST_HASH='9193fb1256b02777801cc0642a6a3ebdfd1a5050eac975e3871f6ec5e9fbf2cd';
export const PAYLOAD_HASH='0967bda4eb8d37b4112bbbaca1eb26a40f194b875b0f24c909efdc68f0cb07a4';
export const TABLES=['branches','programs','program_offerings','curriculum_items','career_paths'];
const sha=x=>createHash('sha256').update(x).digest('hex');
const literal=x=>"'"+String(x).replaceAll("'","''")+"'";
export function loadApproved({manifestPath='migration/catalog-import-manifest.json',payloadPath='migration/generated/catalog-import-payload.json'}={}) {
  const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
  const bytes=readFileSync(payloadPath);
  if(manifest.integritySha256!==MANIFEST_HASH||sha(bytes)!==PAYLOAD_HASH) throw new Error('Approved artifact fingerprint mismatch');
  const expected=prepare(loadSource(),manifest);
  const payload=JSON.parse(bytes.toString('utf8'));
  if(JSON.stringify(expected.payload)!==JSON.stringify(payload)) throw new Error('Payload/manifest mapping mismatch');
  return {project:PROJECT,manifest,payload,counts:expected.reconciliation.counts};
}
export function reconcile(expected,actual) {
  for(const table of TABLES) {
    if(!Array.isArray(actual[table])||actual[table].length!==expected[table].length) throw new Error(`Count mismatch: ${table}`);
    const byId=new Map(actual[table].map(r=>[r.id,r]));
    if(byId.size!==expected[table].length) throw new Error(`Duplicate UUID: ${table}`);
    for(const row of expected[table]) for(const [key,value] of Object.entries(row)) {
      if(!isDeepStrictEqual(byId.get(row.id)?.[key],value)) throw new Error(`Field mismatch: ${table}/${row.id}/${key}`);
    }
  }
  return true;
}
export function buildTransaction(approved=loadApproved()) {
  const {payload,manifest,counts}=approved;
  // A deterministic batch UUID derived from the frozen manifest, not catalog IDs.
  const h=MANIFEST_HASH;
  const batch=`${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;
  const targetTables=TABLES.map(t=>`public.${t}`).join(', ');
  const comparisons=TABLES.map(t=>`if (select count(*) from public.${t}) <> jsonb_array_length(payload->'${t}') or exists (
    select 1 from jsonb_array_elements(payload->'${t}') e
    left join public.${t} r on r.id=(e->>'id')::uuid
    where r.id is null or exists(select 1 from jsonb_each(e) field where to_jsonb(r)->field.key is distinct from field.value)
  ) then raise exception 'Exact reconciliation failed: ${t}'; end if;`).join('\n');
  const insertions=TABLES.map(t=>{const columns=Object.keys(payload[t][0]).join(',');return `insert into public.${t}(${columns}) select ${columns} from jsonb_populate_recordset(null::public.${t},payload->'${t}');`;}).join('\n');
  const empty=TABLES.map(t=>`exists(select 1 from public.${t})`).join(' or ');
  const body=`do $catalog_import$
declare
  payload jsonb := ${literal(JSON.stringify(payload))}::jsonb;
  receipt private.catalog_import_receipts;
  t text;
  original_activity bigint;
  original_auth bigint;
begin
  if not pg_try_advisory_xact_lock(1936946284, 356) then raise exception 'Catalog import already active'; end if;
  if current_user not in ('postgres','supabase_admin') or auth.uid() is not null then raise exception 'Database-owner maintenance only'; end if;
  lock table ${targetTables}, private.catalog_import_receipts in access exclusive mode nowait;
  foreach t in array array[${TABLES.map(literal).join(',')}] loop
    if not exists(select 1 from pg_trigger where tgrelid=('public.'||t)::regclass and tgname='audit_change' and tgenabled='O' and tgfoid='private.audit_catalog_change()'::regprocedure) then raise exception 'Audit trigger state mismatch: %',t; end if;
    if not (select relrowsecurity from pg_class where oid=('public.'||t)::regclass) then raise exception 'RLS disabled: %',t; end if;
  end loop;
  select * into receipt from private.catalog_import_receipts where manifest_fingerprint=${literal(MANIFEST_HASH)};
  if found then
    if receipt.source_fingerprint<>${literal(EXPECTED_FINGERPRINT)} or receipt.payload_fingerprint<>${literal(PAYLOAD_HASH)} or receipt.project_ref<>${literal(PROJECT)} or receipt.manifest_version<>1 or receipt.destination_counts<>${literal(JSON.stringify(counts))}::jsonb then raise exception 'Receipt mismatch'; end if;
    ${comparisons}
    perform set_config('sstli.catalog_import_result','already imported and reconciled',true);
    return;
  end if;
  if ${empty} or exists(select 1 from private.catalog_import_receipts) then raise exception 'Non-empty or partial target; manual review required'; end if;
  select count(*) into original_activity from public.activity_logs;
  select count(*) into original_auth from auth.users;
  foreach t in array array[${TABLES.map(literal).join(',')}] loop
    execute format('alter table public.%I disable trigger audit_change',t);
  end loop;
  ${insertions}
  ${comparisons}
  foreach t in array array[${TABLES.map(literal).join(',')}] loop
    execute format('alter table public.%I enable trigger audit_change',t);
    if not exists(select 1 from pg_trigger where tgrelid=('public.'||t)::regclass and tgname='audit_change' and tgenabled='O') then raise exception 'Audit trigger restore failed'; end if;
  end loop;
  if (select count(*) from public.activity_logs)<>original_activity or (select count(*) from auth.users)<>original_auth then raise exception 'Unexpected activity/auth change'; end if;
  insert into private.catalog_import_receipts(batch_id,source_fingerprint,manifest_fingerprint,payload_fingerprint,manifest_version,source_counts,destination_counts,project_ref,import_actor)
  values(${literal(batch)}::uuid,${literal(EXPECTED_FINGERPRINT)},${literal(MANIFEST_HASH)},${literal(PAYLOAD_HASH)},1,${literal(JSON.stringify(manifest.sourceCounts))}::jsonb,${literal(JSON.stringify(counts))}::jsonb,${literal(PROJECT)},'system migration');
  perform set_config('sstli.catalog_import_result','imported and reconciled',true);
end;
$catalog_import$;`;
  return {body,batch,query:`begin;\nset local statement_timeout='60s';\nset local lock_timeout='5s';\n${body}\nselect current_setting('sstli.catalog_import_result') as result, to_jsonb(r) as receipt from private.catalog_import_receipts r where manifest_fingerprint=${literal(MANIFEST_HASH)};\ncommit;`};
}
export async function runImport({project,execute=false,transport}={}) {
  if(project!==PROJECT) throw new Error('Unknown project; development allowlist only');
  const approved=loadApproved();
  if(!execute) return {mode:'plan',project,counts:approved.counts,sourceFingerprint:EXPECTED_FINGERPRINT,manifestFingerprint:MANIFEST_HASH,payloadFingerprint:PAYLOAD_HASH};
  if(typeof transport!=='function') throw new Error('Explicit execution transport required');
  return transport({project_id:project,query:buildTransaction(approved).query});
}
