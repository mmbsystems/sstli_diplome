// @vitest-environment node
// Opt-in real hosted SELECT verification; never writes or logs secrets.
import { expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
vi.mock('server-only',()=>({}));
vi.mock('@/lib/auth',()=>({requireUser:async()=>({username:'verification',role:'staff'}),requireAdmin:async()=>({username:'verification',role:'super_admin'})}));
import { loadStaffCatalog, loadAdminCatalog } from '@/lib/catalog/load';
import type { Program } from '@/types/program';

it.skipIf(process.env.SSTLI_LIVE_READ_PARITY!=='true')('reads actual hosted rows and deeply matches the static repository',async()=>{
  process.loadEnvFile('.env.local');
  const before=process.env.ADMIN_DATA_SOURCE;
  try {
    process.env.ADMIN_DATA_SOURCE='static';const reference=await loadStaffCatalog();
    process.env.ADMIN_DATA_SOURCE='supabase';const hosted=await loadStaffCatalog();const admin=await loadAdminCatalog();
    expect(reference.status).toBe('ready');expect(hosted.status).toBe('ready');expect(admin.status).toBe('ready');
    if(reference.status!=='ready'||hosted.status!=='ready'||admin.status!=='ready')throw new Error('Read failed');
    const p=(p:Program)=>({...p,searchableKeywords:p.searchableKeywords??[],curriculum:p.curriculum??[],careerPaths:p.careerPaths??[],contentPending:p.contentPending??false,classificationPending:p.classificationPending??false});
    const normalize=(x:unknown)=>JSON.parse(JSON.stringify(x));
    expect(normalize(hosted.catalog.programs.map(p))).toEqual(normalize(reference.catalog.programs.map(p)));
    expect(normalize(hosted.catalog.offerings)).toEqual(normalize(reference.catalog.offerings));
    expect(hosted.catalog.branches).toEqual(reference.catalog.branches);
    expect(admin.snapshot.programs).toHaveLength(53);
    const manifest=JSON.parse(readFileSync('migration/catalog-import-manifest.json','utf8'));
    const originalIds=new Set(manifest.branches.map((b:{uuid:string})=>b.uuid));
    expect(admin.snapshot.branches.filter(b=>originalIds.has(b.id))).toHaveLength(16);
    const artifacts=admin.snapshot.branches.filter(b=>!originalIds.has(b.id));
    if(artifacts.length){
      const proof=JSON.parse(readFileSync('scripts/branch-crud-proof-result.json','utf8'));
      expect(proof.success).toBe(true);expect(artifacts).toHaveLength(1);
      expect(artifacts[0]).toMatchObject({id:proof.branchId,archived:true,active:false,name:proof.verificationName,city:proof.verificationCity});
      expect(admin.snapshot.programs.flatMap(p=>p.offerings).some(o=>o.branchId===proof.branchId)).toBe(false);
      expect(admin.snapshot.branches).toHaveLength(17);
    }else expect(admin.snapshot.branches).toHaveLength(16);
    expect(hosted.source).toBe('supabase');
  } finally { if(before===undefined)delete process.env.ADMIN_DATA_SOURCE;else process.env.ADMIN_DATA_SOURCE=before; }
},45000);
