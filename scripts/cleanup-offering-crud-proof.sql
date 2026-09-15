-- Verification-only maintenance operation. No application DELETE endpoint.
-- Exact IDs/request/version from offering-crud-proof-result.json; audit is retained.
begin;
select set_config('sstli.proof_offering_id', :'offering_id', true);
select set_config('sstli.proof_program_id', :'program_id', true);
select set_config('sstli.proof_branch_id', :'branch_id', true);
select set_config('sstli.proof_request_id', :'create_request_id', true);
select set_config('sstli.proof_version', :'version', true);
do $$declare target uuid:=current_setting('sstli.proof_offering_id')::uuid;begin
 if not exists(select 1 from public.program_offerings where id=target
 and program_id=current_setting('sstli.proof_program_id')::uuid and branch_id=current_setting('sstli.proof_branch_id')::uuid
 and legacy_id is null and sort_order=2147483000 and version=current_setting('sstli.proof_version')::bigint
 and archived_at is not null and not is_active and registration_state='closed') then raise exception 'Verification offering identity/state guard failed';end if;
 if not exists(select 1 from public.activity_logs where entity_type='program_offerings' and entity_id=target and action='create'
 and metadata#>>'{legacy_actor,request_id}'=current_setting('sstli.proof_request_id')
 and metadata#>>'{legacy_actor,username}'='admin' and after_data->>'legacy_id' is null
 and after_data->>'sort_order'='2147483000') then raise exception 'Verification audit provenance guard failed';end if;
 delete from public.program_offerings where id=target;
 -- Existing audit trigger records maintenance deletion and retains all prior entries.
end$$;
commit;
