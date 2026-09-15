# Phase 3B-1 — hosted read integration

Verification date: 2026-09-12. Continued from the existing working tree; Phase 3A and the existing Phase 3B-1 work were not restarted.

Status: complete for the requested read-only scope. Hosted authorized-session end-to-end verification remains outside this scope because no admin profile is provisioned.

## Hosted project and schema

- Project: `crzedkbjvujcmcikgvoe` (`sstli-diploma-finder`), region `ap-southeast-2`, status `ACTIVE_HEALTHY`.
- Hosted PostgreSQL: `17.6.1.155`; generated PostgREST version: `14.5`.
- Types were generated using the Supabase hosted `generate_typescript_types` tool for this exact project and saved directly as UTF-8 to `lib/supabase/database.generated.ts`. They were not inferred from local migrations or handwritten.
- Eight public tables verified: `programs`, `branches`, `program_offerings`, `curriculum_items`, `career_paths`, `admin_profiles`, `admin_branch_assignments`, `activity_logs`.
- All eight tables are empty. One pre-existing Auth user exists; no admin profiles or branch assignments exist. No account details were retrieved or changed.
- All eight tables have RLS enabled and one SELECT policy each. `anon` has no SELECT grants; `authenticated` has SELECT and no INSERT/UPDATE/DELETE/TRUNCATE grants.
- Hosted constraints and triggers were inspected: seven `audit_change` triggers, six `touch_row` triggers, and `audit_immutable` on activity logs are present. Constraint counts are respectively 12 (programs), 7 (branches), 16 (offerings), 6 each (curriculum/careers), 5 (profiles), 3 (assignments), and 6 (activity).
- The configured anonymous Data API probe returned permission denied (`42501`), the expected result for this schema.
- Local configuration was checked without printing credentials: its URL matches `https://crzedkbjvujcmcikgvoe.supabase.co` and `ADMIN_DATA_SOURCE` is `static`.

## Migration history

| Hosted version | Name | Local correspondence |
| --- | --- | --- |
| `20260910183837` | `remove_legacy_diploma_finder` | Historical hosted cleanup; no local counterpart. Not executed in this continuation. |
| `20260910183907` | `catalog_foundation` | `20260910000100_catalog_foundation.sql`; matches after removing comments and whitespace. |
| `20260910183919` | `transactional_audit` | `20260910000200_transactional_audit.sql`; matches after normalizing line endings and trailing whitespace. |

History was read from `supabase_migrations.schema_migrations` and the stored statements were compared with the local files. The differing version identifiers remain unchanged. No migrations were applied, repaired, renamed or replayed. Before any future `db push`, reconcile the local/hosted version mapping deliberately; blindly pushing the current filenames would attempt to reapply existing schema. The historical cleanup must not be replayed as part of read integration.

## Application integration

- Browser, server and dormant middleware client factories use the generated `Database` type. `types.ts` re-exports generated shared types.
- The read repository accepts `SupabaseClient<Database>`. Each query uses a concrete table and projection, preserving inferred row types through pagination. Catalog mapping inputs derive from generated table rows; runtime validation still checks SQL string constraints, numeric values and relationships.
- `lib/admin/load-data.ts` chooses the source lazily. The existing static repository remains intact. The admin layout still calls the existing `requireUser()` before loading data.
- `ADMIN_DATA_SOURCE=static` remains the default. `undefined` or an empty value also selects static. Only explicit `supabase` selects hosted reads; other values report configuration failure.
- Supabase mode uses a request-scoped public-key client and verified `auth.getUser()`, then checks an active matching admin profile. It does not borrow the legacy staff identity, impersonate a user, or use a service-role key.
- Repository operations cover catalog snapshots, ordered curriculum/career rows, current profile and bounded activity reads. Catalog reads exclude personnel and audit payloads. Pagination uses stable ordering and fails rather than silently truncating the snapshot at its safety bound.
- `AdminReadBoundary` renders safe, explicit errors and an authorized empty state. An unavailable source does not mount the provider or child editors. Raw errors and credentials are not sent to the UI.
- Existing edits remain in-memory session previews only. The Supabase notice explains that they do not persist and that existing mock users/activity examples are not hosted accounts/audit records. Persistent audit reads remain a separate repository DTO; the existing mock activity UI is not relabeled as real audit data.

## Explicit behavior

| Condition | Result | Verification |
| --- | --- | --- |
| Static/default mode | Existing 53-program static snapshot; no hosted client constructed | Actual layout integration and existing UI tests |
| Supabase mode, authorized empty catalog | Ready state with zero programs/branches; no static replacement | Typed client GET-only transport tests, layout integration and empty-screen tests |
| Missing Supabase session | `authentication` unavailable state explaining the separate session requirement | Repository and UI tests |
| Missing/disabled profile or denied SQL read | `authorization` unavailable; never confused with empty catalog | Profile/permission tests; hosted anonymous API returns `42501` |
| Missing/malformed public config | `configuration` unavailable; no hosted client constructed | Layout/config tests |
| Unknown source value | Explicit configuration failure | Source-selection tests |
| Connection/schema failure | Safe unavailable state; no fallback | Source/mapper/UI tests |

The live database is empty, but no active admin profile exists. A successful authorized hosted browser read is therefore not claimed. Successful empty/authorized behavior is exercised through the real typed SDK with a controlled GET-only transport; RLS/constraint behavior is exercised in an isolated PostgreSQL cluster with synthetic fixtures. Creating hosted users/profiles or changing staff login to enable that end-to-end path is outside this phase.

## Verification results

- Hosted project, migration statements, schema metadata, grants, counts and generated types: verified through read-only management tools.
- `npm run check:supabase`: PASS; anonymous access denied as intended.
- `npm run test:db`: PASS; migrations, constraints, role matrix, audit immutability, timestamps and archive/restore. Disposable PostgreSQL 18 cluster stopped after testing; this is not a full hosted Auth end-to-end test.
- `npm run validate:catalog`: PASS; 53 programs, 83 offerings, 16 union branches, 80 curriculum items and 124 career paths; zero errors. Existing warnings remain: accounting has no offerings and three Dammam branch references are unresolved. Catalog fingerprint: `61b1cb418837450e3a35dbc0f9b92a0a67c808ca5e473dcdd785ed7303b2cf5b`.
- `npm test -- --maxWorkers=1`: PASS; all 113 tests across 16 files, exit 0. Earlier default-worker runs timed out in existing browser/account tests under contention (including one run alongside the build). Serial execution passed with the original assertions and timeouts unchanged; the ordinary parallel command is not reported as passing.
- `npm run build`: PASS; Next.js 15.5.25 compiled, checked types, generated pages and completed build traces, exit 0. Admin routes remain dynamic. Build used the configured static default.
- `npx tsc --noEmit`: PASS after the final test additions, exit 0.
- `git diff --check`: PASS. Protected tracked authentication, middleware, account configuration, API and catalog paths have no diff.

## Preserved boundaries

No catalog records were migrated. No hosted Auth users/profiles were created. No writes, RPCs, write grants, schema changes or data seeds were enabled. Existing staff authentication, session signing, root middleware authorization, account configuration and catalog source files are unchanged. The optional typed Supabase middleware helper remains disconnected from root middleware. No deployment, commit or push was performed.

## Files completed in this continuation

- Added: `lib/supabase/database.generated.ts`, `lib/admin/load-data.ts`, `components/admin/AdminReadBoundary.tsx`, `tests/admin-read-integration.test.tsx`, this report.
- Completed: typed Supabase factories/repository/mappers, generated type re-exports, admin layout wiring, `.env.example`, read tests.
- Added a current-phase pointer to the historical `SUPABASE-SETUP.md` record.
- Corrected stale imports in `tests/admin-read-ui.test.tsx` to the existing `ProgramsTable`/`PricingTable` components and removed unsupported `exact` options from existing role queries in `tests/admin-completion.test.tsx`; string role names already match exactly.
- Existing untracked admin files, attachments, migrations and earlier dependency changes were preserved.

Reference: [Supabase hosted type generation and typed clients](https://supabase.com/docs/guides/api/rest/generating-types). The earlier `SUPABASE-SETUP.md` Phase 3A record describes the state at that phase; this report records the current hosted integration.
