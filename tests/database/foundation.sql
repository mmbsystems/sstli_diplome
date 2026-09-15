-- Synthetic fixtures only, executed in a disposable local cluster by test-database.mjs.
begin;
create function pg_temp.assert_ok(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %', message; end if; end;
$$;
create function pg_temp.expect_error(command text, expected_state text) returns void language plpgsql as $$
begin
  begin execute command;
  exception when others then
    if sqlstate <> expected_state then raise exception 'Expected %, got %: %', expected_state, sqlstate, sqlerrm; end if;
    return;
  end;
  raise exception 'Expected failure: %', command;
end;
$$;

insert into auth.users(id) select ('00000000-0000-0000-0000-00000000000' || n)::uuid from generate_series(1,6) n;
insert into public.admin_profiles(user_id, display_name, role, is_active) values
('00000000-0000-0000-0000-000000000001','SA','super_admin',true),
('00000000-0000-0000-0000-000000000002','CM','content_manager',true),
('00000000-0000-0000-0000-000000000003','BM','branch_manager',true),
('00000000-0000-0000-0000-000000000004','V','viewer',true),
('00000000-0000-0000-0000-000000000005','Disabled','super_admin',false);
insert into public.programs(id,name_ar,slug,program_type,description,duration_display,publication_status,is_active,catalog_visibility) values
('10000000-0000-0000-0000-000000000001','Published','published','diploma','Description','Two years','published',true,true),
('10000000-0000-0000-0000-000000000002','Draft','draft','diploma','','','draft',false,false);
insert into public.branches(id,name,city,is_active) values
('20000000-0000-0000-0000-000000000001','A','City',true),
('20000000-0000-0000-0000-000000000002','B','City',true);
insert into public.program_offerings(id,program_id,branch_id,study_mode,price,min_down_payment,installment_months,is_active) values
('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','onsite',13000,250,24,true),
('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','online',7999,250,24,true);
insert into public.admin_branch_assignments(user_id,branch_id) values ('00000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000001');
insert into public.curriculum_items(program_id,title,sort_order) values
('10000000-0000-0000-0000-000000000001','Subject 1',0),
('10000000-0000-0000-0000-000000000001','Subject 2',1),
('10000000-0000-0000-0000-000000000002','Private subject',0);
insert into public.career_paths(program_id,title,sort_order) values
('10000000-0000-0000-0000-000000000001','Career',0),
('10000000-0000-0000-0000-000000000002','Private career',0);

select pg_temp.assert_ok((select count(*)=8 from pg_tables where schemaname='public' and rowsecurity), 'RLS on all eight tables');
select pg_temp.assert_ok(not exists(select 1 from information_schema.role_table_grants where grantee in ('anon','authenticated') and table_schema='public' and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')), 'no direct writes');
select pg_temp.assert_ok(not has_function_privilege('anon','private.current_admin_role()','execute'), 'anonymous cannot execute helpers');
select pg_temp.assert_ok(not has_function_privilege('authenticated','private.audit_catalog_change()','execute'), 'audit trigger cannot be called directly');
select pg_temp.assert_ok((13000::numeric-250)/24 = 531.25, 'deposit math parity');

set local role anon;
select pg_temp.expect_error('select * from public.programs','42501');
select pg_temp.expect_error('select * from public.admin_profiles','42501');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000006',true);
select pg_temp.assert_ok((select count(*)=0 from public.programs),'unprofiled user denied');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',true);
select pg_temp.assert_ok((select count(*)=0 from public.programs),'disabled SA denied');
select pg_temp.assert_ok((select count(*)=0 from public.admin_profiles),'disabled personnel access denied');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
select pg_temp.assert_ok((select count(*)=1 from public.programs),'viewer sees published only');
select pg_temp.assert_ok((select count(*)=1 from public.program_offerings),'viewer cannot infer draft offers');
select pg_temp.assert_ok((select count(*)=2 from public.curriculum_items),'viewer cannot see draft curriculum');
select pg_temp.assert_ok((select count(*)=1 from public.career_paths),'viewer cannot see draft careers');
select pg_temp.assert_ok((select count(*)=0 from public.activity_logs),'viewer cannot read audit');
select pg_temp.assert_ok((select count(*)=1 from public.admin_profiles),'viewer sees only self');
select pg_temp.expect_error('update public.admin_profiles set role=''super_admin''','42501');
select pg_temp.expect_error('update public.program_offerings set price=0','42501');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
select pg_temp.assert_ok((select count(*)=2 from public.programs),'BM reads shared content');
select pg_temp.assert_ok((select count(*)=1 from public.branches),'BM branch scoped');
select pg_temp.assert_ok((select count(*)=1 from public.program_offerings),'BM offering scoped');
select pg_temp.assert_ok(not exists(select 1 from public.activity_logs where branch_id <> '20000000-0000-0000-0000-000000000001' or entity_type in ('admin_profiles','admin_branch_assignments')),'BM log scope');
select pg_temp.expect_error('insert into public.admin_branch_assignments(user_id,branch_id) values (auth.uid(),''20000000-0000-0000-0000-000000000002'')','42501');
select pg_temp.expect_error('update public.program_offerings set branch_id=''20000000-0000-0000-0000-000000000002''','42501');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
select pg_temp.assert_ok((select count(*)=2 from public.program_offerings),'CM reads all offerings');
select pg_temp.assert_ok(not exists(select 1 from public.activity_logs where entity_type in ('admin_profiles','admin_branch_assignments')),'CM cannot read personnel audit');
select pg_temp.expect_error('update public.programs set description=''unsafe direct publish''','42501');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select pg_temp.assert_ok((select count(*)=5 from public.admin_profiles),'SA reads personnel');
select pg_temp.expect_error('delete from public.programs','42501');
select pg_temp.expect_error('insert into public.activity_logs(actor_label,action,entity_type,entity_id,entity_label) values (''forged'',''update'',''programs'',''10000000-0000-0000-0000-000000000001'',''forged'')','42501');
reset role;

-- Trusted maintenance updates retain the request actor and emit before/after atomically.
update public.program_offerings set price=14000, updated_at='2000-01-01', version=999 where id='30000000-0000-0000-0000-000000000001';
select pg_temp.assert_ok((select version=2 and updated_at > '2020-01-01' from public.program_offerings where id='30000000-0000-0000-0000-000000000001'),'timestamps and versions owned by trigger');
select pg_temp.assert_ok(exists(select 1 from public.activity_logs where actor_user_id='00000000-0000-0000-0000-000000000001' and before_data->>'price'='13000.00' and after_data->>'price'='14000.00'),'audit has trusted actor and diff');
select pg_temp.expect_error('update public.activity_logs set actor_label=''changed''','P0001');
select pg_temp.expect_error('delete from public.activity_logs','P0001');
select pg_temp.expect_error('truncate public.activity_logs','P0001');
select pg_temp.expect_error('update public.program_offerings set price=-1','23514');
select pg_temp.expect_error('update public.program_offerings set price=''NaN''','23514');
select pg_temp.expect_error('update public.program_offerings set installment_months=0','23514');
select pg_temp.expect_error('update public.program_offerings set min_down_payment=99999','23514');
select pg_temp.expect_error('update public.program_offerings set branch_id=''20000000-0000-0000-0000-000000000099''','23503');
select pg_temp.expect_error('update public.programs set slug=''published'' where slug=''draft''','23505');
select pg_temp.expect_error('update public.curriculum_items set sort_order=-1','23514');
select pg_temp.expect_error('insert into public.program_offerings(program_id,branch_id,study_mode) values (''10000000-0000-0000-0000-000000000001'',''20000000-0000-0000-0000-000000000001'',''onsite'')','23505');
set constraints curriculum_order deferred;
update public.curriculum_items set sort_order=1-sort_order where program_id='10000000-0000-0000-0000-000000000001';
set constraints curriculum_order immediate;
update public.program_offerings set archived_at=now(),is_active=false where id='30000000-0000-0000-0000-000000000001';
update public.program_offerings set archived_at=null where id='30000000-0000-0000-0000-000000000001';
select pg_temp.assert_ok((select price=14000 and not is_active from public.program_offerings where id='30000000-0000-0000-0000-000000000001'),'restore preserves price and stays inactive');
select pg_temp.assert_ok(exists(select 1 from public.activity_logs where action='restore'),'restore audited');
rollback;
select 'Database foundation assertions passed' as result;
