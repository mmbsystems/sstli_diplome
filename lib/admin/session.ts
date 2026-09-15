import type { AdminActivity, AdminBranch, AdminOffering, AdminProgram, AdminSnapshot } from './types';
export interface AdminSession extends AdminSnapshot { activity: AdminActivity[] }
type Meta = { actor: string; time: string; id: string };
export type SessionAction = Meta & (
  | { type: 'persistedProgram'; program: AdminProgram }
  | { type: 'persistedBranch'; branch: AdminBranch }
  | { type: 'persistedOffering'; offering: AdminOffering }
  | { type: 'program'; program: AdminProgram }
  | { type: 'offering'; programId: string; offering: AdminOffering }
  | { type: 'branch'; branch: AdminBranch }
);
const labels: Record<string, string> = {
  name: 'الاسم', city: 'المدينة', address: 'العنوان', active: 'الإتاحة', status: 'حالة البرنامج',
  publication: 'النشر', catalogVisible: 'الظهور', archived: 'الأرشفة', price: 'السعر',
  minDownPayment: 'الدفعة المقدمة', installments: 'عدد الأقساط', accreditedHours: 'الساعات',
  studyMode: 'نمط الدراسة', gender: 'الفئة', branchId: 'الفرع', registration: 'التسجيل',
  curriculum: 'المقررات', careerPaths: 'المسارات الوظيفية', image: 'الصورة', description: 'الوصف',
  slug: 'الرابط', duration: 'المدة', featured: 'تمييز البرنامج', category: 'النوع',
  accreditation: 'الاعتماد', contentPending: 'استكمال المحتوى', classificationPending: 'تأكيد التصنيف',
};
const valueText = (value: unknown): string => {
  if (value === undefined || value === null || value === '') return 'غير محدد';
  if (typeof value === 'boolean') return value ? 'نعم' : 'لا';
  if (Array.isArray(value)) return value.join('، ') || 'لا توجد بنود';
  if (typeof value === 'object') return Object.values(value).join(' · ');
  return ({ active: 'نشط', inactive: 'غير نشط', draft: 'مسودة', published: 'منشور', online: 'عن بُعد', onsite: 'حضوري', unknown: 'غير محدد', open: 'متاح', closed: 'مغلق', male: 'رجال', female: 'نساء', both: 'رجال ونساء' } as Record<string,string>)[String(value)] ?? String(value);
};
function changes(before: object | undefined, after: object, prefix = ''): AdminActivity['changes'] {
  const previous = (before ?? {}) as Record<string,unknown>;
  return Object.entries(after).flatMap(([key, value]) => {
    if (!labels[key] || JSON.stringify(previous[key]) === JSON.stringify(value)) return [];
    return [{ field: prefix + labels[key], before: key === 'image' ? (previous[key] ? 'صورة سابقة' : 'بلا صورة') : valueText(previous[key]), after: key === 'image' ? (value ? 'صورة محدثة' : 'بلا صورة') : valueText(value) }];
  });
}
export function createSession(snapshot: AdminSnapshot): AdminSession {
  return { ...structuredClone(snapshot), activity: [] };
}
/** Pure in-memory service. Never imports the production catalog or performs I/O. */
export function adminReducer(state: AdminSession, command: SessionAction): AdminSession {
  if (command.type === 'persistedOffering') return { ...state, programs: state.programs.map(p => ({ ...p,
    offerings: (p.id === command.offering.programId ? [...p.offerings.filter(o => o.id !== command.offering.id), command.offering] : p.offerings.filter(o => o.id !== command.offering.id)).sort((a,b) => (a.sortOrder??0)-(b.sortOrder??0)),
  })) };
  if (command.type === 'persistedBranch') return { ...state,
    branches: state.branches.some(b => b.id === command.branch.id) ? state.branches.map(b => b.id === command.branch.id ? command.branch : b) : [...state.branches, command.branch],
    // These are joined display labels, not offering writes or session audit events.
    programs: state.programs.map(p => ({ ...p, offerings: p.offerings.map(o => o.branchId === command.branch.id ? { ...o, city: command.branch.city, branch: command.branch.name } : o) })),
  };
  if (command.type === 'persistedProgram') return {...state, programs: state.programs.some(p=>p.id===command.program.id) ? state.programs.map(p=>p.id===command.program.id?{...command.program,offerings:p.offerings.map(o=>({...o,category:command.program.category}))}:p) : [command.program,...state.programs]};
  let programs = state.programs;
  let branches = state.branches;
  let detail: AdminActivity['changes'] = [];
  let title = '';
  let entityId = '';
  let programId: string | undefined;
  let action: AdminActivity['action'] = 'update';
  if (command.type === 'program') {
    const old = programs.find(p => p.id === command.program.id);
    const saved = structuredClone({ ...command.program, updatedAt: command.time });
    saved.offerings = saved.offerings.map(o => {
      const prior = old?.offerings.find(item => item.id === o.id);
      return JSON.stringify(prior) === JSON.stringify(o) ? o : { ...o, updatedAt: command.time };
    });
    detail = changes(old, saved);
    for (const offer of saved.offerings) detail.push(...changes(old?.offerings.find(o => o.id === offer.id), offer, `${offer.city} · ${offer.branch} / `));
    programs = old ? programs.map(p => p.id === saved.id ? saved : p) : [saved, ...programs];
    title = saved.name; entityId = saved.id; programId = saved.id;
    action = !old ? 'create' : saved.archived && !old.archived ? 'archive' : saved.status === 'inactive' && old.status === 'active' ? 'disable' : 'update';
  } else if (command.type === 'offering') {
    const program = programs.find(p => p.id === command.programId);
    if (!program) return state;
    const old = program.offerings.find(o => o.id === command.offering.id);
    const saved = structuredClone({ ...command.offering, updatedAt: command.time });
    detail = changes(old, saved);
    programs = programs.map(p => p.id === program.id ? { ...p, updatedAt: command.time, offerings: old ? p.offerings.map(o => o.id === saved.id ? saved : o) : [...p.offerings, saved] } : p);
    title = `${program.name} · ${saved.city} · ${saved.branch}`; entityId = saved.id; programId = program.id;
    action = !old ? 'create' : saved.archived && !old.archived ? 'archive' : !saved.active && old.active ? 'disable' : 'update';
  } else {
    const old = branches.find(b => b.id === command.branch.id);
    const saved = structuredClone({ ...command.branch, updatedAt: command.time });
    detail = changes(old, saved);
    branches = old ? branches.map(b => b.id === saved.id ? saved : b) : [...branches, saved];
    programs = programs.map(p => ({ ...p, offerings: p.offerings.map(o => o.branchId === saved.id ? { ...o, city: saved.city, branch: saved.name } : o) }));
    title = `${saved.city} · ${saved.name}`; entityId = saved.id;
    action = !old ? 'create' : !saved.active && old.active ? 'disable' : 'update';
  }
  if (!detail.length) return state;
  return { programs, branches, activity: [{ id: command.id, actor: command.actor, time: command.time, title, entityType: command.type, entityId, programId, action, changes: detail }, ...state.activity] };
}
export function branchIssues(branch: AdminBranch, programs: AdminProgram[]): string[] {
  const offers = programs.flatMap(p => p.offerings).filter(o => o.branchId === branch.id && !o.archived);
  return [!branch.directoryListed ? 'اسم وارد في العروض وغير مطابق لدليل الفروع' : '', !offers.length ? 'لا توجد برامج مرتبطة' : '', offers.some(o => o.price === undefined) ? 'أسعار غير مكتملة' : '', !branch.city.trim() ? 'المدينة غير محددة' : ''].filter(Boolean);
}
export function isProgramAvailable(program: AdminProgram, branches: AdminBranch[]) {
  return program.status === 'active' && !program.archived && program.offerings.some(o => o.active && !o.archived && branches.some(b => b.id === o.branchId && b.active));
}
