begin;
-- Server-mediated legacy sessions never become Supabase browser identities.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('program-images','program-images',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

-- Restrictive policies also prevent a future broad permissive policy from
-- exposing this bucket. Service-role Storage requests bypass RLS as designed.
create policy program_images_server_only on storage.objects as restrictive
for all to anon,authenticated
using (bucket_id <> 'program-images') with check (bucket_id <> 'program-images');
create policy program_images_bucket_server_only on storage.buckets as restrictive
for all to anon,authenticated
using (id <> 'program-images') with check (id <> 'program-images');
commit;
