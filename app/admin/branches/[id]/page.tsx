import { BranchDetail } from '@/components/admin/Branches';
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <BranchDetail id={decodeURIComponent(id)} />; }
