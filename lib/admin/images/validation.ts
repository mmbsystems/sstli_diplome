import 'server-only';
import sharp from 'sharp';
import { MutationError } from '../mutations/errors';
export const IMAGE_BUCKET = 'program-images';
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const uuidPattern = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const managed = new RegExp(`^/api/program-images/(${uuidPattern})/(${uuidPattern}\\.(?:jpg|png|webp))$`);
export function managedImageKey(path: unknown, programId: string): string | null {
  const match = typeof path === 'string' ? managed.exec(path) : null;
  return match?.[1] === programId ? `programs/${match[1]}/${match[2]}` : null;
}
export async function validateImageFile(file: File) {
  const allowed: Record<string, { extensions: string[]; format: 'jpeg' | 'png' | 'webp'; extension: string }> = {
    'image/jpeg': { extensions: ['jpg','jpeg'], format: 'jpeg', extension: 'jpg' },
    'image/png': { extensions: ['png'], format: 'png', extension: 'png' },
    'image/webp': { extensions: ['webp'], format: 'webp', extension: 'webp' },
  };
  const type = allowed[file.type];
  if (!type || !file.size || file.size > MAX_IMAGE_BYTES || !type.extensions.includes(file.name.split('.').at(-1)?.toLowerCase() ?? '')) throw new MutationError('validation');
  try {
    const pipeline = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 40000000, failOn: 'warning' });
    const metadata = await pipeline.metadata();
    if (metadata.format !== type.format || !metadata.width || !metadata.height || metadata.width > 8000 || metadata.height > 8000 || (metadata.pages ?? 1) !== 1) throw new Error();
    // Full decode/re-encode rejects truncated payloads and strips embedded metadata.
    const bytes = await pipeline.rotate().toFormat(type.format).toBuffer();
    if (bytes.length > MAX_IMAGE_BYTES) throw new Error();
    return { bytes, mime: file.type, extension: type.extension };
  } catch { throw new MutationError('validation'); }
}
