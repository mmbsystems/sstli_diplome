"use client";

import { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronDown, MapPin, Monitor, Plus, X } from "lucide-react";
import { genderLabel, modeLabel } from "@/lib/formatters";
import {
  money,
  registrationLabels,
  validateAdminProgram,
} from "@/lib/admin/adapter";
import type {
  AdminOffering,
  AdminProgram,
  Registration,
} from "@/lib/admin/types";
import { useAdmin } from "./AdminProvider";
import { EmptyState, FormField } from "./ui";
import { ConfirmDialog, useUnsavedChanges } from "./EditorControls";

const numberValue = (value: string) =>
  value === "" ? undefined : Number(value);

export default function OfferingEditor({
  program,
  onChange,
  initialOffering, dialogOnly = false, onClose, onPersisted,
}: {
  program: AdminProgram;
  onChange: (offerings: AdminOffering[]) => void;
  initialOffering?: AdminOffering; dialogOnly?: boolean; onClose?: () => void;
  onPersisted?: () => void;
}) {
  const { branches, persistentPrograms, persistOffering } = useAdmin();
  const inFlight = useRef(false); const [busy,setBusy] = useState(false); const [message,setMessage] = useState('');
  const [editing, setEditing] = useState<AdminOffering | null>(initialOffering ? { ...initialOffering } : null);
  const [error, setError] = useState("");
  const [origin, setOrigin] = useState<AdminOffering | null>(initialOffering ?? null);
  const [archive, setArchive] = useState<AdminOffering | null>(null);
  const [disabling, setDisabling] = useState(false);
  useUnsavedChanges(editing !== null && JSON.stringify(editing) !== JSON.stringify(origin));
  function close() {
    if (inFlight.current) return;
    if (JSON.stringify(editing) !== JSON.stringify(origin) && !window.confirm('لديك تغييرات غير محفوظة في هذا الخيار. هل تريد تجاهلها؟')) return;
    setEditing(null); onClose?.();
  }
  function open(offering?: AdminOffering) {
    const branch = branches.find(b => !b.archived);
    setEditing(
      offering
        ? { ...offering }
        : {
            id: crypto.randomUUID(),
            programId: program.id,
            category: program.category,
            branchId: branch?.id ?? "",
            city: branch?.city,
            branch: branch?.name,
            studyMode: "onsite",
            gender: "both",
            active: !persistentPrograms,
            sortOrder: 0,
            registration: "unknown",
          },
    );
    setOrigin(offering ? { ...offering } : null);
    setError("");
  }
  function change(patch: Partial<AdminOffering>) {
    setEditing((previous) => (previous ? { ...previous, ...patch } : null));
    setError("");
  }
  async function apply(confirmed = false) {
    if (!editing || inFlight.current) return;
    const next = program.offerings.some((o) => o.id === editing.id)
      ? program.offerings.map((o) => (o.id === editing.id ? editing : o))
      : [...program.offerings, editing];
    const issue = validateAdminProgram(
      { ...program, offerings: next },
      [],
    ).offerings;
    if (issue) {
      setError(issue);
      return;
    }
    if (!confirmed && origin?.active && !editing.active) { setDisabling(true); return; }
    if (persistentPrograms) {
      inFlight.current=true;setBusy(true);setError('');
      try { await persistOffering(editing);setEditing(null);setOrigin(null);setMessage('تم حفظ خيار الدراسة في قاعدة البيانات.');onPersisted?.();onClose?.(); }
      catch(error){setError(error instanceof Error?error.message:'تعذر الاتصال بالخادم. تغييراتك باقية في النموذج.');}
      finally{inFlight.current=false;setBusy(false);}
      return;
    }
    onChange(next);
    setEditing(null); onClose?.();
  }
  async function lifecycle(offering:AdminOffering, action:'archive'|'restore') {
    if(inFlight.current)return;
    if(!persistentPrograms){onChange(program.offerings.map(o=>o.id===offering.id?{...o,archived:action==='archive',active:false}:o));return;}
    inFlight.current=true;setBusy(true);setError('');
    try{await persistOffering(offering,action);setMessage('تم حفظ حالة الخيار في قاعدة البيانات.');onPersisted?.();}
    catch(error){setError(error instanceof Error?error.message:'تعذر الحفظ.');}
    finally{inFlight.current=false;setBusy(false);}
  }
  const validEstimate =
    editing?.price !== undefined &&
    editing.minDownPayment !== undefined &&
    editing.price >= editing.minDownPayment &&
    editing.minDownPayment >= 0 &&
    (editing.installments ?? 0) > 0;
  return (
    <>
      {!editing && error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {!dialogOnly && <><div className="adm-editor-section-title">
        <div>
          <h2>أين يتوفر هذا البرنامج؟</h2>
          <p>كل فرع يحتفظ بسعره وخيارات الدراسة والسداد الخاصة به.</p>
        </div>
        <button className="adm-button" type="button" disabled={busy} onClick={() => open()}>
          <Plus size={17} />
          إضافة فرع
        </button>
      </div>
      <div className="adm-offerings">
        {program.offerings.some(o => !o.archived) ? (
          program.offerings.filter(o => !o.archived).map((offering) => (
            <details className="adm-offering" key={offering.id}>
              <summary>
                <span className="adm-offering-icon">
                  {offering.studyMode === "online" ? (
                    <Monitor size={20} />
                  ) : (
                    <MapPin size={20} />
                  )}
                </span>
                <div className="adm-offering-title">
                  <strong>
                    {offering.city} <span>·</span> {offering.branch}
                  </strong>
                  <small>
                    {modeLabel[offering.studyMode]} ·{" "}
                    {genderLabel[offering.gender ?? "both"]}
                  </small>
                </div>
                <span className="adm-offering-price">
                  {offering.price === undefined ? (
                    "السعر غير محدد"
                  ) : (
                    <bdi>{money(offering.price)}</bdi>
                  )}
                </span>
                <span
                  className={`adm-badge ${offering.active ? "adm-active" : "adm-inactive"}`}
                >
                  <span />
                  {offering.active ? "متاح" : "متوقف"}
                </span>
                <ChevronDown className="adm-offering-chevron" size={17} />
              </summary>
              <div className="adm-offering-body">
                <dl>
                  <div>
                    <dt>السعر الأساسي</dt>
                    <dd>
                      {offering.price === undefined
                        ? "غير محدد"
                        : money(offering.price)}
                    </dd>
                  </div>
                  <div>
                    <dt>السعر الحالي</dt>
                    <dd>
                      {offering.price === undefined
                        ? "غير محدد"
                        : money(offering.price)}
                    </dd>
                  </div>
                  <div>
                    <dt>الحد الأدنى للدفعة المقدمة</dt>
                    <dd>
                      {offering.minDownPayment === undefined
                        ? "غير محدد"
                        : money(offering.minDownPayment)}
                    </dd>
                  </div>
                  <div>
                    <dt>القسط الشهري التقديري</dt>
                    <dd>
                      {offering.price !== undefined &&
                      offering.minDownPayment !== undefined &&
                      (offering.installments ?? 0) > 0
                        ? money(
                            (offering.price - offering.minDownPayment) /
                              offering.installments!,
                          )
                        : "غير مفعّل"}
                    </dd>
                  </div>
                  <div>
                    <dt>الساعات في هذا الفرع</dt>
                    <dd>
                      {offering.accreditedHours ??
                        program.accreditedHours ??
                        "غير محدد"}
                    </dd>
                  </div>
                  <div>
                    <dt>حالة التسجيل</dt>
                    <dd>{registrationLabels[offering.registration]}</dd>
                  </div>
                </dl>
                <div className="adm-offering-actions">
                  <span>لا يوجد تخفيض مؤكد لهذا الخيار.</span>
                  <button className="adm-button" type="button" onClick={() => setArchive(offering)}>أرشفة الخيار</button>
                  <button
                    className="adm-button"
                    type="button"
                    onClick={() => open(offering)}
                  >
                    تعديل الخيار
                  </button>
                </div>
              </div>
            </details>
          ))
        ) : (
          <EmptyState
            title="لم يُضف فرع بعد"
            description="اربط البرنامج بفرع وحدّد نمط الدراسة والسعر."
          >
            <button className="adm-button" type="button" onClick={() => open()}>
              <Plus size={16} />
              إضافة أول فرع
            </button>
          </EmptyState>
        )}
      </div>
      {program.offerings.some(o => o.archived) && <details className="adm-archived-offers"><summary>الخيارات المؤرشفة ({program.offerings.filter(o => o.archived).length})</summary>{program.offerings.filter(o => o.archived).map(o => <div key={o.id}>{o.city} · {o.branch}<button className="adm-button" type="button" disabled={busy} onClick={() => void lifecycle(o,'restore')}>استعادة كخيار متوقف</button></div>)}</details>}
      </>}
      <ConfirmDialog open={archive !== null} title="أرشفة خيار الدراسة؟" description="سيُوقف الخيار مع الاحتفاظ بسعره وبياناته. يمكنك استعادته لاحقًا." confirmLabel="أرشفة الخيار" onCancel={() => setArchive(null)} onConfirm={() => { if(archive)void lifecycle(archive,'archive'); setArchive(null); }} />
      <ConfirmDialog open={disabling} title="إيقاف خيار الدراسة؟" description="سيصبح هذا الخيار غير متاح. تبقى معلومات السعر والسداد محفوظة." onCancel={() => setDisabling(false)} onConfirm={() => { setDisabling(false); apply(true); }} />
      <Dialog.Root
        open={editing !== null}
        onOpenChange={(value) => {
          if (!value) close();
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="adm-overlay" />
          <Dialog.Content className="adm-dialog adm-offering-dialog" dir="rtl">
            <div className="adm-dialog-heading">
              <div>
                <Dialog.Title>خيار الدراسة والسداد</Dialog.Title>
                <Dialog.Description>
                  {program.name || "برنامج جديد"} · {persistentPrograms ? 'حفظ في قاعدة البيانات' : 'تعديل تجريبي'}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  className="adm-icon-button"
                  type="button"
                  aria-label="إغلاق تعديل الخيار"
                >
                  <X size={20} />
                </button>
              </Dialog.Close>
            </div>
            {editing && (
              <>
                <div className="adm-dialog-body" inert={busy}>
                  <div className="adm-form-grid">
                    <FormField label="الفرع" id="off-branch" wide>
                      <select
                        id="off-branch"
                        value={editing.branchId}
                        onChange={(e) => {
                          const branch = branches.find(
                            (b) => b.id === e.target.value,
                          );
                          if (branch)
                            change({
                              branchId: branch.id,
                              city: branch.city,
                              branch: branch.name,
                            });
                        }}
                      >
                        {branches.filter(b=>!b.archived||b.id===editing.branchId).map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {branch.city} · {branch.name}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="نمط الدراسة" id="off-mode">
                      <select
                        id="off-mode"
                        value={editing.studyMode}
                        onChange={(e) =>
                          change({
                            studyMode: e.target
                              .value as AdminOffering["studyMode"],
                          })
                        }
                      >
                        <option value="onsite">حضوري</option>
                        <option value="online">عن بُعد</option>
                      </select>
                    </FormField>
                    <FormField label="الفئة" id="off-gender">
                      <select
                        id="off-gender"
                        value={editing.gender ?? "both"}
                        onChange={(e) =>
                          change({
                            gender: e.target.value as AdminOffering["gender"],
                          })
                        }
                      >
                        <option value="both">رجال ونساء</option>
                        <option value="male">رجال</option>
                        <option value="female">نساء</option>
                      </select>
                    </FormField>
                    <FormField
                      label="السعر الأساسي (ر.س)"
                      id="off-price"
                      hint="اتركه فارغًا إذا لم يتأكد السعر."
                    >
                      <input
                        id="off-price"
                        type="number"
                        min="0"
                        step="0.01"
                        value={editing.price ?? ""}
                        onChange={(e) =>
                          change({ price: numberValue(e.target.value) })
                        }
                      />
                    </FormField>
                    <FormField
                      label="الساعات المعتمدة لهذا الفرع"
                      id="off-hours"
                      hint="اتركها فارغة لاستخدام ساعات البرنامج."
                    >
                      <input
                        id="off-hours"
                        type="number"
                        min="1"
                        step="1"
                        value={editing.accreditedHours ?? ""}
                        onChange={(e) =>
                          change({
                            accreditedHours: numberValue(e.target.value),
                          })
                        }
                      />
                    </FormField>
                    <FormField
                      label="الحد الأدنى للدفعة المقدمة (ر.س)"
                      id="off-down"
                      hint="ليست رسوم تسجيل إضافية."
                    >
                      <input
                        id="off-down"
                        type="number"
                        min="0"
                        step="0.01"
                        value={editing.minDownPayment ?? ""}
                        onChange={(e) =>
                          change({
                            minDownPayment: numberValue(e.target.value),
                            installments: editing.installments ?? 24,
                          })
                        }
                      />
                    </FormField>
                    <FormField label="عدد الأقساط الشهرية" id="off-months">
                      <input
                        id="off-months"
                        type="number"
                        min="1"
                        step="1"
                        value={editing.installments ?? ""}
                        onChange={(e) =>
                          change({ installments: numberValue(e.target.value) })
                        }
                      />
                    </FormField>
                    <FormField label="حالة التسجيل" id="off-registration">
                      <select
                        id="off-registration"
                        value={editing.registration}
                        onChange={(e) =>
                          change({
                            registration: e.target.value as Registration,
                          })
                        }
                      >
                        {Object.entries(registrationLabels).map(
                          ([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ),
                        )}
                      </select>
                    </FormField>
                    <FormField label="عدد الأقساط" id="off-months" hint="عدد الأشهر المستخدمة في حساب القسط بعد الدفعة المقدمة."><input id="off-months" type="number" min="1" step="1" value={editing.installments??''} onChange={e=>change({installments:numberValue(e.target.value)})}/></FormField>
                    <FormField label="ترتيب العرض" id="off-order"><input id="off-order" type="number" min="0" step="1" value={editing.sortOrder??0} onChange={e=>change({sortOrder:numberValue(e.target.value)})}/></FormField>
                    <FormField label="إتاحة الخيار" id="off-active">
                      <select
                        id="off-active"
                        disabled={editing.archived}
                        value={editing.active ? "yes" : "no"}
                        onChange={(e) =>
                          change({ active: e.target.value === "yes" })
                        }
                      >
                        <option value="yes">متاح</option>
                        <option value="no">متوقف</option>
                      </select>
                    </FormField>
                  </div>
                  <div className="adm-estimate">
                    <span>
                      القسط الشهري التقديري
                      <small>بعد الحد الأدنى للدفعة المقدمة</small>
                    </span>
                    <strong>
                      {validEstimate
                        ? money(
                            (editing.price! - editing.minDownPayment!) /
                              editing.installments!,
                          )
                        : "—"}
                    </strong>
                  </div>
                  {error && (
                    <p className="adm-field-error" role="alert">
                      {error}
                    </p>
                  )}
                </div>
                <div className="adm-dialog-footer">
                  <button
                    className="adm-button"
                    type="button"
                    onClick={close}
                    disabled={busy}
                  >
                    إلغاء
                  </button>
                  <button
                    className="adm-button adm-primary"
                    type="button"
                    onClick={() => apply()}
                    disabled={busy}
                  >
                    {dialogOnly ? "حفظ التغييرات" : "اعتماد التعديل"}
                  </button>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
