import type { FilterOptions, Offering, Program, ProgramCategory, StudyMode } from '@/types/program';
import {categoryLabel} from './formatters';

export function normalizeSearch(value:string) {
  return value.normalize('NFKC').toLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/\s+/g,' ').trim();
}
const aliasGroups = [
 ['HR','موارد بشرية','الموارد البشرية'],
 ['AI','ذكاء اصطناعي','الذكاء الاصطناعي'],
 ['OSHA','NEBOSH','نيبوش','سلامة','السلامة والصحة المهنية'],
 ['IT','حاسب','الحاسب الآلي','كمبيوتر','computer','الأمن السيبراني','إدخال بيانات','الذكاء الاصطناعي','تصميم المواقع'],
 ['English','انجليزي','إنجليزي','لغة إنجليزية','اللغة الإنجليزية'],
 ['محاسبة','المحاسبة','Accounting'], ['قانون','القانون','Law'],
].map(group=>group.map(normalizeSearch));
const indexCache=new WeakMap<Program,string>();
function searchText(program:Program) {
  const cached=indexCache.get(program); if(cached!==undefined)return cached;
  const title=normalizeSearch([program.name,program.specialization,...(program.searchableKeywords??[])].join(' '));
  const aliases=aliasGroups.filter(group=>group.some(alias=>title.includes(alias))).flat();
  const text=normalizeSearch([program.name,program.description,program.category,categoryLabel[program.category],program.specialization,...(program.curriculum??[]),...(program.careerPaths??[]),...(program.searchableKeywords??[]),...aliases].join(' '));
  indexCache.set(program,text); return text;
}
function matches(program:Program,query:string) {
  const text=searchText(program);
  return query.split(' ').every(token=>/^[a-z]+$/.test(token)?text.split(/[^a-z0-9]+/).some(word=>word===token):text.includes(token));
}
// Calendar length for sorting only; accredited hours are not elapsed study time.
export function durationDays(program:Program):number|undefined {
  const label=normalizeSearch(program.duration.standard??program.duration.label);
  if(label==='سنتان ونصف')return 912.5;
  if(label==='سنتان')return 730;
  if(label==='يومان')return 2;
  if(label==='شهر')return 30;
  const amount=Number(label.match(/\d+/)?.[0]);
  if(!amount)return undefined;
  if(/شهر|اشهر/.test(label))return amount*30;
  if(/يوم|ايام/.test(label))return amount;
  return undefined;
}
export function filterPrograms(programs:Program[],offerings:Offering[],filters:FilterOptions) {
  const query=normalizeSearch(filters.search??'');
  const results=programs.filter(p=>(!filters.category||p.category===filters.category)&&(!query||matches(p,query)))
    .map(program=>({program,offerings:offerings.filter(o=>o.programId===program.id&&o.active&&(!filters.studyMode||o.studyMode===filters.studyMode)&&(!filters.city||o.city===filters.city))}))
    .filter(x=>x.offerings.length>0);
  if(filters.sort){
    const price=filters.sort.startsWith('price');
    const value=(row:typeof results[number])=>{
      if(!price)return durationDays(row.program);
      const prices=row.offerings.flatMap(o=>o.price===undefined?[]:[o.price]);
      return prices.length?Math.min(...prices):undefined;
    };
    const direction=filters.sort.endsWith('desc')?-1:1;
    results.sort((a,b)=>{const x=value(a),y=value(b);return x===undefined?(y===undefined?0:1):y===undefined?-1:(x-y)*direction});
  }
  return results;
}
export function getAvailableCities(offerings:Offering[],category:ProgramCategory|undefined,studyMode:StudyMode|undefined,programs:Program[]) {
  const ids=new Set(programs.filter(p=>!category||p.category===category).map(p=>p.id));
  return [...new Set(offerings.filter(o=>o.active&&(!studyMode||o.studyMode===studyMode)&&ids.has(o.programId)&&o.city).map(o=>o.city!))].sort((a,b)=>a.localeCompare(b,'ar'));
}
