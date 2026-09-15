import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AdminReadBoundary } from '@/components/admin/AdminReadBoundary';
import { useAdmin } from '@/components/admin/AdminProvider';
import Programs from '@/components/admin/ProgramsTable';
import Branches, { BranchDetail } from '@/components/admin/Branches';
import Pricing from '@/components/admin/PricingTable';
import AdminOverview from '@/components/admin/AdminOverview';
vi.mock('next/navigation', () => ({ usePathname: () => '/admin', useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: vi.fn() }) }));
afterEach(cleanup);

function Counts() { const { programs, branches } = useAdmin(); return <span>{programs.length} programs / {branches.length} branches</span>; }
it('renders a successful empty hosted snapshot and explains session-only edits', () => {
  render(<AdminReadBoundary state={{ status: 'ready', source: 'supabase', snapshot: { programs: [], branches: [] } }} userName="موظف"><Counts /></AdminReadBoundary>);
  expect(screen.getByText('0 programs / 0 branches')).toBeInTheDocument();
  expect(screen.getByText(/لا توجد بيانات كتالوج متاحة/)).toBeInTheDocument();
});
it('renders an explicit access limitation instead of empty catalog or child editor', () => {
  render(<AdminReadBoundary state={{ status: 'unavailable', source: 'supabase', reason: 'authentication' }} userName="موظف"><span>editor must not render</span></AdminReadBoundary>);
  expect(screen.queryByText('editor must not render')).not.toBeInTheDocument();
  expect(screen.getByText(/جلسة تسجيل الدخول/)).toBeInTheDocument();
});
it('keeps static mode free of hosted status messages', () => {
  render(<AdminReadBoundary state={{ status: 'ready', source: 'static', snapshot: { programs: [], branches: [] } }} userName="موظف"><Counts /></AdminReadBoundary>);
  expect(screen.getByText('0 programs / 0 branches')).toBeInTheDocument();
  expect(screen.queryByText(/Supabase/)).not.toBeInTheDocument();
});
it.each(['authorization', 'configuration', 'connection', 'schema'] as const)('shows %s errors without rendering the catalog', reason => {
  render(<AdminReadBoundary state={{ status: 'unavailable', source: 'supabase', reason }} userName="موظف"><Counts /></AdminReadBoundary>);
  expect(screen.getByRole('alert')).toBeInTheDocument();
  expect(screen.queryByText('0 programs / 0 branches')).not.toBeInTheDocument();
  expect(screen.getByText('لم تُستبدل البيانات ببيانات ثابتة.')).toBeInTheDocument();
});
it.each([['overview', AdminOverview], ['programs', Programs], ['branches', Branches], ['pricing', Pricing]] as const)('renders %s with zero hosted catalog records', (_name, Component) => {
  render(<AdminReadBoundary state={{ status: 'ready', source: 'supabase', snapshot: { programs: [], branches: [] } }} userName="موظف"><Component /></AdminReadBoundary>);
  expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
});
it('handles missing branch details in empty hosted mode', () => {
  render(<AdminReadBoundary state={{ status: 'ready', source: 'supabase', snapshot: { programs: [], branches: [] } }} userName="موظف"><BranchDetail id="missing" /></AdminReadBoundary>);
  expect(screen.getByText('لم نجد هذا الفرع')).toBeInTheDocument();
});
