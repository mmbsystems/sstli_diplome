import ProgramEditor from "@/components/admin/ProgramEditor";
export default async function ProgramPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProgramEditor key={id} id={id} />;
}
