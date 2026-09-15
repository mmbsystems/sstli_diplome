import {expect,it} from 'vitest';
import {adminReducer,createSession} from '@/lib/admin/session';
import {createAdminSnapshot} from '@/lib/admin/adapter';
import {programs} from '@/data/programs';import {offerings} from '@/data/offerings';import {branches} from '@/data/branches';
it('a program metadata response cannot overwrite a more recent persisted offering or fabricate audit',()=>{
 const initial=createSession(createAdminSnapshot(programs,offerings,branches));const p=initial.programs.find(p=>p.id==='law')!;const o=p.offerings[0];
 const meta={actor:'مدير النظام',time:'2026-09-13T00:00:00Z',id:'event'};
 const updated=adminReducer(initial,{type:'persistedOffering',offering:{...o,price:12345,version:2},...meta});
 const result=adminReducer(updated,{type:'persistedProgram',program:{...p,name:'New name'},...meta});
 expect(result.programs.find(x=>x.id===p.id)?.offerings.find(x=>x.id===o.id)).toMatchObject({price:12345,version:2});
 expect(result.activity).toEqual([]);
});
