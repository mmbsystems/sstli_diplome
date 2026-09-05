import React from 'react';
import {programs} from '@/data/programs';
import {offerings} from '@/data/offerings';
import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ProgramExplorer from '@/components/programs/ProgramExplorer';
// Next.js subscribes useSearchParams to native history updates; reproduce that boundary in jsdom.
vi.mock('next/navigation',()=>({useSearchParams:()=>{
 const query=React.useSyncExternalStore(callback=>{window.addEventListener('popstate',callback);return ()=>window.removeEventListener('popstate',callback)},()=>window.location.search);
 return React.useMemo(()=>new URLSearchParams(query),[query]);
}}));
beforeEach(()=>{
 const replace=window.history.replaceState.bind(window.history);
 vi.spyOn(window.history,'replaceState').mockImplementation((...args)=>{replace(...args);window.dispatchEvent(new PopStateEvent('popstate'))});
});
afterEach(()=>{cleanup();vi.restoreAllMocks();window.history.replaceState(null,'','/programs')});
describe('explorer interaction',()=>{
 it('searches instantly, supports keyboard suggestions, and clears empty results',()=>{
 render(<ProgramExplorer programs={programs} offerings={offerings}/>);
 const input=screen.getByRole('combobox');
 fireEvent.change(input,{target:{value:'HR'}});
 expect(screen.getAllByRole('option').length).toBeLessThanOrEqual(5);
 fireEvent.keyDown(input,{key:'ArrowDown'});
 expect(input).toHaveAttribute('aria-activedescendant');
 fireEvent.keyDown(input,{key:'Enter'});
 expect(input).toHaveValue('دبلوم إدارة الموارد البشرية');
 fireEvent.change(input,{target:{value:'zzzzzz'}});
 expect(screen.getByText('لا توجد برامج مطابقة لبحثك')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'مسح الفلاتر'}));
 expect(input).toHaveValue('');
 expect(screen.queryByText('لا توجد برامج مطابقة لبحثك')).not.toBeInTheDocument();
 });
 it('opens accessible advanced filters and combines city, mode and category',()=>{
 render(<ProgramExplorer programs={programs} offerings={offerings}/>);
 fireEvent.click(screen.getByRole('button',{name:/الفلاتر/}));
 expect(screen.getByRole('dialog')).toBeInTheDocument();
 fireEvent.change(screen.getByRole('combobox',{name:'نوع البرنامج'}),{target:{value:'diploma'}});
 fireEvent.change(screen.getByLabelText('طريقة الدراسة'),{target:{value:'onsite'}});
 fireEvent.change(screen.getByLabelText('المنطقة / المدينة'),{target:{value:'حفر الباطن'}});
 expect(screen.getByText('تم العثور على 2 برنامج')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:/عرض النتائج/}));
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
 expect(screen.getAllByRole('link',{name:'عرض التفاصيل'})[0]).toHaveAttribute('href',expect.stringContaining('mode=onsite'));
 });
 it('loads shared URL filters and accepts legacy category links',()=>{
 window.history.replaceState(null,'','/programs?category=diploma&search=HR&mode=onsite&city='+encodeURIComponent('حفر الباطن'));
 render(<ProgramExplorer programs={programs} offerings={offerings}/>);
 expect(screen.getByRole('combobox')).toHaveValue('HR');
 expect(screen.getByText('تم العثور على 1 برنامج')).toBeInTheDocument();
 });
});
