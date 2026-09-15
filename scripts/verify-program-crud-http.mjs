// Opt-in production HTTP proof. Password arrives on stdin, never in files/logs.
// The operator MUST run the documented verification-only SQL cleanup afterward,
// including after a failed proof. IDs and results contain no credentials.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
process.loadEnvFile('.env.local');
let input='';for await(const chunk of process.stdin)input+=chunk;
let {password}=JSON.parse(input);input='';
const base=process.env.PROGRAM_TEST_URL||'http://127.0.0.1:3212';
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const slug='crud-verification-'+randomUUID();
const report={slug,steps:[],programId:null};
const manifestHash=()=>createHash('sha256').update(readFileSync('migration/catalog-import-manifest.json')).digest('hex');
const initialManifest=manifestHash();
const tables=['programs','branches','program_offerings','curriculum_items','career_paths'];
async function rows(table){const {data,error}=await db.from(table).select('*').order('id');assert.equal(error,null,'hosted read '+table);return data;}
async function snapshot(){return Object.fromEntries(await Promise.all(tables.map(async t=>[t,await rows(t)])));}
const baseline=await snapshot();
assert.deepEqual(tables.map(t=>baseline[t].length),[53,16,83,80,124]);
report.baselineHashes=Object.fromEntries(tables.map(t=>[t,createHash('sha256').update(JSON.stringify(baseline[t])).digest('hex')]));
const forbidden=[password,process.env.SUPABASE_SECRET_KEY,process.env.SUPABASE_SERVICE_ROLE_KEY,'SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY'].filter(Boolean);
let cookie;
async function http(path,body,session=cookie){
 const start=performance.now();
 const r=await fetch(base+path,{method:body?'POST':'GET',redirect:'manual',headers:{origin:base,...(body?{'content-type':'application/json'}:{}),...(session?{cookie:session}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
 const text=await r.text();assert(!forbidden.some(s=>text.includes(s)),'HTTP secret leak');
 return {status:r.status,text,cookie:r.headers.get('set-cookie')?.split(';')[0],ms:Math.round(performance.now()-start)};
}
async function scope(label){const current=await snapshot();for(const t of ['branches','program_offerings'])assert.deepEqual(current[t],baseline[t],label+' '+t);report.steps.push({step:label,scopeUnchanged:true});return current;}
let saved;let command={action:'save',expectedVersion:0,program:{name_ar:'برنامج اختبار CRUD - مؤقت',slug,program_type:'diploma',description:'Temporary HTTP proof',duration_display:'يوم',is_active:false,catalog_visibility:false},curriculum:[],careers:[]};
function next(patch={}){return {...command,id:saved.id,expectedVersion:saved.version,program:{...command.program},curriculum:saved.curriculumItems,careers:saved.careerItems,...patch};}
async function save(body,label){const r=await http('/api/admin/programs',body);assert.equal(r.status,200,label);saved=JSON.parse(r.text).program;command=body;assert.equal(saved.version,body.expectedVersion+1);await scope(label);return saved;}
async function fails(body,status,label,session=cookie){const before=await snapshot();const audit=await rows('activity_logs');const r=await http('/api/admin/programs',body,session);assert.equal(r.status,status,label);assert.deepEqual(await snapshot(),before,label+' rows');assert.deepEqual(await rows('activity_logs'),audit,label+' audit');await scope(label);report.steps.push({step:label,status:r.status,ms:r.ms});}
try{
 await fails(command,401,'anonymous denied',null);
 const staffRow=readFileSync('STAFF_CREDENTIALS.txt','utf8').split(/\r?\n/).find(l=>l.startsWith('bahaa |')).split('|').map(s=>s.trim());
 const staff=await http('/api/auth/login',{username:staffRow[0],password:staffRow[1]},null);assert.equal(staff.status,200);
 await fails({...command,role:'super_admin'},403,'staff spoof denied',staff.cookie);
 const login=await http('/api/auth/login',{username:'admin',password},null);password=undefined;assert.equal(login.status,200,'admin login');cookie=login.cookie;assert(cookie);
 await fails({...command,program:{...command.program,name_ar:''}},422,'invalid create');
 await save(command,'create');report.programId=saved.id;
 assert.match(saved.id,/^[0-9a-f-]{36}$/);assert.equal(saved.slug,slug);
 assert(!readFileSync('migration/catalog-import-manifest.json','utf8').includes(saved.id));
 const created=(await rows('programs')).find(p=>p.id===saved.id);assert.equal(created.legacy_id,null);
 let admin=await http('/admin/programs/'+saved.id);assert.equal(admin.status,200);assert(admin.text.includes(saved.name));
 let staffList=await http('/programs',null,staff.cookie);assert.equal(staffList.status,200);assert(staffList.text.includes(saved.name));
 await save(next({program:{...command.program,name_ar:'برنامج اختبار CRUD - محدث',description:'Updated hosted description'}}),'update');
 await fails(next({expectedVersion:saved.version-1,program:{...command.program,name_ar:'stale forbidden'}}),409,'stale version');
 await fails(next({expectedVersion:undefined}),422,'missing version');
 await fails(next({actor:{username:'admin'}}),422,'actor injection');
 await fails(next({program:{...command.program,legacy_id:'fake'}}),422,'column injection');
 await fails(next({program:{...command.program,publication_status:'published',description:''}}),422,'invalid publication');
 await fails(next({program:{...command.program,slug:baseline.programs[0].slug}}),409,'duplicate slug update');
 await fails({...command,id:undefined,expectedVersion:0},409,'duplicate slug create');
 await fails(next({id:randomUUID()}),404,'missing program');
 await save(next({curriculum:[{title:'A'},{title:'B'},{title:'C'}]}),'curriculum add');
 const c=saved.curriculumItems;
 await save(next({curriculum:[{...c[1],title:'B edited'},c[0],c[2]]}),'curriculum edit reorder');
 assert.deepEqual(saved.curriculumItems.map(x=>x.id),[c[1].id,c[0].id,c[2].id]);
 await save(next({careers:[{title:'X'},{title:'Y'},{title:'Z'}]}),'careers add');const k=saved.careerItems;
 await save(next({careers:[{...k[1],title:'Y edited'},k[0],k[2]]}),'careers edit reorder');
 assert.deepEqual(saved.careerItems.map(x=>x.id),[k[1].id,k[0].id,k[2].id]);
 await fails(next({curriculum:[{id:randomUUID(),title:'foreign'}]}),422,'nested rollback');
 await fails(next({careers:[{id:randomUUID(),title:'foreign'}],curriculum:[{title:'must rollback'}]}),422,'career rollback');
 await save(next({curriculum:saved.curriculumItems.slice(0,2),careers:saved.careerItems.slice(0,2)}),'child remove');
 const childIds=[...saved.curriculumItems,...saved.careerItems].map(x=>x.id);
 await save(next({action:'archive'}),'archive');assert.equal(saved.archived,true);assert.equal(saved.status,'inactive');assert.equal(saved.catalogVisible,false);
 staffList=await http('/programs',null,staff.cookie);assert.equal(staffList.status,200);assert(!staffList.text.includes(slug));assert(!staffList.text.includes(saved.name));
 admin=await http('/admin/programs/'+saved.id);assert.equal(admin.status,200);assert(admin.text.includes(saved.name));
 await save(next({action:'restore'}),'restore');assert.equal(saved.archived,false);assert.equal(saved.status,'inactive');assert.equal(saved.catalogVisible,false);assert.equal(saved.publication,'draft');
 assert.deepEqual([...saved.curriculumItems,...saved.careerItems].map(x=>x.id),childIds);
 const audit=(await rows('activity_logs')).filter(a=>a.entity_id===saved.id);
 for(const action of ['create','update','archive','restore'])assert(audit.some(a=>a.action===action));
 for(const a of audit){assert.equal(a.actor_label,'مدير النظام');assert.equal(a.metadata.legacy_actor.username,'admin');assert.equal(a.metadata.legacy_actor.role,'super_admin');assert.equal(a.actor_user_id,null);}
 report.auditIds=audit.map(a=>a.id);report.finalVersion=saved.version;report.manifestSHA256=manifestHash();assert.equal(report.manifestSHA256,initialManifest);report.success=true;
}catch(e){report.success=false;report.failure=e.message;process.exitCode=1;}
finally{
 // Recover identity even if an HTTP response was lost after a committed create.
 if(!report.programId)report.programId=(await rows('programs')).find(p=>p.slug===slug)?.id??null;
 writeFileSync('scripts/program-crud-proof-result.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
}
