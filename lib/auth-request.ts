import 'server-only';
import type {NextRequest} from 'next/server';

export function isSameOrigin(request: NextRequest) {
  // NextURL normalizes loopback IPs to localhost. The original Host preserves
  // the browser origin, both locally and on Vercel custom/preview domains.
  const host = request.headers.get('host') ?? request.nextUrl.host;
  try {
    return request.headers.get('origin') === new URL(`${request.nextUrl.protocol}//${host}`).origin;
  } catch { return false; }
}

export async function readLoginBody(request: NextRequest): Promise<{username?: unknown; password?: unknown}> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new Error('Invalid body');
  if (Number(request.headers.get('content-length')) > 4096) throw new Error('Invalid body');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Invalid body');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); throw new Error('Invalid body'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid body');
  return body;
}
