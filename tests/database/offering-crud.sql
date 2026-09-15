begin;
grant select on public.program_offerings,public.activity_logs to service_role;
create function pg_temp.offer_check(ok boolean) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Offering assertion failed';end if;end$$;
insert into public.programs(id,name_ar,slug,program_type,accredited_hours) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Test','offering-crud-test','diploma',84);
insert into public.branches(id,name,city) values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Test branch','Test city');
create temp table offering_parent_before as select to_jsonb(p) as row from public.programs p union all select to_jsonb(b) from public.branches b;
set local role service_role;
do $$declare payload jsonb:='{"program_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","branch_id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","study_mode":"onsite","gender":"both","price":12000,"min_down_payment":2400,"installment_months":12,"accredited_hours_override":75,"registration_state":"unknown","is_active":false,"sort_order":0}'; r jsonb; target uuid; logs bigint; previous jsonb;
begin
 r:=public.legacy_admin_save_offering(null,0,payload,'keep','admin','مدير النظام',gen_random_uuid());target:=(r#>>'{offering,id}')::uuid;
 perform pg_temp.offer_check(r#>>'{offering,version}'='1' and r#>>'{offering,legacy_id}' is null);
 r:=public.legacy_admin_save_offering(target,1,payload||'{"price":14400,"installment_months":24}','keep','admin','مدير النظام',gen_random_uuid());
 perform pg_temp.offer_check(r#>>'{offering,version}'='2' and (r#>>'{offering,price}')::numeric=14400 and r#>>'{offering,accredited_hours_override}'='75');
 perform pg_temp.offer_check(((r#>>'{offering,price}')::numeric-(r#>>'{offering,min_down_payment}')::numeric)/(r#>>'{offering,installment_months}')::integer=500);
 select count(*) into logs from public.activity_logs;select to_jsonb(o) into previous from public.program_offerings o where id=target;
 begin perform public.legacy_admin_save_offering(target,1,payload,'keep','admin','مدير النظام',gen_random_uuid());raise exception 'Stale accepted';exception when sqlstate 'PT409' then null;end;
 begin perform public.legacy_admin_save_offering(null,0,payload,'keep','admin','مدير النظام',gen_random_uuid());raise exception 'Duplicate accepted';exception when sqlstate 'PT409' then null;end;
 begin perform public.legacy_admin_save_offering(target,2,payload||'{"price":1.001}','keep','admin','مدير النظام',gen_random_uuid());raise exception 'Precision accepted';exception when invalid_parameter_value then null;end;
 begin perform public.legacy_admin_save_offering(target,2,payload||'{"min_down_payment":14000}','keep','admin','مدير النظام',gen_random_uuid());raise exception 'Deposit accepted';exception when invalid_parameter_value then null;end;
 begin perform public.legacy_admin_save_offering(target,2,payload||'{"legacy_id":"fake"}','keep','admin','مدير النظام',gen_random_uuid());raise exception 'Identity accepted';exception when invalid_parameter_value then null;end;
 begin perform public.legacy_admin_save_offering(target,2,payload||jsonb_build_object('branch_id',gen_random_uuid()),'keep','admin','مدير النظام',gen_random_uuid());raise exception 'Missing parent accepted';exception when no_data_found then null;end;
 begin perform public.legacy_admin_save_offering(target,2,payload,'keep','fake','مدير النظام',gen_random_uuid());raise exception 'Actor accepted';exception when invalid_parameter_value then null;end;
 perform pg_temp.offer_check(logs=(select count(*) from public.activity_logs));perform pg_temp.offer_check(previous=(select to_jsonb(o) from public.program_offerings o where id=target));
 r:=public.legacy_admin_save_offering(target,2,payload,'archive','admin','مدير النظام',gen_random_uuid());perform pg_temp.offer_check(r#>>'{offering,archived_at}' is not null and r#>>'{offering,is_active}'='false');
 -- Archive/restore commands preserve existing prices, even if supplied display payload is stale.
 perform pg_temp.offer_check((r#>>'{offering,price}')::numeric=14400);
 r:=public.legacy_admin_save_offering(target,3,payload||'{"is_active":true}','restore','admin','مدير النظام',gen_random_uuid());perform pg_temp.offer_check(r#>>'{offering,version}'='4' and r#>>'{offering,archived_at}' is null and r#>>'{offering,is_active}'='false' and (r#>>'{offering,price}')::numeric=14400);
 perform set_config('test.offering_id',target::text,true);
end$$;
reset role;
select pg_temp.offer_check((select count(*)=4 and bool_and(actor_label='مدير النظام' and metadata#>>'{legacy_actor,username}'='admin' and metadata#>>'{legacy_actor,role}'='super_admin') from public.activity_logs where entity_id=current_setting('test.offering_id')::uuid));
select pg_temp.offer_check(not exists((select to_jsonb(p) as row from public.programs p union all select to_jsonb(b) from public.branches b) except select row from offering_parent_before));
-- Imported legacy ID remains immutable on metadata update; inactive historical parents are permitted.
update public.program_offerings set legacy_id='off-historical' where id=current_setting('test.offering_id')::uuid;
create function pg_temp.offer_fail() returns trigger language plpgsql as $$begin raise exception 'synthetic offering failure';end$$;
create trigger test_offering_audit_failure before insert on public.activity_logs for each row execute function pg_temp.offer_fail();
set local role service_role;
do $$declare payload jsonb; logs bigint; begin
 select to_jsonb(o)-'id'-'legacy_id'-'created_at'-'updated_at'-'version'-'archived_at' into payload from public.program_offerings o where id=current_setting('test.offering_id')::uuid;
 select count(*) into logs from public.activity_logs;
 begin perform public.legacy_admin_save_offering(current_setting('test.offering_id')::uuid,5,payload||'{"price":9999}','keep','admin','مدير النظام',gen_random_uuid());raise exception 'Failure ignored';exception when raise_exception then if sqlerrm<>'synthetic offering failure' then raise;end if;end;
 perform pg_temp.offer_check(logs=(select count(*) from public.activity_logs));
end$$;
reset role;
select pg_temp.offer_check((select price=14400 and version=5 and legacy_id='off-historical' from public.program_offerings where id=current_setting('test.offering_id')::uuid));
select pg_temp.offer_check(not has_function_privilege('anon','public.legacy_admin_save_offering(uuid,bigint,jsonb,text,text,text,uuid)','EXECUTE') and not has_function_privilege('authenticated','public.legacy_admin_save_offering(uuid,bigint,jsonb,text,text,text,uuid)','EXECUTE'));
rollback;
