# Phase 3C — legacy admin authentication verification

Verified on 2026-09-12 against the existing working tree. Initial verification preserved the implementation. The subsequent focused conflict fix below changes only the probe function's conflict SQLSTATE and server error mapping; no reprovisioning or password reset occurred.

## Account and session

- One dedicated `admin` account exists, with display name `مدير النظام` and role `super_admin`.
- Account record: `config/admins.json`, array index 18 (19th record), lines 107–112. Username is at line 108; bcrypt hash is the `passwordHash` field at line 111.
- The supplied initial password verified against the existing bcrypt cost-12 hash and succeeded through the actual login endpoint. It was used in memory; no plaintext password file was created or modified.
- All 18 original staff account records exactly match `HEAD:config/admins.json`.
- Legacy login uses bcrypt and an eight-hour HS256 session containing the username. Cookies are HttpOnly, SameSite=Lax, and Secure in production. Trusted account configuration resolves the role on every authenticated request; client-supplied roles are not authoritative.

## Live HTTP evidence

Production build served at `http://127.0.0.1:3210`, using hosted project `crzedkbjvujcmcikgvoe`. This proves the local production server against the hosted database, not a deployed public website.

| Check | Result |
| --- | --- |
| Admin POST `/api/auth/login` | 200, session issued |
| Admin GET `/admin` | 200 |
| Existing staff `bahaa` login | 200 |
| Staff GET `/admin` | 307 to `/programs` |
| Staff GET `/programs?category=diploma` | 200 |
| Anonymous GET `/admin` | 307 to `/login` |
| Staff POST `/api/admin/probe` | 403 |
| Anonymous POST `/api/admin/probe` | 401 |

The proof flags were enabled only in the verification server process. They were not added to `.env.local`.

Actual authenticated POSTs to `/api/admin/probe` created and updated isolated record `70ee518a-3edf-4804-82ce-1712d9a64fa9`; a separate authenticated cleanup POST returned 200 with version 3 and `deleted: true`. The tombstone and immutable audit remain intentionally retained.

Hosted SQL verification confirmed three records in `private.legacy_write_audit`: create/version 1, update/version 2, delete/version 3. Every actor contains username `admin`, name `مدير النظام`, role `super_admin`, and a distinct request ID. This proof writes only `private.admin_write_probes` and its private audit, not catalog records.

### Live conflict issue — resolved

The initial stale-version request hung and eventually returned 404 after cleanup. The focused follow-up reproduced this through the actual HTTP route: record `53406b4c-cebe-400a-9ad4-65913e0be199` was created and updated successfully, then its stale update exceeded the regression's five-second deadline before cleanup started.

Root cause: the function raised SQLSTATE `40001` (serialization failure) for a permanent expected-version mismatch. PostgREST retries that transaction, so the same stale input keeps failing instead of reaching the application's HTTP error mapper. Cleanup changed the eventual error to non-retryable not-found, explaining the original 404. The JavaScript client does not retry these POSTs; the retry occurs in the database API layer. Direct PostgreSQL tests bypass this layer, and the original unit test mocked an immediate error response. [Supabase documents this retry behavior](https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b).

Fix: migration `supabase/migrations/20260912105826_legacy_admin_conflict_http_409.sql`, applied to the hosted project, replaces the three application-conflict raises with `PT409`. [PostgREST maps PT status codes directly to HTTP](https://docs.postgrest.org/en/v14/references/errors.html#raise-errors-with-http-status-codes). `lib/admin/mutations/errors.ts` now recognizes `PT409` as a sanitized `conflict`/409. Function signature, permissions, actor validation, row locking, conditional update, audit insertion, and transaction rollback are unchanged. Historical migrations remain intact; generated types need no change.

Regression: `scripts/test-live-probe.mjs` logs in through HTTP, creates a record, advances to version 2, requires three stale version-1 updates to return 409 within five seconds **before any cleanup**, then successfully updates using version 2 and deletes using version 3. It reads the password from stdin, never logs credentials, and uses a fresh private proof UUID each run. Run against an explicitly enabled verification server with `node scripts/test-live-probe.mjs`, supplying a JSON password object through a secure stdin source. Unit mapping and database expected-SQLSTATE tests were also updated; both failed before the fix and passed afterward.

Live post-fix proof: `46ec825f-d615-40da-9ff4-9f344b3fe9de`, local production server against the hosted database:

| Step | HTTP result | Duration |
| --- | --- | ---: |
| Create | 200, version 1 | 1355 ms |
| Current-version update | 200, version 2 | 997 ms |
| Stale update 1 | 409, conflict | 1006 ms |
| Stale update 2 | 409, conflict | 455 ms |
| Stale update 3 | 409, conflict | 457 ms |
| Update after conflicts | 200, version 3 | 457 ms |
| Cleanup | 200, version 4, deleted | 457 ms |

No stale request hung or relied on deletion. Hosted inspection found zero pending probe queries. Exactly four audit entries exist for this proof (create/update/update/delete), with sequential versions 1–4; no stale write or audit was persisted. Every actor is `admin` / `مدير النظام` / `super_admin`, with a distinct request ID. Hosted catalog counts remained zero throughout; Auth count remains one. No catalog tables, forms, staff authentication, authorization/origin checks, or credential handling were changed.

Post-migration security advisors reported the intentionally policy-free private probe tables and a Supabase Auth leaked-password protection warning outside this legacy-auth fix. No access was broadened. References: [private-table advisory](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [Auth advisory](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Catalog and Supabase Auth invariants

Before and after the live proof, hosted counts were identical:

| Table | Before | After |
| --- | ---: | ---: |
| programs | 0 | 0 |
| branches | 0 | 0 |
| program_offerings | 0 | 0 |
| curriculum_items | 0 | 0 |
| career_paths | 0 | 0 |
| activity_logs | 0 | 0 |
| auth.users | 1 | 1 |

No catalog data was migrated or modified. `git diff --numstat -- data` was empty. The one existing Supabase Auth user was created and last updated on 2026-08-22; no Auth users were created by this verification. The legacy admin is a project-config account, not a Supabase Auth user.

`ADMIN_DATA_SOURCE=static` remains in ignored `.env.local`; `readDataSource(undefined)` and the empty-string setting also default to static. Catalog forms still dispatch only to the in-memory `AdminProvider` reducer; no persistent catalog forms are enabled.

## Verification results

- `npm test`: 19 files, 131 tests passed after the conflict fix.
- `npm run test:db`: passed on a disposable PostgreSQL cluster; migration, constraint, RLS, audit, conflict, and rollback checks passed. Cluster stopped afterward.
- `npm run validate:catalog`: no errors; four existing warnings (accounting without offerings and three unresolved Dammam branches). Fingerprint: `61b1cb418837450e3a35dbc0f9b92a0a67c808ca5e473dcdd785ed7303b2cf5b`.
- `npx tsc --noEmit`: passed after the build. An earlier concurrent run raced the build's regeneration of `.next/types`; the sequential rerun passed.
- `npm run build`: passed, Next.js 15.5.25 production build.
- `git diff --check`: passed; Git emitted only LF/CRLF conversion notices.
- Client/generated asset scan: 298 files across `.next/static`, `out`, `public`, and generated `.next/server/app` HTML/RSC/body/meta assets. Zero matches for `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, the configured secret/service-role key values, JWTs with `role=service_role`, or the supplied plaintext admin password. Server implementation bundles are not browser assets and were excluded from this client scan. Sampled HTTP login/page responses did not contain the supplied password.

## Credential handoff and safe reset

- Username: `admin`.
- Password status: existing initial password verified successfully; unchanged. It is intentionally omitted here. No plaintext credential handoff was saved.
- Exact account location: `B:\Edducation\sstli diplom\config\admins.json`, record selected by `username === 'admin'`.
- Exact hash location: that record's `passwordHash` field, currently line 111. Never replace it with plaintext.
- For an intentional password change, obtain a new password through a masked prompt or secret manager, set `SSTLI_ADMIN_PASSWORD` only in the child process environment, and run `node scripts/bootstrap-super-admin.mjs --reset`. The script requires at least 12 characters and at most 72 UTF-8 bytes; it hashes with bcrypt cost 12 and preserves staff records. Remove the environment value in a `finally` block. Do not put the password in command arguments, source files, shell history, or logs.
- Rebuild/redeploy or restart the application as appropriate so the server loads the updated trusted account configuration. Verify login with the new password and denial with the old password.
- Password reset does not revoke already-issued username sessions. If immediate session invalidation is required, rotate `AUTH_SECRET` through the ignored environment/secret manager and restart/redeploy; this signs out all staff as well as admin. Otherwise existing sessions expire after eight hours.

The live conflict limitation is resolved. The HTTP regression and all required automated checks passed; transactional audit and rollback coverage remain intact. The verification server was stopped after the proof, removing its process-only probe opt-in.
