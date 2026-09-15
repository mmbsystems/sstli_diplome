import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.generated';
import { AdminReadError } from '@/lib/admin/read-source';
import { mapHostedCatalog } from './map-hosted';

/** Internal SELECT-only reader; the caller must authorize before client construction. */
export async function readHostedCatalog(client:SupabaseClient<Database>) {
  async function rows<T>(page:(from:number,to:number)=>PromiseLike<{data:T[]|null;error:{code?:string}|null;count:number|null}>) {
    const collected:T[]=[];
    let total:number|undefined;
    for(let offset=0;offset<10000;offset+=500) {
      const result=await page(offset,offset+499);
      if(result.error) throw new AdminReadError(['42P01','42703','PGRST204','PGRST205'].includes(result.error.code??'')?'schema':result.error.code==='42501'?'authorization':'connection');
      if(!Array.isArray(result.data)||result.count===null||result.count<0||result.count>10000||total!==undefined&&total!==result.count) throw new AdminReadError('schema');
      total=result.count;collected.push(...result.data);
      if(collected.length===total)return collected;
      if(collected.length>total||result.data.length!==500)throw new AdminReadError('schema');
    }
    throw new AdminReadError('schema');
  }
  const [programs,branches,program_offerings,curriculum_items,career_paths]=await Promise.all([
    rows((from,to)=>client.from('programs').select('*',{count:'exact'}).order('id').range(from,to).abortSignal(AbortSignal.timeout(10000)).retry(false)),
    rows((from,to)=>client.from('branches').select('*',{count:'exact'}).order('id').range(from,to).abortSignal(AbortSignal.timeout(10000)).retry(false)),
    rows((from,to)=>client.from('program_offerings').select('*',{count:'exact'}).order('sort_order').order('id').range(from,to).abortSignal(AbortSignal.timeout(10000)).retry(false)),
    rows((from,to)=>client.from('curriculum_items').select('*',{count:'exact'}).order('program_id').order('sort_order').range(from,to).abortSignal(AbortSignal.timeout(10000)).retry(false)),
    rows((from,to)=>client.from('career_paths').select('*',{count:'exact'}).order('program_id').order('sort_order').range(from,to).abortSignal(AbortSignal.timeout(10000)).retry(false)),
  ]);
  return mapHostedCatalog({programs,branches,program_offerings,curriculum_items,career_paths});
}
