// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
vi.mock('server-only',()=>({}));
const mocks=vi.hoisted(()=>({user:vi.fn(),admin:vi.fn(),client:vi.fn()}));
vi.mock('@/lib/auth',()=>({requireUser:mocks.user,requireAdmin:mocks.admin}));
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:mocks.client}));
import { createClient } from '@supabase/supabase-js';
import { loadStaffCatalog, loadAdminCatalog } from '@/lib/catalog/load';
import { mapHostedCatalog } from '@/lib/catalog/map-hosted';
import { programs } from '@/data/programs';
import { offerings } from '@/data/offerings';
import { filterPrograms, getAvailableCities } from '@/lib/filters';
const rows=JSON.parse(readFileSync('migration/reports/phase-3d2-hosted-snapshot.json','utf8'));
const normalize=(x:unknown)=>JSON.parse(JSON.stringify(x));
beforeEach(()=>{vi.stubEnv('ADMIN_DATA_SOURCE','supabase');mocks.user.mockResolvedValue({username:'staff',role:'staff'});mocks.admin.mockResolvedValue({username:'admin',role:'super_admin'});});
afterEach(()=>{vi.unstubAllEnvs();vi.resetAllMocks();});
function hosted(data=rows) {
  const calls:string[]=[];
  const client=createClient('https://example.supabase.co','sb_secret_test',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input,init)=>{
    expect(init?.method).toBe('GET');const url=new URL(String(input));const table=url.pathname.split('/').at(-1)!;calls.push(table);
    const list=data[table];return new Response(JSON.stringify(list),{headers:{'content-type':'application/json','content-range':`0-${Math.max(0,list.length-1)}/${list.length}`}});
  }}});
  vi.spyOn(client.auth,'getUser').mockRejectedValue(new Error('Supabase Auth must not be called'));
  mocks.client.mockReturnValue(client);return calls;
}
it('maps hosted rows to exact normalized static domain without changing DB control semantics',()=>{
  const mapped=mapHostedCatalog(rows);
  const normProgram=(p:typeof programs[number])=>({...p,searchableKeywords:p.searchableKeywords??[],curriculum:p.curriculum??[],careerPaths:p.careerPaths??[],contentPending:p.contentPending??false,classificationPending:p.classificationPending??false});
  expect(normalize(mapped.staff.programs.map(normProgram))).toEqual(normalize(programs.map(normProgram)));
  expect(normalize(mapped.staff.offerings)).toEqual(normalize(offerings));
  expect(mapped.admin.programs.every(p=>p.publication==='draft'&&!p.catalogVisible&&p.status==='inactive')).toBe(true);
});
it('preserves filters, hours, accounting, exact branches and NEBOSH through hosted mapping',()=>{
  const {staff}=mapHostedCatalog(rows);
  for(const category of [undefined,'diploma','qualifying-course','development-course'] as const) for(const studyMode of [undefined,'onsite','online'] as const) {
    expect(getAvailableCities(staff.offerings,category,studyMode,staff.programs)).toEqual(getAvailableCities(offerings,category,studyMode,programs));
    for(const city of [undefined,...new Set(offerings.map(o=>o.city))]) {
      const summary=(r:ReturnType<typeof filterPrograms>)=>r.map(x=>[x.program.id,x.offerings.map(o=>o.id)]);
      expect(summary(filterPrograms(staff.programs,staff.offerings,{category,studyMode,city}))).toEqual(summary(filterPrograms(programs,offerings,{category,studyMode,city})));
    }
  }
  expect(staff.offerings.filter(o=>o.programId==='accounting')).toHaveLength(0);
  expect(staff.programs.filter(p=>p.id.includes('nebosh'))).toHaveLength(2);
  expect(staff.branches.filter(b=>b.city==='الدمام')).toHaveLength(6);
  expect(staff.programs.find(p=>p.id==='law')?.accreditedHours).toBe(84);
  expect(staff.offerings.find(o=>o.id==='off-26')?.accreditedHours).toBe(75);
});
it('authorizes staff before constructing the privileged client and reads five batched tables',async()=>{
  const calls=hosted();const state=await loadStaffCatalog();expect(state.status).toBe('ready');expect(state.source).toBe('supabase');expect(calls.sort()).toEqual(['branches','career_paths','curriculum_items','program_offerings','programs']);expect(mocks.user.mock.invocationCallOrder[0]).toBeLessThan(mocks.client.mock.invocationCallOrder[0]);
});
it('authorizes admin before hosted admin reads',async()=>{hosted();expect((await loadAdminCatalog()).status).toBe('ready');expect(mocks.admin.mock.invocationCallOrder[0]).toBeLessThan(mocks.client.mock.invocationCallOrder[0]);});
it('denies anonymous staff reads and staff admin reads before database access',async()=>{
  mocks.user.mockRejectedValue(new Error('login redirect'));await expect(loadStaffCatalog()).rejects.toThrow('login redirect');
  mocks.admin.mockRejectedValue(new Error('staff denied'));await expect(loadAdminCatalog()).rejects.toThrow('staff denied');expect(mocks.client).not.toHaveBeenCalled();
});
it('supports explicit static mode with no hosted client',async()=>{vi.stubEnv('ADMIN_DATA_SOURCE','static');const state=await loadStaffCatalog();expect(state).toMatchObject({status:'ready',source:'static'});expect(mocks.client).not.toHaveBeenCalled();});
it('does not fall back on invalid source or hosted failure',async()=>{
  vi.stubEnv('ADMIN_DATA_SOURCE','wrong');expect(await loadStaffCatalog()).toMatchObject({status:'unavailable',reason:'configuration'});expect(mocks.client).not.toHaveBeenCalled();
  vi.stubEnv('ADMIN_DATA_SOURCE','supabase');mocks.client.mockImplementation(()=>{throw new Error('secret raw error')});expect(await loadStaffCatalog()).toMatchObject({status:'unavailable'});
});
it('handles an entirely empty database, rejects partial relationships and malformed rows',async()=>{
  hosted(Object.fromEntries(Object.keys(rows).map(k=>[k,[]])));expect(await loadStaffCatalog()).toMatchObject({status:'ready',catalog:{programs:[],offerings:[],branches:[]}});
  const broken=structuredClone(rows);broken.branches.pop();expect(()=>mapHostedCatalog(broken)).toThrow();
  const invalid=structuredClone(rows);invalid.programs[0].program_type='invalid';expect(()=>mapHostedCatalog(invalid)).toThrow();
});

it('reads new hosted identities and edited nested rows independently of the frozen manifest',()=>{
  const live=structuredClone(rows);const p={...live.programs[0],id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',legacy_id:null,slug:'new-hosted',name_ar:'برنامج جديد',version:2};live.programs.push(p);
  live.curriculum_items=live.curriculum_items.filter((c:any)=>c.program_id!==live.programs[0].id);
  live.curriculum_items.push({id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',program_id:p.id,title:'مقرر جديد',sort_order:0});
  const result=mapHostedCatalog(live);expect(result.staff.programs.find(p=>p.slug==='new-hosted')).toMatchObject({id:p.id,curriculum:['مقرر جديد']});expect(result.admin.programs.find(x=>x.id===p.id)).toMatchObject({version:2,curriculumItems:[{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',title:'مقرر جديد'}]});
});
it('retains admin branch version and historical key while excluding archived branch availability',()=>{
 const live=structuredClone(rows);const b=live.branches[0];b.archived_at='2026-09-13T00:00:00Z';
 const result=mapHostedCatalog(live);
 expect(result.admin.branches.find(x=>x.id===b.id)).toMatchObject({version:b.version,legacyKey:b.legacy_key,archived:true});
 expect(result.staff.offerings.some(o=>o.city===b.city&&o.branch===b.name)).toBe(false);
 expect(result.staff.branches.some(x=>x.id===b.legacy_key)).toBe(false);
});

it('accepts a new UUID branch outside the manifest and keeps archived verification data out of staff reads',()=>{
 const manifestBefore=readFileSync('migration/catalog-import-manifest.json');
 const live=structuredClone(rows);
 const id='abababab-abab-4bab-8bab-abababababab';
 live.branches.push({...live.branches[0],id,legacy_key:null,name:'فرع اختبار CRUD - مؤقت - لا يستخدم',city:'مدينة اختبار غير تجارية',source_region_label:'منطقة اختبار',directory_listed:false});
 const active=mapHostedCatalog(live);
 expect(active.admin.branches.find(b=>b.id===id)).toMatchObject({id,version:1});
 expect(active.staff.branches.find(b=>b.id===id)?.name).toBe('فرع اختبار CRUD - مؤقت - لا يستخدم');
 live.branches.at(-1).archived_at='2026-09-13T12:00:00Z';
 const retained=mapHostedCatalog(live);
 expect(retained.admin.branches).toHaveLength(17);
 expect(retained.admin.branches.find(b=>b.id===id)).toMatchObject({archived:true,active:false});
 expect(retained.staff).toEqual(mapHostedCatalog(rows).staff);
 expect(readFileSync('migration/catalog-import-manifest.json')).toEqual(manifestBefore);
});
