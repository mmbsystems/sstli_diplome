-- Full-row snapshots catch leaked parent, child, version, timestamp, audit or scope writes.
begin;
create function pg_temp.snapshot_all() returns jsonb language sql security definer as $$
 select jsonb_build_object(
 'programs',(select jsonb_agg(to_jsonb(t) order by id) from public.programs t),
 'curriculum',(select jsonb_agg(to_jsonb(t) order by id) from public.curriculum_items t),
 'careers',(select jsonb_agg(to_jsonb(t) order by id) from public.career_paths t),
 'audit',(select jsonb_agg(to_jsonb(t) order by id) from public.activity_logs t),
 'branches',(select jsonb_agg(to_jsonb(t) order by id) from public.branches t),
 'offerings',(select jsonb_agg(to_jsonb(t) order by id) from public.program_offerings t));
$$;
create function pg_temp.scope_snapshot() returns jsonb language sql security definer as $$
 select pg_temp.snapshot_all() - 'programs' - 'curriculum' - 'careers' - 'audit';
$$;
create function pg_temp.assert_equal(a jsonb,b jsonb,label text) returns void language plpgsql as $$
begin if a is distinct from b then raise exception 'FAIL: %',label;end if;end$$;
create function pg_temp.fail_command(p uuid,v bigint,patch jsonb,c jsonb,k jsonb,expected text) returns void language plpgsql as $$
declare snapshot jsonb:=pg_temp.snapshot_all(); caught text;
begin
 begin
  perform public.legacy_admin_save_program(p,v,patch,c,k,'keep','admin','مدير النظام',gen_random_uuid());
 exception when others then caught:=sqlstate;end;
 if caught is distinct from expected then raise exception 'Expected %, got %',expected,caught;end if;
 perform pg_temp.assert_equal(pg_temp.snapshot_all(),snapshot,'entire failed mutation rolls back');
end$$;
insert into public.programs(name_ar,slug,program_type) values('Unrelated','atomic-unrelated','diploma');
insert into public.branches(name,city) values('Branch','City');
insert into public.program_offerings(program_id,branch_id,study_mode,price)
 select p.id,b.id,'online',7999 from public.programs p cross join public.branches b;
set local role service_role;
do $$declare r jsonb;p uuid;c jsonb;k jsonb;scope_before jsonb:=pg_temp.scope_snapshot();v bigint:=1;
begin
 r:=public.legacy_admin_save_program(null,0,'{"name_ar":"Atomic","slug":"atomic-test","program_type":"diploma"}','[{"title":"A"},{"title":"B"}]','[{"title":"X"},{"title":"Y"}]','keep','admin','مدير النظام',gen_random_uuid());
 p:=(r#>>'{program,id}')::uuid;
 select jsonb_agg(jsonb_build_object('id',value->'id','title',value->'title') order by ord) into c from jsonb_array_elements(r->'curriculum') with ordinality t(value,ord);
 select jsonb_agg(jsonb_build_object('id',value->'id','title',value->'title') order by ord) into k from jsonb_array_elements(r->'careers') with ordinality t(value,ord);
 perform pg_temp.assert_equal(pg_temp.scope_snapshot(),scope_before,'create scope');
 r:=public.legacy_admin_save_program(p,v,'{"name_ar":"Atomic edited"}',c,k,'keep','admin','مدير النظام',gen_random_uuid());v:=v+1;
 perform pg_temp.assert_equal(pg_temp.scope_snapshot(),scope_before,'update scope');
 perform pg_temp.assert_equal(r#>'{curriculum,0,id}',c#>'{0,id}','unchanged curriculum UUID');
 perform pg_temp.assert_equal(r#>'{careers,0,id}',k#>'{0,id}','unchanged career UUID');
 c:=jsonb_build_array(jsonb_set(c->1,'{title}','"B edited"'),c->0,jsonb_build_object('title','C'));
 k:=jsonb_build_array(jsonb_set(k->1,'{title}','"Y edited"'),k->0,jsonb_build_object('title','Z'));
 r:=public.legacy_admin_save_program(p,v,'{}',c,k,'keep','admin','مدير النظام',gen_random_uuid());v:=v+1;
 perform pg_temp.assert_equal(r#>'{curriculum,0,id}',c#>'{0,id}','edited reordered curriculum UUID');
 perform pg_temp.assert_equal(r#>'{curriculum,1,id}',c#>'{1,id}','reordered curriculum UUID');
 perform pg_temp.assert_equal(r#>'{careers,0,id}',k#>'{0,id}','edited reordered career UUID');
 perform pg_temp.assert_equal(r#>'{careers,1,id}',k#>'{1,id}','reordered career UUID');
 perform pg_temp.assert_equal(pg_temp.scope_snapshot(),scope_before,'nested scope');
 perform pg_temp.fail_command(p,v-1,'{"name_ar":"stale"}','[]','[]','PT409');
 perform pg_temp.fail_command(p,null,'{}',c,k,'22023');
 perform pg_temp.fail_command(p,v,'{"name_ar":"bad curriculum"}','[{"title":"valid first"},{"title":""}]',k,'22023');
 perform pg_temp.fail_command(p,v,'{"name_ar":"bad career"}','[{"title":"changed curriculum"}]','[{"title":"valid first"},{"title":""}]','22023');
 perform pg_temp.fail_command(p,v,'{}',jsonb_build_array(c->0,c->0),k,'22023');
 perform pg_temp.fail_command(p,v,'{}',c,jsonb_build_array(k->0,k->0),'22023');
 perform pg_temp.fail_command(p,v,'{}','[{"id":"bad","title":"A"}]',k,'22023');
 perform pg_temp.fail_command(p,v,'{}',c,'[{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","title":"X"}]','22023');
 perform pg_temp.fail_command(p,v,'{"publication_status":"published"}',c,k,'22023');
 perform pg_temp.fail_command(p,v,'{"slug":"atomic-unrelated"}',c,k,'PT409');
 perform pg_temp.fail_command(null,0,'{"name_ar":"duplicate","slug":"atomic-test","program_type":"diploma"}',c,k,'PT409');
 perform pg_temp.fail_command(null,0,'{"slug":"invalid-create"}',c,k,'22023');
 perform pg_temp.fail_command(gen_random_uuid(),1,'{}',c,k,'P0002');
 perform pg_temp.assert_equal(pg_temp.scope_snapshot(),scope_before,'failed scope');
 c:=jsonb_build_array(c->0);k:=jsonb_build_array(k->0);
 r:=public.legacy_admin_save_program(p,v,'{}',c,k,'keep','admin','مدير النظام',gen_random_uuid());v:=v+1;
 perform pg_temp.assert_equal(to_jsonb(jsonb_array_length(r->'curriculum')),'1','curriculum removal');
 perform pg_temp.assert_equal(to_jsonb(jsonb_array_length(r->'careers')),'1','career removal');
 r:=public.legacy_admin_save_program(p,v,'{}',c,k,'archive','admin','مدير النظام',gen_random_uuid());v:=v+1;
 perform pg_temp.assert_equal(pg_temp.scope_snapshot(),scope_before,'archive scope');
 r:=public.legacy_admin_save_program(p,v,'{"is_active":true,"catalog_visibility":true}',c,k,'restore','admin','مدير النظام',gen_random_uuid());v:=v+1;
 perform pg_temp.assert_equal(pg_temp.scope_snapshot(),scope_before,'restore scope');
 perform pg_temp.assert_equal(r#>'{program,is_active}','false','safe restore');
 perform set_config('test.atomic_id',p::text,true);
 perform set_config('test.atomic_version',v::text,true);
 perform set_config('test.atomic_c',c::text,true);perform set_config('test.atomic_k',k::text,true);
end$$;
reset role;
create function pg_temp.synthetic_failure() returns trigger language plpgsql as $$begin raise exception 'synthetic failure';end$$;
-- Fail late, after the parent and first child were modified.
create trigger test_child_failure before update on public.career_paths for each row execute function pg_temp.synthetic_failure();
set local role service_role;
select pg_temp.fail_command(current_setting('test.atomic_id')::uuid,current_setting('test.atomic_version')::bigint,'{"name_ar":"fail"}','[{"title":"new curriculum"}]',jsonb_set(current_setting('test.atomic_k')::jsonb,'{0,title}','"changed"'),'P0001');
reset role;
drop trigger test_child_failure on public.career_paths;
create trigger test_audit_failure before insert on public.activity_logs for each row execute function pg_temp.synthetic_failure();
set local role service_role;
select pg_temp.fail_command(current_setting('test.atomic_id')::uuid,current_setting('test.atomic_version')::bigint,'{"name_ar":"audit fail"}','[]','[]','P0001');
reset role;
rollback;

