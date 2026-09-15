// Live D proof; existing admin credential is read from non-echoing stdin only.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createInterface} from 'node:readline';
import {randomUUID,createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import sharp from 'sharp';
process.loadEnvFile('.env.local');
if(process.stdin.isTTY)process.stdin.setRawMode(true);
const input=createInterface({input:process.stdin,terminal:false});let password;
for await(const line of input){password=JSON.parse(line).password;input.close();break;}
const base=process.env.PHASE_D_TEST_URL||'http://127.0.0.1:3217';
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const accounts=readFileSync('config/admins.json');const manifest=readFileSync('migration/catalog-import-manifest.json');
const forbidden=[password,process.env.AUTH_SECRET,process.env.SUPABASE_SECRET_KEY,process.env.SUPABASE_SERVICE_ROLE_KEY,...JSON.parse(accounts).map(a=>a.passwordHash)].filter(Boolean);
const tables=['programs','branches','program_offerings','curriculum_items','career_paths'];
async function rows(table){const r=await db.from(table).select('*').order('id');assert(!r.error,`read ${table}`);return r.data;}
async function snapshot(){return Object.fromEntries(await Promise.all(tables.map(async t=>[t,await rows(t)])));}
let cookie;let scanned=0;let step='baseline';const slug='image-verification-'+randomUUID();const report={slug,programId:null,success:false,steps:[]};
async function http(path,body,session=cookie,extra={}){const start=performance.now();const r=await fetch(base+path,{method:body?'POST':'GET',redirect:'manual',headers:{origin:base,...(session?{cookie:session}:{}),...(body&&!(body instanceof FormData)?{'content-type':'application/json'}:{}),...extra},...(body?{body:body instanceof FormData?body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(45000)});const bytes=Buffer.from(await r.arrayBuffer());const text=bytes.toString('utf8');scanned++;assert(!forbidden.some(s=>text.includes(s)),'response secret');return{status:r.status,text,bytes,mime:r.headers.get('content-type'),cache:r.headers.get('cache-control'),cookie:r.headers.get('set-cookie')?.split(';')[0],ms:Math.round(performance.now()-start)};}
const baseline=await snapshot();const auditBefore=await rows('activity_logs');assert.deepEqual(tables.map(t=>baseline[t].length),[53,17,83,80,124]);
let saved;const program={name_ar:'برنامج اختبار الصور - مؤقت',slug,program_type:'diploma',description:'Temporary private image proof',duration_display:'يوم',is_active:false,catalog_visibility:false};
async function save(patch={}){const body={action:'save',expectedVersion:saved?.version??0,...(saved?{id:saved.id}:{}),program:{...program,image_path:saved?.image??null},curriculum:saved?.curriculumItems??[],careers:saved?.careerItems??[],...patch};const r=await http('/api/admin/programs',body);assert.equal(r.status,200,step);saved=JSON.parse(r.text).program;report.programId=saved.id;return saved;}
function imageForm(file,version=saved.version){const f=new FormData();f.set('id',saved.id);f.set('expectedVersion',String(version));f.set('action',file?'upload':'remove');if(file)f.set('file',file);return f;}
async function objects(){const r=await db.storage.from('program-images').list(`programs/${saved.id}`,{limit:100});assert(!r.error);return r.data;}
async function deny(body,status,session=cookie){const before=await snapshot();const audit=await rows('activity_logs');const r=await http('/api/admin/program-images',body,session);assert.equal(r.status,status,step);assert.deepEqual(await snapshot(),before);assert.deepEqual(await rows('activity_logs'),audit);return r;}
try{
 step='admin login';const login=await http('/api/auth/login',{username:'admin',password},null);password=undefined;assert.equal(login.status,200);cookie=login.cookie;
 const staffRow=readFileSync('STAFF_CREDENTIALS.txt','utf8').split(/\r?\n/).find(l=>l.startsWith('bahaa |')).split('|').map(s=>s.trim());forbidden.push(staffRow[1]);const staff=await http('/api/auth/login',{username:staffRow[0],password:staffRow[1]},null);assert.equal(staff.status,200);
 step='create verification program';await save();writeFileSync('scripts/program-images-proof-result.json',JSON.stringify({...report,cleanupRequired:true},null,2));
 const png=await sharp({create:{width:8,height:8,channels:3,background:'red'}}).png().toBuffer();const file=new File([png],'ignored-name.png',{type:'image/png'});
 step='anonymous upload denied';await deny(imageForm(file),401,null);step='staff upload denied';await deny(imageForm(file),403,staff.cookie);
 step='invalid content';await deny(imageForm(new File(['<html>bad</html>'],'fake.png',{type:'image/png'})),422);
 step='upload';let r=await http('/api/admin/program-images',imageForm(file));assert.equal(r.status,200);let image=JSON.parse(r.text).image;saved={...saved,...image};const first=saved.image;assert.equal(saved.version,2);assert.equal((await objects()).length,1);report.steps.push('upload');
 step='private image read';for(const session of [cookie,staff.cookie]){r=await http(first,null,session);assert.equal(r.status,200);assert.equal(r.mime,'image/png');assert(r.cache.includes('no-store'));assert.equal((await sharp(r.bytes).metadata()).width,8);}assert.equal((await http(first,null,null)).status,307);report.steps.push('admin/staff read; anonymous denied');
 const anon=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false}});const key=first.replace('/api/program-images/','programs/');assert((await anon.storage.from('program-images').download(key)).error);
 const publicUrl=db.storage.from('program-images').getPublicUrl(key).data.publicUrl;assert.notEqual((await fetch(publicUrl)).status,200);report.steps.push('direct anonymous/private and public-URL reads denied');
 step='stale';r=await deny(imageForm(file,1),409);assert(r.ms<10000);report.staleMs=r.ms;assert.equal((await objects()).length,1);
 step='generic path bypass';const audit=await rows('activity_logs');r=await http('/api/admin/programs',{id:saved.id,expectedVersion:saved.version,action:'save',program:{...program,image_path:null},curriculum:[],careers:[]});assert.equal(r.status,422);assert.deepEqual(await rows('activity_logs'),audit);
 step='replace';r=await http('/api/admin/program-images',imageForm(file));assert.equal(r.status,200);image=JSON.parse(r.text).image;saved={...saved,...image};assert.notEqual(saved.image,first);assert.equal((await objects()).length,1);assert.equal((await http(first)).status,404);report.steps.push('replace; previous object removed');
 step='remove';const second=saved.image;r=await http('/api/admin/program-images',imageForm());assert.equal(r.status,200);saved={...saved,...JSON.parse(r.text).image};assert.equal((await objects()).length,0);assert.equal((await http(second)).status,404);report.steps.push('remove; zero program Storage objects');
 // Fresh positive nested/program regression on this same isolated, temporary row.
 step='curriculum/career add';await save({curriculum:[{title:'A'},{title:'B'},{title:'C'}],careers:[{title:'X'},{title:'Y'},{title:'Z'}]});const c=saved.curriculumItems,k=saved.careerItems;
 step='nested edit reorder';await save({curriculum:[{...c[1],title:'B edited'},c[0],c[2]],careers:[{...k[1],title:'Y edited'},k[0],k[2]]});assert.equal(saved.curriculumItems[0].id,c[1].id);assert.equal(saved.careerItems[0].id,k[1].id);
 step='nested remove';await save({curriculum:saved.curriculumItems.slice(0,2),careers:saved.careerItems.slice(0,2)});
 step='archive';await save({action:'archive'});assert(saved.archived);assert(!(await http('/programs',null,staff.cookie)).text.includes(slug));
 step='restore';await save({action:'restore'});assert(!saved.archived);assert((await http('/programs',null,staff.cookie)).text.includes(slug));
 step='final archive';await save({action:'archive'});report.steps.push('program create/update/archive/restore and nested add/edit/remove/reorder');
 const current=await snapshot();for(const t of tables){const original=current[t].filter(r=>baseline[t].some(b=>b.id===r.id));assert.deepEqual(original,baseline[t]);}
 const auditNow=await rows('activity_logs');for(const old of auditBefore)assert.deepEqual(auditNow.find(r=>r.id===old.id),old);
 for(const a of auditNow.filter(a=>a.entity_id===saved.id)){assert.equal(a.metadata.legacy_actor.username,'admin');assert.equal(a.metadata.legacy_actor.role,'super_admin');assert(a.metadata.legacy_actor.request_id);}
 assert(accounts.equals(readFileSync('config/admins.json')));assert(manifest.equals(readFileSync('migration/catalog-import-manifest.json')));
 report.success=true;report.finalVersion=saved.version;report.storageObjects=0;report.originalRowsUnchanged=true;report.auditBefore=auditBefore.length;report.auditAfter=auditNow.length;report.responsesScanned=scanned;report.secretHits=0;report.cleanupRequired=true;
}catch{report.failedStep=step;process.exitCode=1;}
finally{password=undefined;forbidden.fill('');if(!report.programId)report.programId=(await rows('programs')).find(p=>p.slug===slug)?.id??null;writeFileSync('scripts/program-images-proof-result.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}