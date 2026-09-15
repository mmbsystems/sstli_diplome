begin;
do $$begin
 if not exists(select 1 from storage.buckets where id='program-images' and public=false and file_size_limit=5242880 and allowed_mime_types=array['image/jpeg','image/png','image/webp']) then raise exception 'Bucket configuration'; end if;
end $$;
-- Deliberately permissive unrelated policies must not open program images.
create policy test_broad_objects on storage.objects for all to anon,authenticated using(true) with check(true);
create policy test_broad_buckets on storage.buckets for all to anon,authenticated using(true) with check(true);
insert into storage.objects(bucket_id,name) values('program-images','test.png');
set local role anon;
do $$begin
 if exists(select 1 from storage.objects where bucket_id='program-images') or exists(select 1 from storage.buckets where id='program-images') then raise exception 'Anonymous read allowed'; end if;
 begin insert into storage.objects(bucket_id,name) values('program-images','bad.png'); raise exception 'Anonymous upload allowed'; exception when insufficient_privilege then null; end;
end $$;
set local role authenticated;
do $$begin
 if exists(select 1 from storage.objects where bucket_id='program-images') then raise exception 'Browser read allowed'; end if;
 begin insert into storage.objects(bucket_id,name) values('program-images','bad.png'); raise exception 'Browser upload allowed'; exception when insufficient_privilege then null; end;
 delete from storage.objects where bucket_id='program-images';
 if found then raise exception 'Browser delete allowed'; end if;
 update storage.buckets set public=true where id='program-images';
 if found then raise exception 'Browser bucket mutation allowed'; end if;
end $$;
set local role service_role;
insert into storage.objects(bucket_id,name) values('program-images','server.png');
do $$begin if (select count(*) from storage.objects where bucket_id='program-images')<>2 then raise exception 'Server access failed'; end if; end $$;
rollback;
