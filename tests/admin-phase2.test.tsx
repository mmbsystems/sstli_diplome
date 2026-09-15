import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { programs } from '@/data/programs';
import { offerings } from '@/data/offerings';
import { branches } from '@/data/branches';
import { createAdminSnapshot, reviewReasons } from '@/lib/admin/adapter';
import { adminReducer, createSession, branchIssues } from '@/lib/admin/session';
import { AdminProvider } from '@/components/admin/AdminProvider';
import ProgramEditor from '@/components/admin/ProgramEditor';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => '/admin/programs/law', useSearchParams: () => new URLSearchParams() }));
afterEach(cleanup);
const snapshot = () => createAdminSnapshot(programs, offerings, branches);

it('keeps availability independent from publication and catalog visibility', () => {
  const data = snapshot();
  const accounting = data.programs.find(p => p.id === 'accounting')!;
  expect(accounting.publication).toBe('draft');
  expect(accounting.catalogVisible).toBe(false);
  expect(accounting.status).toBe('inactive');
  const law = data.programs.find(p => p.id === 'law')!;
  law.publication = 'draft';
  expect(law.status).toBe('active');
});

it('derives missing content and legacy branch issues without silently merging names', () => {
  const data = snapshot();
  const law = data.programs.find(p => p.id === 'law')!;
  expect(reviewReasons({ ...law, curriculum: [], careerPaths: [] }, data.branches)).toEqual(expect.arrayContaining(['المقررات غير مكتملة', 'المسارات الوظيفية غير مكتملة']));
  const legacy = data.branches.filter(b => !b.directoryListed);
  expect(legacy).toHaveLength(3);
  expect(branchIssues(legacy[0], data.programs)).toContain('اسم وارد في العروض وغير مطابق لدليل الفروع');
});

it('saves a single offering without losing sibling prices and logs before/after', () => {
  const data = snapshot();
  const law = data.programs.find(p => p.id === 'law')!;
  const before = structuredClone(data);
  const state = adminReducer(createSession(data), { type: 'offering', programId: law.id, offering: { ...law.offerings[0], price: 14000 }, actor: 'موظف', time: '2026-09-09T10:00:00Z', id: 'event-1' });
  expect(state.programs.find(p => p.id === 'law')!.offerings[0].price).toBe(14000);
  expect(state.programs.find(p => p.id === 'law')!.offerings.slice(1)).toEqual(before.programs.find(p => p.id === 'law')!.offerings.slice(1));
  expect(state.activity[0].changes.some(c => c.field === 'السعر' && c.after === '14000')).toBe(true);
  expect(data).toEqual(before);
});

it('updates branch labels consistently in the session and preserves source identities', () => {
  const data = snapshot();
  const branch = data.branches[0];
  const state = adminReducer(createSession(data), { type: 'branch', branch: { ...branch, name: 'اسم محلي' }, actor: 'موظف', time: '2026-09-09T10:00:00Z', id: 'event-2' });
  expect(state.programs.flatMap(p => p.offerings).filter(o => o.branchId === branch.id).every(o => o.branch === 'اسم محلي')).toBe(true);
  expect(data.branches[0].name).toBe(branch.name);
});

it('edits and reorders flat curriculum then restores the saved version', () => {
  render(<AdminProvider initial={snapshot()} userName="موظف"><ProgramEditor id="law" /></AdminProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'المحتوى الدراسي' }));
  fireEvent.click(screen.getByRole('button', { name: 'إضافة مقرر' }));
  const fields = screen.getAllByRole('textbox');
  fireEvent.change(fields[fields.length - 1], { target: { value: 'مقرر تجريبي' } });
  fireEvent.click(screen.getAllByRole('button', { name: /نقل لأعلى/ }).at(-1)!);
  expect(screen.getAllByRole('textbox').at(-2)).toHaveValue('مقرر تجريبي');
  fireEvent.click(screen.getByRole('button', { name: 'إلغاء التغييرات' }));
  expect(screen.queryByDisplayValue('مقرر تجريبي')).not.toBeInTheDocument();
});
