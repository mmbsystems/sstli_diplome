begin;
grant select on public.branches, public.activity_logs to service_role;
create function pg_temp.branch_check(ok boolean) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Branch assertion failed'; end if; end$$;
create temp table branch_offering_before as select * from public.program_offerings;
set local role service_role;
do $$declare r jsonb; target uuid; payload jsonb := '{"name":"سكوير","city":"الدمام","source_region_label":null,"address":null,"directory_listed":false,"is_active":false}'; logs bigint; snapshot jsonb;
begin
 r:=public.legacy_admin_save_branch(null,0,payload,'keep','admin','مدير النظام',gen_random_uuid());
 target:=(r->>'id')::uuid;
 perform pg_temp.branch_check(r->>'version'='1' and r->>'legacy_key' is null);
 perform set_config('test.branch_id',target::text,true);
 r:=public.legacy_admin_save_branch(target,1,payload||'{"address":"updated"}','keep','admin','مدير النظام',gen_random_uuid());
 perform pg_temp.branch_check(r->>'version'='2' and r->>'name'='سكوير');
 select count(*) into logs from public.activity_logs;
 select to_jsonb(b) into snapshot from public.branches b where id=target;
 begin
  perform public.legacy_admin_save_branch(target,1,payload,'keep','admin','مدير النظام',gen_random_uuid()); raise exception 'Stale accepted';
 exception when sqlstate 'PT409' then null; end;
 begin
  perform public.legacy_admin_save_branch(null,0,payload,'keep','admin','مدير النظام',gen_random_uuid()); raise exception 'Duplicate accepted';
 exception when sqlstate 'PT409' then null; end;
 begin
  perform public.legacy_admin_save_branch(target,2,payload||'{"legacy_key":"forged"}','keep','admin','مدير النظام',gen_random_uuid()); raise exception 'Identity injection accepted';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.legacy_admin_save_branch(target,2,payload||'{"name":12}','keep','admin','مدير النظام',gen_random_uuid()); raise exception 'Invalid type accepted';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.legacy_admin_save_branch(target,2,payload,'keep','impostor','مدير النظام',gen_random_uuid()); raise exception 'Actor spoof accepted';
 exception when invalid_parameter_value then null; end;
 perform pg_temp.branch_check(logs=(select count(*) from public.activity_logs));
 perform pg_temp.branch_check(snapshot=(select to_jsonb(b) from public.branches b where id=target));
 r:=public.legacy_admin_save_branch(target,2,payload,'archive','admin','مدير النظام',gen_random_uuid());
 perform pg_temp.branch_check(r->>'version'='3' and r->>'archived_at' is not null);
 r:=public.legacy_admin_save_branch(target,3,payload,'restore','admin','مدير النظام',gen_random_uuid());
 perform pg_temp.branch_check(r->>'version'='4' and r->>'archived_at' is null and r->>'is_active'='false');
end$$;
reset role;
select pg_temp.branch_check((select count(*)=4 and bool_and(actor_user_id is null and actor_label='مدير النظام' and metadata#>>'{legacy_actor,username}'='admin' and metadata#>>'{legacy_actor,role}'='super_admin') from public.activity_logs where entity_id=current_setting('test.branch_id')::uuid));
-- Imported identity remains exact even when display fields change.
update public.branches set legacy_key='الدمام::حي الضيافة' where id=current_setting('test.branch_id')::uuid;
set local role service_role;
select pg_temp.branch_check(public.legacy_admin_save_branch(current_setting('test.branch_id')::uuid,5,'{"name":"حي الضيافة","city":"الدمام","source_region_label":null,"address":null,"directory_listed":false,"is_active":false}','keep','admin','مدير النظام',gen_random_uuid())->>'legacy_key'='الدمام::حي الضيافة');
reset role;
-- Real active link: archive must conflict without cascading changes.
insert into public.programs(id,name_ar,slug,program_type) values('abababab-abab-4bab-8bab-abababababab','Test','branch-link-test','diploma');
insert into public.program_offerings(program_id,branch_id,study_mode,gender,is_active) values('abababab-abab-4bab-8bab-abababababab',current_setting('test.branch_id')::uuid,'onsite','both',true);
create temp table branch_link_before as select * from public.program_offerings;
set local role service_role;
do $$declare logs bigint; begin
 select count(*) into logs from public.activity_logs;
 begin
 perform public.legacy_admin_save_branch(current_setting('test.branch_id')::uuid,6,'{"name":"حي الضيافة","city":"الدمام","source_region_label":null,"address":null,"directory_listed":false,"is_active":false}','archive','admin','مدير النظام',gen_random_uuid());raise exception 'Unsafe archive accepted';
 exception when sqlstate 'PT409' then null; end;
 perform pg_temp.branch_check(logs=(select count(*) from public.activity_logs));
end$$;
reset role;
select pg_temp.branch_check(not exists((select * from public.program_offerings except select * from branch_link_before) union all (select * from branch_link_before except select * from public.program_offerings)));
create function pg_temp.branch_fail_audit() returns trigger language plpgsql as $$begin raise exception 'synthetic audit failure';end$$;
create trigger branch_audit_failure before insert on public.activity_logs for each row execute function pg_temp.branch_fail_audit();
set local role service_role;
do $$begin
 begin
 perform public.legacy_admin_save_branch(current_setting('test.branch_id')::uuid,6,'{"name":"must rollback","city":"الدمام","source_region_label":null,"address":null,"directory_listed":false,"is_active":false}','keep','admin','مدير النظام',gen_random_uuid());raise exception 'Audit failure accepted';
 exception when raise_exception then if sqlerrm<>'synthetic audit failure' then raise;end if;end;
end$$;
reset role;
select pg_temp.branch_check((select version=6 and name='حي الضيافة' from public.branches where id=current_setting('test.branch_id')::uuid));
drop trigger branch_audit_failure on public.activity_logs;
create function pg_temp.branch_fail_database() returns trigger language plpgsql as $$begin raise exception 'synthetic database failure';end$$;
create trigger zz_branch_database_failure after update on public.branches for each row execute function pg_temp.branch_fail_database();
set local role service_role;
do $$declare logs bigint; begin
 select count(*) into logs from public.activity_logs;
 begin
  perform public.legacy_admin_save_branch(current_setting('test.branch_id')::uuid,6,'{"name":"database rollback","city":"الدمام","source_region_label":null,"address":null,"directory_listed":false,"is_active":false}','keep','admin','مدير النظام',gen_random_uuid());raise exception 'Database failure accepted';
 exception when raise_exception then if sqlerrm<>'synthetic database failure' then raise;end if;end;
 perform pg_temp.branch_check(logs=(select count(*) from public.activity_logs));
end$$;
reset role;
select pg_temp.branch_check((select version=6 and name='حي الضيافة' from public.branches where id=current_setting('test.branch_id')::uuid));
select pg_temp.branch_check(not exists((select * from public.program_offerings except select * from branch_link_before) union all (select * from branch_link_before except select * from public.program_offerings)));
select pg_temp.branch_check(not has_function_privilege('anon','public.legacy_admin_save_branch(uuid,bigint,jsonb,text,text,text,uuid)','EXECUTE') and not has_function_privilege('authenticated','public.legacy_admin_save_branch(uuid,bigint,jsonb,text,text,text,uuid)','EXECUTE'));
rollback;
