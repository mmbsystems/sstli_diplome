// @vitest-environment node
import {expect,it,vi,beforeEach} from 'vitest';
import {NextRequest} from 'next/server';
vi.mock('server-only',()=>({}));
const m=vi.hoisted(()=>({auth:vi.fn(),rpc:vi.fn()}));
vi.mock('@/lib/auth',async()=>({...await vi.importActual('@/lib/auth'),requireAdmin:m.auth}));
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:()=>({rpc:m.rpc})}));
import {AdminAuthorizationError} from '@/lib/auth';
import {POST} from '@/app/api/admin/branches/route';
const body={action:'save',expectedVersion:0,branch:{name:'فرع جديد',city:'الدمام',source_region_label:null,address:null,directory_listed:false,is_active:false}};
const request=(b:unknown=body,origin='http://localhost')=>new NextRequest('http://localhost/api/admin/branches',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(b)});
beforeEach(()=>{vi.stubEnv('ADMIN_DATA_SOURCE','supabase');m.auth.mockReset().mockResolvedValue({username:'admin',name:'مدير النظام',role:'super_admin'});m.rpc.mockReset();});
it('denies anonymous, staff and cross-origin before RPC',async()=>{
 for(const reason of ['unauthenticated','unauthorized'] as const){m.auth.mockRejectedValue(new AdminAuthorizationError(reason));expect((await POST(request())).status).toBe(reason==='unauthenticated'?401:403);}
 expect((await POST(request(body,'https://evil.test'))).status).toBe(403);expect(m.rpc).not.toHaveBeenCalled();
});
it('rejects identities, versions, actor and arbitrary fields',async()=>{
 for(const patch of [{actor:'fake'},{expectedVersion:undefined},{id:'bad'},{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',expectedVersion:0},{branch:{...body.branch,legacy_key:'new::key'}},{branch:{...body.branch,name:''}},{branch:{...body.branch,is_active:null}},{branch:{...body.branch,address:12}},{branch:{...body.branch,source_region_label:[]}},{expectedVersion:Number.MAX_SAFE_INTEGER}])expect((await POST(request({...body,...patch}))).status).toBe(422);
 expect(m.rpc).not.toHaveBeenCalled();
});
it.each([['PT409',409,'conflict'],['P0002',404,'not_found'],['22023',422,'validation'],['P0001',500,'database']])('controls %s without SQL detail',async(code,status,reason)=>{
 m.rpc.mockReturnValue({abortSignal:()=>Promise.resolve({error:{code,message:'raw database secret'}})});
 const r=await POST(request());expect(r.status).toBe(status);expect(await r.json()).toEqual({error:reason});
 expect(m.rpc.mock.calls[0][1]).toMatchObject({p_actor_username:'admin',p_actor_name:'مدير النظام',p_expected_version:0});
});
it('returns canonical UUID/version and immutable imported key',async()=>{
 m.rpc.mockReturnValue({abortSignal:()=>Promise.resolve({error:null,data:{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',version:1,name:'فرع جديد',city:'الدمام',legacy_key:null,source_region_label:null,address:null,is_active:false,directory_listed:false,archived_at:null,updated_at:'2026-09-13T00:00:00Z'}})});
 const r=await POST(request());expect(r.status).toBe(200);const saved=(await r.json()).branch;expect(saved).toMatchObject({id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',version:1,archived:false});expect(saved.legacyKey).toBeUndefined();
});
