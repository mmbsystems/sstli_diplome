import {MutationError} from './errors';
import {object,uuid,expectedVersion,bool,enumeration} from './validation';
const invalid=():never=>{throw new MutationError('validation');};
function money(value:unknown):number|null {
 if(value===null)return null;
 // Decimal string validation rejects excess precision without floating-point rounding.
 if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>9999999999.99||!/^\d+(\.\d{1,2})?$/.test(String(value)))return invalid();
 return value;
}
function integer(value:unknown,min:number):number {if(typeof value!=='number'||!Number.isInteger(value)||value<min||value>2147483647)return invalid();return value;}
export function parseOfferingInput(value:unknown){
 const input=object(value);if(Object.keys(input).some(k=>!['id','expectedVersion','action','offering'].includes(k)))return invalid();
 const id=input.id===undefined?null:uuid(input.id),action=enumeration(input.action,['save','archive','restore']);
 const version=expectedVersion(input.expectedVersion,id?1:0);if(version>=Number.MAX_SAFE_INTEGER-1||!id&&(version!==0||action!=='save'))return invalid();
 const o=object(input.offering);
 if(Object.keys(o).some(k=>!['program_id','branch_id','study_mode','gender','price','min_down_payment','installment_months','accredited_hours_override','registration_state','is_active','sort_order'].includes(k)))return invalid();
 const price=money(o.price),deposit=money(o.min_down_payment),months=o.installment_months===null?null:integer(o.installment_months,1);
 if(deposit!==null&&(price===null||deposit>price||months===null))return invalid();
 return {id,action,expectedVersion:version,offering:{program_id:uuid(o.program_id),branch_id:uuid(o.branch_id),study_mode:enumeration(o.study_mode,['onsite','online']),gender:enumeration(o.gender,['male','female','both']),price,min_down_payment:deposit,installment_months:months,accredited_hours_override:o.accredited_hours_override===null?null:integer(o.accredited_hours_override,1),registration_state:enumeration(o.registration_state,['unknown','open','closed']),is_active:bool(o.is_active),sort_order:integer(o.sort_order,0)}};
}
