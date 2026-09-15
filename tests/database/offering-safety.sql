begin;
grant select on public.program_offerings,public.activity_logs to service_role;
create function pg_temp.safe_check(ok boolean) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Offering safety assertion failed';end if;end$$;
insert into public.programs(id,name_ar,slug,program_type) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Test','offering-safety','diploma');
insert into public.branches(id,name,city) values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Test','City');
set local role service_role;
do $$declare payload jsonb:='{"program_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","branch_id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","study_mode":"onsite","gender":"both","price":100,"min_down_payment":null,"installment_months":null,"accredited_hours_override":null,"registration_state":"unknown","is_active":false,"sort_order":0}'; a uuid;b uuid;logs bigint;
begin
 a:=(public.legacy_admin_save_offering(null,0,payload,'keep','admin','مدير النظام',gen_random_uuid())#>>'{offering,id}')::uuid;
 perform public.legacy_admin_save_offering(a,1,payload,'archive','admin','مدير النظام',gen_random_uuid());
 b:=(public.legacy_admin_save_offering(null,0,payload,'keep','admin','مدير النظام',gen_random_uuid())#>>'{offering,id}')::uuid;
 select count(*) into logs from public.activity_logs;
 begin perform public.legacy_admin_save_offering(a,2,payload,'restore','admin','مدير النظام',gen_random_uuid());raise exception 'Duplicate restore accepted';exception when sqlstate 'PT409' then null;end;
 perform pg_temp.safe_check(logs=(select count(*) from public.activity_logs));
 perform pg_temp.safe_check((select version=2 and archived_at is not null from public.program_offerings where id=a));
 perform public.legacy_admin_save_offering(b,1,payload,'archive','admin','مدير النظام',gen_random_uuid());
 perform public.legacy_admin_save_offering(a,2,payload,'restore','admin','مدير النظام',gen_random_uuid());
 perform set_config('test.offering_a',a::text,true);perform set_config('test.payload',payload::text,true);
end$$;
reset role;
update public.program_offerings set legacy_id='historical-identity' where id=current_setting('test.offering_a')::uuid;
set local role service_role;
select pg_temp.safe_check(public.legacy_admin_save_offering(current_setting('test.offering_a')::uuid,4,current_setting('test.payload')::jsonb||'{"price":120}','keep','admin','مدير النظام',gen_random_uuid())#>>'{offering,legacy_id}'='historical-identity');
reset role;
update public.branches set archived_at=now() where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
set local role service_role;
do $$declare logs bigint;begin
 select count(*) into logs from public.activity_logs;
 begin perform public.legacy_admin_save_offering(current_setting('test.offering_a')::uuid,5,current_setting('test.payload')::jsonb,'keep','admin','مدير النظام',gen_random_uuid());raise exception 'Archived branch accepted';exception when sqlstate 'PT409' then null;end;
 perform pg_temp.safe_check(logs=(select count(*) from public.activity_logs));
 perform public.legacy_admin_save_offering(current_setting('test.offering_a')::uuid,5,current_setting('test.payload')::jsonb,'archive','admin','مدير النظام',gen_random_uuid());
 begin perform public.legacy_admin_save_offering(current_setting('test.offering_a')::uuid,6,current_setting('test.payload')::jsonb,'restore','admin','مدير النظام',gen_random_uuid());raise exception 'Archived restore accepted';exception when sqlstate 'PT409' then null;end;
end$$;
reset role;
-- Maintenance deletion is schema-supported and retains audit references to the existing branch.
delete from public.program_offerings where id=current_setting('test.offering_a')::uuid;
select pg_temp.safe_check(exists(select 1 from public.activity_logs where entity_id=current_setting('test.offering_a')::uuid and action='delete'));
select pg_temp.safe_check(exists(select 1 from public.activity_logs where entity_id=current_setting('test.offering_a')::uuid and action='create'));
rollback;
