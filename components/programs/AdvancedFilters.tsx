"use client";
import * as Dialog from '@radix-ui/react-dialog';
import {Settings2,X} from 'lucide-react';
import type {FilterOptions,ProgramCategory,StudyMode} from '@/types/program';
import {categoryNames} from './ProgramFilterChips';
export default function AdvancedFilters({filters,onChange,categories,cities,count,onClear}:{filters:FilterOptions;onChange:(patch:Partial<FilterOptions>)=>void;categories:ProgramCategory[];cities:string[];count:number;onClear:()=>void}) {
 const active=[filters.category,filters.studyMode,filters.city,filters.sort].filter(Boolean).length;
 return <Dialog.Root><Dialog.Trigger asChild><button className="secondary-btn"><Settings2 size={18}/> الفلاتر {active>0&&<span className="badge">{active}</span>}</button></Dialog.Trigger>
 <Dialog.Portal><Dialog.Overlay className="filter-overlay"/><Dialog.Content className="advanced-filters" dir="rtl">
  <div className="filter-heading"><Dialog.Title>الفلاتر</Dialog.Title><Dialog.Close asChild><button className="close" aria-label="إغلاق الفلاتر"><X/></button></Dialog.Close></div>
  <Dialog.Description className="filter-description">حدّد طريقة الدراسة والمدينة للوصول إلى البرامج المتاحة لك.</Dialog.Description>
  <div className="filter-fields">
   <div className="field"><label htmlFor="program-type">نوع البرنامج</label><select id="program-type" className="select" value={filters.category??''} onChange={e=>onChange({category:(e.target.value||undefined) as ProgramCategory|undefined})}><option value="">الكل</option>{categories.map(c=><option key={c} value={c}>{categoryNames[c]}</option>)}</select></div>
   <div className="field"><label htmlFor="study-mode">طريقة الدراسة</label><select id="study-mode" className="select" value={filters.studyMode??''} onChange={e=>onChange({studyMode:(e.target.value||undefined) as StudyMode|undefined})}><option value="">الكل</option><option value="onsite">حضوري</option><option value="online">أونلاين</option></select></div>
   <div className="field"><label htmlFor="program-city">المنطقة / المدينة</label><select id="program-city" className="select" value={filters.city??''} onChange={e=>onChange({city:e.target.value||undefined})}><option value="">الكل</option>{filters.city&&!cities.includes(filters.city)&&<option value={filters.city}>{filters.city} (غير متاحة لهذه الاختيارات)</option>}{cities.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
   <div className="field"><label htmlFor="price-sort">السعر</label><select id="price-sort" className="select" value={filters.sort?.startsWith('price')?filters.sort:''} onChange={e=>onChange({sort:(e.target.value||undefined) as FilterOptions['sort']})}><option value="">الكل</option><option value="price-asc">الأقل سعرًا أولًا</option><option value="price-desc">الأعلى سعرًا أولًا</option></select></div>
   <div className="field"><label htmlFor="duration-sort">المدة</label><select id="duration-sort" className="select" value={filters.sort?.startsWith('duration')?filters.sort:''} onChange={e=>onChange({sort:(e.target.value||undefined) as FilterOptions['sort']})}><option value="">الترتيب الافتراضي</option><option value="duration-asc">الأقصر أولًا</option><option value="duration-desc">الأطول أولًا</option></select></div>
  </div>
  <p className="filter-description">يُطبّق ترتيب واحد في كل مرة. السعر هو أقل رسوم بين الخيارات المطابقة، والمدد غير المحددة تظهر أخيرًا.</p>
  <div className="filter-actions"><Dialog.Close asChild><button className="primary-btn">عرض النتائج ({count})</button></Dialog.Close><button className="secondary-btn" onClick={onClear}>مسح جميع الفلاتر</button></div>
 </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
