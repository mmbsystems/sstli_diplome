# Phase 3E-1 — secure Supabase read cutover

## Read graph recorded before implementation

- Staff layout validates the legacy session with `requireUser()`.
- Staff `/programs` directly imports `data/programs.ts` and `data/offerings.ts`, then sends those records to the client explorer.
- Staff `/programs/[slug]` and its metadata loader directly import static program lookup/offerings; detail selection and installment/filter logic run against those props.
- Admin layout calls `requireAdmin()`, then `loadAdminReadState()`. Every admin catalog view shares the resulting `AdminProvider` snapshot; edits dispatch only to its in-memory reducer.
- Admin source selection alone respects `ADMIN_DATA_SOURCE`. Static mode uses `adminRepository/createAdminSnapshot`. Existing Supabase mode uses the SSR Supabase client and `createSupabaseReadRepository`, which requires an unrelated Supabase Auth session/profile.
- The existing server-only privileged client is used by the isolated probe write command. It is not imported by browser components.
- Users/activity demonstration screens remain preview data, not imported identities or hosted audit readers.

This phase authorizes application read-path changes only; hosted database mutations are excluded.

## Completed result — 2026-09-12

Local runtime cutover completed after all gates passed. `.env.local` changed from `ADMIN_DATA_SOURCE=static` to `ADMIN_DATA_SOURCE=supabase`; the file remains ignored. The code default and `.env.example` remain static. No deployed environment was changed.

Project: `crzedkbjvujcmcikgvoe`. Source fingerprint: `61b1cb418837450e3a35dbc0f9b92a0a67c808ca5e473dcdd785ed7303b2cf5b`. Existing import batch: `9193fb12-56b0-4777-801c-c0642a6a3ebd`.

## Implemented read graph and authorization

Browser → authenticated Server Component → `lib/catalog/load.ts` → explicit selected source → domain DTO → existing client UI.

Staff list, details, and metadata call `loadStaffCatalog()`, which runs legacy `requireUser()` before constructing a database client. Admin layout uses `loadAdminReadState()`, now an alias of `loadAdminCatalog()`, which runs legacy `requireAdmin()` before reads. Authorization remains outside request memoization. Browser-supplied roles are never authoritative. Existing sessions, bcrypt accounts, middleware, origin checks, and write-command boundaries are unchanged by this phase.

The smallest design reuses the existing server-only privileged client. The new repository performs only SELECT operations on five catalog tables; it never calls Supabase Auth. The client accepts an optional fetch override to enforce `cache: no-store` for these reads without changing existing write callers. All privileged modules use `server-only`; browser components receive mapped catalog values, never the client or credentials. No new RPC, grants, RLS policies, or migrations were required.

The previous Supabase Auth-based read repository remains for compatibility but is no longer the staff/admin runtime entry point. Users/activity preview screens and in-memory admin editing remain previews.

## Visibility and mapping

Private authenticated staff see the approved imported catalog regardless of public draft, inactive, registration, or catalog-visibility flags. These flags are not changed in the database. Archived programs/offerings/branches are excluded from staff availability. Admin receives hosted records and their actual control flags and UUIDs. Anonymous access remains denied. Future public catalog visibility needs a separately approved policy.

`mapHostedCatalog` uses the frozen manifest for approved identity, order, and completeness only; display content comes from hosted rows. Staff retains original legacy IDs and offering IDs; admin retains database UUIDs. It preserves exact branches, descriptions, pricing, deposits, installments, modes, genders, curriculum/career order, pending flags, and offering-hour overrides. Optional empty fields normalize equivalently for comparison.

This read-only phase deliberately validates imported relation identities/order against the frozen manifest. Future CRUD must replace or evolve that provenance/completeness strategy before adding, deleting, reordering, or changing offering context. Newly added records are not automatically approved for the staff catalog.

## Failure handling and performance

Five parallel grouped reads reconstruct the catalog, with 500-row pages, exact-count/completeness checks, a 10,000-row cap per table, and a 10-second timeout per request. There is no per-program query pattern. Invalid configuration, transport failure, malformed data, and partial relations produce a controlled unavailable state. A fully empty database produces an empty result. There is no static fallback in Supabase mode. Server logs contain only source and categorized failure information.

React `cache` deduplicates repeated page/metadata loads within a server request; authorization executes outside it. No cross-request catalog cache is introduced. Upstream fetches use `no-store`, and live private responses returned `Cache-Control: private, no-store`. React documents the per-request cache lifetime at https://react.dev/reference/react/cache.

## Verification evidence

- Full suite with `SSTLI_LIVE_READ_PARITY=true`: **175 tests passed in 24 files**, including the real hosted repository comparison.
- `npm run test:db`: passed in a disposable local cluster, including transactions, receipt immutability, rollback, reconciliation, RLS, and audit checks.
- `npm run validate:catalog`: passed; source fingerprint unchanged. Existing accounting/no-offering and unresolved Dammam branch warnings remain intentional.
- Static versus real hosted domain comparison: **zero unexplained differences** across programs, offerings, branches and nested content. Tests cover filters, prices/installments, accounting without offerings, six distinct NEBOSH records, exact branch distinctions and law hours 84 versus offering override 75.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed, Next.js 15.5.25 production build; protected routes remain dynamic.
- `git diff --check`: passed; only Windows line-ending notices.
- Client/generated asset scan: **298 files, zero secret hits**, covering `.next/static`, public/export assets and generated HTML/RSC/body/meta files. Checked privileged variable names, actual configured secret values, service-role JWT values, and the supplied admin password. Password was supplied in memory only, never saved by this phase.

The first isolated live parity attempt encountered a connection error and correctly refused fallback. A subsequent isolated run, the full suite's live test, both source-mode HTTP proofs, and the final default-runtime HTTP proof passed.

## Production HTTP proof

`node scripts/verify-catalog-http.mjs` accepts the admin password through stdin and reads an existing staff credential from the ignored local handoff. Neither credential is printed or persisted by the verifier.

Both explicit static and Supabase production instances passed before cutover. After changing `.env.local`, a fresh production instance with no source override passed again:

| Actor | Verified behavior |
| --- | --- |
| Anonymous | `/login` 200; `/programs`, law detail and `/admin` 307 to login |
| Existing staff | Login, list, law detail, accounting unavailable state and RSC request 200; `/admin` 307 to programs |
| Legacy admin | Login, staff list and hosted admin dashboard 200 |

Each complete proof scanned 13 HTTP responses with zero secret hits. The law detail retained online/Dammam selection, price and 75-hour override. Server-only diagnostic output from the final default runtime explicitly reported `SSTLI_CATALOG_READ source=supabase programs=53 offerings=83` for the tested requests. The admin source label also confirmed Supabase. Diagnostics were enabled only in the temporary verification process.

A separate production instance with both privileged credentials empty returned the controlled catalog error state and no static explorer records; server logs reported only `reason=configuration`. Verification processes were stopped afterward.

## Read-only invariants

Before and after the final HTTP proof:

| Table | Before | After | Full-row MD5 unchanged |
| --- | ---: | ---: | --- |
| programs | 53 | 53 | `8e01373aa59d897ba1ec8db216b72a08` |
| branches | 16 | 16 | `7adaf9020f7de78115706456ee459c48` |
| program_offerings | 83 | 83 | `83ed00c75cd6e94ce6731d6c25a8522f` |
| curriculum_items | 80 | 80 | `93ef24ce0bd6764dce699b3ce32b7fd9` |
| career_paths | 124 | 124 | `ac7dc776714c4172da3646b0fe43249e` |

Hashes cover all row columns as ordered JSON, including publication controls and timestamps. Activity logs remain **0**. The migration receipt count remains **1**, and its full-row hash remains `cf99142cc632e7323bd95faaadbcf14d`. Supabase Auth users remain **1**, unchanged; no users were created. No hosted writes or import retries were performed. Source catalog files were not edited.

Privilege checks confirmed anon SELECT denied and anon/authenticated INSERT, UPDATE and DELETE denied on all five catalog tables. No DB/RLS changes were made, so advisors were not rerun in this phase. Existing leaked-password-protection warning and intentional private-table advisor notices remain separate prior-phase observations; no security settings or indexes were weakened or removed.

## Rollback and remaining work

To roll back reads, change the ignored local environment to `ADMIN_DATA_SOURCE=static` and restart Next.js. Static reference data and code support remain intact. Supabase failures never trigger this automatically.

Persistent CRUD is still disabled. Before enabling it: approve entity-specific server validation and authorization; implement audited transactional/versioned mutations with rollback; connect forms with conflict/error handling; evolve manifest-bound identity/order validation for edited/new records; define staff approval/archive and future public publication policies; and verify these flows end to end. No read-cutover blocker remains for this local runtime.
