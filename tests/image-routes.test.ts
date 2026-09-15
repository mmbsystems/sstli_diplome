// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only',()=>({}));
const state=vi.hoisted(()=>({role:'super_admin',archived:false,path:'',calls:0,conflict:false,downloads:0}));
vi.mock('@/lib/auth',()=>({AdminAuthorizationError:class extends Error{constructor(public reason:string){super(reason);}},requireAdmin:async()=>{if(state.role!=='super_admin'){const {AdminAuthorizationError}=await import('@/lib/auth');throw new AdminAuthorizationError(state.role==='anonymous'?'unauthenticated':'unauthorized');}},currentUser:async()=>state.role==='anonymous'?null:{role:state.role}}));
vi.mock('@/lib/admin/images/command',()=>({runImageCommand:async()=>{state.calls++;if(state.conflict){const {MutationError}=await import('@/lib/admin/mutations/errors');throw new MutationError('conflict');}return {version:2};}}));
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:()=>({from:()=>({select:()=>({eq:()=>({abortSignal:()=>({single:async()=>({error:null,data:{image_path:state.path,archived_at:state.archived?'date':null}})})})})}),storage:{from:()=>({download:async()=>{state.downloads++;return {error:null,data:new Blob(['image'],{type:'image/png'})};}})}})}));
import { POST } from '@/app/api/admin/program-images/route';
import { GET } from '@/app/api/program-images/[id]/[name]/route';
const id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';const name='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png';
beforeEach(()=>{state.role='super_admin';state.calls=0;state.downloads=0;state.conflict=false;state.archived=false;state.path=`/api/program-images/${id}/${name}`;vi.stubEnv('ADMIN_DATA_SOURCE','supabase');});
function form(){const f=new FormData();f.set('id',id);f.set('expectedVersion','1');f.set('action','remove');return f;}
it('rejects cross origin, role injection, duplicates and excessive body before command',async()=>{
 for(const kind of ['origin','role','duplicate','size']){const f=form();if(kind==='role')f.set('role','super_admin');if(kind==='duplicate')f.append('id',id);const r=await POST(new NextRequest('http://localhost/api/admin/program-images',{method:'POST',headers:{origin:kind==='origin'?'http://evil.test':'http://localhost',...(kind==='size'?{'content-length':'99999999'}:{})},body:f}));expect([403,422]).toContain(r.status);}
 expect(state.calls).toBe(0);
});
it('parses valid bounded multipart and rejects non-multipart',async()=>{expect((await POST(new NextRequest('http://localhost/api/admin/program-images',{method:'POST',headers:{origin:'http://localhost'},body:form()}))).status).toBe(200);expect(state.calls).toBe(1);expect((await POST(new NextRequest('http://localhost/api/admin/program-images',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json'},body:'{}'}))).status).toBe(422);});
it('requires a current session and exact active reference for private image reads',async()=>{
 const request=new NextRequest('http://localhost'+state.path);const context={params:Promise.resolve({id,name})};
 state.role='anonymous';expect((await GET(request,context)).status).toBe(401);
 state.role='staff';let r=await GET(request,context);expect(r.status).toBe(200);expect(r.headers.get('cache-control')).toContain('no-store');
 state.archived=true;expect((await GET(request,context)).status).toBe(404);
 state.role='super_admin';expect((await GET(request,context)).status).toBe(200);
 state.path='/images/old.jpg';expect((await GET(request,context)).status).toBe(404);
});

it('denies an authenticated unsupported role on reads',async()=>{state.role='viewer';expect((await GET(new NextRequest('http://localhost'+state.path),{params:Promise.resolve({id,name})})).status).toBe(403);});

it.each([['anonymous',401],['staff',403]])('denies %s writes before processing the command',async(role,status)=>{state.role=String(role);const r=await POST(new NextRequest('http://localhost/api/admin/program-images',{method:'POST',headers:{origin:'http://localhost'},body:form()}));expect(r.status).toBe(status);expect(state.calls).toBe(0);});
it('returns 409 for stale image updates',async()=>{state.conflict=true;const r=await POST(new NextRequest('http://localhost/api/admin/program-images',{method:'POST',headers:{origin:'http://localhost'},body:form()}));expect(r.status).toBe(409);expect(await r.json()).toEqual({error:'conflict'});});
it('rejects malformed multipart and cross-site browser requests',async()=>{for(const headers of [{'content-type':'multipart/form-data; boundary=missing'}, {'sec-fetch-site':'cross-site'}]){const r=await POST(new NextRequest('http://localhost/api/admin/program-images',{method:'POST',headers:{origin:'http://localhost',...headers},body:'bad'}));expect([403,422]).toContain(r.status);}expect(state.calls).toBe(0);});
it('enforces the body limit even without content-length',async()=>{const r=await POST(new NextRequest('http://localhost/api/admin/program-images',{method:'POST',headers:{origin:'http://localhost','content-type':'multipart/form-data; boundary=x'},body:new Uint8Array(5*1024*1024+16385)}));expect(r.status).toBe(422);expect(state.calls).toBe(0);});
it.each(['../other.png','%2e%2e%2fother.png',name+'?download=1',name+'/extra'])('rejects injected image name %s without downloading',async injected=>{const r=await GET(new NextRequest('http://localhost/'),{params:Promise.resolve({id,name:injected})});expect(r.status).toBe(404);expect(state.downloads).toBe(0);});
it('does not download a stale or foreign reference',async()=>{state.path='/api/program-images/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/'+name;const r=await GET(new NextRequest('http://localhost/'),{params:Promise.resolve({id,name})});expect(r.status).toBe(404);expect(state.downloads).toBe(0);});
