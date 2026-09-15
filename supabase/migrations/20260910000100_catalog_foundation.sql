-- Phase 3A: schema only. No catalog/account seed or application cutover.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  name_ar text not null check (btrim(name_ar) <> ''),
  name_en text,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  program_type text not null check (program_type in ('diploma','qualifying-course','development-course')),
  specialization text,
  searchable_keywords text[] not null default '{}',
  description text not null default '',
  duration_display text not null default '',
  duration_standard text,
  duration_summer text,
  accredited_hours integer check (accredited_hours > 0),
  accreditation_text text,
  image_path text,
  image_position text,
  content_pending boolean not null default false,
  classification_pending boolean not null default false,
  is_active boolean not null default false,
  publication_status text not null default 'draft' check (publication_status in ('draft','published')),
  catalog_visibility boolean not null default false,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  archived_at timestamptz,
  check (legacy_id is null or btrim(legacy_id) <> ''),
  check (archived_at is null or (not is_active and not catalog_visibility)),
  check (publication_status <> 'published' or (btrim(description) <> '' and btrim(duration_display) <> '' and not content_pending))
);
comment on column public.programs.publication_status is 'Editorial approval only; never grants anonymous access. Draft/publish commands are deferred.';
comment on column public.programs.image_path is 'Legacy asset path initially. Private Storage and media ownership checks are a later phase.';

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  legacy_key text unique,
  name text not null check (btrim(name) <> ''),
  city text not null check (btrim(city) <> ''),
  source_region_label text,
  directory_listed boolean not null default false,
  address text,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  archived_at timestamptz,
  check (legacy_key is null or btrim(legacy_key) <> ''),
  check (archived_at is null or not is_active)
);
comment on column public.branches.source_region_label is 'Preserves source region=city without asserting an approved Saudi region mapping.';
comment on column public.branches.legacy_key is 'Exact city::branch source key. Do not normalize or silently merge aliases.';

create table public.program_offerings (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  program_id uuid not null references public.programs(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  study_mode text not null check (study_mode in ('onsite','online')),
  gender text not null default 'both' check (gender in ('male','female','both')),
  price numeric(12,2) check (price >= 0 and price <> 'NaN'::numeric),
  min_down_payment numeric(12,2) check (min_down_payment >= 0 and min_down_payment <> 'NaN'::numeric),
  installment_months integer check (installment_months > 0),
  accredited_hours_override integer check (accredited_hours_override > 0),
  registration_state text not null default 'unknown' check (registration_state in ('unknown','open','closed')),
  is_active boolean not null default false,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  archived_at timestamptz,
  check (legacy_id is null or btrim(legacy_id) <> ''),
  check (min_down_payment is null or (price is not null and min_down_payment <= price and installment_months is not null)),
  check (archived_at is null or not is_active)
);
comment on column public.program_offerings.price is 'SAR tuition from current price. No inferred discount, tax, registration fee or monthly minimum.';
comment on column public.program_offerings.min_down_payment is 'Upfront amount subtracted from tuition before dividing by installment_months.';
create unique index offerings_current_context on public.program_offerings(program_id, branch_id, study_mode, gender) where archived_at is null;

create table public.curriculum_items (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete restrict,
  title text not null check (btrim(title) <> ''),
  sort_order integer not null check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  constraint curriculum_order unique(program_id, sort_order) deferrable initially immediate
);
create table public.career_paths (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete restrict,
  title text not null check (btrim(title) <> ''),
  sort_order integer not null check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  constraint careers_order unique(program_id, sort_order) deferrable initially immediate
);

create table public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null check (btrim(display_name) <> ''),
  role text not null check (role in ('super_admin','content_manager','branch_manager','viewer')),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0)
);
comment on table public.admin_profiles is 'Explicit future provisioning only. No signup trigger, metadata role inference, or mapping from current staff accounts.';
create table public.admin_branch_assignments (
  user_id uuid not null references public.admin_profiles(user_id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (user_id, branch_id)
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.admin_profiles(user_id) on delete restrict,
  actor_label text not null,
  action text not null check (action in ('create','update','disable','archive','restore','delete')),
  entity_type text not null check (entity_type in ('programs','branches','program_offerings','curriculum_items','career_paths','admin_profiles','admin_branch_assignments')),
  entity_id uuid not null,
  entity_label text not null,
  branch_id uuid references public.branches(id) on delete restrict,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}' check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

-- B-tree unique constraints already index IDs, slugs, legacy keys and child ordering.
create index programs_type on public.programs(program_type);
create index programs_publication on public.programs(publication_status, is_active, updated_at desc, id) where archived_at is null;
create index branches_city on public.branches(city);
create index offerings_program on public.program_offerings(program_id);
create index offerings_branch_active on public.program_offerings(branch_id, is_active);
create index offerings_mode_program on public.program_offerings(study_mode, program_id) where archived_at is null;
create index assignments_branch on public.admin_branch_assignments(branch_id);
create index activity_newest on public.activity_logs(created_at desc, id);
create index activity_actor on public.activity_logs(actor_user_id, created_at desc);
create index activity_branch on public.activity_logs(branch_id, created_at desc);
create index activity_entity on public.activity_logs(entity_type, entity_id);

create function private.touch_row() returns trigger language plpgsql set search_path = '' as $$
begin
  new.created_at := old.created_at;
  new.updated_at := clock_timestamp();
  new.version := old.version + 1;
  return new;
end;
$$;
revoke all on function private.touch_row() from public, anon, authenticated;

-- Locked helpers avoid RLS recursion on profiles/assignments. Never exposed as RPCs.
create function private.current_admin_role() returns text language sql stable security definer set search_path = '' as $$
  select role from public.admin_profiles where user_id = (select auth.uid()) and is_active;
$$;
create function private.is_super_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(private.current_admin_role() = 'super_admin', false);
$$;
create function private.can_manage_branch(target uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(private.current_admin_role() in ('super_admin','content_manager') or
    (private.current_admin_role() = 'branch_manager' and exists (
      select 1 from public.admin_branch_assignments where user_id = (select auth.uid()) and branch_id = target
    )), false);
$$;
revoke all on function private.current_admin_role(), private.is_super_admin(), private.can_manage_branch(uuid) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.current_admin_role(), private.is_super_admin(), private.can_manage_branch(uuid) to authenticated;

-- Every table denies anon access, even when a program is published.
do $$
declare name text;
begin
  foreach name in array array['programs','branches','program_offerings','curriculum_items','career_paths','admin_profiles','admin_branch_assignments','activity_logs'] loop
    execute format('alter table public.%I enable row level security', name);
    execute format('revoke all on public.%I from public, anon, authenticated', name);
    execute format('grant select on public.%I to authenticated', name);
  end loop;
  foreach name in array array['programs','branches','program_offerings','curriculum_items','career_paths','admin_profiles'] loop
    execute format('create trigger touch_row before update on public.%I for each row execute function private.touch_row()', name);
  end loop;
end;
$$;

create policy programs_read on public.programs for select to authenticated using (
  (select private.current_admin_role()) in ('super_admin','content_manager','branch_manager') or
  ((select private.current_admin_role()) = 'viewer' and publication_status = 'published' and catalog_visibility and is_active and archived_at is null)
);
create policy branches_read on public.branches for select to authenticated using (
  private.can_manage_branch(id) or ((select private.current_admin_role()) = 'viewer' and is_active and archived_at is null)
);
create policy offerings_read on public.program_offerings for select to authenticated using (
  private.can_manage_branch(branch_id) or ((select private.current_admin_role()) = 'viewer' and is_active and archived_at is null
    and exists (select 1 from public.programs p where p.id = program_id)
    and exists (select 1 from public.branches b where b.id = branch_id))
);
create policy curriculum_read on public.curriculum_items for select to authenticated using (
  exists (select 1 from public.programs p where p.id = program_id)
);
create policy careers_read on public.career_paths for select to authenticated using (
  exists (select 1 from public.programs p where p.id = program_id)
);
create policy profiles_read on public.admin_profiles for select to authenticated using (
  (select private.is_super_admin()) or (user_id = (select auth.uid()) and (select private.current_admin_role()) is not null)
);
create policy assignments_read on public.admin_branch_assignments for select to authenticated using (
  (select private.is_super_admin()) or (user_id = (select auth.uid()) and (select private.current_admin_role()) = 'branch_manager')
);
create policy activity_read on public.activity_logs for select to authenticated using (
  (select private.is_super_admin()) or
  ((select private.current_admin_role()) = 'content_manager' and entity_type not in ('admin_profiles','admin_branch_assignments')) or
  ((select private.current_admin_role()) = 'branch_manager' and entity_type in ('branches','program_offerings') and private.can_manage_branch(branch_id))
);
-- Deliberately no authenticated INSERT/UPDATE/DELETE grants or policies. Phase 3B
-- must implement authorized/versioned draft/publish/provisioning commands first.
commit;
