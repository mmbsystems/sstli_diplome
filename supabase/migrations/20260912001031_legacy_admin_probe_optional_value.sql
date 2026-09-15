-- Explicit defaults let generated RPC types represent omitted deletion values.
begin;
create or replace function public.legacy_admin_probe(
  p_id uuid, p_action text, p_expected_version bigint, p_value text default null,
  p_actor_username text default null, p_actor_name text default null, p_request_id uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare previous private.admin_write_probes; saved private.admin_write_probes;
  actor jsonb; previous_context text := current_setting('sstli.legacy_actor',true);
begin
  if current_setting('role',true) is distinct from 'service_role' or auth.uid() is not null then
    raise exception using errcode='42501', message='Server command only';
  end if;
  if p_id is null or p_request_id is null or p_actor_username is distinct from 'admin' or p_actor_name is distinct from 'مدير النظام'
    or p_action is null or p_action not in ('create','update','delete') or p_expected_version is null
    or p_expected_version < 0 or p_expected_version >= 9007199254740990
    or (p_action='create' and p_expected_version<>0) or (p_action<>'create' and p_expected_version<1)
    or (p_action<>'delete' and (p_value is null or length(btrim(p_value)) not between 1 and 160 or p_value ~ '[[:cntrl:]]'))
    or (p_action='delete' and p_value is not null) then
    raise exception using errcode='22023', message='Invalid command';
  end if;
  actor := jsonb_build_object('username',p_actor_username,'name',p_actor_name,'role','super_admin','request_id',p_request_id);
  perform set_config('sstli.legacy_actor',actor::text,true);
  actor := private.legacy_admin_actor();
  if p_action='create' then
    insert into private.admin_write_probes(id,value,version) values(p_id,btrim(p_value),1)
      on conflict (id) do nothing returning * into saved;
    if not found then raise exception using errcode='40001', message='Version conflict'; end if;
  else
    select * into previous from private.admin_write_probes p where p.id=p_id for update;
    if not found or previous.deleted then raise exception using errcode='P0002', message='Record not found'; end if;
    if previous.version<>p_expected_version then raise exception using errcode='40001', message='Version conflict'; end if;
    update private.admin_write_probes set value=case when p_action='delete' then null else btrim(p_value) end,
      deleted=(p_action='delete'), version=version+1
      where id=p_id and version=p_expected_version returning * into saved;
    if not found then raise exception using errcode='40001', message='Version conflict'; end if;
  end if;
  insert into private.legacy_write_audit(test_id,action,actor,before_data,after_data,request_id)
    values(p_id,p_action,actor,case when p_action='create' then null else to_jsonb(previous) end,to_jsonb(saved),p_request_id);
  perform set_config('sstli.legacy_actor',coalesce(previous_context,''),true);
  return jsonb_build_object('id',saved.id,'version',saved.version,'deleted',saved.deleted);
end;
$$;
commit;
