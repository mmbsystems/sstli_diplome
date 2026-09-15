import 'server-only';
import {randomUUID} from 'node:crypto';
import {requireAdmin} from '@/lib/auth';
import {createAdminClient} from '@/lib/supabase/admin';
import {mapBranch,mapOffering} from '@/lib/supabase/read-mappers';
import {parseOfferingInput} from './offering-validation';
import {MutationError,throwDatabaseError} from './errors';
import type {ProgramCategory} from '@/types/program';
export async function runOfferingCommand(body:unknown){
 const actor=await requireAdmin({api:true}),input=parseOfferingInput(body);
 if(process.env.ADMIN_DATA_SOURCE!=='supabase')throw new MutationError('disabled');
 const {data,error}=await createAdminClient().rpc('legacy_admin_save_offering',{p_id:input.id as string,p_expected_version:input.expectedVersion,p_offering:input.offering,p_archive:input.action==='save'?'keep':input.action,p_actor_username:actor.username,p_actor_name:actor.name,p_request_id:randomUUID()}).abortSignal(AbortSignal.timeout(15000));
 throwDatabaseError(error);
 try{
  const result=data as unknown as {offering:unknown;program:{id:string;program_type:ProgramCategory};branch:unknown};
  const saved=mapOffering(result.offering,{id:result.program.id,category:result.program.program_type},mapBranch(result.branch));
  if(saved.version!==input.expectedVersion+1||input.id&&saved.id!==input.id)throw new Error();
  return saved;
 }catch{throw new MutationError('database');}
}
