begin;
create table private.catalog_import_receipts (
  batch_id uuid primary key,
  source_fingerprint text not null check (source_fingerprint ~ '^[0-9a-f]{64}$'),
  manifest_fingerprint text not null unique check (manifest_fingerprint ~ '^[0-9a-f]{64}$'),
  payload_fingerprint text not null check (payload_fingerprint ~ '^[0-9a-f]{64}$'),
  manifest_version integer not null check (manifest_version > 0),
  source_counts jsonb not null check (jsonb_typeof(source_counts)='object'),
  destination_counts jsonb not null check (jsonb_typeof(destination_counts)='object'),
  project_ref text not null check (project_ref='crzedkbjvujcmcikgvoe'),
  import_actor text not null check (import_actor='system migration'),
  transaction_id bigint not null default txid_current(),
  imported_at timestamptz not null default clock_timestamp()
);
alter table private.catalog_import_receipts enable row level security;
revoke all on private.catalog_import_receipts from public, anon, authenticated, service_role;
create trigger catalog_import_receipt_immutable before update or delete or truncate
on private.catalog_import_receipts for each statement execute function private.reject_audit_mutation();
commit;
