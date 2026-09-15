begin;
create function public.legacy_admin_save_offering(p_id uuid,p_expected_version bigint,p_offering jsonb,p_archive text,p_actor_username text,p_actor_name text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare previous public.program_offerings; proposed public.program_offerings; saved public.program_offerings; parent public.programs; branch public.branches;
 k text; amount numeric; old_context text:=current_setting('sstli.legacy_actor',true);
begin
 if current_setting('role',true) is distinct from 'service_role' or auth.uid() is not null then raise exception using errcode='42501',message='Server command only';end if;
 if p_actor_username is distinct from 'admin' or p_actor_name is distinct from 'مدير النظام' or p_request_id is null
 or p_expected_version is null or p_expected_version<0 or p_expected_version>=9007199254740990
 or (p_id is null and (p_expected_version<>0 or p_archive<>'keep')) or (p_id is not null and p_expected_version<1)
 or p_archive is null or p_archive not in ('keep','archive','restore') or jsonb_typeof(p_offering) is distinct from 'object' then
 raise exception using errcode='22023',message='Invalid offering command';end if;
 if not p_offering ?& array['program_id','branch_id','study_mode','gender','price','min_down_payment','installment_months','accredited_hours_override','registration_state','is_active','sort_order']
 or exists(select 1 from jsonb_object_keys(p_offering) f where f not in ('program_id','branch_id','study_mode','gender','price','min_down_payment','installment_months','accredited_hours_override','registration_state','is_active','sort_order')) then
 raise exception using errcode='22023',message='Unknown or missing offering field';end if;
 foreach k in array array['program_id','branch_id'] loop
  if jsonb_typeof(p_offering->k) is distinct from 'string' or p_offering->>k !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception using errcode='22023',message='Invalid relationship';end if;
 end loop;
 if jsonb_typeof(p_offering->'is_active') is distinct from 'boolean' or p_offering->>'study_mode' is null or p_offering->>'study_mode' not in ('onsite','online')
 or p_offering->>'gender' is null or p_offering->>'gender' not in ('male','female','both') or p_offering->>'registration_state' is null or p_offering->>'registration_state' not in ('unknown','open','closed') then
 raise exception using errcode='22023',message='Invalid offering state';end if;
 foreach k in array array['price','min_down_payment','installment_months','accredited_hours_override','sort_order'] loop
  if p_offering->k='null'::jsonb and k<>'sort_order' then continue;end if;
  if jsonb_typeof(p_offering->k) is distinct from 'number' then raise exception using errcode='22023',message='Invalid numeric type';end if;
  amount:=(p_offering->>k)::numeric;
  if k in ('price','min_down_payment') then
   if amount<0 or amount>9999999999.99 or amount<>round(amount,2) then raise exception using errcode='22023',message='Invalid money precision';end if;
  elsif amount<(case when k='sort_order' then 0 else 1 end) or amount>2147483647 or amount<>trunc(amount) then
   raise exception using errcode='22023',message='Invalid integer';
  end if;
 end loop;
 begin
  lock table public.program_offerings in share row exclusive mode nowait;
  if p_id is not null then
   select * into previous from public.program_offerings where id=p_id for update nowait;
   if not found then raise exception using errcode='P0002',message='Offering not found';end if;
   if previous.version<>p_expected_version then raise exception using errcode='PT409',message='Version conflict';end if;
  end if;
  -- Archival operations only change lifecycle state; they never overwrite prices or relationships.
  proposed:=case when p_archive='keep' then jsonb_populate_record(previous,p_offering) else previous end;
  select * into parent from public.programs where id=proposed.program_id for share nowait;
  if not found then raise exception using errcode='P0002',message='Program not found';end if;
  select * into branch from public.branches where id=proposed.branch_id for share nowait;
  if not found then raise exception using errcode='P0002',message='Branch not found';end if;
 exception when lock_not_available then raise exception using errcode='PT409',message='Concurrent mutation';end;
 if p_archive<>'archive' and (parent.archived_at is not null or branch.archived_at is not null) then raise exception using errcode='PT409',message='Archived relationship';end if;
 if proposed.min_down_payment is not null and (proposed.price is null or proposed.min_down_payment>proposed.price or proposed.installment_months is null) then raise exception using errcode='22023',message='Invalid installment terms';end if;
 if p_archive='archive' then proposed.archived_at:=coalesce(previous.archived_at,clock_timestamp());proposed.is_active:=false;
 elsif p_archive='restore' then proposed.archived_at:=null;proposed.is_active:=false;end if;
 perform set_config('sstli.legacy_actor',jsonb_build_object('username',p_actor_username,'name',p_actor_name,'role','super_admin','request_id',p_request_id)::text,true);
 perform private.legacy_admin_actor();
 if p_id is null then
  insert into public.program_offerings(program_id,branch_id,study_mode,gender,price,min_down_payment,installment_months,accredited_hours_override,registration_state,is_active,sort_order)
  values(proposed.program_id,proposed.branch_id,proposed.study_mode,proposed.gender,proposed.price,proposed.min_down_payment,proposed.installment_months,proposed.accredited_hours_override,proposed.registration_state,proposed.is_active,proposed.sort_order) returning * into saved;
 else
  update public.program_offerings set program_id=proposed.program_id,branch_id=proposed.branch_id,study_mode=proposed.study_mode,gender=proposed.gender,price=proposed.price,min_down_payment=proposed.min_down_payment,installment_months=proposed.installment_months,accredited_hours_override=proposed.accredited_hours_override,registration_state=proposed.registration_state,is_active=proposed.is_active,sort_order=proposed.sort_order,archived_at=proposed.archived_at where id=p_id returning * into saved;
 end if;
 perform set_config('sstli.legacy_actor',coalesce(old_context,''),true);
 return jsonb_build_object('offering',to_jsonb(saved),'program',to_jsonb(parent),'branch',to_jsonb(branch));
exception
 when unique_violation then raise exception using errcode='PT409',message='Offering context conflict';
 when check_violation or not_null_violation or invalid_text_representation or numeric_value_out_of_range then raise exception using errcode='22023',message='Invalid offering data';
end;
$$;
revoke all on function public.legacy_admin_save_offering(uuid,bigint,jsonb,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.legacy_admin_save_offering(uuid,bigint,jsonb,text,text,text,uuid) to service_role;
commit;
