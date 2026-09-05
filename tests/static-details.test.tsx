import React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ProgramDetails from '@/components/program-details/ProgramDetails';
import {programs} from '@/data/programs';
import {offerings} from '@/data/offerings';
vi.mock('next/navigation',()=>({useSearchParams:()=>new URLSearchParams('mode=online&city='+encodeURIComponent('الدمام'))}));
afterEach(cleanup);
it('selects the requested online offering from the browser URL on a static page',()=>{
 const program=programs.find(p=>p.id==='law')!;
 render(<ProgramDetails program={program} available={offerings.filter(o=>o.programId===program.id&&o.active)}/>);
 const selected=screen.getByLabelText('الفرع وطريقة الدراسة') as HTMLSelectElement;
 expect(selected.selectedOptions[0].textContent).toContain('عن بُعد');
 expect(selected.selectedOptions[0].textContent).toContain('الدمام');
});
