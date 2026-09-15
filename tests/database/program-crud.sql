begin;
create function pg_temp.check_it(ok boolean) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'CRUD assertion failed'; end if;end$$;
set local role service_role;
do $$declare r jsonb; p uuid; c1 uuid;c2 uuid;v bigint; logs bigint; before_row jsonb;
begin
 r:=public.legacy_admin_save_program(null,0,'{"name_ar":"اختبار","slug":"crud-test","program_type":"diploma"}', '[{"title":"A"},{"title":"B"}]','[{"title":"Career"}]','keep','admin','مدير النظام',gen_random_uuid());
 p:=(r#>>'{program,id}')::uuid;c1:=(r#>>'{curriculum,0,id}')::uuid;c2:=(r#>>'{curriculum,1,id}')::uuid;
 perform pg_temp.check_it(r#>>'{program,version}'='1' and r#>>'{program,legacy_id}' is null);
 r:=public.legacy_admin_save_program(p,1,'{"name_ar":"محدث"}',jsonb_build_array(jsonb_build_object('id',c2,'title','B edited'),jsonb_build_object('id',c1,'title','A')),(r->'careers') - 0 || '[{"title":"New career"}]','keep','admin','مدير النظام',gen_random_uuid());
 perform pg_temp.check_it(r#>>'{program,version}'='2' and r#>>'{curriculum,0,id}'=c2::text and r#>>'{curriculum,1,id}'=c1::text);
 begin
  perform public.legacy_admin_save_program(p,1,'{}','[]','[]','keep','admin','مدير النظام',gen_random_uuid());raise exception 'Stale accepted';
 exception when sqlstate 'PT409' then null;end;
 begin
  perform public.legacy_admin_save_program(p,2,'{"name_ar":"must rollback"}','[{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","title":"bad ownership"}]','[]','keep','admin','مدير النظام',gen_random_uuid());raise exception 'Nested accepted';
 exception when invalid_parameter_value then null;end;
 begin
  perform public.legacy_admin_save_program(p,2,'{"publication_status":"published"}','[]','[]','keep','admin','مدير النظام',gen_random_uuid());raise exception 'Invalid publication accepted';
 exception when invalid_parameter_value then null;end;
 begin
  perform public.legacy_admin_save_program(null,0,'{"name_ar":"Duplicate","slug":"crud-test","program_type":"diploma"}','[]','[]','keep','admin','مدير النظام',gen_random_uuid());raise exception 'Duplicate accepted';
 exception when sqlstate 'PT409' then null;end;
 begin
  perform public.legacy_admin_save_program(gen_random_uuid(),1,'{}','[]','[]','keep','admin','مدير النظام',gen_random_uuid());raise exception 'Missing accepted';
 exception when no_data_found then null;end;
 begin
  perform public.legacy_admin_save_program(p,2,'{"legacy_id":"forged"}','[]','[]','keep','admin','مدير النظام',gen_random_uuid());raise exception 'Unsafe accepted';
 exception when invalid_parameter_value then null;end;
 r:=public.legacy_admin_save_program(p,2,'{}','[]','[]','archive','admin','مدير النظام',gen_random_uuid());
 perform pg_temp.check_it(r#>>'{program,version}'='3' and r#>>'{program,name_ar}'='محدث' and r#>>'{program,archived_at}' is not null and r->'curriculum'='[]');
 r:=public.legacy_admin_save_program(p,3,'{"is_active":true,"catalog_visibility":true}','[]','[]','restore','admin','مدير النظام',gen_random_uuid());
 perform pg_temp.check_it(r#>>'{program,version}'='4' and r#>>'{program,archived_at}' is null and r#>>'{program,is_active}'='false' and r#>>'{program,catalog_visibility}'='false' and r#>>'{program,publication_status}'='draft');
 perform set_config('test.program_id',p::text,true);
end$$;
reset role;
select pg_temp.check_it((select count(*)=4 from public.activity_logs where entity_id=current_setting('test.program_id')::uuid));
select pg_temp.check_it((select bool_and(actor_label='مدير النظام' and metadata#>>'{legacy_actor,username}'='admin' and metadata#>>'{legacy_actor,role}'='super_admin') from public.activity_logs where entity_id=current_setting('test.program_id')::uuid));
create function pg_temp.fail_audit() returns trigger language plpgsql as $$begin raise exception 'synthetic audit failure';end$$;
create trigger test_audit_failure before insert on public.activity_logs for each row execute function pg_temp.fail_audit();
set local role service_role;
do $$begin
 begin
 perform public.legacy_admin_save_program(current_setting('test.program_id')::uuid,4,'{"name_ar":"failed audit"}','[]','[]','keep','admin','مدير النظام',gen_random_uuid());raise exception 'Audit failure accepted';
 exception when raise_exception then if sqlerrm<>'synthetic audit failure' then raise;end if;end;
end$$;
reset role;
select pg_temp.check_it((select version=4 and name_ar='محدث' from public.programs where id=current_setting('test.program_id')::uuid));
select pg_temp.check_it(not has_function_privilege('anon','public.legacy_admin_save_program(uuid,bigint,jsonb,jsonb,jsonb,text,text,text,uuid)','EXECUTE') and not has_function_privilege('authenticated','public.legacy_admin_save_program(uuid,bigint,jsonb,jsonb,jsonb,text,text,text,uuid)','EXECUTE'));
rollback;

