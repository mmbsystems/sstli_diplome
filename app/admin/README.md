# Admin UI preview

Open `/admin` after signing in through the existing `/login` page. The existing staff authentication and no-index policy protect all admin routes. This phase introduces no new roles, authentication endpoints, database, or Supabase connection.

Implemented routes:

- `/admin`: catalog metrics, source-derived review issues, and recent session activity alongside labeled examples.
- `/admin/programs`: search, combined type/status/mode/branch filters, name/price/recent-save sorting, pagination, row actions, and mobile summaries.
- `/admin/programs/new` and `/admin/programs/[id]`: basic information, branch offerings and payment estimates, editable ordered curriculum/careers, image replacement, visibility controls, reversible archiving, local save/cancel, validation, and unsaved-navigation warning.
- `/admin/branches` and `/admin/branches/[id]`: searchable branch directory, identity and availability editing, review issues, and shared offering pricing.
- `/admin/pricing`: searchable/filterable offering prices, payment estimates, edit dialog, archive and restore.
- `/admin/activity`: actor/action/entity/source/date filters, search, pagination, before/after details, and links to changed records. Session activity and illustrative fixtures are explicitly distinguished.
- `/admin/users`: read-only illustrative staff list with role/status/search filters, empty-state recovery, and proposed role descriptions.

Publishing and visibility controls affect only the preview session. Selected images are validated and retained in memory; there is no remote upload. User accounts, role enforcement, invitations, persistent audit records, and database publishing remain mocked or deferred. Settings remains marked unavailable in the sidebar.

## Data boundary

`lib/admin/repository.ts` is a server-only read interface. Its static adapter creates independent copies of existing catalog data and unions declared branches with offering branch identities without guessing aliases. Existing prices are original/current prices, registration is unknown, accounting is presented as a draft, and source timestamps are left unknown. In-memory status is a UI interpretation, not a database publication state.

`AdminProvider` owns the preview session. Save updates only that provider and its activity list. Changes survive client-side navigation within `/admin`, but a reload, leaving the admin layout, or ending the session resets them. Nothing writes to production data modules, browser storage, authentication records, or external services. New programs use temporary UUIDs; existing IDs remain source IDs until a future migration.

`catalogSlug` retains the original route for existing programs; a locally edited slug does not pretend that a public route has changed. Local programs without an original catalog route have no catalog link. The public catalog components and global stylesheet are unchanged. All new visual styles use the `adm-` prefix, including portal styles.

The future Supabase implementation must introduce real authorization, validated draft/publish commands, durable IDs, and concurrency/audit enforcement before allowing persistent writes. The preview provider is not a security boundary or a production repository.

## Verification

Run `npm test` and `npm run build`. The three admin test files cover clone isolation, validation, editor cancellation, ordered curriculum, offering and program archive/restore, activity filters and before/after values, mock user filters, and pricing consistency across all three screens. Dirty program/branch editors warn on document exits, links and logout; dirty offering dialogs also warn on document exits and explicit dismissal. Back/Forward navigation is guarded in browsers exposing cancellable Navigation API traversal events; browsers without that API retain the link, dialog and document-exit guards.

### Phase 2 continuation verification — 2026-09-10

- Continued the existing working tree; completed screens were retained.
- Fixed pricing rows leaking their display-only parent program into saved offering data.
- Added document-exit protection for dirty offering dialogs.
- Activity filter changes now reset pagination to the first page.
- Added unsaved Back/Forward protection through cancellable Navigation API traversal events.
- `npm test`: **11 files, 69 tests passed**, including existing staff authentication and catalog tests.
- `npm run build`: **passed**, including TypeScript validation and all admin routes.
- Production-server browser checks: Activity, Users, Pricing, Branches and Program Editor at **1440, 1024, 768, 390 and 360 px**, with no page-level horizontal overflow. Desktop Activity, tablet Users, and mobile Users screenshots visually reviewed. These were browser viewport checks, not physical-device tests.
- Live client-side navigation confirmed a **13,000 → 14,567 SAR** offering edit in Pricing, Branch Details and Program Editor; Activity displayed the matching before/after record. Mobile user filters and empty-state recovery passed. No browser console errors were recorded during those checks.
- Supabase remains disconnected. No authentication code/configuration, production catalog files, dependency files, or production data were changed. No migration was performed.

Files changed in this continuation: `components/admin/Activity.tsx`, `components/admin/OfferingEditor.tsx`, `components/admin/EditorControls.tsx`, `components/admin/PricingTable.tsx`, `tests/admin-completion.test.tsx`, and this README. Activity and Users route files and the Users implementation were already present and were verified rather than rewritten.
