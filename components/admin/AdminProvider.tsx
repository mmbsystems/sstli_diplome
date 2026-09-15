"use client";
import { createContext, useContext, useReducer, type ReactNode } from 'react';
import type { AdminBranch, AdminOffering, AdminProgram, AdminSnapshot } from '@/lib/admin/types';
import { adminReducer, createSession, type AdminSession } from '@/lib/admin/session';
interface AdminContextValue extends AdminSession {
  userName: string;
  persistentPrograms: boolean;
  acceptProgram: (program: AdminProgram) => void;
  acceptBranch: (branch: AdminBranch) => void;
  persistOffering: (offering: AdminOffering, action?: 'save' | 'archive' | 'restore') => Promise<AdminOffering>;
  saveProgram: (program: AdminProgram) => void;
  saveOffering: (programId: string, offering: AdminOffering) => void;
  saveBranch: (branch: AdminBranch) => void;
}
const AdminContext = createContext<AdminContextValue | null>(null);
export function AdminProvider({ initial, userName, children, persistentPrograms = false }: { initial: AdminSnapshot; userName: string; children: ReactNode; persistentPrograms?: boolean }) {
  const [state, dispatch] = useReducer(adminReducer, initial, createSession);
  const meta = () => ({ actor: userName, time: new Date().toISOString(), id: crypto.randomUUID() });
  return <AdminContext.Provider value={{ ...state, userName, persistentPrograms,
    acceptProgram: program => dispatch({ type: 'persistedProgram', program, ...meta() }),
    acceptBranch: branch => dispatch({ type: 'persistedBranch', branch, ...meta() }),
    persistOffering: async (offering, action = 'save') => {
      const response = await fetch('/api/admin/offerings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        ...(offering.version ? { id: offering.id } : {}), expectedVersion: offering.version ?? 0, action,
        offering: { program_id: offering.programId, branch_id: offering.branchId, study_mode: offering.studyMode, gender: offering.gender ?? 'both', price: offering.price ?? null, min_down_payment: offering.minDownPayment ?? null, installment_months: offering.installments ?? null, accredited_hours_override: offering.accreditedHours ?? null, registration_state: offering.registration, is_active: offering.active, sort_order: offering.sortOrder ?? 0 },
      }) });
      if (!response.ok) throw new Error(response.status === 409 ? 'تعارض في النسخة أو تكرار خيار الدراسة أو علاقة مؤرشفة. لم تُحفظ تغييراتك؛ راجع النسخة الحالية.' : response.status === 422 ? 'راجع السعر والدفعة المقدمة وعدد الأقساط وبقية الحقول.' : 'تعذر تأكيد الحفظ. احتفظ بتغييراتك وتحقق من النسخة الحالية.');
      const result = await response.json();
      dispatch({ type: 'persistedOffering', offering: result.offering, ...meta() });
      return result.offering;
    },
    saveProgram: program => dispatch({ type: 'program', program, ...meta() }),
    saveOffering: (programId, offering) => dispatch({ type: 'offering', programId, offering, ...meta() }),
    saveBranch: branch => dispatch({ type: 'branch', branch, ...meta() }),
  }}>{children}</AdminContext.Provider>;
}
export function useAdmin() {
  const value = useContext(AdminContext);
  if (!value) throw new Error('AdminProvider is required');
  return value;
}
