// Opt-in production HTTP proof. Existing admin password arrives on stdin only.
// The branch is intentionally retained archived/inactive. No DELETE or audit cleanup.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
process.loadEnvFile('.env.local');
const base=process.env.BRANCH_TEST_URL||'http://127.0.0.1:3213';
assert.equal(process.env.ADMIN_DATA_SOURCE,'supabase');
const reportPath='scripts/branch-crud-proof-result.json';
assert(!existsSync(reportPath),'Existing proof report: reconcile it before running another proof; do not create another artifact.');
let input='';for await(const chunk of process.stdin)input+=chunk;
let {password}=JSON.parse(input);input='';assert.equal(typeof password,'string');assert(password.length>0);
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const hash=value=>createHash('sha256').update(value).digest('hex');
const manifestHash=()=>hash(readFileSync('migration/catalog-import-manifest.json'));
const initialManifest=manifestHash(),initialAdmins=hash(readFileSync('config/admins.json'));
const forbidden=[password,process.env.SUPABASE_SECRET_KEY,process.env.SUPABASE_SERVICE_ROLE_KEY,process.env.JWT_SECRET,'SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY'].filter(Boolean);
const tables=['programs','branches','program_offerings','curriculum_items','career_paths'];
async function rows(table){const {data,error}=await db.from(table).select('*').order('id');assert.equal(error,null,'Hosted SELECT '+table);return data;}
async function snapshot(){return Object.fromEntries(await Promise.all(tables.map(async t=>[t,await rows(t)])));}
const baseline=await snapshot();assert.deepEqual(tables.map(t=>baseline[t].length),[53,16,83,80,124]);
writeFileSync('scripts/branch-crud-proof-baseline.json',JSON.stringify(baseline,null,2)+'\n');
const report={startedAt:new Date().toISOString(),base,verificationName:'فرع اختبار CRUD - مؤقت - لا يستخدم',verificationCity:'مدينة اختبار غير تجارية '+randomUUID(),branchId:null,steps:[],baselineSHA256:Object.fromEntries(tables.map(t=>[t,hash(JSON.stringify(baseline[t]))])),manifestSHA256:initialManifest};
const persist=()=>writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
let cookie,saved;
async function http(path,body,session=cookie){
 const start=performance.now();
 const response=await fetch(base+path,{method:body?'POST':'GET',redirect:'manual',headers:{origin:base,...(body?{'content-type':'application/json'}:{}),...(session?{cookie:session}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
 const text=await response.text();assert(!forbidden.some(s=>text.includes(s)),'HTTP secret leak');
 return {status:response.status,text,cookie:response.headers.get('set-cookie')?.split(';')[0],ms:Math.round(performance.now()-start)};
}
const fields=()=>({name:report.verificationName,city:report.verificationCity,source_region_label:'منطقة اختبار غير تجارية',address:saved?.address||null,directory_listed:false,is_active:false});
const command=patch=>({action:'save',expectedVersion:saved?.version??0,...(saved?{id:saved.id}:{}),branch:fields(),...patch});
async function integrity(label){
 const current=await snapshot();
 for(const t of tables.filter(t=>t!=='branches'))assert.deepEqual(current[t],baseline[t],label+' '+t);
 const originals=current.branches.filter(b=>baseline.branches.some(old=>old.id===b.id));
 assert.deepEqual(originals,baseline.branches,label+' original branches');
 const added=current.branches.filter(b=>!baseline.branches.some(old=>old.id===b.id));
 assert.equal(added.length,saved?1:0,label+' only one new branch');
 if(saved)assert.equal(added[0].id,saved.id);
 assert.equal(manifestHash(),initialManifest);assert.equal(hash(readFileSync('config/admins.json')),initialAdmins);
 return current;
}
async function save(body,label){
 const response=await http('/api/admin/branches',body);assert.equal(response.status,200,label);
 saved=JSON.parse(response.text).branch;report.branchId=saved.id;persist();
 assert.match(saved.id,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
 assert.equal(saved.version,body.expectedVersion+1);assert.equal(saved.legacyKey,undefined);
 await integrity(label);report.steps.push({step:label,status:response.status,version:saved.version,ms:response.ms});persist();
}
async function fails(body,status,label,session=cookie){
 const before=await snapshot(),audit=await rows('activity_logs');
 const response=await http('/api/admin/branches',body,session);assert.equal(response.status,status,label);
 if(label==='stale version')assert(response.ms<5000,'stale conflict must return promptly');
 assert.deepEqual(await snapshot(),before,label+' no writes');assert.deepEqual(await rows('activity_logs'),audit,label+' no audit');
 report.steps.push({step:label,status:response.status,ms:response.ms});
}
try{
 await fails(command(),401,'anonymous denied',null);
 const staffRow=readFileSync('STAFF_CREDENTIALS.txt','utf8').split(/\r?\n/).find(l=>l.startsWith('bahaa |')).split('|').map(s=>s.trim());
 const staff=await http('/api/auth/login',{username:staffRow[0],password:staffRow[1]},null);assert.equal(staff.status,200);
 await fails(command(),403,'staff denied',staff.cookie);
 await fails(command({actor:{username:'admin'},role:'super_admin'}),403,'staff actor and role spoof denied',staff.cookie);
 const login=await http('/api/auth/login',{username:'admin',password},null);password=undefined;assert.equal(login.status,200,'real admin login');cookie=login.cookie;assert(cookie);
 report.steps.push({step:'real admin login',status:200});
 const staffBefore=await http('/programs',null,staff.cookie);assert.equal(staffBefore.status,200);
 persist(); // Record the exact unique test identity before the first possible committed write.
 await save(command(),'create');
 let current=await rows('branches');assert(current.some(b=>b.id===saved.id&&b.legacy_key===null));
 let admin=await http('/admin/branches/'+saved.id);assert.equal(admin.status,200);assert(admin.text.includes(report.verificationName));
 await save(command({branch:{...fields(),address:'بيانات تحقق محدثة؛ لا يستخدم للعمل'}}),'update metadata');
 await fails(command({expectedVersion:saved.version-1,branch:{...fields(),address:'stale forbidden'}}),409,'stale version');
 await fails(command({expectedVersion:undefined}),422,'missing version');
 await fails(command({actor:{username:'admin'}}),422,'actor spoof rejected');
 await fails(command({role:'super_admin'}),422,'role spoof rejected');
 await fails(command({branch:{...fields(),legacy_key:'forged'}}),422,'legacy identity injection');
 await fails(command({branch:{...fields(),name:''}}),422,'invalid input');
 await fails(command({id:undefined,expectedVersion:0}),409,'duplicate exact create');
 await fails(command({branch:{...fields(),name:baseline.branches[0].name,city:baseline.branches[0].city}}),409,'duplicate exact update');
 await save(command({action:'archive'}),'archive');assert.equal(saved.archived,true);assert.equal(saved.active,false);
 await save(command({action:'restore'}),'restore');assert.equal(saved.archived,false);assert.equal(saved.active,false);
 await save(command({action:'archive'}),'final retained archive');assert.equal(saved.archived,true);assert.equal(saved.active,false);
 current=await integrity('final retained state');assert.equal(current.branches.length,17);assert.equal(current.program_offerings.length,83);
 assert(!current.program_offerings.some(o=>o.branch_id===saved.id));
 const finalBranch=current.branches.find(b=>b.id===saved.id);assert(finalBranch.archived_at);assert.equal(finalBranch.is_active,false);assert.equal(finalBranch.legacy_key,null);
 const staffAfter=await http('/programs',null,staff.cookie);assert.equal(staffAfter.status,200);assert(!staffAfter.text.includes(saved.id));assert(!staffAfter.text.includes(report.verificationName));assert(!staffAfter.text.includes(report.verificationCity));
 admin=await http('/admin/branches/'+saved.id);assert.equal(admin.status,200);assert(admin.text.includes(report.verificationName));assert(admin.text.includes('استعادة الفرع'));
 const audit=(await rows('activity_logs')).filter(a=>a.entity_id===saved.id);assert.equal(audit.length,5);
 assert.deepEqual(audit.map(a=>a.action).sort(),['archive','archive','create','restore','update'].sort());
 for(const a of audit){assert.equal(a.actor_label,'مدير النظام');assert.equal(a.actor_user_id,null);assert.equal(a.branch_id,saved.id);assert.equal(a.metadata.legacy_actor.username,'admin');assert.equal(a.metadata.legacy_actor.name,'مدير النظام');assert.equal(a.metadata.legacy_actor.role,'super_admin');}
 report.audit=audit;report.finalBranch=finalBranch;report.finalCounts={branches:17,originalBusinessBranches:16,archivedVerificationBranches:1,offerings:83,linkedOfferings:0};
 report.finalOfferingSHA256=hash(JSON.stringify(current.program_offerings));report.originalBranchSHA256=hash(JSON.stringify(current.branches.filter(b=>b.id!==saved.id)));
 report.staffExcludesArtifact=true;report.adminCanManageArtifact=true;report.success=true;
}catch(error){report.success=false;report.failure=forbidden.some(s=>String(error.message).includes(s))?'Redacted proof failure':String(error.message);process.exitCode=1;}
finally{
 // Recover a committed identity if its HTTP response was lost. Never create a second branch.
 const matching=(await rows('branches')).filter(b=>b.name===report.verificationName&&b.city===report.verificationCity);
 assert(matching.length<=1);if(!report.branchId)report.branchId=matching[0]?.id??null;
 // On a failed proof, use the same authorized HTTP path to leave its one artifact safely archived.
 if(!report.success&&matching[0]&&cookie&&(!matching[0].archived_at||matching[0].is_active)){
  const b=matching[0];const final=await http('/api/admin/branches',{id:b.id,action:'archive',expectedVersion:b.version,branch:{name:b.name,city:b.city,source_region_label:b.source_region_label,address:b.address,directory_listed:b.directory_listed,is_active:false}});
  report.failureRetentionStatus=final.status;
 }
 report.finishedAt=new Date().toISOString();persist();console.log(JSON.stringify({success:report.success,branchId:report.branchId,steps:report.steps,finalCounts:report.finalCounts,failure:report.failure}));
}
