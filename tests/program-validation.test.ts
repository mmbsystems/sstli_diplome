// @vitest-environment node
import {expect,it} from 'vitest';
import {parseProgramInput} from '@/lib/admin/mutations/program-validation';
const valid={action:'save',expectedVersion:0,program:{name_ar:'برنامج',slug:' Test-Program ',program_type:'diploma'},curriculum:[{title:'A'}],careers:[]};
it('normalizes slug and supplies conservative defaults without accepting generated columns',()=>{const p=parseProgramInput(valid);expect(p.program).toMatchObject({slug:'test-program',publication_status:'draft',is_active:false,catalog_visibility:false});expect(()=>parseProgramInput({...valid,program:{...valid.program,version:100}})).toThrow();});
it('rejects missing versions, actor spoofing, invalid publication, unsafe paths and nested identities',()=>{
 for(const patch of [{expectedVersion:undefined},{actor:'forged'},{program:{...valid.program,publication_status:'published'}},{program:{...valid.program,image_path:'javascript:alert(1)'}},{curriculum:[{id:'bad',title:'A'}]},{program:{...valid.program,is_active:'true'}}])expect(()=>parseProgramInput({...valid,...patch})).toThrow();
});
it.each([
 ['name_ar',''],['name_ar',123],['name_en',false],['slug','../bad'],['program_type','unknown'],
 ['specialization',{}],['searchable_keywords',[3]],['description','x'.repeat(20001)],
 ['duration_display',[]],['duration_standard',false],['duration_summer',3],['accredited_hours',0],
 ['accredited_hours',1.5],['accreditation_text',{}],['image_path','//evil.test/image'],['image_position','999%'],
 ['content_pending','false'],['classification_pending',1],['is_active',null],['catalog_visibility',null],
 ['is_featured',null],['publication_status',null],
])('rejects invalid %s', (field,value)=>{
 expect(()=>parseProgramInput({...valid,program:{...valid.program,[field]:value}})).toThrow();
});
it('rejects invalid versions and duplicate or injected nested IDs',()=>{
 for(const expectedVersion of [-1,1.5,'1',null,Number.MAX_SAFE_INTEGER-1])expect(()=>parseProgramInput({...valid,id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',expectedVersion})).toThrow();
 for(const field of ['curriculum','careers'])for(const children of [[{title:'',id:'bad'}],[{title:'A',program_id:'spoof'}],[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',title:'A'},{id:'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA',title:'B'}]])expect(()=>parseProgramInput({...valid,[field]:children})).toThrow();
});
