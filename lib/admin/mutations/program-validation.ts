import { MutationError } from './errors';
import { object, uuid, expectedVersion, bool, enumeration } from './validation';
const invalid=():never=>{throw new MutationError('validation');};
function string(value:unknown,max:number,required=false):string {
 if(typeof value!=='string')return invalid();const s=value.trim();
 if(s.length>max||(required&&!s)||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(s))return invalid();return s;
}
const fields=['name_ar','name_en','slug','program_type','specialization','searchable_keywords','description','duration_display','duration_standard','duration_summer','accredited_hours','accreditation_text','image_path','image_position','content_pending','classification_pending','is_active','publication_status','catalog_visibility','is_featured'];
export function parseProgramInput(value:unknown) {
 const input=object(value);if(Object.keys(input).some(k=>!['id','action','expectedVersion','program','curriculum','careers'].includes(k)))return invalid();
 const action=enumeration(input.action,['save','archive','restore']);const id=input.id===undefined?null:uuid(input.id);
 const version=expectedVersion(input.expectedVersion,id?1:0);if(version>=Number.MAX_SAFE_INTEGER-1||!id&&(version!==0||action!=='save'))return invalid();
 const p=object(input.program);if(Object.keys(p).some(k=>!fields.includes(k)))return invalid();
 for(const key of ['content_pending','classification_pending','is_active','catalog_visibility','is_featured','publication_status','searchable_keywords'])if(p[key]===null)return invalid();
 const optional=(key:string,max:number)=>p[key]===undefined||p[key]===null?null:string(p[key],max);
 const slug=string(p.slug,160,true).toLowerCase();if(!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))return invalid();
 const hours=p.accredited_hours==null?null:expectedVersion(p.accredited_hours);if(hours!==null&&hours>100000)return invalid();
 const keywords=p.searchable_keywords??[];if(!Array.isArray(keywords)||keywords.length>100)return invalid();
 const image=optional('image_path',1024);if(image&&!/^\/(?!\/)[^\s<>"\\]*$/.test(image))return invalid();
 const position=optional('image_position',60);if(position&&!/^(center|top|bottom|left|right|\d{1,3}(\.\d+)?%)( (center|top|bottom|left|right|\d{1,3}(\.\d+)?%))?$/.test(position))return invalid();
 if(position?.split(' ').some(part=>part.endsWith('%')&&Number.parseFloat(part)>100))return invalid();
 const program={name_ar:string(p.name_ar,300,true),name_en:optional('name_en',300),slug,program_type:enumeration(p.program_type,['diploma','qualifying-course','development-course']),specialization:optional('specialization',300),searchable_keywords:keywords.map(k=>string(k,100,true)),description:p.description===undefined?'':string(p.description,20000),duration_display:p.duration_display===undefined?'':string(p.duration_display,500),duration_standard:optional('duration_standard',500),duration_summer:optional('duration_summer',500),accredited_hours:hours,accreditation_text:optional('accreditation_text',2000),image_path:image,image_position:position,content_pending:bool(p.content_pending??false),classification_pending:bool(p.classification_pending??false),is_active:bool(p.is_active??false),publication_status:enumeration(p.publication_status??'draft',['draft','published']),catalog_visibility:bool(p.catalog_visibility??false),is_featured:bool(p.is_featured??false)};
 if(program.publication_status==='published'&&(!program.description||!program.duration_display||program.content_pending||program.classification_pending))return invalid();
 const nested=(value:unknown)=>{if(!Array.isArray(value)||value.length>200)return invalid();const ids=new Set<string>();return value.map(v=>{const r=object(v);if(Object.keys(r).some(k=>!['id','title'].includes(k)))return invalid();const title=string(r.title,500,true);if(r.id===undefined)return {title};const id=uuid(r.id);if(ids.has(id))return invalid();ids.add(id);return {id,title};});};
 return {id,action,expectedVersion:version,program,curriculum:nested(input.curriculum),careers:nested(input.careers)};
}
