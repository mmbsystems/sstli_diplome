// Read-only production HTTP proof. Admin password comes from stdin; never saved.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const base=process.env.CATALOG_TEST_URL||'http://127.0.0.1:3211';
let input='';for await(const chunk of process.stdin)input+=chunk;
let {password}=JSON.parse(input);input='';
const env=readFileSync('.env.local','utf8').split(/\r?\n/).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).replace(/^['"]|['"]$/g,'')]);
const forbidden=['SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY',password,...env.filter(([k])=>/SUPABASE_(SECRET|SERVICE_ROLE)_KEY/.test(k)).map(x=>x[1])];
let scanned=0;
async function request(path,cookie,body,extra={}) {
  const r=await fetch(base+path,{method:body?'POST':'GET',redirect:'manual',headers:{origin:base,...(cookie?{cookie}:{}),...(body?{'content-type':'application/json'}:{}),...extra},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
  const text=await r.text();scanned++;
  assert(!forbidden.some(x=>x&&text.includes(x)),'Secret in HTTP response');
  return {status:r.status,text,cookie:r.headers.get('set-cookie')?.split(';')[0],location:r.headers.get('location'),cache:r.headers.get('cache-control')};
}
assert.equal((await request('/login')).status,200);
for(const path of ['/programs','/programs/law','/admin']) {const r=await request(path);assert.equal(r.status,307);assert(r.location.includes('/login'));}
const row=readFileSync('STAFF_CREDENTIALS.txt','utf8').split(/\r?\n/).find(l=>l.startsWith('bahaa |')).split('|').map(s=>s.trim());
const staff=await request('/api/auth/login',null,{username:row[0],password:row[1]});assert.equal(staff.status,200);
const denied=await request('/admin',staff.cookie);assert.equal(denied.status,307);assert(denied.location.includes('/programs'));
const list=await request('/programs',staff.cookie);assert.equal(list.status,200);assert(list.text.includes('استكشف برامجنا التدريبية'));assert(list.text.includes('off-26'));assert(list.cache.includes('private')&&list.cache.includes('no-store'));
const law=await request('/programs/law?mode=online&city='+encodeURIComponent('الدمام'),staff.cookie);assert.equal(law.status,200);assert(law.text.includes('دبلوم القانون'));assert(law.text.includes('75'));assert(law.text.includes('7999'));
const accounting=await request('/programs/accounting',staff.cookie);assert.equal(accounting.status,200);assert(accounting.text.includes('لا يتوفر هذا البرنامج حاليًا'));
const rsc=await request('/programs',staff.cookie,null,{RSC:'1'});assert.equal(rsc.status,200);
const admin=await request('/api/auth/login',null,{username:'admin',password});password=undefined;assert.equal(admin.status,200);
const adminList=await request('/programs',admin.cookie);assert.equal(adminList.status,200);assert(adminList.text.includes('off-26'));
const dashboard=await request('/admin',admin.cookie);assert.equal(dashboard.status,200);
if(process.env.EXPECTED_CATALOG_SOURCE==='supabase')assert(dashboard.text.includes('مصدر الكتالوج: Supabase'));
else if(process.env.EXPECTED_CATALOG_SOURCE==='static')assert(!dashboard.text.includes('مصدر الكتالوج: Supabase'));
console.log(JSON.stringify({source:process.env.EXPECTED_CATALOG_SOURCE,anonymous:'login 200; protected routes 307',staff:'login/list/detail/accounting/RSC 200; admin 307',admin:'login/catalog/dashboard 200',privateNoStore:true,responsesScanned:scanned,secretHits:0}));
