"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Check,
  Eye,
  ImageIcon,
  Info,
  Save,
} from "lucide-react";
import type { AdminProgram } from "@/lib/admin/types";
import { categoryLabel, modeLabel } from "@/lib/formatters";
import { validateAdminProgram } from "@/lib/admin/adapter";
import { useAdmin } from "./AdminProvider";
import { EmptyState, FormField, PageHeader, StatusBadge } from "./ui";
import OfferingEditor from "./OfferingEditor";
import ManagedImageEditor from './ManagedImageEditor';
import { ConfirmDialog, OrderedListEditor, ImageEditor, useUnsavedChanges } from "./EditorControls";

const tabs = [
  "المعلومات الأساسية",
  "الفروع والأسعار",
  "المحتوى الدراسي",
  "المسارات الوظيفية",
  "الصور",
  "الظهور في الموقع",
];
function newProgram(): AdminProgram {
  return {
    id: "new",
    slug: "",
    name: "",
    category: "diploma",
    description: "",
    duration: { label: "" },
    status: "inactive",
    publication: "draft",
    catalogVisible: false,
    updatedAt: null,
    accreditation: "",
    featured: false,
    offerings: [],
  };
}

export default function ProgramEditor({ id }: { id: string }) {
  const { programs, saveProgram } = useAdmin();
  const source =
    id === "new" ? newProgram() : programs.find((p) => p.id === id);
  if (!source)
    return (
      <EmptyState
        title="لم نجد هذا البرنامج"
        description="قد يكون مسودة تجريبية انتهت جلستها. يمكنك العودة إلى قائمة البرامج."
      >
        <Link className="adm-button" href="/admin/programs">
          العودة إلى البرامج
        </Link>
      </EmptyState>
    );
  return (
    <EditorForm
      key={id}
      source={source}
      isNew={id === "new"}
      saveProgram={saveProgram}
      all={programs}
    />
  );
}

function EditorForm({
  source,
  isNew,
  saveProgram,
  all,
}: {
  source: AdminProgram;
  isNew: boolean;
  saveProgram: (program: AdminProgram) => void;
  all: AdminProgram[];
}) {
  const router = useRouter();
  const {persistentPrograms,acceptProgram}=useAdmin();
  const [saving,setSaving]=useState(false);
  const [conflict,setConflict]=useState(false);
  const [draft, setDraft] = useState(() => structuredClone(source));
  const [baseline, setBaseline] = useState(() => structuredClone(source));
  const [tab, setTab] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  useUnsavedChanges(dirty);
  const [confirm, setConfirm] = useState<"disable" | "archive" | null>(null);
  function change(patch: Partial<AdminProgram>) {
    setDraft((previous) => ({ ...previous, ...patch }));
    setMessage("");
    setErrors({});
  }
  function cancel() {
    setDraft(structuredClone(baseline));
    setErrors({});
    setMessage("");
  }
  async function save() {
    if(saving)return;
    const issues = validateAdminProgram(draft, all);
    if (Object.keys(issues).length) {
      setErrors(issues);
      const field = Object.keys(issues)[0];
      setTab(field === "offerings" ? 1 : field === "slug" ? 5 : field === "curriculum" ? 2 : field === "careerPaths" ? 3 : 0);
      requestAnimationFrame(() => document.getElementById(field)?.focus());
      return;
    }
    if(persistentPrograms){
      setSaving(true);setConflict(false);setMessage('');
      try {
        const response=await fetch('/api/admin/programs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
          ...(isNew?{}:{id:draft.id}),expectedVersion:isNew?0:baseline.version,
          action:draft.archived&&!baseline.archived?'archive':!draft.archived&&baseline.archived?'restore':'save',
          program:{name_ar:draft.name,name_en:draft.nameEn??null,slug:draft.slug,program_type:draft.category,specialization:draft.specialization??null,searchable_keywords:draft.searchableKeywords??[],description:draft.description,duration_display:draft.duration.label,duration_standard:draft.duration.standard??null,duration_summer:draft.duration.withSummerTerm??null,accredited_hours:draft.accreditedHours??null,accreditation_text:draft.accreditation,image_path:draft.image??null,image_position:draft.imagePosition??null,content_pending:draft.contentPending??false,classification_pending:draft.classificationPending??false,is_active:draft.status==='active',publication_status:draft.publication,catalog_visibility:draft.catalogVisible,is_featured:draft.featured},
          curriculum:draft.curriculumItems??[],careers:draft.careerItems??[]
        })});
        const result=await response.json();
        if(!response.ok){setConflict(response.status===409);setErrors({server:response.status===409?'تعارض في الحفظ: تغيرت البيانات منذ تحميلها أو أصبح الرابط مستخدمًا. راجع الرابط أو أعد تحميل النسخة الحالية.':response.status===422?'تعذر الحفظ. راجع الحقول وحالة النشر ثم حاول مجددًا.':'تعذر تأكيد الحفظ. تعديلاتك محفوظة في النموذج؛ تحقق من النسخة الحالية قبل إعادة المحاولة.'});return;}
        const saved:AdminProgram={...result.program,offerings:baseline.offerings.map(o=>({...o,category:result.program.category}))};
        acceptProgram(saved);setDraft(structuredClone(saved));setBaseline(structuredClone(saved));setErrors({});setMessage('تم حفظ التغييرات في قاعدة البيانات.');
        if(isNew)router.replace(`/admin/programs/${saved.id}`);
        return;
      }catch{setErrors({server:'تعذر تأكيد الحفظ. تعديلاتك محفوظة في النموذج؛ أعد تحميل النسخة الحالية للتحقق.'});setConflict(true);return;}
      finally{setSaving(false);}
    }
    const saved = {
      ...structuredClone(draft),
      id: isNew ? crypto.randomUUID() : draft.id,
    };
    saved.offerings = saved.offerings.map((o) => ({
      ...o,
      programId: saved.id,
      category: saved.category,
    }));
    saveProgram(saved);
    setBaseline(structuredClone(saved));
    setDraft(saved);
    setMessage("تم حفظ التغييرات في هذه الجلسة فقط. بيانات المستكشف لم تتغير.");
    if (isNew) router.replace(`/admin/programs/${saved.id}`);
  }
  return (
    <>
      <PageHeader
        title={isNew ? "إضافة برنامج" : baseline.name}
        description={
          isNew
            ? "ابدأ بالمعلومات الأساسية، ثم أضف خيارات الفروع والدراسة."
            : "معلومات واضحة، وخيارات دراسة منظمة لكل فرع."
        }
        back
      >
        <div className="adm-editor-heading-actions">
          <StatusBadge status={draft.status} />
          {source.catalogSlug && (
            <Link
              className="adm-button"
              href={`/programs/${source.catalogSlug}`}
            >
              <Eye size={17} />
              عرض المستكشف
            </Link>
          )}
        </div>
      </PageHeader>
      <div className="adm-editor-layout">
        <nav className="adm-editor-tabs" aria-label="أقسام البرنامج">
          {tabs.map((label, index) => (
            <button
              type="button"
              key={label}
              aria-label={label}
              disabled={saving}
              aria-current={tab === index ? "page" : undefined}
              onClick={() => setTab(index)}
            >
              {label}
              {index === 1 && <span>{draft.offerings.length}</span>}
            </button>
          ))}
          <div className="adm-editor-side-note">
            <Info size={17} />
            <p>احفظ تعديلاتك لتبقى متاحة أثناء تنقلك في لوحة الإدارة.</p>
          </div>
        </nav>
        <form
          className="adm-editor-panel"
          id="admin-program-form"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <div className="adm-editor-panel-inner">
            {tab === 0 && (
              <>
                <div className="adm-editor-section-title">
                  <div>
                    <h2>المعلومات الأساسية</h2>
                    <p>التعريف بالبرنامج وما يحتاج الموظف إلى معرفته.</p>
                  </div>
                  <BookOpen size={23} strokeWidth={1.4} />
                </div>
                <div className="adm-form-grid">
                  <FormField
                    label="اسم البرنامج"
                    id="name"
                    error={errors.name}
                    wide
                  >
                    <input
                      id="name"
                      aria-required="true"
                      value={draft.name}
                      onChange={(e) => change({ name: e.target.value })}
                      aria-invalid={Boolean(errors.name)}
                      aria-describedby={errors.name ? "name-error" : undefined}
                    />
                  </FormField>
                  <FormField label="نوع البرنامج" id="category">
                    <select
                      id="category"
                      value={draft.category}
                      onChange={(e) =>
                        change({
                          category: e.target.value as AdminProgram["category"],
                        })
                      }
                    >
                      {Object.entries(categoryLabel).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="حالة البرنامج" id="status" hint="الإتاحة مستقلة عن النشر والظهور في الموقع.">
                    <select
                      id="status"
                      value={draft.status}
                      onChange={(e) =>
                        e.target.value === "inactive" ? setConfirm("disable") : change({ status: "active", archived: false })
                      }
                    >
                      <option value="active">نشط</option>
                      <option value="inactive">غير نشط</option>
                    </select>
                  </FormField>
                  <FormField
                    label="وصف البرنامج"
                    id="description"
                    wide
                    hint="اكتب وصفًا واضحًا يساعد على فهم هدف البرنامج."
                  >
                    <textarea
                      id="description"
                      rows={5}
                      value={draft.description}
                      onChange={(e) => change({ description: e.target.value })}
                    />
                  </FormField>
                  <FormField label="مدة البرنامج" id="duration">
                    <input
                      id="duration"
                      value={draft.duration.label}
                      onChange={(e) =>
                        change({
                          duration: {
                            ...draft.duration,
                            label: e.target.value,
                          },
                        })
                      }
                    />
                  </FormField>
                  <FormField
                    label="الساعات المعتمدة / التدريبية"
                    id="accreditedHours"
                    error={errors.accreditedHours}
                    hint="يمكن تخصيص عدد الساعات لكل فرع."
                  >
                    <input
                      id="accreditedHours"
                      type="number"
                      min="1"
                      step="1"
                      value={draft.accreditedHours ?? ""}
                      onChange={(e) =>
                        change({
                          accreditedHours:
                            e.target.value === ""
                              ? undefined
                              : Number(e.target.value),
                        })
                      }
                      aria-invalid={Boolean(errors.accreditedHours)}
                      aria-describedby={
                        errors.accreditedHours
                          ? "accreditedHours-error"
                          : undefined
                      }
                    />
                  </FormField>
                  {draft.duration.standard !== undefined && (
                    <FormField
                      label="المدة دون الترم الصيفي"
                      id="duration-standard"
                    >
                      <input
                        id="duration-standard"
                        value={draft.duration.standard}
                        onChange={(e) =>
                          change({
                            duration: {
                              ...draft.duration,
                              standard: e.target.value,
                            },
                          })
                        }
                      />
                    </FormField>
                  )}
                  {draft.duration.withSummerTerm !== undefined && (
                    <FormField
                      label="المدة مع الترم الصيفي"
                      id="duration-summer"
                    >
                      <input
                        id="duration-summer"
                        value={draft.duration.withSummerTerm}
                        onChange={(e) =>
                          change({
                            duration: {
                              ...draft.duration,
                              withSummerTerm: e.target.value,
                            },
                          })
                        }
                      />
                    </FormField>
                  )}
                  <FormField
                    label="الاعتماد"
                    id="accreditation"
                    wide
                    hint="أضف معلومات مؤكدة فقط. لا تتوفر تفاصيل اعتماد مستقلة في المصدر الحالي."
                  >
                    <input
                      id="accreditation"
                      value={draft.accreditation}
                      onChange={(e) =>
                        change({ accreditation: e.target.value })
                      }
                      placeholder="لم تُضف تفاصيل الاعتماد"
                    />
                  </FormField>
                </div>
                <div className="adm-mode-summary">
                  <div>
                    <span>نمط الدراسة</span>
                    <p>
                      {[...new Set(draft.offerings.map((o) => o.studyMode))]
                        .map((mode) => modeLabel[mode])
                        .join(" و") || "لم يُحدد بعد"}
                    </p>
                  </div>
                  <button
                    className="adm-text-link"
                    type="button"
                    onClick={() => setTab(1)}
                  >
                    يُحدد لكل فرع <ArrowLeft size={15} />
                  </button>
                </div>
              </>
            )}
            {tab === 1 && (persistentPrograms ? (isNew ? <p>احفظ البرنامج أولًا لإضافة خيارات الدراسة.</p> : <OfferingEditor program={all.find(p=>p.id===draft.id)??source} onChange={() => {}} />) : (
              <OfferingEditor
                program={draft}
                onChange={(offerings) => change({ offerings })}
              />
            ))}{" "}
            {tab === 2 && <OrderedListEditor title="المحتوى الدراسي" itemLabel="مقرر" items={draft.curriculum ?? []} itemIds={persistentPrograms?(draft.curriculumItems??[]).map(i=>i.id):undefined} onChange={(curriculum,ids) => change({ curriculum,...(persistentPrograms?{curriculumItems:curriculum.map((title,i)=>({...((ids??[])[i]?{id:ids![i]}:{}),title}))}:{}) })} error={errors.curriculum} />}
            {tab === 3 && <OrderedListEditor title="المسارات الوظيفية" itemLabel="مسار" items={draft.careerPaths ?? []} itemIds={persistentPrograms?(draft.careerItems??[]).map(i=>i.id):undefined} onChange={(careerPaths,ids) => change({ careerPaths,...(persistentPrograms?{careerItems:careerPaths.map((title,i)=>({...((ids??[])[i]?{id:ids![i]}:{}),title}))}:{}) })} error={errors.careerPaths} />}
            {tab === 4 && (persistentPrograms ? <ManagedImageEditor program={baseline} disabled={isNew||dirty||!!baseline.archived||saving} onBusy={setSaving} onSaved={patch=>{const saved={...baseline,...patch};acceptProgram(saved);setDraft(structuredClone(saved));setBaseline(structuredClone(saved));}}/> : <ImageEditor value={draft.image} name={draft.name} onChange={image => change({ image })} />)}
            {tab === 5 && (
              <>
                <div className="adm-editor-section-title">
                  <div>
                    <h2>الظهور في الموقع</h2>
                    <p>
                      {persistentPrograms ? 'تُحفظ إعدادات النشر مع البرنامج. المستكشف الحالي مخصص للموظفين.' : 'خيارات تجريبية لا تغيّر ظهور البرنامج في المستكشف الحالي.'}
                    </p>
                  </div>
                </div>
                <div className="adm-form-grid">
                  <FormField
                    label="رابط البرنامج"
                    id="slug"
                    error={errors.slug}
                    hint="حروف إنجليزية صغيرة وأرقام، دون مسافات."
                    wide
                  >
                    <div className="adm-slug-input" dir="ltr">
                      <span>/programs/</span>
                      <input
                        id="slug"
                        dir="ltr"
                        value={draft.slug}
                        onChange={(e) => change({ slug: e.target.value })}
                        aria-invalid={Boolean(errors.slug)}
                        aria-describedby={
                          errors.slug ? "slug-error" : undefined
                        }
                      />
                    </div>
                  </FormField>
                  <FormField label="حالة النشر" id="publication" hint="المسودة تحت المراجعة، والمنشور جاهز للعرض."><select id="publication" value={draft.publication} onChange={e => change({ publication: e.target.value as AdminProgram['publication'] })}><option value="draft">مسودة</option><option value="published">منشور</option></select></FormField>
                  <FormField label="الظهور في المستكشف" id="catalog-visible" hint="النشر والإتاحة لا يغيّران هذا الخيار تلقائيًا."><select id="catalog-visible" value={draft.catalogVisible ? 'yes' : 'no'} onChange={e => change({ catalogVisible: e.target.value === 'yes' })}><option value="yes">ظاهر</option><option value="no">مخفي</option></select></FormField>
                  <FormField label="تمييز البرنامج" id="featured" wide>
                    <select
                      id="featured"
                      value={draft.featured ? "yes" : "no"}
                      onChange={(e) =>
                        change({ featured: e.target.value === "yes" })
                      }
                    >
                      <option value="no">عرض عادي</option>
                      <option value="yes">برنامج مميز</option>
                    </select>
                  </FormField>
                </div>
                <div className="adm-review-controls"><label><input type="checkbox" checked={!draft.contentPending} onChange={e => change({ contentPending: !e.target.checked })} /> المحتوى تمت مراجعته</label>{source.classificationPending && <label><input type="checkbox" checked={!draft.classificationPending} onChange={e => change({ classificationPending: !e.target.checked })} /> تم تأكيد تصنيف البرنامج</label>}</div>
                <div className="adm-inline-note">
                  <Info size={18} />
                  <p>
                    {persistentPrograms ? 'المستكشف مخصص للموظفين حاليًا. الأرشفة تستبعد البرنامج من إتاحتهم؛ إعدادات النشر والظهور محفوظة للاستخدام المستقبلي.' : 'المستكشف مخصص للموظفين حاليًا. خيارات الظهور هنا للمعاينة فقط؛ إعدادات البحث والنشر ليست مفعّلة.'}
                  </p>
                </div>
                <div className="adm-archive-zone"><div><strong>{draft.archived ? 'البرنامج مؤرشف' : 'أرشفة البرنامج'}</strong><p>تحتفظ الأرشفة بالبيانات وتوقف الإتاحة والظهور.</p></div><button className="adm-button" type="button" onClick={() => draft.archived ? change({ archived: false }) : setConfirm('archive')}>{draft.archived ? 'استعادة من الأرشيف' : 'أرشفة البرنامج'}</button></div>
              </>
            )}
            {errors.server && <p role="alert" className="adm-field-error">{errors.server}</p>}
            {conflict && <button type="button" className="adm-button" onClick={()=>{if(window.confirm("ستفقد التعديلات غير المحفوظة عند إعادة التحميل. متابعة؟"))window.location.reload();}}>إعادة تحميل النسخة الحالية</button>}
            {errors.offerings && (
              <p className="adm-field-error" role="alert">
                {errors.offerings}
              </p>
            )}
            {Object.keys(errors).length > 0 && (
              <p className="adm-field-error" role="alert">
                راجع الحقول المحددة قبل الحفظ.
              </p>
            )}
          </div>
        </form>
      </div>
      {message && (
        <div className="adm-save-message" role="status">
          <Check size={18} />
          {message}
        </div>
      )}
      <ConfirmDialog open={confirm !== null} title={confirm === 'archive' ? 'أرشفة البرنامج؟' : 'إيقاف إتاحة البرنامج؟'} description="سيُطبّق هذا التغيير عند حفظ البرنامج. تبقى بيانات الفروع والمحتوى محفوظة." onCancel={() => setConfirm(null)} onConfirm={() => { change(confirm === 'archive' ? { archived: true, status: 'inactive', catalogVisible: false } : { status: 'inactive' }); setConfirm(null); }} />
      {(dirty || isNew) && (
        <div className="adm-save-bar">
          <div>
            <span className="adm-unsaved-dot" />
            <span>
              {dirty ? "لديك تغييرات غير محفوظة" : "مسودة برنامج جديد"}
            </span>
          </div>
          <div>
            <button className="adm-button" type="button" aria-label="إلغاء التغييرات" onClick={cancel}>
              تراجع
            </button>
            <button
              className="adm-button adm-primary"
              type="submit"
              form="admin-program-form"
              disabled={saving}
            >
              <Save size={17} />
              حفظ التغييرات
            </button>
          </div>
        </div>
      )}
    </>
  );
}
