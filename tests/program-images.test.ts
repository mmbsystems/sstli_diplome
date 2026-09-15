// @vitest-environment node
import { expect, it, vi } from 'vitest';
import sharp from 'sharp';
vi.mock('server-only', () => ({}));
import { validateImageFile, managedImageKey } from '@/lib/admin/images/validation';
const id = '00000000-0000-4000-8000-000000000001';
it.each(['png','jpeg','webp'] as const)('decodes and validates real %s image content', async format => {
  const data = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } }).toFormat(format).toBuffer();
  const result = await validateImageFile(new File([new Uint8Array(data)], `image.${format}`, { type: `image/${format}` }));
  expect(result.mime).toBe(`image/${format}`); expect((await sharp(result.bytes).metadata()).format).toBe(format);
});
it('rejects false image MIME, mismatched extension, empty and oversized files', async () => {
  await expect(validateImageFile(new File(['<script>bad</script>'], 'image.png', { type: 'image/png' }))).rejects.toMatchObject({ reason: 'validation' });
  await expect(validateImageFile(new File(['bad'], 'image.svg', { type: 'image/png' }))).rejects.toMatchObject({ reason: 'validation' });
  await expect(validateImageFile(new File([], 'image.png', { type: 'image/png' }))).rejects.toMatchObject({ reason: 'validation' });
  await expect(validateImageFile(new File([new Uint8Array(5*1024*1024+1)], 'image.png', { type: 'image/png' }))).rejects.toMatchObject({ reason: 'validation' });
});
it('never treats local, foreign-program, or traversal paths as owned Storage objects', () => {
  expect(managedImageKey(`/api/program-images/${id}/00000000-0000-4000-8000-000000000002.png`,id)).toBe(`programs/${id}/00000000-0000-4000-8000-000000000002.png`);
  for (const path of ['/images/law.jpg',`/api/program-images/${id}/../other.png`,`/api/program-images/00000000-0000-4000-8000-000000000002/00000000-0000-4000-8000-000000000002.png`]) expect(managedImageKey(path,id)).toBeNull();
});

it('rejects truncated decodable headers, mismatched content, and oversized dimensions',async()=>{
 const png=await sharp({create:{width:20,height:20,channels:3,background:'red'}}).png().toBuffer();
 for(const f of [new File([new Uint8Array(png.subarray(0,50))],'image.png',{type:'image/png'}),new File([new Uint8Array(png)],'image.jpg',{type:'image/jpeg'}),new File([new Uint8Array(await sharp({create:{width:8001,height:1,channels:3,background:'red'}}).png().toBuffer())],'image.png',{type:'image/png'})]) await expect(validateImageFile(f)).rejects.toMatchObject({reason:'validation'});
});
it('strips embedded metadata while keeping a fully decodable image',async()=>{const input=await sharp({create:{width:2,height:2,channels:3,background:'red'}}).jpeg().withMetadata().toBuffer();const result=await validateImageFile(new File([new Uint8Array(input)],'image.jpg',{type:'image/jpeg'}));const metadata=await sharp(result.bytes).metadata();expect(metadata.exif).toBeUndefined();expect(metadata.icc).toBeUndefined();expect((await sharp(result.bytes).raw().toBuffer()).length).toBe(12);});
it.each(['?x=1','#fragment','/extra','%00','\\other'])('rejects managed path suffix %s',suffix=>{expect(managedImageKey(`/api/program-images/${id}/00000000-0000-4000-8000-000000000002.png${suffix}`,id)).toBeNull();});
