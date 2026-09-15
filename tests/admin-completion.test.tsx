import React, { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { programs } from '@/data/programs';
import { offerings } from '@/data/offerings';
import { branches } from '@/data/branches';
import { createAdminSnapshot, money } from '@/lib/admin/adapter';
import { AdminProvider, useAdmin } from '@/components/admin/AdminProvider';
import PricingTable from '@/components/admin/PricingTable';
import ProgramEditor from '@/components/admin/ProgramEditor';
import { BranchDetail } from '@/components/admin/Branches';
import Activity from '@/components/admin/Activity';
import Users from '@/components/admin/Users';
import { adminReducer, createSession } from '@/lib/admin/session';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => '/admin/pricing', useSearchParams: () => new URLSearchParams() }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const data = createAdminSnapshot(programs, offerings, branches);
const law = data.programs.find(p => p.id === 'law')!;
function Harness() {
  const [view, setView] = useState('pricing');
  const state = useAdmin();
  return <><nav>{['pricing', 'branch', 'program', 'activity'].map(v => <button key={v} onClick={() => setView(v)}>{v}</button>)}</nav>
    <output data-testid="state">{JSON.stringify(state.programs.find(p => p.id === 'law')!.offerings)}</output>
    {view === 'pricing' && <PricingTable />}{view === 'branch' && <BranchDetail id={law.offerings[0].branchId} />}{view === 'program' && <ProgramEditor id="law" />}{view === 'activity' && <Activity />}</>;
}
function setup() { render(<AdminProvider initial={data} userName="موظف الاختبار"><Harness /></AdminProvider>); }
function editPrice() {
  fireEvent.change(screen.getByLabelText('البرنامج'), { target: { value: 'law' } });
  fireEvent.click(screen.getAllByRole('button', { name: /^تعديل سعر/ })[0]);
  fireEvent.change(screen.getByLabelText('السعر الأساسي (ر.س)'), { target: { value: '14567' } });
}
it('keeps saved pricing consistent across all three screens and records the change without display metadata', () => {
  setup(); editPrice();
  fireEvent.click(screen.getByRole('button', { name: 'حفظ التغييرات' }));
  expect(screen.getByText(money(14567))).toBeInTheDocument();
  const saved = JSON.parse(screen.getByTestId('state').textContent!);
  expect(saved[0]).not.toHaveProperty('program');
  expect(saved.slice(1)).toEqual(law.offerings.slice(1));
  fireEvent.click(screen.getByRole('button', { name: 'branch' }));
  expect(screen.getByText(money(14567))).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'program' }));
  fireEvent.click(screen.getByRole('button', { name: 'الفروع والأسعار' }));
  expect(screen.getAllByText(money(14567)).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: 'activity' }));
  fireEvent.change(screen.getByLabelText('المصدر'), { target: { value: 'session' } });
  expect(screen.getByText('14567')).toBeInTheDocument();
  expect(screen.getByText('السعر')).toBeInTheDocument();
});
it('guards dirty offering reload and cancel, then removes the guard after discarding', () => {
  setup(); editPrice();
  const unload = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(unload);
  expect(unload.defaultPrevented).toBe(true);
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  fireEvent.click(screen.getByRole('button', { name: 'إغلاق تعديل الخيار' }));
  expect(confirm).toHaveBeenCalled();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: 'إغلاق تعديل الخيار' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  const clean = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(clean);
  expect(clean.defaultPrevented).toBe(false);
  expect(JSON.parse(screen.getByTestId('state').textContent!)[0].price).toBe(law.offerings[0].price);
});
it('archives and restores an offering with price preserved and availability disabled', () => {
  setup(); fireEvent.change(screen.getByLabelText('البرنامج'), { target: { value: 'law' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'أرشفة' })[0]);
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'أرشفة الخيار' }));
  fireEvent.change(screen.getByLabelText('حالة الخيار'), { target: { value: 'archived' } });
  fireEvent.click(screen.getByRole('button', { name: 'استعادة' }));
  const saved = JSON.parse(screen.getByTestId('state').textContent!)[0];
  expect(saved).toMatchObject({ archived: false, active: false, price: law.offerings[0].price });
  fireEvent.click(screen.getByRole('button', { name: 'activity' }));
  fireEvent.change(screen.getByLabelText('المصدر'), { target: { value: 'session' } });
  expect(screen.getAllByText('الأرشفة')).toHaveLength(2);
});
it('filters mock users and recovers from an empty result', () => {
  render(<Users />);
  fireEvent.change(screen.getByLabelText('الدور'), { target: { value: 'Viewer' } });
  expect(screen.getByText('خالد الحربي')).toBeInTheDocument();
  expect(screen.queryByText('سارة العتيبي')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('الحالة'), { target: { value: 'active' } });
  expect(screen.getByText('لا يوجد مستخدمون مطابقون')).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button', { name: 'مسح الفلاتر' })[0]);
  expect(screen.getByText('سارة العتيبي')).toBeInTheDocument();
});

it('preserves program content through archive and restore and omits no-op activity', () => {
  const meta = { actor: 'موظف', time: '2026-09-10T10:00:00Z', id: 'archive' };
  const initial = createSession(data);
  expect(adminReducer(initial, { ...meta, type: 'program', program: law })).toBe(initial);
  const archived = adminReducer(initial, { ...meta, type: 'program', program: { ...law, archived: true, status: 'inactive', catalogVisible: false } });
  const source = archived.programs.find(p => p.id === law.id)!;
  const restored = adminReducer(archived, { ...meta, id: 'restore', type: 'program', program: { ...source, archived: false } });
  expect(restored.programs.find(p => p.id === law.id)).toMatchObject({ archived: false, status: 'inactive', catalogVisible: false, curriculum: law.curriculum, careerPaths: law.careerPaths, offerings: law.offerings });
  expect(restored.activity).toHaveLength(2);
  expect(restored.activity[0].changes).toContainEqual({ field: 'الأرشفة', before: 'نعم', after: 'لا' });
});

it('guards program navigation while dirty and clears the guard after save', () => {
  const navigation = new EventTarget();
  vi.stubGlobal('navigation', navigation);
  render(<AdminProvider initial={data} userName="موظف"><ProgramEditor id="law" /></AdminProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'المحتوى الدراسي' }));
  fireEvent.change(screen.getByLabelText('مقرر 1'), { target: { value: 'مقرر معدل' } });
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  const link = screen.getByRole('link', { name: 'عرض المستكشف' });
  expect(fireEvent.click(link)).toBe(false);
  expect(confirm).toHaveBeenCalled();
  const back = new Event('navigate', { cancelable: true });
  Object.assign(back, { navigationType: 'traverse', canIntercept: true });
  navigation.dispatchEvent(back);
  expect(back.defaultPrevented).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'حفظ التغييرات' }));
  const unload = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(unload);
  expect(unload.defaultPrevented).toBe(false);
  vi.unstubAllGlobals();
});

it('filters activity by source and date and recovers from no matches', () => {
  render(<AdminProvider initial={data} userName="موظف"><Activity /></AdminProvider>);
  fireEvent.change(screen.getByLabelText('المصدر'), { target: { value: 'session' } });
  expect(screen.getByText('لا توجد تعديلات مطابقة')).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button', { name: 'مسح الفلاتر' })[0]);
  fireEvent.change(screen.getByLabelText('من تاريخ'), { target: { value: '2026-09-08' } });
  fireEvent.change(screen.getByLabelText('إلى تاريخ'), { target: { value: '2026-09-08' } });
  expect(screen.getByRole('status')).toHaveTextContent('1–2 من 2');
  expect(screen.queryByText(/إيقاف · حساب عرض/)).not.toBeInTheDocument();
});
