# Phase 3D-1 — frozen catalog dry run

Prepared 2026-09-12 from the completed Phase 3C working tree. This phase creates offline review artifacts only. No hosted catalog writes, test catalog rows, migration replay, private probe operations, auth changes, form changes, or source cutover were performed.

## Source and stop gates

Authoritative inputs inspected: `data/programs.ts`, `data/offerings.ts`, `data/branches.ts`, `data/regions.ts`, `lib/installments.ts`, the Phase 3A migration plan, Phase 3C verification report, existing migrations, generated database types, source validator and read mappers. The explorer's real `filterPrograms` and `getAvailableCities` functions are exercised by parity tests.

Source SHA-256: `61b1cb418837450e3a35dbc0f9b92a0a67c808ca5e473dcdd785ed7303b2cf5b` — matches the approved baseline exactly. The hash uses the existing validator's materialized `{ programs, offerings, branches }` JSON, including array order. Auxiliary hashes bind the manifest to regions, installment logic, generated types and the foundation schema file.

Source validation: zero errors; zero duplicate program IDs/slugs/offering IDs/contexts, invalid prices, or broken program relationships. Four warnings are explicitly allowed for preservation by this phase's instructions: accounting without offerings and the three exact Dammam references listed below. Any other warning or fingerprint drift fails preparation; existing manifest IDs are never regenerated to hide a mismatch.

## Reconciliation

| Entity | Source | Payload | Hosted before | Hosted after |
| --- | ---: | ---: | ---: | ---: |
| Programs | 53 | 53 | 0 | 0 |
| Exact branch union | 16 | 16 | 0 | 0 |
| Offerings | 83 | 83 | 0 | 0 |
| Curriculum items | 80 | 80 | 0 | 0 |
| Career paths | 124 | 124 | 0 | 0 |

The directory contains 13 identities; offerings reference 15; their exact union contains 16. All 356 destination rows are review data only. Source order is retained for programs and offerings; child order is zero-based within each program. Branch order is directory order followed by first-seen offering-only identities.

## Frozen artifacts and regeneration

- `migration/catalog-import-manifest.json`: version 1, created `2026-09-12T11:14:44.671Z`, target project `crzedkbjvujcmcikgvoe`, target schema version `20260912105826`.
- `migration/generated/catalog-import-payload.json`: ordered arrays for the five destination tables.
- `migration/reports/reconciliation.json`: counts, validation warnings, policy and payload checksum.
- `migration/reports/program-map.csv`: source ID, UUID, name and slug.
- `migration/reports/branch-map.csv`: exact key, UUID, city, branch and directory flag.
- `migration/reports/offering-map.csv`: legacy ID, UUID, source program, branch key, mode, gender, price and source index.

Run `node scripts/prepare-catalog-import.mjs` from the project root. It has no database client, SQL execution or network calls. It validates before writing artifacts; creation uses an exclusive manifest write. An existing manifest is loaded and checked, never overwritten. Repeated runs produce byte-identical manifest/payload/CSV/reconciliation artifacts. Keep and review the manifest with its payload; deleting it would create a different batch and must never be part of a retry procedure.

Manifest body integrity SHA-256: `9193fb1256b02777801cc0642a6a3ebdfd1a5050eac975e3871f6ec5e9fbf2cd`.

Payload file SHA-256: `0967bda4eb8d37b4112bbbaca1eb26a40f194b875b0f24c909efdc68f0cb07a4`.

The integrity checksum detects accidental edits; it is not a digital signature. Approved copies/checksums must be retained independently for the later import.

UUIDs are generated once with `randomUUID()` and frozen for program source IDs, exact `city::branch` keys, JSON offering tuples `[programId, city, branch, studyMode, gender ?? 'both']`, and child tuples `[programId, originalIndex, text]`. Offering provenance also retains legacy `off-N`, zero-based source index and original `active`. All 356 UUIDs are unique. No price-based or name-similarity identity heuristic is used.

## Field policy and exact preservation

All authoritative program fields map directly: legacy ID, Arabic name, slug, category, specialization, keywords/order, description, all duration strings, hours, image path/crop and pending flags. Missing optional text/numbers become null; missing keywords become an empty array and absent pending flags become false, matching current runtime defaults. No text is trimmed or normalized in output.

Programs are explicitly draft, hidden and inactive. Branches and offerings are inactive; offering registration is unknown. Original offering activity is retained only as manifest provenance for parity analysis. These controls intentionally differ from the usable static catalog and are not permission to publish later.

No `name_en`, accreditation, featured status, SEO, address, timestamps, archive date or row version is invented. Omitted fields will use the schema's defaults only during a separately approved import. No discounts, registration fees, monthly minimums or cohort fields are inferred.

All offering prices, exact program/branch relationships, modes, genders, overrides and order are preserved. Zero stays zero; unknown stays null. The 41 diploma offerings retain deposit 250 and repayment months 24. `(price - min_down_payment) / installment_months` remains the calculation; 250 is a down payment, not a registration fee or minimum monthly payment. No semesters or child deduplication are introduced.

Preservation totals: **zero renamed programs, zero branch merges, zero inferred prices, zero inferred offerings, zero inferred curriculum, zero source record drops**. Differences are limited to the explicit safe controls, generated UUID relationships, nullable/default representation, source category stored once on the parent, and source region stored on the exact branch. No source business value is corrected by this phase.

## Ambiguities retained for business review

| Issue | Exact treatment |
| --- | --- |
| Dammam offering-only references | `الدمام::فرع الدمام`, `الدمام::حي الشاطئ`, `الدمام::حي الزهور` remain separate rows with `directory_listed=false`. |
| Dammam directory identities | `حي الشاطئ الغربي`, `حي الزهور 1`, `حي الزهور 2` retain their exact distinct keys; no alias resolution. |
| Khamis Mushait | `سكوير` and directory-only `حي الضيافة` remain separate; the latter is retained without manufactured offerings. |
| Accounting | `accounting` program retained, zero offerings, no price/availability invented. |
| NEBOSH | `d-nebosh-250` and `d-nebosh-300` remain two programs with distinct UUIDs, source names and 250/300 prices. Shared imagery or similar titles does not establish identity. |
| English classification | `english-1` through `english-4` retain `qualifying-course`, `classification_pending=true` and original modes. No classification repair. |
| Law hours | Base program hours 84 and `off-26` override 75 both retained. No other differing explicit override found. |

Source region labels are taken only from exact offering references. Conflicting labels fail the dry run; directory-only branches without an offering label keep null. `knownRegions` is not used to invent a region label or rename a city.

## Prevalidation and parity

Application prevalidation checks UUIDs, unique legacy IDs/slugs/branch keys/live offering contexts, foreign keys, allowed categories/modes/genders, text/boolean types, positive integer hours/months within PostgreSQL integer bounds, nonnegative money within numeric(12,2) precision/range, deposit bounds, contiguous zero-based child ordering, safe initial controls and absence of unapproved generated fields. All checks pass.

Tests compare exact program content, categories, images, flags, duration variants, keywords, branch/mode/gender/price values, curriculum/career text and ordering, deposits/months, zero/null prices, accounting, NEBOSH and law overrides. Tests also feed reconstructed payload content into the actual explorer functions across category/mode/city combinations, price/duration sorting and representative Arabic/English searches, and compare the actual installment function.

Parity is **content/relationship behavior parity**, not publication parity. Tests restore the frozen original offering activity solely in their comparison projection. The payload itself stays inactive and would not expose this catalog after import. It must not be used as evidence that a source switch is ready.

## Hosted migration history — read only

| Hosted version | Name |
| --- | --- |
| 20260910183837 | remove_legacy_diploma_finder |
| 20260910183907 | catalog_foundation |
| 20260910183919 | transactional_audit |
| 20260912000847 | legacy_admin_write_foundation |
| 20260912001137 | legacy_admin_probe_optional_value |
| 20260912105826 | legacy_admin_conflict_http_409 |

Earlier local migration filenames have different timestamps from their hosted application versions; this phase documents that existing state without renaming files, repairing history or replaying migrations. No schema changes are included.

## Phase 3D-2 recommendation — design only

Use the reviewed frozen manifest/payload as one approved import batch. Before execution, recheck source and artifact checksums, exact hosted schema/function/trigger state, empty target counts and backups. Reconcile the historical local/hosted naming difference through review rather than blindly replaying the migration directory. Do not use the admin probe route or impersonate a human admin.

Execute one controlled database-owner maintenance transaction in this FK-safe order: **branches → programs → offerings → curriculum → careers**. Acquire locks on the five target tables in a fixed order and recheck emptiness inside the transaction to avoid a race. Insert only explicit payload UUIDs/columns. Validate counts, relationships, ordered text, prices and payload-equivalent row projections before commit. Any insertion, constraint, reconciliation or receipt failure rolls back the whole batch. Do not disable foreign keys, CHECK constraints, RLS definitions or uniqueness constraints.

Audit decision: **A — intentionally suppress only initial import row events under controlled maintenance semantics**. In Phase 3D-2, use transactional DDL under the database owner to disable only the named `audit_change` triggers on these five tables, retain other triggers/constraints, then restore and verify their prior enabled states before commit. Never use global `session_replication_role`, never change the ordinary application audit function, and never delete existing audit rows. Record one separate immutable migration-batch receipt with manifest/payload fingerprints, counts, operator, transaction identifier and completion time as part of the same transaction. The receipt mechanism and trigger-state assertions must be implemented and reviewed in Phase 3D-2 before running any import; they are not implemented here. A failure rolls back the data, receipt and trigger-state changes together. This avoids presenting 356 initial rows as human admin edits while preserving normal transactional auditing afterward.

Idempotency: the batch receipt is keyed by the approved manifest checksum. If a retry finds a committed matching receipt, compare every expected UUID and business field and exit without writes only on an exact match. If the database is empty after rollback, reuse the same manifest IDs. Any partial/pre-existing/unexpected rows, different receipt or changed values must stop for review; never reset, merge or blindly upsert. UUIDs, not regenerated `off-N` values, are the future identity keys. Do not overwrite later edits or create fresh child IDs on retries.

Keep `ADMIN_DATA_SOURCE=static` and persistent forms disabled throughout Phase 3D-2 unless separately authorized. Import approval does not authorize publication, staff authentication changes or UI cutover.

## Verification and changed files

Final verification on 2026-09-12: catalog validator and repeated offline dry run passed with the exact baseline fingerprint and four approved preservation warnings. All **157 tests in 20 files passed**, including **26 migration tests**. Database tests passed; production build passed (Next.js 15.5.25); standalone `npx tsc --noEmit` passed after the build; `git diff --check` passed with only existing LF/CRLF conversion notices. The final hosted SELECT confirmed all five catalog counts remain zero. `git diff --numstat -- data lib/installments.ts` was empty, and `.env.local` still reports `ADMIN_DATA_SOURCE=static`.

Database tests use an existing disposable local cluster with synthetic transactional fixtures; they do not touch hosted catalog records. The dry-run itself executes no INSERT statements anywhere.

Added files: `scripts/catalog-import-lib.mjs`, `scripts/prepare-catalog-import.mjs`, `tests/catalog-import.test.mjs`, this report, the frozen manifest, generated payload, reconciliation JSON and three mapping CSVs. Existing application, authentication, source, SQL migrations and private probe files are unchanged by Phase 3D-1. Artifacts remain in the working tree for review; no commit or deployment is performed.
