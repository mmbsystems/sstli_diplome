import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { IMAGE_BUCKET, managedImageKey, MAX_IMAGE_BYTES } from '@/lib/admin/images/validation';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export async function GET(_request:NextRequest,{params}:{params:Promise<{id:string;name:string}>}) {
  const user=await currentUser(); if(!user)return NextResponse.json({error:'unauthenticated'},{status:401,headers});
  if(user.role!=='staff'&&user.role!=='super_admin')return NextResponse.json({error:'unauthorized'},{status:403,headers});
  const {id,name}=await params; const path=`/api/program-images/${id}/${name}`;const key=managedImageKey(path,id);
  if(!key||process.env.ADMIN_DATA_SOURCE!=='supabase')return new NextResponse(null,{status:404,headers});
  try {
    const client=createAdminClient((url,options)=>fetch(url,{...options,signal:options?.signal?AbortSignal.any([options.signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)}));
    const {data,error}=await client.from('programs').select('image_path,archived_at').eq('id',id).abortSignal(AbortSignal.timeout(10000)).single();
    if(error||!data||data.image_path!==path||(user.role!=='super_admin'&&data.archived_at!==null))return new NextResponse(null,{status:404,headers});
    const object=await client.storage.from(IMAGE_BUCKET).download(key);
    if(object.error||!object.data||object.data.size>MAX_IMAGE_BYTES)return new NextResponse(null,{status:404,headers});
    const mime=name.endsWith('.png')?'image/png':name.endsWith('.jpg')?'image/jpeg':'image/webp';
    return new NextResponse(await object.data.arrayBuffer(),{headers:{...headers,'Content-Type':mime,'Content-Disposition':'inline'}});
  }catch{return NextResponse.json({error:'unavailable'},{status:503,headers});}
}
