import type { AdminActivity } from './types';
/** Illustrative UI fixtures only. Never used for authentication or authorization. */
export const mockUsers = [
  { id: 'sample-user-1', name: 'سارة العتيبي', email: 'sarah@example.test', role: 'Super Admin', scope: 'جميع الفروع', active: true },
  { id: 'sample-user-2', name: 'أحمد القحطاني', email: 'ahmad@example.test', role: 'Content Manager', scope: 'محتوى جميع البرامج', active: true },
  { id: 'sample-user-3', name: 'نورة الدوسري', email: 'noura@example.test', role: 'Branch Manager', scope: 'الرياض · حي الروضة (مثال)', active: true },
  { id: 'sample-user-4', name: 'خالد الحربي', email: 'khalid@example.test', role: 'Viewer', scope: 'جميع الفروع · قراءة فقط', active: false },
];
export const roleLabels: Record<string, string> = { 'Super Admin': 'مدير النظام', 'Content Manager': 'مدير المحتوى', 'Branch Manager': 'مدير فرع', Viewer: 'مشاهد' };
export const actionLabels: Record<AdminActivity['action'], string> = { create: 'إضافة', update: 'تعديل', disable: 'إيقاف', archive: 'أرشفة' };
export const entityLabels: Record<AdminActivity['entityType'], string> = { program: 'برنامج', offering: 'خيار دراسة', branch: 'فرع', user: 'مستخدم' };
export const sampleActivity: AdminActivity[] = [
  { id: 'sample-1', title: 'برنامج تدريبي تجريبي', actor: 'أحمد القحطاني', time: '2026-09-08T11:30:00+03:00', sample: true, entityId: 'sample-program', entityType: 'program', action: 'update', changes: [{ field: 'الوصف', before: 'وصف مختصر', after: 'وصف يشمل أهداف البرنامج ومخرجاته' }] },
  { id: 'sample-2', title: 'خيار دراسة تجريبي · الرياض', actor: 'نورة الدوسري', time: '2026-09-08T09:15:00+03:00', sample: true, entityId: 'sample-offering', entityType: 'offering', action: 'update', changes: [{ field: 'السعر', before: '12000', after: '11500' }, { field: 'عدد الأقساط', before: '12', after: '24' }] },
  { id: 'sample-3', title: 'حساب عرض تجريبي', actor: 'سارة العتيبي', time: '2026-09-07T14:40:00+03:00', sample: true, entityId: 'sample-user-4', entityType: 'user', action: 'disable', changes: [{ field: 'الحالة', before: 'نشط', after: 'غير نشط' }] },
];
