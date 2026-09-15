-- Verification-only operator script; never exposed through HTTP/RPC.
-- psql -v program_id=<report.programId> -v program_slug=<report.slug> -f ...
-- Requires a maintenance connection, not browser/service API credentials.
begin;
select set_config('sstli.verification_id', :'program_id', true);
select set_config('sstli.verification_slug', :'program_slug', true);
do $$
declare target uuid:=current_setting('sstli.verification_id')::uuid;
begin
 if not exists(select 1 from public.programs where id=target
   and slug=current_setting('sstli.verification_slug')
   and slug like 'crud-verification-%' and legacy_id is null
   and name_ar like 'برنامج اختبار CRUD%') then
  raise exception 'Verification cleanup identity guard failed';
 end if;
 if exists(select 1 from public.program_offerings where program_id=target) then
  raise exception 'Verification program unexpectedly has offerings';
 end if;
 delete from public.curriculum_items where program_id=target;
 delete from public.career_paths where program_id=target;
 delete from public.programs where id=target;
 -- Retain append-only audit, including these maintenance deletes.
end$$;
commit;
