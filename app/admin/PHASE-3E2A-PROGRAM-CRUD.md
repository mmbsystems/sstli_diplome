# Phase 3E-2A — transactional program CRUD

Continuation on 2026-09-13 from the existing working tree. Phase 3D artifacts were not regenerated. Scope is programs, curriculum_items and career_paths only. **Phase 3E-2A is fully accepted:** production-build hosted CRUD, guarded cleanup and all final verification passed. The existing legacy admin account was used without reset or reprovisioning; its password was supplied through stdin/in-memory only.

## Architecture and validation

The existing editor sends one JSON POST to `/api/admin/programs`. The Node route authorizes the legacy session, checks same-origin JSON, limits the body to 256 KiB, and calls the server-only command. Validation explicitly projects allowed program fields and `{id?, title}` children; unknown fields at every level are rejected. Browser actor, timestamps, legacy IDs, versions inside rows, offerings and arbitrary columns are forbidden. UUIDs, positive safe update versions, text bounds, slug, enums, booleans, keywords, duration, accredited hours, local image paths/position and publication completeness are validated. Nullable optional text is supported; null is rejected for nonnullable control fields. Invalid requests return 422 without raw SQL messages.

`public.legacy_admin_save_program` is a restricted SECURITY DEFINER RPC with an empty search path and service-role-only execute privileges. It additionally rejects authenticated user identity and requires the fixed legacy admin actor. It exposes no arbitrary SQL/table parameter. The existing server-only client never carries browser credentials. Supabase Auth and user provisioning remain unchanged.

One RPC performs parent, curriculum, career and audit writes in one PostgreSQL transaction. Any nested error, constraint error, audit failure or unexpected exception rolls back all rows, versions, timestamps and audit. No browser sequence of independent saves exists. PostgreSQL constraints remain intact.

## Concurrency and conflicts

Create requires version 0 and no ID. Update/archive/restore require UUID and expected version >=1. The RPC locks the parent with `FOR UPDATE NOWAIT`, compares its version before any write, and emits PT409 for stale or busy rows. The route maps it to HTTP 409. Each successful Save advances the parent version once, including nested-only saves. Missing rows return 404. Slug uniqueness violations produce a controlled 409; the UI explains both stale data and an occupied slug without silently renaming it. Invalid publication returns 422. Unexpected errors return 500 with no PostgreSQL detail.

## Child identity and deletion policy

Both lists carry UUID separately from title/order. Existing children are checked for ownership by the target program and diffed by UUID. Edits and reorder update the existing row; an unchanged title/order does not update the child. New children omit ID and receive a database-generated UUID. Duplicate, malformed or foreign IDs fail atomically. Deferred ordering constraints allow swaps, then are checked before returning. Omitted children are hard-deleted inside the transaction and their deletion is audited; these tables have no archive column. List indexes specify order only, never persistent identity.

## Archive and staff reads

Archive sets archived_at and forces inactive/hidden. Admin still receives archived rows. The active hosted staff mapper excludes archived programs and their offerings. Restore clears archived_at and forces inactive, hidden, draft; it never publishes. Phase 3E-1 private staff semantics remain: public control flags do not gate the authenticated internal catalog. A program with no offerings can be present in the catalog payload while having no available study option. No public catalog behavior is introduced.

## Audit

Successful actual row changes use existing transactional audit triggers. Actor is server-derived: username `admin`, name `مدير النظام`, role `super_admin`, with a generated request ID. Legacy actions have null Supabase actor_user_id. Parent create/update/archive/restore and changed children generate append-only records. No-op parent content can omit a parent audit record while nested changes generate their own records under the same request ID. Failed/stale commands produce no audit. Activity UI remains preview-only.

## Historical identity and generated types

New programs use the database UUID, null legacy_id and canonical slug. The hosted mapper accepts records absent from the frozen manifest; the manifest is used only to retain imported display ordering. Existing legacy IDs remain unchanged. Historical `lib/supabase/database.generated.ts` is preserved byte-for-byte because it is included in the manifest's auxiliary hashes. Current hosted RPC types are generated separately into `lib/supabase/database.current.generated.ts` and used by the server mutation client.

Manifest SHA256 before/after continuation:
`f65d96c408be1cf46996c29312b8a251ea37d7d06c8c7949f2f4b4fb20a095a1`.

Historical type SHA256: `244b95fa71aa139eca1ce7e120388a006046f7872a91713a98518a6e3d770041`.

## Editor

Existing design and Save/Add Program flow are retained. Hosted success accepts the authoritative row/version, clears dirty state, and reports success. Create navigates to `/admin/programs/<database UUID>`. Nested lists are included in the same request. Validation, conflict and network failure preserve unsaved values. Conflict offers a reload with a discard confirmation. Arabic text encoding was repaired. Branch/price data in the program editor is read-only; other existing preview screens do not gain persistence. Images use existing local paths; no Storage upload or simulated upload success was added. Supabase source guidance now describes program persistence accurately.

## Verification and live procedure

`tests/database/program-crud.sql` and `program-atomicity.sql` run only in the disposable cluster. Full-row JSON snapshots include parent, both child tables, audit, branches and offerings. They cover stale/missing version, invalid curriculum/career, duplicate and foreign UUID, invalid publishing, duplicate slug, missing program, audit failure and a late injected career trigger failure. Each failed operation must leave the snapshot exactly equal. Create/update/nested/remove/archive/restore all assert exact branch/offering equality against nonempty fixtures. Both child tables have explicit edit/reorder/unchanged UUID checks.

Route tests cover anonymous/staff rejection, actor and column injection, origin protection and controlled PT409. UI tests cover authoritative version reuse, dirty-state clearing, 422/500 preservation, nested UUID reorder/conflict and creation/navigation. Hosted repository tests verify manifest independence and archived staff exclusion, plus opt-in actual hosted parity.

Run `node scripts/verify-program-crud-http.mjs` against a fresh `npm run start -- -p 3212` production instance. Supply `{"password":"..."}` through stdin only. The script creates exactly one temporary program, logs its ID and writes nonsecret `scripts/program-crud-proof-result.json`. It verifies real admin login, anonymous/staff/spoof denial, create/read/update/stale/invalid/slug conflicts, nested add/edit/reorder/remove/UUIDs/rollback, archive/staff exclusion/restore and audit. Every step compares branches and offerings byte-for-byte as JSON. It scans HTTP responses for configured secrets. It never edits imported records.

Always run verification-only `scripts/cleanup-program-crud-proof.sql` with the exact reported UUID/slug via a maintenance SQL connection after this proof, including failures. Its guards require the matching temporary slug/name, null legacy_id and no offerings. It deletes children then the temporary program. It leaves immutable audit entries, including maintenance cleanup actions; record their IDs/count in this document. No permanent deletion endpoint is added.

## Hosted changes and reconciliation

Applied hosted migration: `20260913053108_legacy_program_commands`, from the existing local `supabase/migrations/20260912172014_legacy_program_commands.sql`. No table schema, constraints, policies, users, Auth, branches, offerings or pricing were changed by this migration.

Before live proof: programs 53, branches 16, offerings 83, curriculum 80, careers 124; activity logs 0; Auth users 1. Full-row MD5: branches `7adaf9020f7de78115706456ee459c48`, offerings `83ed00c75cd6e94ce6731d6c25a8522f`, Auth users `fc5cae53be866d50625b2cfae519be29`.

Supabase security advisor showed only existing intentional private-table no-policy info and the pre-existing [leaked-password-protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No settings were changed.

## Final verification evidence (2026-09-13)

- Full suite with `SSTLI_LIVE_READ_PARITY=true`: **209 passed, 27 files**, including actual hosted repository parity. An earlier full run encountered a transient hosted connection failure; the isolated hosted check and subsequent complete run passed. Historical auxiliary-hash tests also pass after preserving historical generated types separately.
- Disposable database suite: passed, including the expanded full-row atomicity and scope matrix.
- Catalog validator: zero errors; existing accounting-without-offerings and three unresolved Dammam branch warnings remain.
- `npx tsc --noEmit`: passed.
- Final `npm run build`: passed, Next.js 15.5.25; admin mutation route is dynamic Node runtime.
- `git diff --check`: passed (Windows line-ending notices only).
- `node scripts/scan-client-secrets.mjs`: **299 files, zero secret hits**, including static chunks, public/export assets and generated HTML/RSC/body/meta; scans actual configured privileged keys, JWT secret and service-role JWT payloads.
- Actual production server on port 3212: anonymous mutation **401**, existing staff mutation **403**, staff with spoofed super_admin/actor payload **403**. No program created by these checks.
- Admin CRUD production HTTP proof: **passed** on a fresh production instance at port 3212. The first attempt stopped before writes during baseline reads with a transient gateway `PGRST303` JWT timing error. The second completed successfully with exactly one temporary program. No account or security configuration was changed. The verification server was stopped afterward.
- Final hosted reconciliation after guarded cleanup: **53 programs / 16 branches / 83 offerings / 80 curriculum / 124 careers**. Audit count **21**, intentionally retained. All five full-row MD5 values exactly equal the prior Phase 3E-1 baseline: programs `8e01373aa59d897ba1ec8db216b72a08`, branches `7adaf9020f7de78115706456ee459c48`, offerings `83ed00c75cd6e94ce6731d6c25a8522f`, curriculum `93ef24ce0bd6764dce699b3ce32b7fd9`, careers `ac7dc776714c4172da3646b0fe43249e`.
- Supabase Auth users remain **1**, with unchanged full-row hash `fc5cae53be866d50625b2cfae519be29`. No local account/config/auth files were edited during this continuation.
- Historical manifest bytes and its historical type input retain the SHA256 values above. `.env.local` remains `ADMIN_DATA_SOURCE=supabase`.

## Completed live proof and cleanup

Temporary UUID: `36cbd915-7b73-448f-a6ef-30d3f25b8564`.

Temporary slug: `crud-verification-5f40f080-916b-4464-aade-6190f80b4e36`.

The real admin login returned 200 using the existing bcrypt-backed account. Create returned the canonical UUID, null legacy_id and version 1; program update returned version 2; the full sequence ended at version 9. Hosted database read, admin HTTP read and staff catalog payload reflected the new program, which was absent from the immutable manifest. Anonymous returned 401; staff and role spoofing returned 403; browser actor/column injection and missing expected version returned 422.

Stale version returned **409 in 480 ms**, duplicate slug update/create returned controlled **409 in 787/482 ms**, and invalid publishing returned **422 in 8 ms**. Full snapshots proved failed requests changed neither catalog nor audit.

Curriculum and career lists each added three children, edited and reordered existing children with UUID preservation, then removed one child. Foreign curriculum identity returned 422 with complete rollback. A foreign career identity after a proposed curriculum replacement also returned 422, with complete parent/child/version/audit snapshot equality. Archive hid the program from the actual staff catalog while admin could still retrieve it. Restore returned inactive/hidden/draft and preserved the remaining child UUIDs. Every stage compared every branch/offering column against baseline with exact JSON equality, including failures.

The existing `scripts/cleanup-program-crud-proof.sql` was read and executed via the maintenance SQL connector, substituting only the exact UUID/slug from `scripts/program-crud-proof-result.json` for its psql parameters. All guards remained intact: matching temporary name/slug, null legacy_id, no offerings. It deleted the four remaining children and the parent transactionally. A subsequent hosted query found **zero temporary programs**; all five catalog table hashes returned to baseline. No permanent deletion endpoint exists.

Evidence files: `scripts/program-crud-proof-result.json` records timings, program identity and scope assertions; `scripts/program-crud-proof-reconciliation.json` records final counts/hashes and **all 21 immutable audit IDs**. There are **16 CRUD audit records** attributed to `admin` / `مدير النظام` / `super_admin`, plus **5 cleanup deletion records** correctly attributed to `Database maintenance`. No audit history was deleted.

Parent action audit IDs:

| Action | Audit UUID |
| --- | --- |
| create | `aef94822-d452-4484-a18d-16d6ad131fa8` |
| update | `94ed401d-4209-4aff-80be-6dd6e240bbe2` |
| archive | `cccd8399-bdf1-4422-a931-11f5b87af352` |
| restore | `d108003c-3495-4de5-9cbb-a4a5ae1fbf76` |

After cleanup the full suite again passed **209 tests / 27 files** with live hosted parity enabled. Disposable DB tests, catalog validator, type check, production build and diff checks passed. Final client secret scan: **299 files, zero hits**. An additional stdin-only scan for the supplied password covered **339 client/artifact/document files, zero hits**. Local admin configuration SHA256 stayed `15ca1c71910eb980afba8c3f9fd907151c4f04d2966ae95f038f6a27abb30979`. No secrets were written to source, reports, fixtures, configuration or logs.

## Remaining scope

No Phase 3E-2A acceptance blockers remain. `ADMIN_DATA_SOURCE=supabase` remains active. Branch/offering/pricing persistence, user/Auth changes, Storage uploads, public catalog policy and Activity redesign remain outside this phase and were not enabled. Phase 3E-2B can proceed as a separate scoped task.
