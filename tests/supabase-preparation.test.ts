// @vitest-environment node
import { expect, it, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { programs } from '@/data/programs';
import { offerings } from '@/data/offerings';
import { branches } from '@/data/branches';
import { validateCatalogSource, offeringIdentity } from '@/lib/supabase/migration-validation';
import { getSupabaseConfig } from '@/lib/supabase/config';

afterEach(() => vi.unstubAllEnvs());
it('verifies materialized counts and reports unresolved branches without merging them', () => {
  const result = validateCatalogSource(programs, offerings, branches);
  expect(result.counts).toMatchObject({ programs: 53, offerings: 83, declaredBranches: 13, unionBranches: 16, curriculumItems: 80 });
  expect(result.errors).toEqual([]);
  expect(result.unresolvedBranches).toEqual(['الدمام::فرع الدمام', 'الدمام::حي الشاطئ', 'الدمام::حي الزهور']);
});
it('detects bad prices, broken relations, duplicate slugs and duplicate offering contexts', () => {
  const source = structuredClone(programs); source[1].slug = source[0].slug;
  const rows = structuredClone(offerings); rows[0].price = -1; rows[1].programId = 'missing'; rows.push({ ...rows[0], id: 'another' });
  const report = validateCatalogSource(source, rows, branches);
  expect(report.errors.join(' ')).toMatch(/duplicate slug/);
  expect(report.errors.join(' ')).toMatch(/invalid price/);
  expect(report.errors.join(' ')).toMatch(/missing program/);
  expect(report.errors.join(' ')).toMatch(/duplicate offering context/);
});
it('uses context rather than array position or price for offering migration identity', () => {
  const original = offerings[0];
  expect(offeringIdentity(original)).toBe(offeringIdentity({ ...original, id: 'off-999', price: 1 }));
  expect(offeringIdentity(original)).not.toBe(offeringIdentity({ ...original, studyMode: 'online' }));
});
it('does not require configuration until an explicitly requested client is created', () => {
  for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']) vi.stubEnv(key, '');
  expect(getSupabaseConfig()).toBeNull();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
  expect(getSupabaseConfig()).toEqual({ url: 'https://example.supabase.co', key: 'sb_publishable_test' });
});
it('retains the static repository and existing middleware boundary', () => {
  const repository = readFileSync('lib/admin/repository.ts', 'utf8');
  expect(repository).toContain('createAdminSnapshot(programs, offerings, branches)');
  expect(repository).not.toMatch(/supabase/);
  expect(readFileSync('middleware.ts', 'utf8')).not.toMatch(/supabase/);
  expect(readFileSync('components/admin/AdminProvider.tsx', 'utf8')).not.toMatch(/supabase/);
});
it('rejects privileged keys in public configuration', () => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_secret_test');
  expect(() => getSupabaseConfig()).toThrow(/secret key/);
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', `header.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.signature`);
  expect(() => getSupabaseConfig()).toThrow(/anon/);
});
