do $$
begin
  perform set_config('sstli.legacy_actor', jsonb_build_object('username','admin','name','مدير النظام','role','super_admin','request_id','cccccccc-cccc-4ccc-8ccc-cccccccccccc')::text, true);
  perform private.legacy_admin_actor();
  delete from public.curriculum_items where program_id in (select id from public.programs where slug like 'image-verification-%');
  delete from public.career_paths where program_id in (select id from public.programs where slug like 'image-verification-%');
  delete from public.programs where slug like 'image-verification-%';
end $$;