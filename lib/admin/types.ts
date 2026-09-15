import type {
  Offering,
  Program,
  ProgramCategory,
  StudyMode,
} from "@/types/program";

export type AdminStatus = "active" | "draft" | "inactive";
export type Registration = "unknown" | "open" | "closed";
export interface AdminOffering extends Offering {
  version?: number;
  legacyId?: string;
  sortOrder?: number;
  branchId: string;
  registration: Registration;
  updatedAt?: string;
  archived?: boolean;
}
export interface AdminProgram extends Program {
  catalogSlug?: string;
  version?: number;
  nameEn?: string;
  curriculumItems?: { id?: string; title: string }[];
  careerItems?: { id?: string; title: string }[];
  status: "active" | "inactive";
  publication: "draft" | "published";
  catalogVisible: boolean;
  archived?: boolean;
  updatedAt: string | null;
  accreditation: string;
  featured: boolean;
  offerings: AdminOffering[];
}
export interface AdminBranch {
  id: string;
  version?: number;
  legacyKey?: string;
  sourceRegionLabel?: string;
  archived?: boolean;
  name: string;
  city: string;
  active: boolean;
  directoryListed: boolean;
  address: string;
  updatedAt: string | null;
}
export interface AdminActivity {
  id: string;
  programId?: string;
  title: string;
  actor: string;
  time: string;
  sample?: boolean;
  entityType: "program" | "offering" | "branch" | "user";
  entityId: string;
  action: "create" | "update" | "disable" | "archive";
  changes: { field: string; before: string; after: string }[];
}
export interface AdminSnapshot {
  programs: AdminProgram[];
  branches: AdminBranch[];
}
export interface AdminFilters {
  search?: string;
  type?: ProgramCategory | "";
  status?: AdminStatus | "";
  mode?: StudyMode | "";
  branch?: string;
  attention?: boolean;
  sort?: "name" | "price" | "updated";
}
