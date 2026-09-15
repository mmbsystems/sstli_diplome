import {NextRequest,NextResponse} from 'next/server';
import {requireAdmin,AdminAuthorizationError} from '@/lib/auth';
import {isSameOrigin} from '@/lib/auth-request';
import {runProgramCommand} from '@/lib/admin/mutations/program';
import {MutationError,mutationStatus} from '@/lib/admin/mutations/errors';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function POST(request:NextRequest) {
 if(!isSameOrigin(request)||request.headers.get('sec-fetch-site')==='cross-site')return NextResponse.json({error:'unauthorized'},{status:403,headers});
 try {
  await requireAdmin({api:true});
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw new MutationError('validation');
  const reader=request.body?.getReader();if(!reader)throw new MutationError('validation');
  let size=0;const chunks:Uint8Array[]=[];
  try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>262144){await reader.cancel();throw new MutationError('validation');}chunks.push(value);}}finally{reader.releaseLock();}
  let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new MutationError('validation');}
  return NextResponse.json({program:await runProgramCommand(input)},{headers});
 }catch(error){const reason=error instanceof MutationError||error instanceof AdminAuthorizationError?error.reason:'database';return NextResponse.json({error:reason},{status:mutationStatus[reason],headers});}
}
