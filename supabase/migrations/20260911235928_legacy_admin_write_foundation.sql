begin;

-- Identity context is trusted only under the DB role selected by the API gateway.
-- It is not a Supabase Auth identity and never changes auth.uid().
create function private.legacy_admin_actor() returns jsonb
language plpgsql stable set search_path = '' as $$
declare raw text := current_setting('sstli.legacy_actor', true); actor jsonb;
begin
  if raw is null or raw = '' then return null; end if;
  if current_setting('role', true) is distinct from 'service_role' or auth.uid() is not null then
    raise exception using errcode='42501', message='Untrusted legacy actor';
  end if;
  begin actor := raw::jsonb;
  exception when others then raise exception using errcode='22023', message='Invalid actor context'; end;
  if jsonb_typeof(actor) is distinct from 'object' or actor->>'username' is distinct from 'admin'
    or actor->>'name' is distinct from 'مدير النظام' or actor->>'role' is distinct from 'super_admin'
    or coalesce(actor->>'request_id','') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    raise exception using errcode='22023', message='Invalid actor context';
  end if;
  return actor;
end;
$$;
revoke all on function private.legacy_admin_actor() from public, anon, authenticated, service_role;

-- Private development records, deliberately separate from all catalog tables.
create table private.admin_write_probes (
  id uuid primary key,
  value text,
  version bigint not null check (version > 0 and version < 9007199254740991),
  deleted boolean not null default false,
  check ((deleted and value is null) or (not deleted and length(btrim(value)) between 1 and 160 and value is not null))
);
create table private.legacy_write_audit (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null,
  action text not null check (action in ('create','update','delete')),
  actor jsonb not null check (jsonb_typeof(actor)='object'),
  before_data jsonb,
  after_data jsonb not null,
  request_id uuid not null unique,
  transaction_id bigint not null default txid_current(),
  created_at timestamptz not null default clock_timestamp()
);
alter table private.admin_write_probes enable row level security;
alter table private.legacy_write_audit enable row level security;
revoke all on private.admin_write_probes, private.legacy_write_audit from public, anon, authenticated, service_role;
create trigger legacy_audit_immutable before update or delete or truncate on private.legacy_write_audit
for each statement execute function private.reject_audit_mutation();

-- The sole exposed mutation. There is no arbitrary table/SQL/catalog-row argument.
create function public.legacy_admin_probe(
  p_id uuid, p_action text, p_expected_version bigint, p_value text,
  p_actor_username text, p_actor_name text, p_request_id uuid
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
revoke all on function public.legacy_admin_probe(uuid,text,bigint,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.legacy_admin_probe(uuid,text,bigint,text,text,text,uuid) to service_role;

create or replace function private.audit_catalog_change() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  previous jsonb;
  current_row jsonb;
  item jsonb;
  actor uuid := auth.uid();
  actor_name text;
  legacy_actor jsonb := private.legacy_admin_actor();
  operation text;
  scope uuid;
  target uuid;
begin
  if current_setting('role',true)='service_role' and legacy_actor is null then
    raise exception using errcode='42501', message='Legacy writes require a controlled actor context';
  end if;
  if tg_op <> 'INSERT' then previous := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then current_row := to_jsonb(new); end if;
  if tg_op = 'UPDATE' and (previous - 'updated_at' - 'version') = (current_row - 'updated_at' - 'version') then return new; end if;
  item := coalesce(current_row, previous);
  target := coalesce((item->>'id')::uuid, (item->>'user_id')::uuid);
  if tg_table_name = 'branches' then scope := target;
  elsif tg_table_name in ('program_offerings','admin_branch_assignments') then scope := (item->>'branch_id')::uuid;
  end if;
  select display_name into actor_name from public.admin_profiles where user_id = actor;
  if actor is not null and actor_name is null then raise exception 'Audit actor must have an explicitly provisioned profile'; end if;
  if legacy_actor is not null then actor_name := legacy_actor->>'name'; end if;
  operation := case when tg_op = 'INSERT' then 'create' when tg_op = 'DELETE' then 'delete'
    when previous->>'archived_at' is null and current_row->>'archived_at' is not null then 'archive'
    when previous->>'archived_at' is not null and current_row->>'archived_at' is null then 'restore'
    when previous->>'is_active' = 'true' and current_row->>'is_active' = 'false' then 'disable' else 'update' end;
  insert into public.activity_logs(actor_user_id, actor_label, action, entity_type, entity_id, entity_label, branch_id, before_data, after_data, metadata)
  values(actor, coalesce(actor_name, 'Database maintenance'), operation, tg_table_name, target,
    coalesce(item->>'name_ar', item->>'name', item->>'title', item->>'display_name', item->>'legacy_id', target::text),
    scope, previous, current_row, jsonb_build_object('system', actor is null and legacy_actor is null, 'transaction_id', txid_current()::text, 'legacy_actor', legacy_actor));
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.audit_catalog_change() from public, anon, authenticated, service_role;

commit;
