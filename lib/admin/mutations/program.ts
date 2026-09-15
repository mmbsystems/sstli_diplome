import 'server-only';
import {randomUUID} from 'node:crypto';
import {requireAdmin} from '@/lib/auth';
import {createAdminClient} from '@/lib/supabase/admin';
import {mapCatalog,type CatalogReadRows} from '@/lib/supabase/read-mappers';
import {parseProgramInput} from './program-validation';
import {MutationError,throwDatabaseError} from './errors';
export async function runProgramCommand(body:unknown){
 const actor=await requireAdmin({api:true});
 const input=parseProgramInput(body);
 if(process.env.ADMIN_DATA_SOURCE!=='supabase')throw new MutationError('disabled');
 const {data,error}=await createAdminClient().rpc('legacy_admin_save_program',{
  p_id:input.id as string,p_expected_version:input.expectedVersion,p_program:input.program,p_curriculum:input.curriculum,p_careers:input.careers,p_archive:input.action==='save'?'keep':input.action,p_actor_username:actor.username,p_actor_name:actor.name,p_request_id:randomUUID(),
 }).abortSignal(AbortSignal.timeout(15000));
 throwDatabaseError(error);
 try {
  const r=data as unknown as {program:CatalogReadRows['programs'][number];curriculum:CatalogReadRows['curriculum'];careers:CatalogReadRows['careers']};
  const saved=mapCatalog({programs:[r.program],curriculum:r.curriculum,careers:r.careers,branches:[],offerings:[]}).programs[0];
  if(!saved||saved.version!==input.expectedVersion+1||(input.id&&saved.id!==input.id))throw new Error();
  return saved;
 }catch{throw new MutationError('database');}
}
