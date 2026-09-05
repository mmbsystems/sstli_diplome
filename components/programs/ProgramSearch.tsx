"use client";
import {useId,useState} from 'react';
import {Search,X} from 'lucide-react';
import type {Program} from '@/types/program';
import {categoryLabel} from '@/lib/formatters';

export default function ProgramSearch({value,onChange,suggestions}:{value:string;onChange:(value:string)=>void;suggestions:Program[]}) {
 const id=useId();
 const [open,setOpen]=useState(false);
 const [active,setActive]=useState(-1);
 const visible=open&&value.trim().length>0&&suggestions.length>0;
 const choose=(program:Program)=>{onChange(program.name);setOpen(false);setActive(-1)};
 return <div className="program-search" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget)){setOpen(false);setActive(-1)}}}>
  <label htmlFor={id} className="search-label">ابحث عن برنامجك</label>
  <div className="search-input-wrap"><Search size={22} aria-hidden="true"/>
   <input id={id} className="input" role="combobox" aria-autocomplete="list" aria-expanded={visible} aria-controls={visible?`${id}-suggestions`:undefined} aria-activedescendant={visible&&active>=0&&active<suggestions.length?`${id}-${active}`:undefined} autoComplete="off" placeholder="ابحث عن دبلوم أو دورة..." value={value}
    onFocus={()=>setOpen(true)} onChange={e=>{onChange(e.target.value);setOpen(true);setActive(-1)}}
    onKeyDown={e=>{
     if(e.nativeEvent.isComposing)return;
     if(e.key==='Escape'){setOpen(false);setActive(-1)}
     if((e.key==='ArrowDown'||e.key==='ArrowUp')&&suggestions.length){e.preventDefault();setOpen(true);setActive(i=>e.key==='ArrowDown'?(i+1)%suggestions.length:(i<=0?suggestions.length-1:i-1))}
     if(e.key==='Enter'&&visible&&active>=0&&suggestions[active]){e.preventDefault();choose(suggestions[active])}
    }}/>
   {value&&<button className="close search-clear" aria-label="مسح البحث" onClick={()=>{onChange('');setActive(-1)}}><X size={18}/></button>}
  </div>
  {visible&&<ul id={`${id}-suggestions`} className="search-suggestions" role="listbox" aria-label="اقتراحات البرامج">
   {suggestions.map((program,i)=><li key={program.id} id={`${id}-${i}`} role="option" aria-selected={i===active} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(program)}><span>{program.name}</span><small>{categoryLabel[program.category]}</small></li>)}
  </ul>}
 </div>;
}
