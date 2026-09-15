# Phase 3A Supabase foundation

This is the historical Phase 3A record. For the current hosted project, generated types, opt-in read integration and migration-version mapping, see [PHASE-3B1-READ-INTEGRATION.md](./PHASE-3B1-READ-INTEGRATION.md). Do not replay the setup migrations on the already-configured hosted project.

The infrastructure is dormant. The dashboard, catalog, middleware, login and in-memory edits retain their existing implementation. No hosted project is configured or migrated. Both SQL migrations have been exercised only in a disposable local PostgreSQL database with synthetic fixtures.

## Files and architecture

- `lib/supabase/client.ts`: lazy browser client using official `@supabase/ssr`.
- `server.ts`: request-scoped server client using Next.js 15 async cookies.
- `middleware.ts`: optional session-refresh helper; it is not imported into the application's existing middleware. Future integration must compose cookie refresh with existing route authorization. Refresh itself does not authorize a user.
- `config.ts`: optional configuration plus rejection of secret/service-role keys in public configuration. This guard cannot protect a secret already put in a `NEXT_PUBLIC_*` build variable: never put one there.
- `types.ts`: shared JSON type and generation instructions, not fabricated generated schema types.
- `migration-validation.ts` and `scripts/validate-catalog.mjs`: read-only source validation.

The official packages are `@supabase/supabase-js` and `@supabase/ssr`. Importing these factories does not connect to Supabase. Calling an unconfigured factory raises an actionable error; the dormant middleware helper simply continues when unconfigured. No fake adapter or fallback database writes have been introduced.

## Create and configure a development project

An institute project owner should create a separate development project in the Supabase dashboard, select the approved organization/region, and store its database password in an approved secret manager. Do not select a production project for this setup. Disable public signups and anonymous sign-ins in hosted Auth settings. Local `config.toml` disables signups, but does not change hosted Auth settings.

Copy the project URL and publishable key from the project's Connect/API settings. Legacy projects can use their `anon` key instead. Add to untracked `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
# Legacy alternative, if no publishable key is supplied:
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Keep the existing staff `AUTH_SECRET` unchanged. No server secret/service-role key is required for this phase. A future privileged worker would require separate server-only secret handling, explicit authorization and audit design; never prefix privileged credentials with `NEXT_PUBLIC_` or commit them.

## Apply schema (future operator steps)

The CLI configuration exposes only `public`, requires explicit API grants, and disables seeding. It contains no catalog/account seed. The private helper schema must stay outside the Data API's exposed schemas on hosted projects as well.

For a disposable **local Supabase** stack, install Docker and use the official CLI:

```powershell
npx supabase start
npx supabase db reset --local
```

`db reset --local` erases that local stack's database; use only a disposable stack. It applies schema migrations without catalog data. Match `db.major_version` to your selected project's PostgreSQL version before platform testing (the scaffold currently specifies 17).

For an approved empty **development** project, verify the project reference, then:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_DEVELOPMENT_PROJECT_REF
npx supabase db push --dry-run
# Review the target and listed migrations before applying:
npx supabase db push
```

These commands are documentation, not actions performed in Phase 3A. Do not run against production. The migrations expect Supabase-managed `auth.users`, `auth.uid()`, `anon` and `authenticated` roles. They are one-time versioned migrations, not rerunnable bootstrap scripts.

## Schema and access policy

`20260910000100_catalog_foundation.sql` defines eight tables: `programs`, `branches`, `program_offerings`, `curriculum_items`, `career_paths`, `admin_profiles`, `admin_branch_assignments`, and `activity_logs`. `20260910000200_transactional_audit.sql` adds transactional audit capture and append-only enforcement.

UUIDs, unique slugs/legacy keys, restricted foreign keys, checked categories/statuses, numeric pricing/deposit constraints, positive months/hours and ordered flat children protect integrity. A partial unique index prevents duplicate unarchived offering contexts. Indexes cover program category/publication, branch city, offering parent/branch-active/mode, branch assignments, and audit time/actor/branch/entity. Unique constraints already supply indexes for slugs and child ordering.

All eight tables enable RLS. Anonymous has no table grants, including for published catalog data. An authenticated session requires an explicitly provisioned active profile; no signup metadata creates roles.

| Role | Read scope | Direct writes |
| --- | --- | --- |
| Super Admin | All eight tables | Denied |
| Content Manager | Shared catalog and non-personnel activity; own profile | Denied |
| Branch Manager | Shared program content, assigned branches/offerings and their branch/offer audit; own profile/assignments | Denied |
| Viewer | Active published visible programs and children, active branches/offerings; own profile; no audit | Denied |
| Unprofiled/disabled user | None | Denied |
| Anonymous | None | Denied |

The master specification requires versioned draft/publish commands. Broad table writes would bypass that lifecycle, so this phase grants SELECT only—even to Super Admin. Future role-authorized commands must implement content management, branch-scoped offering changes and provisioning before runtime cutover. Do not "fix" this boundary by granting table UPDATE.

Private `current_admin_role`, `is_super_admin`, and `can_manage_branch` use SECURITY DEFINER to resolve active profiles/assignments without recursive RLS. They have an empty fixed `search_path`, qualified table names, and EXECUTE only for authenticated callers. `audit_catalog_change` uses SECURITY DEFINER so audited changes and audit insertion succeed or roll back together; normal roles cannot execute it directly or forge logs. `touch_row` is an invoker trigger controlling timestamps/version. `reject_audit_mutation` blocks update/delete/truncate of audit rows. RLS is not forced on the table owner because the private helpers require owner access. Database owners remain trusted administrators who can change triggers/schema; this is not tamper-proof logging against a compromised database owner.

Audit records contain before/after row data, actor identity, entity and branch context. Privileged maintenance with no Auth identity is explicitly recorded as database maintenance, not falsely attributed to a staff member. Future commands must derive identity from the verified user session and must not accept client-supplied audit actors. Audit retention/access should be approved before importing personnel data.

Archive constraints retain records while requiring inactive/hidden state. Restore clears archival state but does not automatically republish/reactivate; conflicts with another live offering context are rejected. Foreign keys restrict destructive deletion. Ordered children are removed through future audited commands; parent archival preserves them.

## Generate actual database types

After applying migrations to a real local Supabase stack:

```powershell
npx supabase gen types typescript --local --schema public > lib/supabase/database.generated.ts
```

Or generate from the approved development project with `npx supabase gen types typescript --project-id YOUR_DEVELOPMENT_PROJECT_REF --schema public`. Save successful output as UTF-8 `lib/supabase/database.generated.ts`, review the diff, and run tests/build. Use UTF-8 redirection tooling on older Windows PowerShell. Before implementing an adapter, import its `Database` type and parameterize both client factories. No generated output is committed now: the lightweight PostgreSQL test fixture is not a full Supabase platform from which to claim generated types.

## Verification

```powershell
npm run validate:catalog
npm test
npm run test:db
npm run check:supabase
npm run build
```

`test:db` requires PostgreSQL binaries (`PG_BIN` can select their directory). It creates and stops its own temporary loopback cluster on a free port, installs minimal Auth role/UID test fixtures, applies both migrations, exercises actual constraints and RLS, and rolls back synthetic data. It never accepts a remote connection URL or uses the installed PostgreSQL service. Diagnostic files remain in the reported temporary directory. The executed test used PostgreSQL 18; repeat in the target Supabase PostgreSQL version and full platform before deployment.

`check:supabase` is an explicit read-only, anonymous probe. With no configuration it reports SKIPPED. Once configured and migrated, permission-denied (`42501`) is the expected success condition: the API is reachable and anonymous catalog access is blocked. It fails on unexpected anonymous reads or other connection errors. It does not prove staff authorization; use the role-matrix tests in a full staging environment before cutover. No hosted connection was verified in this phase.

## Deliberately deferred / institute decisions

- No `site_settings`: current UI constants do not justify an operational settings table. No geography/role lookup tables, invented semesters, fees, discount dates, SEO fields or media Storage migration.
- Approve the exact branch identities, classification/hour ambiguities, offering uniqueness/cohort rules, initial publication/visibility/registration values and nullable unknown prices described in `SUPABASE-MIGRATION-PLAN.md`.
- Approve Viewer visibility and Branch Manager shared-content read scope, staff provisioning policy, audit retention, and operational backup requirements.
- Before writes: implement transactional draft/publish commands, expected-version conflict checks, branch-scope enforcement (including old/new branches), actor validation, and concurrency-safe protection against disabling/removing the last Super Admin. Account provisioning must be explicit and cannot grant roles from signup metadata. Initial Super Admin bootstrap requires a controlled privileged operation after approved Auth account creation.
- No forms, repository, staff authentication, routing, image uploads, imports or production data have been switched to Supabase. No project credentials are required for existing app startup/build.

Official references: [SSR clients and cookies](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [API keys](https://supabase.com/docs/guides/getting-started/api-keys), [RLS and private helpers](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Phase 3A verification record — 2026-09-10

- `npm test`: 12 test files, 75 tests passed (including all existing authentication/admin/catalog tests).
- `npm run test:db`: both migrations and constraint/RLS/audit/timestamp/archive tests passed on disposable PostgreSQL 18; cluster stopped after testing.
- `npm run validate:catalog`: 53 programs, 83 offerings, 80 curriculum items, 124 career paths; zero errors. Three unresolved branch references and accounting without offerings remain documented warnings.
- `npm run check:supabase`: SKIPPED, no project configured. No hosted connection or migration is claimed.
- `npm run build`: passed on Next.js 15.5.25, including type checking and route generation, without Supabase credentials.
- Protected tracked source diff: no changes to catalog data, existing auth/session/middleware, staff configuration or global styling. No Supabase imports in app/component runtime or the existing admin repository.

Phase 3A files added: the six files under `lib/supabase/`; `supabase/config.toml`, `supabase/.gitignore`, and both migrations; `scripts/check-supabase.mjs`, `scripts/test-database.mjs`, `scripts/validate-catalog.mjs`; `tests/supabase-preparation.test.ts`, `tests/database/foundation.sql`; and these two Supabase documents. Updated existing files: `.env.example`, `package.json`, `package-lock.json`. The pre-existing untracked admin implementation and user attachments were preserved.
