// @vitest-environment node
import {beforeEach,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
vi.mock('server-only',()=>({}));
const m=vi.hoisted(()=>({auth:vi.fn(),rpc:vi.fn()}));
vi.mock('@/lib/auth',async()=>({...await vi.importActual('@/lib/auth'),requireAdmin:m.auth}));
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:()=>({rpc:m.rpc})}));
import {AdminAuthorizationError} from '@/lib/auth';
import {POST} from '@/app/api/admin/offerings/route';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',branchId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const body={action:'save',expectedVersion:0,offering:{program_id:id,branch_id:branchId,study_mode:'onsite',gender:'both',price:12000,min_down_payment:2400,installment_months:12,accredited_hours_override:75,registration_state:'unknown',is_active:false,sort_order:0}};
const request=(value:unknown=body)=>new NextRequest('http://localhost/api/admin/offerings',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json'},body:JSON.stringify(value)});
beforeEach(()=>{vi.stubEnv('ADMIN_DATA_SOURCE','supabase');m.auth.mockReset().mockResolvedValue({username:'admin',name:'مدير النظام',role:'super_admin'});m.rpc.mockReset();});
it('denies anonymous and staff before touching the database',async()=>{for(const reason of ['unauthenticated','unauthorized'] as const){m.auth.mockRejectedValue(new AdminAuthorizationError(reason));expect((await POST(request())).status).toBe(reason==='unauthenticated'?401:403);}expect(m.rpc).not.toHaveBeenCalled();});
it.each([{actor:'fake'},{role:'super_admin'},{expectedVersion:undefined},{id,expectedVersion:0},{expectedVersion:-1},{offering:{...body.offering,legacy_id:'off-new'}},{offering:{...body.offering,price:-1}},{offering:{...body.offering,price:1.001}},{offering:{...body.offering,price:1.000000001}},{offering:{...body.offering,price:1e10}},{offering:{...body.offering,min_down_payment:12001}},{offering:{...body.offering,installment_months:0}},{offering:{...body.offering,installment_months:2.5}},{offering:{...body.offering,accredited_hours_override:0}},{offering:{...body.offering,sort_order:-1}},{offering:{...body.offering,branch_id:'bad'}},{offering:{...body.offering,is_active:null}},{offering:{...body.offering,gender:'invalid'}}])('rejects invalid/unsafe fields without writes: %j',async patch=>{expect((await POST(request({...body,...patch}))).status).toBe(422);expect(m.rpc).not.toHaveBeenCalled();});
it.each([['PT409',409,'conflict'],['P0002',404,'not_found'],['22023',422,'validation'],['P0001',500,'database']])('controls %s and never exposes SQL',async(code,status,reason)=>{m.rpc.mockReturnValue({abortSignal:()=>Promise.resolve({data:null,error:{code,message:'raw SQL secret'}})});const r=await POST(request());expect(r.status).toBe(status);expect(await r.json()).toEqual({error:reason});expect(m.rpc.mock.calls[0][1]).toMatchObject({p_actor_username:'admin',p_actor_name:'مدير النظام',p_expected_version:0});});
it('returns the canonical UUID/version, price, hours override and imported identity',async()=>{
 const offering={...body.offering,id,legacy_id:'off-26',version:2,archived_at:null,updated_at:'2026-09-13T00:00:00Z'};
 m.rpc.mockReturnValue({abortSignal:()=>Promise.resolve({error:null,data:{offering,program:{id,program_type:'diploma'},branch:{id:branchId,name:'سكوير',city:'الدمام',is_active:false,directory_listed:false,address:null,updated_at:'2026-09-13T00:00:00Z'}}})});
 const r=await POST(request({...body,id,expectedVersion:1}));expect(r.status).toBe(200);expect((await r.json()).offering).toMatchObject({id,version:2,legacyId:'off-26',price:12000,minDownPayment:2400,installments:12,accreditedHours:75,sortOrder:0});
});
