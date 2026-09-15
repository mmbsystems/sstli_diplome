import { NextRequest, NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdmin } from '@/lib/auth';
import { isSameOrigin, readJsonBody } from '@/lib/auth-request';
import { runProbeCommand } from '@/lib/admin/mutations/probe';
import { MutationError, mutationStatus } from '@/lib/admin/mutations/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
export async function POST(request: NextRequest) {
  if (request.method !== 'POST') return NextResponse.json({ error: 'method_not_allowed' }, { status: 405, headers: { ...headers, Allow: 'POST' } });
  if (!isSameOrigin(request) || request.headers.get('sec-fetch-site') === 'cross-site') return NextResponse.json({ error: 'unauthorized' }, { status: 403, headers });
  try {
    await requireAdmin({ api: true });
    let body;
    try { body = await readJsonBody(request); } catch { throw new MutationError('validation'); }
    return NextResponse.json(await runProbeCommand(body), { headers });
  } catch (error) {
    const reason = error instanceof MutationError || error instanceof AdminAuthorizationError ? error.reason : 'database';
    return NextResponse.json({ error: reason }, { status: mutationStatus[reason], headers });
  }
}
