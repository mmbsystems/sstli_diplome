import {describe,it,expect} from 'vitest';
import {filterPrograms} from '@/lib/filters';
import {programs} from '@/data/programs';
import {offerings} from '@/data/offerings';
const search=(search:string)=>filterPrograms(programs,offerings,{search});
describe('smart search',()=>{
 it.each([['HR','hr'],['AI','ai'],['IT','cyber'],['English','english-1'],['انجليزي','english-1'],['إِنْجِلِيزِي','english-1'],['محاسبة','d-financial-accounting'],['حاسب','q-data'],['NEBOSH','d-nebosh-250'],['دبلوم القانون','law']])('finds %s', (query,id)=>expect(search(query).map(x=>x.program.id)).toContain(id));
 it('ignores extra spaces and case',()=>expect(search('  hR  ').map(x=>x.program.id)).toContain('hr'));
 it('combines search and offering filters',()=>{
 const result=filterPrograms(programs,offerings,{search:'HR',category:'diploma',studyMode:'onsite',city:'حفر الباطن'});
 expect(result.map(x=>x.program.id)).toEqual(['hr']);
 expect(result[0].offerings.every(o=>o.active&&o.city==='حفر الباطن'&&o.studyMode==='onsite')).toBe(true);
 });
 it('has an empty state and clears all constraints',()=>{expect(search('zzzzzz')).toEqual([]);expect(filterPrograms(programs,offerings,{}).length).toBeGreaterThan(40)});
 it('sorts by matching offering price',()=>{const r=filterPrograms(programs,offerings,{category:'diploma',studyMode:'onsite',city:'حفر الباطن',sort:'price-asc'});expect(r[0].offerings[0].price).toBe(6250)});
 it('sorts duration across days, months and diplomas',()=>{expect(filterPrograms(programs,offerings,{sort:'duration-asc'})[0].program.id).toBe('d-priorities');expect(filterPrograms(programs,offerings,{sort:'duration-desc'})[0].program.category).toBe('diploma')});
});


describe('ordering and availability boundaries',()=>{
 const catalog=programs.filter(p=>['law','hr','d-priorities'].includes(p.id));
 const available=[
  {id:'a',programId:'law',category:'diploma' as const,studyMode:'onsite' as const,city:'الرياض',price:13000,active:true},
  {id:'b',programId:'hr',category:'diploma' as const,studyMode:'onsite' as const,city:'الرياض',price:8999,active:true},
  {id:'c',programId:'d-priorities',category:'development-course' as const,studyMode:'onsite' as const,city:'الرياض',active:true},
 ];
 it('orders known prices in both directions and leaves missing prices last',()=>{
  expect(filterPrograms(catalog,available,{sort:'price-asc'}).map(x=>x.program.id)).toEqual(['hr','law','d-priorities']);
  expect(filterPrograms(catalog,available,{sort:'price-desc'}).map(x=>x.program.id)).toEqual(['law','hr','d-priorities']);
 });
 it('does not combine a city from one offering with mode from another',()=>{
  const rows=[...available,{...available[0],id:'online',city:'الدمام',studyMode:'online' as const}];
  expect(filterPrograms(catalog,rows,{city:'الرياض',studyMode:'online'})).toEqual([]);
 });
 it('never surfaces inactive offerings',()=>expect(filterPrograms(catalog,available.map(o=>({...o,active:false})),{})).toEqual([]));
});
