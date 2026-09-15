import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { programs } from "@/data/programs";
import { offerings } from "@/data/offerings";
import { branches } from "@/data/branches";
import {
  createAdminSnapshot,
  filterAdminPrograms,
  validateAdminProgram,
} from "@/lib/admin/adapter";
import { AdminProvider } from "@/components/admin/AdminProvider";
import ProgramEditor from "@/components/admin/ProgramEditor";
import ProgramsTable from "@/components/admin/ProgramsTable";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/programs/law",
  useSearchParams: () => new URLSearchParams(),
}));
afterEach(cleanup);
const snapshot = () => createAdminSnapshot(programs, offerings, branches);

it("adapts separate copies without inventing registration or losing hours overrides", () => {
  const data = snapshot();
  expect(data.programs).toHaveLength(53);
  expect(data.branches).toHaveLength(16);
  const law = data.programs.find((p) => p.id === "law")!;
  expect(
    law.offerings.find((o) => o.studyMode === "online")?.accreditedHours,
  ).toBe(75);
  expect(law.offerings.every((o) => o.registration === "unknown")).toBe(true);
  law.name = "changed";
  law.offerings[0].price = 1;
  expect(programs.find((p) => p.id === "law")?.name).toBe("دبلوم القانون");
  expect(offerings[0].price).toBe(13000);
});

it("includes unavailable drafts but matches branch and mode on one offering", () => {
  const data = snapshot();
  expect(
    filterAdminPrograms(data.programs, { status: "draft" }).map((p) => p.id),
  ).toContain("accounting");
  const hamra = data.branches.find((b) => b.name === "حي الحمراء")!;
  expect(
    filterAdminPrograms(data.programs, { branch: hamra.id, mode: "online" }),
  ).toHaveLength(0);
  expect(
    filterAdminPrograms(data.programs, { search: "إِدَارَة الموارد" }).map(
      (p) => p.id,
    ),
  ).toContain("hr");
});

it("rejects invalid plans and duplicate offering identities before local save", () => {
  const data = snapshot();
  const law = data.programs.find((p) => p.id === "law")!;
  law.offerings[0].installments = 0;
  expect(
    Object.keys(validateAdminProgram(law, data.programs)).length,
  ).toBeGreaterThan(0);
  law.offerings[0].installments = 24;
  law.offerings.push({ ...law.offerings[0], id: "duplicate" });
  expect(
    Object.values(validateAdminProgram(law, data.programs)).join(" "),
  ).toMatch(/مكرر/);
});

it("cancels unsaved edits and saves only into the preview session", () => {
  render(
    <AdminProvider initial={snapshot()} userName="موظف تجريبي">
      <ProgramEditor id="law" />
    </AdminProvider>,
  );
  const name = screen.getByLabelText("اسم البرنامج");
  fireEvent.change(name, { target: { value: "اسم معدل" } });
  expect(screen.getByText("لديك تغييرات غير محفوظة")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "إلغاء التغييرات" }));
  expect(name).toHaveValue("دبلوم القانون");
  fireEvent.change(name, { target: { value: "اسم معدل" } });
  fireEvent.click(screen.getByRole("button", { name: "حفظ التغييرات" }));
  expect(
    screen.getByText(/تم حفظ التغييرات في هذه الجلسة/),
  ).toBeInTheDocument();
  expect(programs.find((p) => p.id === "law")?.name).toBe("دبلوم القانون");
});

it("keeps unsaved form values when switching editor sections", () => {
  render(
    <AdminProvider initial={snapshot()} userName="موظف تجريبي">
      <ProgramEditor id="law" />
    </AdminProvider>,
  );
  fireEvent.change(screen.getByLabelText("اسم البرنامج"), {
    target: { value: "قانون معدل" },
  });
  fireEvent.click(screen.getByRole("button", { name: "الفروع والأسعار" }));
  expect(screen.getByText("أين يتوفر هذا البرنامج؟")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "المعلومات الأساسية" }));
  expect(screen.getByLabelText("اسم البرنامج")).toHaveValue("قانون معدل");
});

it("filters the program table and recovers from an empty search", () => {
  render(
    <AdminProvider initial={snapshot()} userName="موظف">
      <ProgramsTable />
    </AdminProvider>,
  );
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "القانون" },
  });
  expect(screen.getAllByRole("row")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "تصفية" }));
  fireEvent.change(screen.getByLabelText("نمط الدراسة"), {
    target: { value: "online" },
  });
  const branch = snapshot().branches.find((b) => b.name === "حي الحمراء")!;
  fireEvent.change(screen.getByLabelText("الفرع"), {
    target: { value: branch.id },
  });
  expect(
    screen.getByRole("heading", { name: "لا توجد برامج مطابقة" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole("button", { name: "مسح الفلاتر" })[0]);
  expect(screen.getAllByRole("row")).toHaveLength(11);
});

it("validates an offering dialog before applying a draft price", () => {
  render(
    <AdminProvider initial={snapshot()} userName="موظف">
      <ProgramEditor id="law" />
    </AdminProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "الفروع والأسعار" }));
  fireEvent.click(screen.getAllByText("تعديل الخيار")[0]);
  fireEvent.change(screen.getByLabelText("السعر الأساسي (ر.س)"), {
    target: { value: "100" },
  });
  fireEvent.click(screen.getByRole("button", { name: "اعتماد التعديل" }));
  expect(screen.getByRole("alert")).toHaveTextContent("راجع الدفعة المقدمة");
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("السعر الأساسي (ر.س)"), {
    target: { value: "12000" },
  });
  fireEvent.click(screen.getByRole("button", { name: "اعتماد التعديل" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByText("لديك تغييرات غير محفوظة")).toBeInTheDocument();
  expect(offerings[0].price).toBe(13000);
});
