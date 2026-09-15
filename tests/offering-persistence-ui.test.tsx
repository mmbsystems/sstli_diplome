import React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import OfferingEditor from '@/components/admin/OfferingEditor';
import PricingTable from '@/components/admin/PricingTable';
import {AdminProvider} from '@/components/admin/AdminProvider';
import {createAdminSnapshot} from '@/lib/admin/adapter';
import {programs} from '@/data/programs';import {offerings} from '@/data/offerings';import {branches} from '@/data/branches';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
function setup(status=409){
 const data=createAdminSnapshot(programs,offerings,branches),p=data.programs.find(p=>p.id==='law')!,o=p.offerings[0];p.version=1;o.version=3;o.sortOrder=7;
 const fetcher=vi.fn().mockResolvedValue({ok:status===200,status,json:async()=>({offering:{...o,version:4,price:12000}})});vi.stubGlobal('fetch',fetcher);
 const onClose=vi.fn(),onChange=vi.fn();
 render(<AdminProvider initial={data} userName="مدير النظام" persistentPrograms><OfferingEditor program={p} initialOffering={o} dialogOnly onClose={onClose} onChange={onChange}/></AdminProvider>);
 return {fetcher,onClose,onChange};
}
it.each([409,422,500])('retains price edits on HTTP %i and sends only offering fields',async status=>{
 const {fetcher,onClose,onChange}=setup(status);
 fireEvent.change(screen.getByLabelText('السعر الأساسي (ر.س)'),{target:{value:'12000'}});
 fireEvent.change(screen.getByLabelText('عدد الأقساط'),{target:{value:'12'}});
 fireEvent.click(screen.getByRole('button',{name:'حفظ التغييرات'}));
 await screen.findByRole('alert');expect(screen.getByLabelText('السعر الأساسي (ر.س)')).toHaveValue(12000);expect(onClose).not.toHaveBeenCalled();expect(onChange).not.toHaveBeenCalled();
 const body=JSON.parse(fetcher.mock.calls[0][1].body);expect(body.expectedVersion).toBe(3);expect(body.offering.installment_months).toBe(12);expect(body.offering.sort_order).toBe(7);expect(body.actor).toBeUndefined();expect(body.offering.legacy_id).toBeUndefined();
});
it('accepts successful server save without fabricating an in-memory offering mutation',async()=>{const {fetcher,onChange,onClose}=setup(200);fireEvent.change(screen.getByLabelText('السعر الأساسي (ر.س)'),{target:{value:'12000'}});fireEvent.click(screen.getByRole('button',{name:'حفظ التغييرات'}));await waitFor(()=>expect(onClose).toHaveBeenCalled());expect(fetcher).toHaveBeenCalledTimes(1);expect(onChange).not.toHaveBeenCalled();});
it('pricing archive waits for the server and leaves the row available after conflict',async()=>{
 const data=createAdminSnapshot(programs,offerings,branches);data.programs.forEach(p=>p.offerings.forEach(o=>o.version=3));
 const fetcher=vi.fn().mockResolvedValue({ok:false,status:409});vi.stubGlobal('fetch',fetcher);
 render(<AdminProvider initial={data} userName="مدير النظام" persistentPrograms><PricingTable/></AdminProvider>);
 fireEvent.click(screen.getAllByRole('button',{name:'أرشفة'})[0]);fireEvent.click(screen.getByRole('button',{name:'أرشفة الخيار'}));
 await screen.findByRole('alert');expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({action:'archive',expectedVersion:3});
 expect(screen.getAllByRole('button',{name:'أرشفة'})).toHaveLength(10);
});
