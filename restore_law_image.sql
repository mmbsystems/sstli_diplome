do $$
begin
  perform set_config('sstli.legacy_actor', jsonb_build_object('username','admin','name','مدير النظام','role','super_admin','request_id','88888888-8888-4888-8888-888888888888')::text, true);
  perform private.legacy_admin_actor();
  update public.programs set image_path = '/diploms_photos/القانون.png' where slug = 'law';
end $$;