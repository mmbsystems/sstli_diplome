// @vitest-environment node
import {readFileSync} from 'node:fs';
import {expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {mapHostedCatalog} from '@/lib/catalog/map-hosted';
import {calculateInstallment} from '@/lib/installments';
it('reads a new UUID offering outside the manifest, preserves 84/75 hours and calculates the actual saved terms',()=>{
 const rows=JSON.parse(readFileSync('migration/reports/phase-3d2-hosted-snapshot.json','utf8'));
 const p=rows.programs.find((p:any)=>p.legacy_id==='law');
 const added={...rows.program_offerings[0],id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',program_id:p.id,legacy_id:null,price:14400,min_down_payment:2400,installment_months:24,accredited_hours_override:75,version:2,is_active:false,archived_at:null,sort_order:999};rows.program_offerings.push(added);
 const mapped=mapHostedCatalog(rows);const offering=mapped.staff.offerings.find(o=>o.id===added.id)!;
 expect(mapped.staff.programs.find(p=>p.id==='law')?.accreditedHours).toBe(84);
 expect(offering).toMatchObject({price:14400,minDownPayment:2400,installments:24,accreditedHours:75});
 expect(calculateInstallment(offering.price!,offering.minDownPayment!,offering.minDownPayment!,offering.installments!)).toEqual({remainingAmount:12000,monthlyInstallment:500,error:null});
 expect(mapped.admin.programs.find(x=>x.id===p.id)?.offerings.find(o=>o.id===added.id)).toMatchObject({version:2,sortOrder:999});
 added.archived_at='2026-09-13T00:00:00Z';expect(mapHostedCatalog(rows).staff.offerings.some(o=>o.id===added.id)).toBe(false);
});
