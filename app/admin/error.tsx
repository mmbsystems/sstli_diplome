"use client";
import { EmptyState } from "@/components/admin/ui";
export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <EmptyState
      title="تعذّر تحميل الصفحة"
      description="حاول مجددًا. بيانات المستكشف لم تتغير."
    >
      <button className="adm-button adm-primary" onClick={reset}>
        إعادة المحاولة
      </button>
    </EmptyState>
  );
}
