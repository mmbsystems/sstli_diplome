// Opt-in real legacy-login proof. Credential enters via stdin, never files/logs.
// Exactly one NEW offering under existing nonarchived parents. Guarded maintenance cleanup follows.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {calculateInstallment} from '../lib/installments.ts';
process.loadEnvFile('.env.local');assert.equal(process.env.ADMIN_DATA_SOURCE,'supabase');
const file='scripts/offering-crud-proof-result.json';assert(!existsSync(file),'Reconcile existing offering proof before another run.');
let input='';for await(const chunk of process.stdin)input+=chunk;let {password}=JSON.parse(input);input='';assert.equal(typeof password,'string');
const base=process.env.OFFERING_TEST_URL||'http://127.0.0.1:3215';
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const hash=x=>createHash('sha256').update(x).digest('hex');const manifestHash=()=>hash(readFileSync('migration/catalog-import-manifest.json'));
const initialManifest=manifestHash(),initialAdmins=hash(readFileSync('config/admins.json'));
const forbidden=[password,process.env.SUPABASE_SECRET_KEY,process.env.SUPABASE_SERVICE_ROLE_KEY,process.env.JWT_SECRET,'SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY'].filter(Boolean);
const tables=['programs','branches','program_offerings','curriculum_items','career_paths'];
async function rows(table){const {data,error}=await db.from(table).select('*').order('id');assert.equal(error,null,'Hosted SELECT '+table);return data;}
async function snapshot(){return Object.fromEntries(await Promise.all(tables.map(async t=>[t,await rows(t)])));}
const baseline=await snapshot();assert.deepEqual(tables.map(t=>baseline[t].length),[53,17,83,80,124]);
const program=baseline.programs.find(p=>p.legacy_id==='law'&&!p.archived_at);assert(program);assert.equal(program.accredited_hours,84);
const branch=baseline.branches.find(b=>!b.archived_at&&!baseline.program_offerings.some(o=>o.program_id===program.id&&o.branch_id===b.id&&o.study_mode==='onsite'&&o.gender==='both'&&!o.archived_at));assert(branch,'No unused safe context');
writeFileSync('scripts/offering-crud-proof-baseline.json',JSON.stringify(baseline,null,2)+'\n');
const report={startedAt:new Date().toISOString(),programId:program.id,branchId:branch.id,offeringId:null,sortOrder:2147483000,manifestSHA256:initialManifest,steps:[]};
const persist=()=>writeFileSync(file,JSON.stringify(report,null,2)+'\n');let cookie,saved;
let fields={program_id:program.id,branch_id:branch.id,study_mode:'onsite',gender:'both',price:12000,min_down_payment:2400,installment_months:12,accredited_hours_override:75,registration_state:'closed',is_active:false,sort_order:report.sortOrder};
const command=patch=>({action:'save',expectedVersion:saved?.version??0,...(saved?{id:saved.id}:{}),offering:fields,...patch});
async function http(path,body,session=cookie){const start=performance.now();const r=await fetch(base+path,{method:body?'POST':'GET',redirect:'manual',headers:{origin:base,...(body?{'content-type':'application/json'}:{}),...(session?{cookie:session}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});const text=await r.text();assert(!forbidden.some(s=>text.includes(s)),'HTTP secret leak');return {status:r.status,text,cookie:r.headers.get('set-cookie')?.split(';')[0],ms:Math.round(performance.now()-start)};}
async function integrity(label){const current=await snapshot();for(const t of tables){const actual=t==='program_offerings'?current[t].filter(o=>o.id!==saved?.id):current[t];assert.deepEqual(actual,baseline[t],label+' original '+t);}assert.equal(current.program_offerings.length,saved?84:83);assert.equal(manifestHash(),initialManifest);assert.equal(hash(readFileSync('config/admins.json')),initialAdmins);return current;}
async function save(body,label){const r=await http('/api/admin/offerings',body);assert.equal(r.status,200,label);saved=JSON.parse(r.text).offering;report.offeringId=saved.id;persist();assert.equal(saved.version,body.expectedVersion+1);assert.equal(saved.legacyId,undefined);await integrity(label);report.steps.push({step:label,status:r.status,version:saved.version,ms:r.ms});persist();}
async function fails(body,status,label,session=cookie){const before=await snapshot(),audit=await rows('activity_logs');const r=await http('/api/admin/offerings',body,session);assert.equal(r.status,status,label);if(label==='stale version')assert(r.ms<5000);assert.deepEqual(await snapshot(),before,label+' rows');assert.deepEqual(await rows('activity_logs'),audit,label+' audit');report.steps.push({step:label,status:r.status,ms:r.ms});}
try{
 await fails(command(),401,'anonymous denied',null);
 const staffRow=readFileSync('STAFF_CREDENTIALS.txt','utf8').split(/\r?\n/).find(l=>l.startsWith('bahaa |')).split('|').map(s=>s.trim());
 const staff=await http('/api/auth/login',{username:staffRow[0],password:staffRow[1]},null);assert.equal(staff.status,200);
 await fails(command(),403,'staff denied',staff.cookie);await fails(command({actor:{username:'admin'},role:'super_admin'}),403,'staff spoof denied',staff.cookie);
 const login=await http('/api/auth/login',{username:'admin',password},null);password=undefined;assert.equal(login.status,200);cookie=login.cookie;assert(cookie);report.steps.push({step:'real admin login',status:200});persist();
 await save(command(),'create');
 fields={...fields,price:14400};await save(command(),'update price');
 fields={...fields,installment_months:24};await save(command(),'update installment');
 const calc=calculateInstallment(saved.price,saved.minDownPayment,saved.minDownPayment,saved.installments);assert.deepEqual(calc,{remainingAmount:12000,monthlyInstallment:500,error:null});report.calculator=calc;assert.equal(saved.accreditedHours,75);
 const detail=await http('/programs/'+program.slug,null,staff.cookie);assert.equal(detail.status,200);assert(detail.text.includes(saved.id));assert(detail.text.includes('14400'));assert(detail.text.includes('2400'));
 await fails(command({expectedVersion:saved.version-1}),409,'stale version');
 await fails(command({id:undefined,expectedVersion:0}),409,'duplicate context');
 await fails(command({actor:'fake'}),422,'actor spoof');await fails(command({role:'super_admin'}),422,'role spoof');
 await fails(command({offering:{...fields,price:1.001}}),422,'precision');
 await fails(command({offering:{...fields,min_down_payment:15000}}),422,'deposit bound');
 await fails(command({offering:{...fields,installment_months:0}}),422,'invalid installments');
 await fails(command({offering:{...fields,legacy_id:'off-fake'}}),422,'legacy identity injection');
 const retained=baseline.branches.find(b=>b.archived_at);assert(retained);await fails(command({offering:{...fields,branch_id:retained.id}}),409,'archived branch refused');
 await save(command({action:'archive'}),'archive');assert(saved.archived);assert.equal(saved.active,false);assert.equal(saved.price,14400);
 const archived=await http('/programs/'+program.slug,null,staff.cookie);assert.equal(archived.status,200);assert(!archived.text.includes(saved.id));
 await save(command({action:'restore'}),'restore');assert.equal(saved.archived,false);assert.equal(saved.active,false);assert.equal(saved.price,14400);assert.equal(saved.installments,24);
 const restored=await http('/programs/'+program.slug,null,staff.cookie);assert.equal(restored.status,200);assert(restored.text.includes(saved.id));
 const admin=await http('/admin/programs/'+program.id);assert.equal(admin.status,200);assert(admin.text.includes(saved.id));
 await save(command({action:'archive'}),'final archive before maintenance cleanup');
 const audit=(await rows('activity_logs')).filter(a=>a.entity_id===saved.id);assert.equal(audit.length,6);
 for(const a of audit){assert.equal(a.actor_label,'مدير النظام');assert.equal(a.actor_user_id,null);assert.equal(a.branch_id,branch.id);assert.equal(a.metadata.legacy_actor.username,'admin');assert.equal(a.metadata.legacy_actor.name,'مدير النظام');assert.equal(a.metadata.legacy_actor.role,'super_admin');}
 report.audit=audit;report.finalVersion=saved.version;report.createRequestId=audit.find(a=>a.action==='create').metadata.legacy_actor.request_id;report.success=true;await integrity('final');
}catch(error){report.success=false;report.failure=forbidden.some(s=>String(error.message).includes(s))?'Redacted proof failure':String(error.message);process.exitCode=1;}
finally{
 const match=(await rows('program_offerings')).filter(o=>o.program_id===program.id&&o.branch_id===branch.id&&o.sort_order===report.sortOrder&&o.legacy_id===null);assert(match.length<=1);
 if(!report.offeringId)report.offeringId=match[0]?.id??null;
 if(!report.success&&match[0]&&cookie&&!match[0].archived_at){const o=match[0];report.failureArchiveStatus=(await http('/api/admin/offerings',{id:o.id,action:'archive',expectedVersion:o.version,offering:fields})).status;}
 report.finishedAt=new Date().toISOString();persist();console.log(JSON.stringify({success:report.success,offeringId:report.offeringId,steps:report.steps,failure:report.failure,requiresGuardedCleanup:!!report.offeringId}));
}
