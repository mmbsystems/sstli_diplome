import { Suspense } from "react";
import ProgramsTable from "@/components/admin/ProgramsTable";
import { AdminSkeleton } from "@/components/admin/ui";
export default function ProgramsPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <ProgramsTable />
    </Suspense>
  );
}
