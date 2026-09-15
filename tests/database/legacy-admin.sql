-- Disposable local cluster only. All synthetic records roll back.
begin;
create function pg_temp.assert_ok(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %', message; end if; end; $$;
create function pg_temp.expect_error(command text, expected_state text) returns void language plpgsql as $$
begin
  begin execute command;
  exception when others then
    if sqlstate <> expected_state then raise exception 'Expected %, got %', expected_state, sqlstate; end if;
    return;
  end;
  raise exception 'Expected failure';
end; $$;
select pg_temp.assert_ok(not has_function_privilege('anon','public.legacy_admin_probe(uuid,text,bigint,text,text,text,uuid)','execute'), 'anon cannot invoke command');
select pg_temp.assert_ok(not has_function_privilege('authenticated','public.legacy_admin_probe(uuid,text,bigint,text,text,text,uuid)','execute'), 'authenticated cannot invoke command');
set local role authenticated;
select pg_temp.expect_error($q$select public.legacy_admin_probe('90000000-0000-4000-8000-000000000001','create',0,'test','admin','مدير النظام',gen_random_uuid())$q$, '42501');
reset role;
set local role service_role;
select public.legacy_admin_probe('90000000-0000-4000-8000-000000000001','create',0,'test','admin','مدير النظام',gen_random_uuid());
select pg_temp.expect_error($q$select public.legacy_admin_probe('90000000-0000-4000-8000-000000000001','create',0,'duplicate','admin','مدير النظام',gen_random_uuid())$q$, 'PT409');
select public.legacy_admin_probe('90000000-0000-4000-8000-000000000001','update',1,'changed','admin','مدير النظام',gen_random_uuid());
select pg_temp.expect_error($q$select public.legacy_admin_probe('90000000-0000-4000-8000-000000000001','update',1,'stale','admin','مدير النظام',gen_random_uuid())$q$, 'PT409');
select pg_temp.expect_error($q$select public.legacy_admin_probe('90000000-0000-4000-8000-000000000002','update',1,'missing','admin','مدير النظام',gen_random_uuid())$q$, 'P0002');
select pg_temp.expect_error($q$select public.legacy_admin_probe('90000000-0000-4000-8000-000000000002','create',0,'test','staff','Staff',gen_random_uuid())$q$, '22023');
select pg_temp.expect_error($q$select public.legacy_admin_probe('90000000-0000-4000-8000-000000000002','create',0,'','admin','مدير النظام',gen_random_uuid())$q$, '22023');
select public.legacy_admin_probe('90000000-0000-4000-8000-000000000001','delete',2,null,'admin','مدير النظام',gen_random_uuid());
select pg_temp.expect_error($q$select public.legacy_admin_probe('90000000-0000-4000-8000-000000000001','create',0,'reuse','admin','مدير النظام',gen_random_uuid())$q$, 'PT409');
select pg_temp.expect_error('select * from private.admin_write_probes', '42501');
reset role;
select pg_temp.assert_ok((select count(*)=3 from private.legacy_write_audit), 'exactly three committed test changes');
select pg_temp.assert_ok((select bool_and(actor->>'username'='admin' and actor->>'name'='مدير النظام' and actor->>'role'='super_admin') from private.legacy_write_audit), 'legacy actor attributed');
select pg_temp.assert_ok((select deleted and value is null and version=3 from private.admin_write_probes), 'test row retired, version retained');
select pg_temp.assert_ok(coalesce(current_setting('sstli.legacy_actor',true),'')='', 'actor context restored');
select pg_temp.expect_error('delete from private.legacy_write_audit', 'P0001');
select pg_temp.expect_error('truncate private.legacy_write_audit', 'P0001');
-- Failure to append audit must roll back the entire mutation.
create function pg_temp.fail_audit() returns trigger language plpgsql as $$begin raise exception 'synthetic audit failure'; end;$$;
create trigger force_failure before insert on private.legacy_write_audit for each row execute function pg_temp.fail_audit();
set local role service_role;
select pg_temp.expect_error($q$select public.legacy_admin_probe('90000000-0000-4000-8000-000000000003','create',0,'rollback','admin','مدير النظام',gen_random_uuid())$q$, 'P0001');
reset role;
select pg_temp.assert_ok(not exists(select 1 from private.admin_write_probes where id='90000000-0000-4000-8000-000000000003'), 'audit failure rolls back row');
drop trigger force_failure on private.legacy_write_audit;
-- Verify the catalog trigger can attribute future controlled commands without Auth users.
grant insert on public.branches to service_role;
set local role service_role;
select pg_temp.expect_error($q$insert into public.branches(name,city) values ('denied','test')$q$, '42501');
select set_config('sstli.legacy_actor', jsonb_build_object('username','admin','name','مدير النظام','role','super_admin','request_id',gen_random_uuid())::text,true);
insert into public.branches(name,city) values ('Synthetic local attribution','test');
reset role;
select pg_temp.assert_ok((select actor_user_id is null and actor_label='مدير النظام' and metadata->'legacy_actor'->>'username'='admin' and metadata->>'system'='false' from public.activity_logs limit 1), 'catalog audit uses honest legacy identity');
rollback;
