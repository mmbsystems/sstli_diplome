begin;
-- Service-only, entity-specific transaction. No general SQL/table write interface.
create function public.legacy_admin_save_program(
 p_id uuid,p_expected_version bigint,p_program jsonb,p_curriculum jsonb,p_careers jsonb,
 p_archive text,p_actor_username text,p_actor_name text,p_request_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare previous public.programs; saved public.programs; proposed public.programs;
 actor jsonb; old_context text:=current_setting('sstli.legacy_actor',true);
 item jsonb; child_id uuid; child_ids uuid[]; ordinal integer; target_table text; items jsonb;
begin
 if current_setting('role',true) is distinct from 'service_role' or auth.uid() is not null then
  raise exception using errcode='42501',message='Server command only';
 end if;
 if p_actor_username is distinct from 'admin' or p_actor_name is distinct from 'مدير النظام' or p_request_id is null
 or p_expected_version is null or p_expected_version<0 or p_expected_version>=9007199254740990
 or (p_id is null and p_expected_version<>0) or (p_id is not null and p_expected_version<1)
 or p_archive is null or p_archive not in ('keep','archive','restore')
 or jsonb_typeof(p_program) is distinct from 'object'
 or jsonb_typeof(p_curriculum) is distinct from 'array' or jsonb_typeof(p_careers) is distinct from 'array'
 or jsonb_array_length(p_curriculum)>200 or jsonb_array_length(p_careers)>200
 or exists(select 1 from jsonb_object_keys(p_program) k where k not in
 ('name_ar','name_en','slug','program_type','specialization','searchable_keywords','description','duration_display','duration_standard','duration_summer','accredited_hours','accreditation_text','image_path','image_position','content_pending','classification_pending','is_active','publication_status','catalog_visibility','is_featured')) then
  raise exception using errcode='22023',message='Invalid program command';
 end if;
 actor:=jsonb_build_object('username',p_actor_username,'name',p_actor_name,'role','super_admin','request_id',p_request_id);
 perform set_config('sstli.legacy_actor',actor::text,true);
 perform private.legacy_admin_actor();
 if p_id is not null then
  begin
   select * into previous from public.programs where id=p_id for update nowait;
  exception when lock_not_available then raise exception using errcode='PT409',message='Version conflict'; end;
  if not found then raise exception using errcode='P0002',message='Program not found'; end if;
  if previous.version<>p_expected_version then raise exception using errcode='PT409',message='Version conflict'; end if;
 else
  previous.id:=gen_random_uuid(); previous.searchable_keywords:='{}'; previous.description:=''; previous.duration_display:='';
  previous.content_pending:=false; previous.classification_pending:=false; previous.is_active:=false;
  previous.publication_status:='draft'; previous.catalog_visibility:=false; previous.is_featured:=false;
 end if;
 proposed:=jsonb_populate_record(previous,p_program);
 if proposed.publication_status='published' and (btrim(proposed.description)='' or btrim(proposed.duration_display)='' or proposed.content_pending or proposed.classification_pending) then
  raise exception using errcode='22023',message='Incomplete publication';
 end if;
 if p_archive='archive' then proposed.archived_at:=coalesce(previous.archived_at,clock_timestamp()); proposed.is_active:=false; proposed.catalog_visibility:=false;
 elsif p_archive='restore' then proposed.archived_at:=null; proposed.is_active:=false; proposed.catalog_visibility:=false; proposed.publication_status:='draft';
 end if;
 if p_id is null then
  insert into public.programs(id,name_ar,name_en,slug,program_type,specialization,searchable_keywords,description,duration_display,duration_standard,duration_summer,accredited_hours,accreditation_text,image_path,image_position,content_pending,classification_pending,is_active,publication_status,catalog_visibility,is_featured,archived_at)
  values(proposed.id,proposed.name_ar,proposed.name_en,proposed.slug,proposed.program_type,proposed.specialization,proposed.searchable_keywords,proposed.description,proposed.duration_display,proposed.duration_standard,proposed.duration_summer,proposed.accredited_hours,proposed.accreditation_text,proposed.image_path,proposed.image_position,proposed.content_pending,proposed.classification_pending,proposed.is_active,proposed.publication_status,proposed.catalog_visibility,proposed.is_featured,proposed.archived_at) returning * into saved;
 else
  update public.programs set name_ar=proposed.name_ar,name_en=proposed.name_en,slug=proposed.slug,program_type=proposed.program_type,specialization=proposed.specialization,searchable_keywords=proposed.searchable_keywords,description=proposed.description,duration_display=proposed.duration_display,duration_standard=proposed.duration_standard,duration_summer=proposed.duration_summer,accredited_hours=proposed.accredited_hours,accreditation_text=proposed.accreditation_text,image_path=proposed.image_path,image_position=proposed.image_position,content_pending=proposed.content_pending,classification_pending=proposed.classification_pending,is_active=proposed.is_active,publication_status=proposed.publication_status,catalog_visibility=proposed.catalog_visibility,is_featured=proposed.is_featured,archived_at=proposed.archived_at
  where id=p_id returning * into saved;
 end if;
 set constraints public.curriculum_order, public.careers_order deferred;
 foreach target_table in array array['curriculum_items','career_paths'] loop
  items:=case when target_table='curriculum_items' then p_curriculum else p_careers end;
  child_ids:='{}'; ordinal:=0;
  for item in select value from jsonb_array_elements(items) loop
   if jsonb_typeof(item) is distinct from 'object' or exists(select 1 from jsonb_object_keys(item) k where k not in ('id','title'))
    or jsonb_typeof(item->'title') is distinct from 'string' or length(btrim(item->>'title')) not between 1 and 500 then
    raise exception using errcode='22023',message='Invalid nested item';
   end if;
   if item ? 'id' then
    child_id:=(item->>'id')::uuid;
    if child_id is null or child_id=any(child_ids) then raise exception using errcode='22023',message='Invalid nested identity'; end if;
    execute format('select id from public.%I where id=$1 and program_id=$2',target_table) into child_id using child_id,saved.id;
    if child_id is null then raise exception using errcode='22023',message='Invalid nested ownership'; end if;
    execute format('update public.%I set title=$1,sort_order=$2 where id=$3 and (title is distinct from $1 or sort_order is distinct from $2)',target_table) using btrim(item->>'title'),ordinal,child_id;
   else
    execute format('insert into public.%I(program_id,title,sort_order) values($1,$2,$3) returning id',target_table) into child_id using saved.id,btrim(item->>'title'),ordinal;
   end if;
   child_ids:=array_append(child_ids,child_id);ordinal:=ordinal+1;
  end loop;
  execute format('delete from public.%I where program_id=$1 and not(id=any($2))',target_table) using saved.id,child_ids;
 end loop;
 set constraints public.curriculum_order, public.careers_order immediate;
 perform set_config('sstli.legacy_actor',coalesce(old_context,''),true);
 return jsonb_build_object('program',to_jsonb(saved),'curriculum',coalesce((select jsonb_agg(to_jsonb(c) order by sort_order) from public.curriculum_items c where program_id=saved.id),'[]'::jsonb),'careers',coalesce((select jsonb_agg(to_jsonb(c) order by sort_order) from public.career_paths c where program_id=saved.id),'[]'::jsonb));
exception
 when unique_violation then raise exception using errcode='PT409',message='Slug conflict';
 when check_violation or not_null_violation or invalid_text_representation then raise exception using errcode='22023',message='Invalid program data';
end;
$$;
revoke all on function public.legacy_admin_save_program(uuid,bigint,jsonb,jsonb,jsonb,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.legacy_admin_save_program(uuid,bigint,jsonb,jsonb,jsonb,text,text,text,uuid) to service_role;
commit;
