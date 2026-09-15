import "server-only";
import { programs } from "@/data/programs";
import { offerings } from "@/data/offerings";
import { branches } from "@/data/branches";
import { createAdminSnapshot } from "./adapter";
import type { AdminSnapshot } from "./types";

export interface AdminRepository {
  getSnapshot(): Promise<AdminSnapshot>;
}
// Read-only boundary. A future repository can replace this without changing UI contracts.
export const adminRepository: AdminRepository = {
  async getSnapshot() {
    return createAdminSnapshot(programs, offerings, branches);
  },
};
