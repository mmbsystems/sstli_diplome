// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { loadAdminData, readDataSource } from '@/lib/admin/read-source';

it('defaults to static data without constructing a hosted client', async () => {
  const snapshot = { programs: [], branches: [] };
  const hosted = () => { throw new Error('must not connect'); };
  expect(readDataSource(undefined)).toBe('static');
  expect(await loadAdminData(undefined, { getSnapshot: async () => snapshot }, hosted)).toEqual({ status: 'ready', source: 'static', snapshot });
});
it('keeps an authorized empty hosted dataset empty', async () => {
  const fallback = vi.fn(async () => { throw new Error('must not fall back'); });
  const snapshot = { programs: [], branches: [], source: 'supabase' as const };
  const result = await loadAdminData('supabase', { getSnapshot: fallback }, async () => ({ getSnapshot: async () => snapshot }));
  expect(result).toEqual({ status: 'ready', source: 'supabase', snapshot });
  expect(fallback).not.toHaveBeenCalled();
});
it('does not hide hosted failure behind static data or expose raw errors', async () => {
  const result = await loadAdminData('supabase', { getSnapshot: async () => { throw new Error('fallback'); } }, async () => { throw new Error('credential in diagnostic'); });
  expect(result).toEqual({ status: 'unavailable', source: 'supabase', reason: 'connection' });
});
it('rejects misspelled data source instead of silently selecting static', async () => {
  expect(() => readDataSource('supabse')).toThrow();
  expect(await loadAdminData('supabse', { getSnapshot: async () => ({ programs: [], branches: [] }) }, async () => { throw new Error(); })).toEqual({ status: 'unavailable', source: 'configuration', reason: 'configuration' });
});
