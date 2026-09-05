import type {ProgramCategory} from '@/types/program';
export const categoryNames:Record<ProgramCategory,string>={diploma:'الدبلومات','qualifying-course':'الدورات التأهيلية','development-course':'الدورات التطويرية'};
export default function ProgramFilterChips({categories,value,onChange}:{categories:ProgramCategory[];value?:ProgramCategory;onChange:(value?:ProgramCategory)=>void}) {
 return <div className="chips category-chips" role="group" aria-label="نوع البرنامج">
 <button className={`chip ${!value?'active':''}`} aria-pressed={!value} onClick={()=>onChange(undefined)}>الكل</button>
 {categories.map(category=><button key={category} className={`chip ${value===category?'active':''}`} aria-pressed={value===category} onClick={()=>onChange(category)}>{categoryNames[category]}</button>)}
 </div>;
}
