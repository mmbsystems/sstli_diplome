import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { loadAdminReadState } from "@/lib/admin/load-data";
import { AdminReadBoundary } from "@/components/admin/AdminReadBoundary";
import AdminShell from "@/components/admin/AdminShell";
import "./admin.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "لوحة الإدارة" };
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();
  const state = await loadAdminReadState();
  return (
    <AdminReadBoundary state={state} userName={user.name}>
      <AdminShell>{children}</AdminShell>
    </AdminReadBoundary>
  );
}
