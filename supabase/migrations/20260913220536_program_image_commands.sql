begin;
-- Only the image command may assign/remove managed references. Generic metadata
-- saves can retain them, but cannot resurrect deleted or foreign-program objects.
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

create function public.legacy_admin_set_program_image(p_id uuid,p_expected_version bigint,p_image_path text,p_actor_username text,p_actor_name text,p_request_id uuid)
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
 if previous.archived_at is not null or (p_image_path is null and coalesce(previous.image_path,'') not like '/api/program-images/'||p_id::text||'/%')
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
commit;
