import HostedActivity from '@/components/admin/HostedActivity';
import { loadActivity } from '@/lib/admin/activity';
export default async function Page({ searchParams }: { searchParams: Promise<{ cursor?: string | string[] }> }) {
  const { cursor } = await searchParams;
  return <HostedActivity result={await loadActivity(Array.isArray(cursor) ? 'invalid' : cursor)} />;
}
