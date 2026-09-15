import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import HostedActivity from '@/components/admin/HostedActivity';
import LegacyUsers from '@/components/admin/LegacyUsers';
afterEach(cleanup);
it('renders saved audit attribution and an older-page link without preview rows', () => {
  render(<HostedActivity result={{ status: 'ready', nextCursor: 'next', items: [{ id: 'audit', time: '2026-09-13T12:00:00Z', actor: 'Real Actor', username: 'admin', role: 'super_admin', action: 'delete', entity: 'program_offerings', entityId: 'deleted-id', label: 'Retained offering', requestId: 'request' }] }} />);
  expect(screen.getByText(/Retained offering/)).toBeInTheDocument();
  expect(screen.getByText('deleted-id')).toBeInTheDocument();
  expect(screen.getByText('request')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'نشاطات أقدم' })).toHaveAttribute('href', '/admin/activity?cursor=next');
  expect(document.querySelectorAll('[data-audit-id]')).toHaveLength(1);
});
it('keeps empty history empty and failures explicit', () => {
  const { rerender } = render(<HostedActivity result={{ status: 'ready', items: [], nextCursor: null }} />);
  expect(screen.getByRole('status')).toBeInTheDocument(); expect(document.querySelectorAll('li')).toHaveLength(0);
  rerender(<HostedActivity result={{ status: 'unavailable' }} />);
  expect(screen.getByRole('alert')).toBeInTheDocument(); expect(screen.queryByRole('link', { name: 'نشاطات أقدم' })).not.toBeInTheDocument();
});
it('shows only provided legacy accounts and offers no account mutation controls', () => {
  render(<LegacyUsers users={[{ username: 'real-staff', name: 'Real Staff', role: 'staff' }, { username: 'admin', name: 'Real Admin', role: 'super_admin' }]} />);
  expect(screen.getByText('real-staff')).toBeInTheDocument(); expect(screen.getByText('super_admin')).toBeInTheDocument();
  expect(screen.getAllByRole('row')).toHaveLength(3); expect(screen.queryByRole('button')).not.toBeInTheDocument(); expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});
