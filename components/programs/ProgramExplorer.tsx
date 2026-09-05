"use client";
import {useMemo} from 'react';
import {GraduationCap,X} from 'lucide-react';
import {useSearchParams} from 'next/navigation';
import {programs} from '@/data/programs';
import {offerings} from '@/data/offerings';
import {filterPrograms,getAvailableCities} from '@/lib/filters';
import type {FilterOptions,ProgramCategory} from '@/types/program';
import ProgramCard from './ProgramCard';
import ProgramSearch from './ProgramSearch';
import ProgramFilterChips,{categoryNames} from './ProgramFilterChips';
import AdvancedFilters from './AdvancedFilters';

const categories=Array.from(new Set(programs.map(p=>p.category)));
const sorts:Record<NonNullable<FilterOptions['sort']>,string>={'price-asc':'الأقل سعرًا أولًا','price-desc':'الأعلى سعرًا أولًا','duration-asc':'الأقصر أولًا','duration-desc':'الأطول أولًا'};
export default function ProgramExplorer() {
 const params=useSearchParams();
 const filters=useMemo<FilterOptions>(()=>{
  const type=params.get('type')??params.get('category');
  const mode=params.get('mode');
  const sort=params.get('sort');
  return {search:params.get('search')??'',category:categories.includes(type as ProgramCategory)?type as ProgramCategory:undefined,studyMode:mode==='onsite'||mode==='online'?mode:undefined,city:params.get('city')||undefined,sort:sort&&Object.hasOwn(sorts,sort)?sort as FilterOptions['sort']:undefined};
 },[params]);
 const update=(patch:Partial<FilterOptions>,clear=false)=>{
  const next=clear?{}:{...filters,...patch};
  const query=new URLSearchParams(params.toString());
  ['search','category','type','mode','city','sort'].forEach(key=>query.delete(key));
  Object.entries({search:next.search,type:next.category,mode:next.studyMode,city:next.city,sort:next.sort}).forEach(([key,value])=>{if(value)query.set(key,value)});
  const suffix=query.toString();
  window.history.replaceState(null,'',`${window.location.pathname}${suffix?'?'+suffix:''}${window.location.hash}`);
 };
 const clear=()=>update({},true);
 const results=useMemo(()=>filterPrograms(programs,offerings,filters),[filters]);
 const cities=useMemo(()=>getAvailableCities(offerings,filters.category,filters.studyMode,programs),[filters.category,filters.studyMode]);
 const suggestions=useMemo(()=>results.slice(0,5).map(x=>x.program),[results]);
 const active=Boolean(filters.search||filters.category||filters.studyMode||filters.city||filters.sort);
 return <><section className="hero"><div className="container"><span className="eyebrow"><GraduationCap size={18}/> مستقبلك يبدأ باختيار واضح</span><h1>استكشف برامجنا التدريبية</h1><p>ابحث عن تخصصك، وحدّد طريقة الدراسة ومدينتك لاستكشاف البرامج المتاحة لك.</p></div></section>
 <section className="section"><div className="container">
  <div className="panel explorer-controls"><ProgramSearch value={filters.search??''} onChange={search=>update({search})} suggestions={suggestions}/>
   <div className="search-filter-row"><ProgramFilterChips categories={categories} value={filters.category} onChange={category=>update({category})}/><AdvancedFilters filters={filters} onChange={update} categories={categories} cities={cities} count={results.length} onClear={clear}/></div>
   {active&&<div className="active-filters" aria-label="الفلاتر النشطة">
    {filters.search&&<button className="chip" onClick={()=>update({search:undefined})}>البحث: {filters.search}<X size={14}/></button>}
    {filters.category&&<button className="chip" onClick={()=>update({category:undefined})}>{categoryNames[filters.category]}<X size={14}/></button>}
    {filters.studyMode&&<button className="chip" onClick={()=>update({studyMode:undefined})}>{filters.studyMode==='online'?'أونلاين':'حضوري'}<X size={14}/></button>}
    {filters.city&&<button className="chip" onClick={()=>update({city:undefined})}>{filters.city}<X size={14}/></button>}
    {filters.sort&&<button className="chip" onClick={()=>update({sort:undefined})}>{sorts[filters.sort]}<X size={14}/></button>}
    <button className="clear-all" onClick={clear}>مسح جميع الفلاتر</button>
   </div>}
  </div>
  <div className="results-bar"><h2>البرامج المتاحة</h2><span role="status" aria-live="polite" aria-atomic="true">تم العثور على {results.length} برنامج</span></div>
  <div className="grid">{results.length?results.map(x=><ProgramCard key={x.program.id} program={x.program} available={x.offerings}/>):<div className="empty"><strong>لا توجد برامج مطابقة لبحثك</strong><p>جرّب البحث بكلمة أخرى أو قم بتعديل الفلاتر.</p><button className="secondary-btn" onClick={clear}>مسح الفلاتر</button></div>}</div>
 </div></section></>;
}
