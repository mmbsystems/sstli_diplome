import LegacyUsers from '@/components/admin/LegacyUsers';
import { loadLegacyUsers } from '@/lib/admin/users';
export default async function Page() { return <LegacyUsers users={await loadLegacyUsers()} />; }
