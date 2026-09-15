begin;
create function private.audit_catalog_change() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  previous jsonb;
  current_row jsonb;
  item jsonb;
  actor uuid := auth.uid();
  actor_name text;
  operation text;
  scope uuid;
  target uuid;
begin
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
  operation := case when tg_op = 'INSERT' then 'create' when tg_op = 'DELETE' then 'delete'
    when previous->>'archived_at' is null and current_row->>'archived_at' is not null then 'archive'
    when previous->>'archived_at' is not null and current_row->>'archived_at' is null then 'restore'
    when previous->>'is_active' = 'true' and current_row->>'is_active' = 'false' then 'disable' else 'update' end;
  insert into public.activity_logs(actor_user_id, actor_label, action, entity_type, entity_id, entity_label, branch_id, before_data, after_data, metadata)
  values(actor, coalesce(actor_name, 'Database maintenance'), operation, tg_table_name, target,
    coalesce(item->>'name_ar', item->>'name', item->>'title', item->>'display_name', item->>'legacy_id', target::text),
    scope, previous, current_row, jsonb_build_object('system', actor is null, 'transaction_id', txid_current()::text));
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.audit_catalog_change() from public, anon, authenticated;
do $$
declare name text;
begin
  foreach name in array array['programs','branches','program_offerings','curriculum_items','career_paths','admin_profiles','admin_branch_assignments'] loop
    execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function private.audit_catalog_change()', name);
  end loop;
end;
$$;
create function private.reject_audit_mutation() returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Audit logs are append-only';
end;
$$;
revoke all on function private.reject_audit_mutation() from public, anon, authenticated;
create trigger audit_immutable before update or delete or truncate on public.activity_logs for each statement execute function private.reject_audit_mutation();
commit;
