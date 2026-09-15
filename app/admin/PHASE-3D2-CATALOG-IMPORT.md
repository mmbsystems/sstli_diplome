# Phase 3D-2 — committed catalog import

Status: **import committed successfully; final verification passed**. Verification completed on 2026-09-12 from the existing working tree. The final verification continuation performed hosted SELECT/advisor calls only and did not execute the import again.

## Batch identity

- Project: `crzedkbjvujcmcikgvoe` (`sstli-diploma-finder`, approved development target, ACTIVE_HEALTHY).
- Batch ID: `9193fb12-56b0-4777-801c-c0642a6a3ebd`.
- Committed receipt timestamp: `2026-09-12T11:29:07.662934+00:00` (14:29:07 Saudi time).
- Database transaction ID: `118637`.
- Import actor: `system migration`.
- Source fingerprint: `61b1cb418837450e3a35dbc0f9b92a0a67c808ca5e473dcdd785ed7303b2cf5b`.
- Manifest version: `1`.
- Manifest body fingerprint: `9193fb1256b02777801cc0642a6a3ebdfd1a5050eac975e3871f6ec5e9fbf2cd`.
- Approved payload file fingerprint: `0967bda4eb8d37b4112bbbaca1eb26a40f194b875b0f24c909efdc68f0cb07a4`.
- Frozen artifacts: `migration/catalog-import-manifest.json` and `migration/generated/catalog-import-payload.json`. Neither UUID mappings nor approved business values were regenerated or changed.

## Counts and exact reconciliation

| Table | Before | Inserted | After / final verification |
| --- | ---: | ---: | ---: |
| programs | 0 | 53 | 53 |
| branches | 0 | 16 | 16 |
| program_offerings | 0 | 83 | 83 |
| curriculum_items | 0 | 80 | 80 |
| career_paths | 0 | 124 | 124 |
| private.catalog_import_receipts | 0 | 1 | 1 |
| activity_logs | 0 | 0 | 0 |
| auth.users | 1 | 0 | 1 |

All 356 catalog rows were reconciled inside the transaction before commit. The SQL compares the UUID, count and **every payload field** using JSON field equality, including array order, not just counts or JSON containment. Foreign keys and ordinary constraints remain active. UUIDs, legacy IDs/keys, slugs, names, relationships, modes, genders, prices, deposits, months, hours and child ordering all match.

A fresh post-commit SELECT read back every table into `migration/reports/phase-3d2-hosted-snapshot.json`. The final continuation read every hosted row again and confirmed the snapshot is identical, including database-generated timestamps. `loadApproved()` validates the frozen manifest against the authoritative source and pinned artifact checksums; `reconcile()` compares that payload field-by-field with hosted rows. Both pass. No row repair, truncation, merge or source modification was required.

## Import execution and transaction safety

`scripts/import-catalog-to-supabase.mjs` defaults to an offline plan and requires the exact `--project-ref crzedkbjvujcmcikgvoe`. Execution requires `--execute`. It accepts no alternate project or production override. The approved ref was also checked through the Supabase project tool before execution.

The actual run used the explicit `--execute --mcp-request <temporary-path>` transport: the CLI validated and staged a project-bound transaction envelope, then the Supabase `execute_sql` tool submitted it to the same approved ref. Staging alone is clearly reported as not executed. The alternative management-API transport requires an in-memory `SUPABASE_ACCESS_TOKEN`; no new credential was created or persisted for this import. No secrets appear in the SQL/payload/receipt/logs.

The transaction requires database-owner maintenance identity, no Supabase Auth identity, `pg_try_advisory_xact_lock(1936946284,356)`, and NOWAIT exclusive locks on the five catalog tables plus receipts. It checks table emptiness and audit/RLS states under those locks. It inserts branches, programs, offerings, curriculum and careers using explicit manifest UUIDs, then reconciles every row before committing. Lock acquisition refuses contention; statement and lock timeouts are bounded. The mutex was not separately exercised with a hosted competing importer, avoiding an unnecessary second execution.

The only schema addition is `supabase/migrations/20260912112848_catalog_import_receipts.sql`, applied once with hosted version `20260912112848`. It adds a private, RLS-enabled, access-revoked receipt table and its immutable trigger. No previous migration was replayed. Public catalog types were unchanged, so the frozen generated-types binding remains intact.

## Audit and rollback

The approved initial-import maintenance strategy was applied: only the five named `audit_change` triggers were temporarily disabled inside the transaction, then restored and checked before commit. No global trigger/replication setting, foreign key, CHECK constraint, RLS policy or normal audit function was weakened.

Exactly one immutable receipt contains the fingerprints, manifest version, source/destination counts, actor, project, batch, timestamp and transaction ID. It lives in `private.catalog_import_receipts`; browser roles and service-role API clients have no direct receipt access. UPDATE, DELETE and TRUNCATE are rejected by its append-only trigger. Normal `activity_logs` remained zero rather than receiving 356 misleading human-admin edits.

Any insertion, reconciliation, trigger-restoration or receipt failure aborts the transaction, rolling back catalog rows, receipt and temporary trigger-state changes together. Disposable PostgreSQL tests deliberately corrupted an inserted value and forced receipt failure; both rolled back completely. They also verified normal post-import edits generate audit entries and receipt mutations are refused. No failure/recovery mutation was run against the hosted catalog.

Final hosted inspection confirmed all five `audit_change` triggers are enabled (`O`). Audit/receipt immutability is unchanged. No manual database intervention or recovery was required.

## Retry behavior

The exact live retry, already completed after the original commit, returned **`already imported and reconciled`**. It retained the same receipt, original timestamp and transaction ID and added no catalog rows. The importer checks the immutable matching batch and exact current data before returning a no-op. Partial/non-empty targets without that matching receipt, or mismatched rows, stop for manual review; no blind upserts or destructive resets exist.

During the final verification continuation the import was not executed again. Fresh identical hosted rows and the same receipt confirm the no-op preconditions still hold. Fresh disposable database tests again passed exact retry and mismatch refusal. The importer was run in dry-run mode only during that continuation.

## Static-versus-hosted parity and preserved ambiguity

`tests/catalog-hosted-parity.test.mjs` feeds the freshly verified hosted snapshot through the real `mapCatalog` Supabase mapper. It checks programs, categories, duration/content, branch identities, prices, study modes, genders, curriculum, career paths and hour overrides. Reconstructed content also passes the actual explorer category/mode/city filters. Combined with the frozen payload tests, verification covers exact images/keywords/flags, search/sorting and installment semantics.

Intentional controls remain different from the currently usable static catalog: imported programs are draft, hidden and inactive; branches/offerings inactive; registration unknown. Parity tests restore the frozen original offering activity only in their test projection to compare content and availability rules. They do not activate hosted rows. This is content/relationship parity, not authorization or publication cutover proof.

- Accounting remains one program with zero offerings and no manufactured price/availability.
- Six exact Dammam identities remain separate: `فرع الدمام`, `حي الشاطئ`, `حي الشاطئ الغربي`, `حي الزهور`, `حي الزهور 1`, `حي الزهور 2`.
- `سكوير` and directory-only `حي الضيافة` remain separate.
- `d-nebosh-250` and `d-nebosh-300` remain distinct records with original names and prices.
- English entries retain qualifying-course classification and pending flags.
- Law retains base hours 84 and the `off-26` override 75.
- Diploma deposit 250 and repayment months 24 retain `(price - deposit) / months`; neither became a registration fee or monthly minimum.

No normalization, renaming, inferred offerings, source drops or business-data correction occurred. Four catalog-validator warnings remain explicitly preserved: accounting without offerings and the three offering-only Dammam references.

## Final security and performance checks

Fresh hosted checks confirm RLS on all five catalog tables, no anon SELECT/write grants, no direct authenticated browser INSERT/UPDATE/DELETE grants, and all catalog audit triggers enabled. The private probe, private audit and receipt tables have RLS and no anon/authenticated direct access. The existing controlled probe infrastructure was not changed.

Security advisors were rerun. Three informational `RLS enabled, no policy` notices concern the intentionally inaccessible private tables (`admin_write_probes`, `legacy_write_audit`, `catalog_import_receipts`). These are deny-by-default maintenance tables, not a reason to grant browser access. [Advisor reference](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

**Separate existing Auth warning:** Supabase leaked-password protection is disabled. This setting predates the import and is distinct from legacy bcrypt authentication. It was documented, not changed in this phase. [Auth warning reference](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Performance advisors reported **11 informational unused-index notices** after the new import. All indexes were retained; low usage at this stage is not evidence for removal. [Performance advisor reference](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

The rebuilt client/generated asset scan covered 298 files (`.next/static`, `out`, `public`, generated HTML/RSC/body/meta assets): zero matches for secret/service-role environment identifiers, configured key values, or service-role JWTs. Server implementation bundles were excluded from the client scan; privileged credentials remain server-only.

## Final verification

| Check | Result |
| --- | --- |
| `npm run validate:catalog` | Passed; baseline fingerprint, approved counts, four preserved warnings |
| `node scripts/prepare-catalog-import.mjs` | Passed; existing manifest/payload stable |
| Importer dry run with exact project ref | Passed; no hosted execution |
| Fresh hosted exact reconciliation | Passed for all 356 rows |
| Static/hosted mapper parity | Passed |
| Full `npm test` | 166 tests, 22 files passed |
| `npm run test:db` | Passed; disposable cluster stopped |
| `npx tsc --noEmit` | Passed after build |
| `npm run build` | Passed, Next.js 15.5.25 |
| `git diff --check` | Passed; only existing LF/CRLF notices |

`ADMIN_DATA_SOURCE=static` remains unchanged. `AdminProvider` still dispatches session/in-memory updates; persistent catalog editing remains disabled. No auth/session/middleware/account source files were changed by this phase, and no Supabase Auth user was created (one pre-existing user remains). `git diff --numstat -- data lib/installments.ts` is empty; source fingerprint and frozen mappings are unchanged.

## Remaining gates before Supabase read cutover

1. The existing hosted read repository still requires `client.auth.getUser()` plus an active `admin_profiles` row. Legacy admin sessions are intentionally not bridged to Supabase Auth. A separately reviewed server-side read-authorization integration is required; changing the source environment variable alone would fail authentication for legacy-admin reads.
2. Decide and approve hosted visibility/active-state policy. Data remains draft/hidden/inactive; technical import approval did not authorize publication or staff-catalog exposure.
3. Verify the actual authenticated hosted read path end-to-end, including role denial, ordering, empty/error states and rollback to static reads. Mapper parity is not a substitute for that integration proof.
4. Preserve or explicitly resolve business ambiguities through institute approval before any business-data correction. No such correction is required to preserve the imported representation.

Persistent CRUD remains a separate phase. No remaining data-reconciliation blocker was found, and no further import is required.
