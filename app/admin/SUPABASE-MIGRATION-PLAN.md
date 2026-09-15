# Phase 3A migration preparation

No catalog records or staff accounts have been imported. The dashboard continues to use its existing static/in-memory repository. These mappings are a reviewable plan, not an executable importer.

## Verified source baseline

Run `npm run validate:catalog` from the project root. It reads and materializes `data/programs.ts`, `data/offerings.ts`, and `data/branches.ts` without connecting to a database. The validator is `lib/supabase/migration-validation.ts`.

Verified on 2026-09-10:

| Source measure | Count |
| --- | ---: |
| Programs | 53 |
| Offerings | 83 |
| Declared directory branches | 13 |
| Distinct branches referenced by offerings | 15 |
| Exact union of directory and offering branches | 16 |
| Flat curriculum items | 80 |
| Career paths | 124 |

Source SHA-256 fingerprint: `61b1cb418837450e3a35dbc0f9b92a0a67c808ca5e473dcdd785ed7303b2cf5b`. Recompute before import; changed source requires a new reviewed manifest. Current validation finds no duplicate slugs/IDs/offering contexts, broken program relationships, or invalid prices. Branch warnings below remain unresolved.

## Field mapping

| Source | Destination | Treatment |
| --- | --- | --- |
| Program `id` | `programs.legacy_id` | Preserve verbatim; separate UUID primary key |
| `name`, `slug`, `category` | `name_ar`, `slug`, `program_type` | Preserve current category codes and display text |
| `specialization`, `searchableKeywords` | `specialization`, `searchable_keywords` | Preserve optional values and ordering |
| `description` | `description` | Preserve text, including content gaps |
| `duration.label`, `.standard`, `.withSummerTerm` | `duration_display`, `duration_standard`, `duration_summer` | Preserve strings; no inferred numeric duration or unit |
| `accreditedHours` | `accredited_hours` | Optional program-level value |
| `image`, `imagePosition` | `image_path`, `image_position` | Keep current paths/cropping; no uploads or Storage migration |
| `contentPending`, `classificationPending` | `content_pending`, `classification_pending` | Preserve pending flags |
| `curriculum[]`, `careerPaths[]` | `curriculum_items`, `career_paths` | Separate UUID rows, parent UUID, zero-based `sort_order`; no semesters |
| Directory city + branch | `branches.city`, `.name`, `.legacy_key` | Exact identity, `directory_listed=true` |
| Offering-only city + branch | Same branch table | Preserve separate unresolved rows; `directory_listed=false` |
| Offering `region` | `branches.source_region_label` | Source label only; require review if labels conflict for one branch |
| Offering `programId` | `program_offerings.program_id` | Resolve through program UUID manifest |
| Offering city + branch | `program_offerings.branch_id` | Resolve exact branch key through manifest |
| `studyMode`, `gender` | `study_mode`, `gender` | Preserve; absent gender becomes existing model's `both` |
| `price` | `price` | SAR tuition; unknown remains NULL, zero remains zero |
| `minDownPayment`, `installments` | `min_down_payment`, `installment_months` | Upfront deposit and remaining repayment months |
| Offering `accreditedHours` | `accredited_hours_override` | Preserve overrides separately from program hours |
| Offering `active` | `is_active` | Import only after visibility/approval mapping is accepted |
| Offering source order | `sort_order` | Preserve current ordering explicitly |

`accreditation_text`, `name_en`, and branch `address` support existing admin concepts but have no authoritative static-source value to invent. Publication, catalog visibility, featured status, timestamps and versions require an explicit import policy. Existing preview-derived publication defaults are not evidence of institute approval. New database rows default to draft/inactive/hidden; registration defaults to `unknown`. No source registration dates, discounts, original prices, fees, minimum monthly payments, SEO metadata or cohort rules are inferred.

## Stable IDs and repeatability

Create a reviewed, immutable import manifest before writing data: source fingerprint, source program ID -> UUID, exact `city::branch` -> UUID, and offering context -> UUID. Program and branch legacy keys remain unique. Reject delimiter ambiguity if future branch strings contain `::`.

Offering identity is the JSON tuple `[programId, city, branch, studyMode, gender || 'both']`, as implemented by `offeringIdentity`. The current `off-N` identifiers depend on array order: retain the frozen original value in `legacy_id` for traceability, but never use a newly recomputed `off-N` as an upsert key. Price changes do not change identity. Future context changes must be explicit edits against the manifest's UUID. Resolve duplicate contexts before import instead of silently dropping them.

Curriculum/career child UUIDs also belong in the frozen manifest (source program, original position and text). Subsequent edits/reordering use UUIDs; importing again must not recreate rows or replace IDs.

## Source ambiguities requiring review

- Dammam references `الدمام::فرع الدمام`, `الدمام::حي الشاطئ`, and `الدمام::حي الزهور` are absent from the directory. Do not merge them with `حي الشاطئ الغربي`, `حي الزهور 1`, or `حي الزهور 2` automatically. The proposed union has 16 identities until institute approval says otherwise.
- Preserve `سكوير` and the directory-only `حي الضيافة` independently. A directory entry without offerings is not grounds for deletion.
- Accounting currently has no offerings; retain its program record without manufacturing availability or pricing.
- Preserve distinct NEBOSH entries and English course classification/study modes. Resolve naming or classification concerns through institute review, not migration heuristics.
- Preserve differing program/offering hours (including law's 84/75 values) as base plus override, rather than replacing either.
- Current installment logic treats the 250 amount as a deposit and 24 as repayment months: `(price - deposit) / months`. It is not a registration fee or minimum monthly payment.

## Constraints and import checks

The schema rejects negative/NaN prices, invalid deposit bounds, nonpositive installment months/hours, duplicate slugs, broken foreign keys and invalid ordering. Money uses `numeric(12,2)`; the future importer must reject excess precision/range before sending values rather than relying on PostgreSQL rounding. Unique live offering context is program + branch + mode + gender; archived rows do not occupy that slot. Overlapping `both` versus male/female contexts and future multiple cohorts require an approved business rule before schema expansion. Restoring an archived duplicate must resolve the conflict explicitly.

Before a future import, freeze source and manifest, resolve all warnings, approve publication/registration/branch mappings, back up the target, and dry-run into an isolated database. Verify counts (53/83/16/80/124 unless approved mappings change them), IDs, exact Arabic text, images, ordering, every price/deposit/month value, and all foreign keys. Compare destination rows against the manifest, not counts alone. Compare staff-catalog behavior before proposing repository cutover. Retain the old source and an explicit rollback plan.

No import script, live adapter, Auth account creation, or production migration is included in Phase 3A. Current preview user/activity records are mocks, not account/audit migration sources.
