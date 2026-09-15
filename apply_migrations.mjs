import {createClient} from '@supabase/supabase-js';
import {loadEnvFile} from 'node:process';
loadEnvFile('.env.local');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;
const PROJECT_REF = 'crzedkbjvujcmcikgvoe';

const db = createClient(SUPABASE_URL, SERVICE_KEY, {auth:{persistSession:false}});

async function runViaManagementAPI(sql, name) {
  console.log('Applying:', name);
  const mgmtUrl = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
  const response = await fetch(mgmtUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({query: sql})
  });
  const text = await response.text();
  if (!response.ok) {
    console.log('Error:', response.status, text);
    throw new Error(`Failed: ${name}`);
  }
  console.log('Success:', name);
}

async function main() {
  // Migration 1: 20260914105618 - storage policies (bucket already exists)
  const sql1 = `begin;
    insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
    values ('program-images','program-images',false,5242880,array['image/jpeg','image/png','image/webp'])
    on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
    create policy program_images_server_only on storage.objects as restrictive
    for all to anon,authenticated
    using (bucket_id <> 'program-images') with check (bucket_id <> 'program-images');
    create policy program_images_bucket_server_only on storage.buckets as restrictive
    for all to anon,authenticated
    using (id <> 'program-images') with check (id <> 'program-images');
    commit;`;
  await runViaManagementAPI(sql1, '20260914105618_program_image_storage.sql');
  
  // Migration 2: 20260913220536 - trigger only (function exists)
  const sql2 = `begin;
    create function private.guard_managed_program_image() returns trigger language plpgsql set search_path='' as $$
    begin
     if (tg_op='INSERT' or new.image_path is distinct from old.image_path)
     and (new.image_path like '/api/program-images/%' or (tg_op='UPDATE' and old.image_path like '/api/program-images/%'))
     and current_setting('sstli.image_command',true) is distinct from new.id::text then
       raise exception using errcode='22023',message='Use the image command';
     end if;
     return new;
    end; $$;
    revoke all on function private.guard_managed_program_image() from public,anon,authenticated;
    create trigger managed_image_guard before insert or update of image_path on public.programs for each row execute function private.guard_managed_program_image();
    commit;`;
  await runViaManagementAPI(sql2, '20260913220536_program_image_commands.sql (trigger)');
  
  // Migration 3: 20260914105708 - local removal override
  const sql3 = `begin;
    create or replace function public.legacy_admin_set_program_image(p_id uuid,p_expected_version bigint,p_image_path text,p_actor_username text,p_actor_name text,p_request_id uuid)
    returns jsonb language plpgsql security definer set search_path='' as $$
    declare previous public.programs; saved public.programs; old_actor text:=current_setting('sstli.legacy_actor',true); old_image text:=current_setting('sstli.image_command',true);
    begin
     if current_setting('role',true) is distinct from 'service_role' or auth.uid() is not null then raise exception using errcode='42501',message='Server command only'; end if;
     if p_id is null or p_expected_version is null or p_expected_version<1 or p_expected_version>=9007199254740990
     or p_actor_username is distinct from 'admin' or p_actor_name is distinct from 'مدير النظام' or p_request_id is null
     or (p_image_path is not null and p_image_path !~ ('^/api/program-images/'||p_id::text||'/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$')) then
       raise exception using errcode='22023',message='Invalid image command';
     end if;
     begin select * into previous from public.programs where id=p_id for update nowait;
     exception when lock_not_available then raise exception using errcode='PT409',message='Version conflict'; end;
     if not found then raise exception using errcode='P0002',message='Program not found'; end if;
     if previous.version<>p_expected_version then raise exception using errcode='PT409',message='Version conflict'; end if;
     if previous.archived_at is not null or (p_image_path is null and coalesce(previous.image_path,'') = '')
     or p_image_path is not distinct from previous.image_path then raise exception using errcode='22023',message='Invalid image change'; end if;
     perform set_config('sstli.legacy_actor',jsonb_build_object('username',p_actor_username,'name',p_actor_name,'role','super_admin','request_id',p_request_id)::text,true);
     perform private.legacy_admin_actor();
     perform set_config('sstli.image_command',p_id::text,true);
     update public.programs set image_path=p_image_path where id=p_id returning * into saved;
     perform set_config('sstli.image_command',coalesce(old_image,''),true);
     perform set_config('sstli.legacy_actor',coalesce(old_actor,''),true);
     return jsonb_build_object('id',saved.id,'version',saved.version,'image',saved.image_path,'updatedAt',saved.updated_at,'oldImage',previous.image_path);
    end; $$;
    revoke all on function public.legacy_admin_set_program_image(uuid,bigint,text,text,text,uuid) from public,anon,authenticated;
    grant execute on function public.legacy_admin_set_program_image(uuid,bigint,text,text,text,uuid) to service_role;
    commit;`;
  await runViaManagementAPI(sql3, '20260914105708_program_image_local_removal.sql');
  
  // Verify trigger exists
  const {data: triggers} = await db.from('information_schema.triggers').select('trigger_name').eq('event_object_table','programs').eq('trigger_name','managed_image_guard');
  console.log('Trigger after:', triggers?.length > 0 ? 'exists' : 'MISSING');
  
  // Test function with local path removal
  const {data: progs} = await db.from('programs').select('id,version,image_path').limit(1);
  const p = progs[0];
  console.log('Test program:', p);
  
  const {data, error} = await db.rpc('legacy_admin_set_program_image', {
    p_id: p.id,
    p_expected_version: p.version,
    p_image_path: null,
    p_actor_username: 'admin',
    p_actor_name: 'مدير النظام',
    p_request_id: '11111111-1111-4111-8111-111111111111'
  });
  console.log('Local removal test:', error ? error.message : 'Success - image cleared');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });