import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AdminAuthorizationError } from '@/lib/auth';
import { isSameOrigin } from '@/lib/auth-request';
import { runImageCommand } from '@/lib/admin/images/command';
import { MAX_IMAGE_BYTES } from '@/lib/admin/images/validation';
import { MutationError, mutationStatus } from '@/lib/admin/mutations/errors';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control':'private, no-store' };
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request) || request.headers.get('sec-fetch-site') === 'cross-site') return NextResponse.json({error:'unauthorized'},{status:403,headers});
  try {
    await requireAdmin({api:true});
    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.startsWith('multipart/form-data;')) throw new MutationError('validation');
    const limit = MAX_IMAGE_BYTES+16384;
    if (Number(request.headers.get('content-length')) > limit) throw new MutationError('validation');
    const reader = request.body?.getReader(); if (!reader) throw new MutationError('validation');
    const chunks: Uint8Array[] = []; let size = 0;
    try { while(true) { const {done,value}=await reader.read(); if(done)break; size+=value.length; if(size>limit){await reader.cancel();throw new MutationError('validation');}chunks.push(value); } } finally { reader.releaseLock(); }
    let form: FormData;
    try { form=await new Response(Buffer.concat(chunks),{headers:{'content-type':contentType}}).formData(); } catch { throw new MutationError('validation'); }
    const keys=[...form.keys()];
    if (keys.some(k=>!['id','expectedVersion','action','file'].includes(k)) || new Set(keys).size!==keys.length) throw new MutationError('validation');
    const file=form.get('file'); const version=form.get('expectedVersion');
    if (typeof version!=='string'||!/^\d+$/.test(version)||file!==null&&!(file instanceof File)) throw new MutationError('validation');
    return NextResponse.json({image:await runImageCommand({id:form.get('id'),expectedVersion:Number(version),action:form.get('action'),...(file instanceof File?{file}:{})})},{headers});
  } catch(error) { const reason=error instanceof MutationError||error instanceof AdminAuthorizationError?error.reason:'database';return NextResponse.json({error:reason},{status:mutationStatus[reason],headers}); }
}
