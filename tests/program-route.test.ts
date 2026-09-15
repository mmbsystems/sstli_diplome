// @vitest-environment node
import {expect,it,vi,beforeEach} from 'vitest';
import {NextRequest} from 'next/server';
vi.mock('server-only',()=>({}));
const m=vi.hoisted(()=>({auth:vi.fn(),rpc:vi.fn()}));
vi.mock('@/lib/auth',async()=>({...await vi.importActual('@/lib/auth'),requireAdmin:m.auth}));
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:()=>({rpc:m.rpc})}));
import {AdminAuthorizationError} from '@/lib/auth';
import {POST} from '@/app/api/admin/programs/route';
const body={action:'save',expectedVersion:0,program:{name_ar:'برنامج',slug:'test',program_type:'diploma'},curriculum:[],careers:[]};
const request=(b:unknown=body,origin='http://localhost')=>new NextRequest('http://localhost/api/admin/programs',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(b)});
beforeEach(()=>{vi.stubEnv('ADMIN_DATA_SOURCE','supabase');m.auth.mockReset().mockResolvedValue({username:'admin',name:'مدير النظام',role:'super_admin'});m.rpc.mockReset();});
it('denies anonymous and staff before invoking mutations',async()=>{for(const reason of ['unauthenticated','unauthorized'] as const){m.auth.mockRejectedValue(new AdminAuthorizationError(reason));expect((await POST(request())).status).toBe(reason==='unauthenticated'?401:403);}expect(m.rpc).not.toHaveBeenCalled();});
it('rejects cross-origin, actor fields, version bypass and unknown columns',async()=>{expect((await POST(request(body,'https://evil.test'))).status).toBe(403);for(const b of [{...body,actor:'fake'},{...body,expectedVersion:undefined},{...body,program:{...body.program,created_at:'fake'}}])expect((await POST(request(b))).status).toBe(422);expect(m.rpc).not.toHaveBeenCalled();});
it('maps PT409 promptly without leaking raw errors and derives actor server-side',async()=>{m.rpc.mockReturnValue({abortSignal:()=>Promise.resolve({data:null,error:{code:'PT409',message:'raw secret'}})});const r=await POST(request());expect(r.status).toBe(409);expect(await r.json()).toEqual({error:'conflict'});expect(m.rpc.mock.calls[0][1]).toMatchObject({p_actor_username:'admin',p_actor_name:'مدير النظام',p_expected_version:0});});
