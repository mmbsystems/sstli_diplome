import { describe, expect, it } from "vitest";
import { calculateInstallment } from "@/lib/installments";
import { filterPrograms, getAvailableCities } from "@/lib/filters";
import { formatCurrency } from "@/lib/formatters";
import { offerings } from "@/data/offerings";
import { programs } from "@/data/programs";
import { existsSync } from "node:fs";
import path from "node:path";

describe("installment calculation", () => {
  it("calculates remaining balance and 24 monthly payments", () => {
    expect(calculateInstallment(13000, 250, 250, 24)).toEqual({ remainingAmount: 12750, monthlyInstallment: 531.25, error: null });
  });
  it("rejects a down payment below the offering minimum", () => {
    expect(calculateInstallment(13000, 200, 250, 24).error).toBe("الدفعة المقدمة أقل من الحد الأدنى");
  });
  it("rejects a down payment above total price", () => {
    expect(calculateInstallment(13000, 14000, 250, 24).error).toBe("الدفعة المقدمة لا يمكن أن تتجاوز إجمالي الرسوم");
  });
});

describe("catalog filtering", () => {
  it("returns only onsite diploma programs offered in Riyadh", () => {
    const result = filterPrograms(programs, offerings, { category: "diploma", studyMode: "onsite", city: "الرياض" });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(({ offerings }) => offerings.every((o) => o.studyMode === "onsite" && o.city === "الرياض"))).toBe(true);
  });
  it("does not expose Sakaka for diploma filtering", () => {
    expect(getAvailableCities(offerings, "diploma", "onsite", programs)).not.toContain("سكاكا / الجوف");
  });
  it("shows online programs without requiring a city", () => {
    const result = filterPrograms(programs, offerings, { category: "diploma", studyMode: "online" });
    expect(result.length).toBeGreaterThan(0);
  });

  it("prices all three online diplomas at 7,999 SAR", () => {
    const onlineDiplomas = offerings.filter(
      (offering) => offering.category === "diploma" && offering.studyMode === "online",
    );

    expect([...new Set(onlineDiplomas.map(({ programId }) => programId))].sort()).toEqual([
      "hr",
      "law",
      "office-diploma",
    ]);
    expect(onlineDiplomas.every(({ price }) => price === 7999)).toBe(true);
  });
});

it("formats Saudi currency in Arabic", () => {
  expect(formatCurrency(13000)).toContain("13,000");
});

describe("diploma metadata", () => {
  it("keeps onsite law at 84 hours and overrides online law to 75 hours", () => {
    const lawOfferings = offerings.filter(({ programId }) => programId === "law");
    expect(lawOfferings.filter(({ studyMode }) => studyMode === "onsite").every(({ accreditedHours }) => accreditedHours === undefined)).toBe(true);
    expect(lawOfferings.find(({ studyMode }) => studyMode === "online")?.accreditedHours).toBe(75);
    expect(programs.find(({ id }) => id === "law")?.accreditedHours).toBe(84);
  });

  it("sets office management to 80 accredited hours", () => {
    expect(programs.find(({ id }) => id === "office-diploma")?.accreditedHours).toBe(80);
  });

  it("maps all eleven diploma images to real public files", () => {
    const diplomaImages = programs.filter(({ category, image }) => category === "diploma" && image);
    expect(diplomaImages).toHaveLength(11);
    expect(diplomaImages.every(({ image }) => existsSync(path.join(process.cwd(), "public", image!)))).toBe(true);
  });

  it("maps every qualifying course image to a real public file", () => {
    const qualifying = programs.filter(({ category }) => category === "qualifying-course");
    expect(qualifying).toHaveLength(11);
    expect(qualifying.every(({ image }) => image && existsSync(path.join(process.cwd(), "public", image)))).toBe(true);
  });

  it("maps every development course image to a real public file", () => {
    const development = programs.filter(({ category }) => category === "development-course");
    const withoutImages = development.filter(({ image }) => !image).map(({ slug }) => slug);
    expect(withoutImages).toEqual([]);
    expect(development.filter(({ image }) => image).every(({ image }) => existsSync(path.join(process.cwd(), "public", image!)))).toBe(true);
  });

  it("uses the new English-level and OSHA images only for their matching courses", () => {
    const expectedImages: Record<string, string> = {
      "english-1": "/الدورات_التاهلية/اللغة_الانحليوية_المستوي_الاول.png",
      "english-2": "/الدورات_التاهلية/اللغة_الانجليزية_المتستوي_التاني.png",
      "english-3": "/الدورات_التاهلية/اللغة_الانجليزية_المستوي_التالت.png",
      "english-4": "/الدورات_التاهلية/اللغة_الانجليزي_المستوي_الرابع.png",
      "d-osha": "/الدورات التطويرية/السلامة_والصحة_المهنية_OSHA.png",
    };

    for (const [id, image] of Object.entries(expectedImages)) {
      expect(programs.find((program) => program.id === id)?.image).toBe(image);
    }
  });

  it("does not reuse course images except for the two NEBOSH catalog entries", () => {
    const coursePrograms = programs.filter(({ category, image }) => category !== "diploma" && image);
    const idsByImage = new Map<string, string[]>();

    for (const program of coursePrograms) {
      idsByImage.set(program.image!, [...(idsByImage.get(program.image!) ?? []), program.id]);
    }

    const duplicateGroups = [...idsByImage.values()].filter((ids) => ids.length > 1);
    expect(duplicateGroups).toEqual([["d-nebosh-250", "d-nebosh-300"]]);
  });
});
