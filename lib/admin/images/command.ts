import 'server-only';
import { randomUUID } from 'node:crypto';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { MutationError, throwDatabaseError } from '../mutations/errors';
import { uuid, expectedVersion } from '../mutations/validation';
import { IMAGE_BUCKET, managedImageKey, validateImageFile } from './validation';

export async function runImageCommand(input: { id: unknown; expectedVersion: unknown; action: unknown; file?: File }) {
  const actor = await requireAdmin({ api: true });
  if (process.env.ADMIN_DATA_SOURCE !== 'supabase') throw new MutationError('disabled');
  const id = uuid(input.id); const version = expectedVersion(input.expectedVersion, 1);
  if (!['upload','remove'].includes(String(input.action)) || (input.action === 'upload') !== !!input.file) throw new MutationError('validation');
  const client = createAdminClient((url, options) => fetch(url,{...options,signal:options?.signal?AbortSignal.any([options.signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)}));
  const read = () => client.from('programs').select('id,version,image_path,archived_at').eq('id',id).abortSignal(AbortSignal.timeout(10000)).single();
  const previous = await read(); throwDatabaseError(previous.error);
  if (!previous.data) throw new MutationError('not_found');
  if (previous.data.version !== version) throw new MutationError('conflict');
  if (previous.data.archived_at) throw new MutationError('validation');
  const oldKey = managedImageKey(previous.data.image_path,id);
  if (input.action === 'remove' && !previous.data.image_path) throw new MutationError('validation');
  const storage = client.storage.from(IMAGE_BUCKET);
  let newKey: string | null = null; let newPath: string | null = null;
  let metadataAttempted = false;
  let metadataRejected = false;
  async function removeKey(key: string) {
    try { const result = await storage.remove([key]); return !result.error; } catch { return false; }
  }
  // Ambiguous network outcomes must never delete an object the DB may reference.
  async function compensate() {
    if (!newKey) return;
    try {
      const current = await read();
      if (current.error || !current.data || current.data.image_path === newPath) {
        console.error('SSTLI_IMAGE_RECONCILIATION_REQUIRED');
        return;
      }
      if (!await removeKey(newKey)) console.error('SSTLI_IMAGE_CLEANUP_REQUIRED');
    } catch { console.error('SSTLI_IMAGE_RECONCILIATION_REQUIRED'); }
  }
  try {
    if (input.file) {
      const image = await validateImageFile(input.file);
      const name = `${randomUUID()}.${image.extension}`;
      newKey = `programs/${id}/${name}`; newPath = `/api/program-images/${id}/${name}`;
      const upload = await storage.upload(newKey,image.bytes,{ contentType:image.mime,upsert:false,cacheControl:'0' });
      if (upload.error) throw new MutationError('database');
    }
    metadataAttempted = true;
    const result = await client.rpc('legacy_admin_set_program_image',{
      p_id:id,p_expected_version:version,p_image_path:newPath,p_actor_username:actor.username,p_actor_name:actor.name,p_request_id:randomUUID(),
    }).abortSignal(AbortSignal.timeout(15000));
    // SQLSTATE errors confirm the transaction was rejected. Transport errors do not.
    metadataRejected = !!result.error && /^[0-9A-Z]{5}$/.test(result.error.code ?? '');
    throwDatabaseError(result.error);
    const saved = result.data as { id?: string; version?: number; image?: string | null; updatedAt?: string; oldImage?: string | null } | null;
    if (!saved || saved.id !== id || saved.version !== version+1 || saved.image !== newPath) throw new MutationError('database');
    const cleanupPending = !!oldKey && !await removeKey(oldKey);
    if (cleanupPending) console.error('SSTLI_IMAGE_CLEANUP_REQUIRED');
    return { id,version:saved.version,image:saved.image,updatedAt:saved.updatedAt,cleanupPending };
  } catch (error) {
    // A timed-out transaction can commit after a reread; defer uncertain objects
    // to reconciliation instead of deleting something it might later reference.
    if (metadataAttempted && !metadataRejected) console.error('SSTLI_IMAGE_RECONCILIATION_REQUIRED');
    else await compensate();
    throw error;
  }
}
