begin;
-- Phase A only. No offering DML; exact labels and imported keys are never normalized.
create function public.legacy_admin_save_branch(
 p_id uuid,p_expected_version bigint,p_branch jsonb,p_archive text,
 p_actor_username text,p_actor_name text,p_request_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare previous public.branches; saved public.branches; proposed public.branches;
 old_context text:=current_setting('sstli.legacy_actor',true); k text;
begin
 if current_setting('role',true) is distinct from 'service_role' or auth.uid() is not null then
  raise exception using errcode='42501',message='Server command only';
 end if;
 if p_actor_username is distinct from 'admin' or p_actor_name is distinct from 'مدير النظام' or p_request_id is null
 or p_expected_version is null or p_expected_version<0 or p_expected_version>=9007199254740990
 or (p_id is null and (p_expected_version<>0 or p_archive<>'keep')) or (p_id is not null and p_expected_version<1)
 or p_archive is null or p_archive not in ('keep','archive','restore')
 or jsonb_typeof(p_branch) is distinct from 'object' then
  raise exception using errcode='22023',message='Invalid branch command';
 end if;
 if exists(select 1 from jsonb_object_keys(p_branch) f where f not in ('name','city','source_region_label','address','directory_listed','is_active')) then
  raise exception using errcode='22023',message='Unknown branch field';
 end if;
 foreach k in array array['name','city'] loop
  if jsonb_typeof(p_branch->k) is distinct from 'string' or length(btrim(p_branch->>k))=0 or length(p_branch->>k)>300 or (p_branch->>k)~'[[:cntrl:]]' then
   raise exception using errcode='22023',message='Invalid branch label';
  end if;
 end loop;
 foreach k in array array['source_region_label','address'] loop
  if p_branch ? k and p_branch->k<>'null'::jsonb and (jsonb_typeof(p_branch->k)<>'string' or length(p_branch->>k)>case when k='address' then 2000 else 300 end or (p_branch->>k)~'[[:cntrl:]]') then
   raise exception using errcode='22023',message='Invalid branch text';
  end if;
 end loop;
 if jsonb_typeof(p_branch->'directory_listed') is distinct from 'boolean' or jsonb_typeof(p_branch->'is_active') is distinct from 'boolean' then
  raise exception using errcode='22023',message='Invalid branch state';
 end if;
 -- Serialize identity checks without imposing a new uniqueness rule on historical rows.
 -- NOWAIT avoids unbounded waits and reports concurrent mutation as a controlled conflict.
 begin
  lock table public.branches in share row exclusive mode nowait;
  if p_id is not null then
   select * into previous from public.branches where id=p_id for update nowait;
   if not found then raise exception using errcode='P0002',message='Branch not found'; end if;
   if previous.version<>p_expected_version then raise exception using errcode='PT409',message='Version conflict'; end if;
  end if;
  if p_archive='archive' then
   lock table public.program_offerings in share mode nowait;
   if exists(select 1 from public.program_offerings where branch_id=p_id and is_active and archived_at is null) then
    raise exception using errcode='PT409',message='Active offerings prevent archive';
   end if;
  end if;
 exception when lock_not_available then raise exception using errcode='PT409',message='Concurrent mutation'; end;
 if (p_id is null or previous.name is distinct from p_branch->>'name' or previous.city is distinct from p_branch->>'city')
 and exists(select 1 from public.branches where name=p_branch->>'name' and city=p_branch->>'city' and (p_id is null or id<>p_id)) then
  raise exception using errcode='PT409',message='Exact branch identity conflict';
 end if;
 proposed:=jsonb_populate_record(previous,p_branch);
 if p_archive='archive' then proposed.archived_at:=coalesce(previous.archived_at,clock_timestamp()); proposed.is_active:=false;
 elsif p_archive='restore' then proposed.archived_at:=null; proposed.is_active:=false;
 end if;
 perform set_config('sstli.legacy_actor',jsonb_build_object('username',p_actor_username,'name',p_actor_name,'role','super_admin','request_id',p_request_id)::text,true);
 perform private.legacy_admin_actor();
 if p_id is null then
  insert into public.branches(name,city,source_region_label,address,directory_listed,is_active)
  values(proposed.name,proposed.city,proposed.source_region_label,proposed.address,proposed.directory_listed,proposed.is_active) returning * into saved;
 else
  update public.branches set name=proposed.name,city=proposed.city,source_region_label=proposed.source_region_label,address=proposed.address,directory_listed=proposed.directory_listed,is_active=proposed.is_active,archived_at=proposed.archived_at
  where id=p_id returning * into saved;
 end if;
 -- Existing audit and version triggers run in this same transaction; failures roll back everything.
 perform set_config('sstli.legacy_actor',coalesce(old_context,''),true);
 return to_jsonb(saved);
exception
 when unique_violation then raise exception using errcode='PT409',message='Branch identity conflict';
 when check_violation or not_null_violation or invalid_text_representation then raise exception using errcode='22023',message='Invalid branch data';
end;
$$;
revoke all on function public.legacy_admin_save_branch(uuid,bigint,jsonb,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.legacy_admin_save_branch(uuid,bigint,jsonb,text,text,text,uuid) to service_role;
commit;
