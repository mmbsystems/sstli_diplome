import React, {useState} from 'react';
import {afterEach, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ManagedImageEditor from '@/components/admin/ManagedImageEditor';
import type {AdminProgram} from '@/lib/admin/types';
const id='00000000-0000-4000-8000-000000000001';
const path=`/api/program-images/${id}/00000000-0000-4000-8000-000000000002.png`;
const program={id,name:'برنامج',version:4,image:'/images/local.png'} as AdminProgram;
const saved={id,version:5,image:path,updatedAt:'2026-09-14T12:00:00Z'};
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();});
function setup(disabled=false){
 const accepted=vi.fn();
 function Host(){const [value,setValue]=useState(program);return <ManagedImageEditor program={value} disabled={disabled} onBusy={()=>{}} onSaved={patch=>{accepted(patch);setValue(p=>({...p,...patch}));}}/>;}
 render(<Host/>);return accepted;
}
function upload(){fireEvent.change(screen.getByLabelText('رفع أو استبدال الصورة'),{target:{files:[new File(['image'],'photo.png',{type:'image/png'})]}});}
it('shows persisted replacement and uses its version for reference removal',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({image:saved})}).mockResolvedValueOnce({ok:true,json:async()=>({image:{...saved,version:6,image:null}})});vi.stubGlobal('fetch',fetcher);vi.spyOn(window,'confirm').mockReturnValue(true);setup();upload();
 await waitFor(()=>expect(screen.getByRole('img')).toHaveAttribute('src',path));
 fireEvent.click(screen.getByRole('button',{name:/إزالة الصورة/}));await screen.findByText('لا توجد صورة للبرنامج.');
 expect(fetcher.mock.calls[1][1].body.get('expectedVersion')).toBe('5');
 expect(fetcher.mock.calls[1][1].body.get('action')).toBe('remove');
});
it('allows removing only the local image reference',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({image:{...saved,image:null}})}));vi.spyOn(window,'confirm').mockReturnValue(true);setup();
 fireEvent.click(screen.getByRole('button',{name:/إزالة الصورة/}));await screen.findByText('لا توجد صورة للبرنامج.');
});
it.each([{...saved,id:'another'}, {...saved,version:4}, {...saved,image:'/wrong.png'}, {...saved,updatedAt:undefined}])('never accepts malformed successful patch %j',async image=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({image})}));const accepted=setup();upload();
 await screen.findByRole('alert');expect(accepted).not.toHaveBeenCalled();expect(screen.getByRole('img')).toHaveAttribute('src','/images/local.png');expect(screen.getByLabelText('رفع أو استبدال الصورة')).toBeDisabled();
});
it.each([409,500])('keeps preview and prevents blind retries after %i',async status=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status,json:async()=>({})}));setup();upload();await screen.findByRole('alert');expect(screen.getByRole('img')).toHaveAttribute('src','/images/local.png');expect(screen.getByLabelText('رفع أو استبدال الصورة')).toBeDisabled();
});
it('preserves preview on network failure',async()=>{vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));setup();upload();await screen.findByRole('alert');expect(screen.getByRole('img')).toHaveAttribute('src','/images/local.png');});
it('blocks uploading while unsaved edits exist',()=>{const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);setup(true);upload();expect(fetcher).not.toHaveBeenCalled();});
it('locks controls during a request and permits retry after validation rejection',async()=>{
 let resolve!:(value:unknown)=>void;vi.stubGlobal('fetch',vi.fn(()=>new Promise(r=>{resolve=r;})));setup();upload();expect(screen.getByLabelText('رفع أو استبدال الصورة')).toBeDisabled();resolve({ok:false,status:422});await screen.findByRole('alert');expect(screen.getByLabelText('رفع أو استبدال الصورة')).toBeEnabled();
});
