begin;
insert into public.programs(id,name_ar,slug,program_type,image_path,image_position) values('dddddddd-dddd-4ddd-8ddd-dddddddddddd','Image test','image-test','diploma','/images/local.jpg','top');
set local role service_role;
do $$declare r jsonb; p uuid:='dddddddd-dddd-4ddd-8ddd-dddddddddddd'; path text:='/api/program-images/dddddddd-dddd-4ddd-8ddd-dddddddddddd/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png'; begin
 r:=public.legacy_admin_set_program_image(p,1,path,'admin','مدير النظام',gen_random_uuid());
 if r->>'version'<>'2' or r->>'image'<>path or r->>'oldImage'<>'/images/local.jpg' then raise exception 'Image result'; end if;
 begin perform public.legacy_admin_set_program_image(p,1,null,'admin','مدير النظام',gen_random_uuid()); raise exception 'Stale accepted'; exception when sqlstate 'PT409' then null; end;
 begin perform public.legacy_admin_save_program(p,2,'{"image_path":null}','[]','[]','keep','admin','مدير النظام',gen_random_uuid()); raise exception 'Managed override accepted'; exception when invalid_parameter_value then null; end;
 r:=public.legacy_admin_set_program_image(p,2,replace(path,'aaaaaaaa-aaaa','bbbbbbbb-bbbb'),'admin','مدير النظام',gen_random_uuid());
 r:=public.legacy_admin_set_program_image(p,3,null,'admin','مدير النظام',gen_random_uuid());
 if r->>'version'<>'4' or r->>'image' is not null then raise exception 'Remove failed'; end if;
 begin perform public.legacy_admin_set_program_image(p,4,'/images/local.jpg','admin','مدير النظام',gen_random_uuid()); raise exception 'Local accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.legacy_admin_set_program_image(p,4,replace(path,p::text,gen_random_uuid()::text),'admin','مدير النظام',gen_random_uuid()); raise exception 'Foreign accepted'; exception when invalid_parameter_value then null; end;
end $$;
reset role;
do $$begin
 if (select count(*) from public.activity_logs where entity_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd')<>4 then raise exception 'Misleading audit'; end if;
 if (select image_position from public.programs where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd')<>'top' then raise exception 'Position changed'; end if;
 if has_function_privilege('anon','public.legacy_admin_set_program_image(uuid,bigint,text,text,text,uuid)','execute') or has_function_privilege('authenticated','public.legacy_admin_set_program_image(uuid,bigint,text,text,text,uuid)','execute') then raise exception 'Browser privilege'; end if;
end $$;
create function pg_temp.fail_image_audit() returns trigger language plpgsql as $$begin raise exception 'image audit failure'; end $$;
create trigger test_image_audit before insert on public.activity_logs for each row execute function pg_temp.fail_image_audit();
set local role service_role;
do $$begin
 begin perform public.legacy_admin_set_program_image('dddddddd-dddd-4ddd-8ddd-dddddddddddd',4,'/api/program-images/dddddddd-dddd-4ddd-8ddd-dddddddddddd/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png','admin','مدير النظام',gen_random_uuid()); raise exception 'Failure accepted';
 exception when raise_exception then if sqlerrm<>'image audit failure' then raise; end if; end;
end $$;
reset role;
do $$begin if (select version<>4 or image_path is not null from public.programs where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd') then raise exception 'Audit rollback failed'; end if; end $$;
rollback;

begin;
insert into public.programs(id,name_ar,slug,program_type,image_path,image_position) values('dddddddd-dddd-4ddd-8ddd-dddddddddddd','Local image','local-image','diploma','/images/local.jpg','top');
set local role service_role;
do $$declare r jsonb; begin
 r:=public.legacy_admin_set_program_image('dddddddd-dddd-4ddd-8ddd-dddddddddddd',1,null,'admin','مدير النظام',gen_random_uuid());
 if r->>'version'<>'2' or r->>'image' is not null or r->>'oldImage'<>'/images/local.jpg' then raise exception 'Local reference removal failed'; end if;
end $$;
reset role;
do $$begin
 if (select image_position from public.programs where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd')<>'top' then raise exception 'Local position changed'; end if;
 if not exists(select 1 from public.activity_logs where entity_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd' and metadata#>>'{legacy_actor,username}'='admin') then raise exception 'Local removal attribution missing'; end if;
end $$;
rollback;
