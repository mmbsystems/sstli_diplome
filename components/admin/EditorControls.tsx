"use client";
import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowUp, ArrowDown, Plus, Trash2, Upload, X } from 'lucide-react';
import { EmptyState } from './ui';

export function ConfirmDialog({ open, title, description, onCancel, onConfirm, confirmLabel = 'تأكيد التغيير' }: { open: boolean; title: string; description: string; onCancel: () => void; onConfirm: () => void; confirmLabel?: string }) {
  return <Dialog.Root open={open} onOpenChange={value => { if (!value) onCancel(); }}><Dialog.Portal><Dialog.Overlay className="adm-overlay" /><Dialog.Content className="adm-dialog adm-confirm-dialog" dir="rtl" onOpenAutoFocus={event => { event.preventDefault(); document.getElementById('adm-confirm-cancel')?.focus(); }}>
    <div className="adm-dialog-heading"><div><Dialog.Title>{title}</Dialog.Title><Dialog.Description>{description}</Dialog.Description></div></div>
    <div className="adm-dialog-footer"><button id="adm-confirm-cancel" type="button" className="adm-button" onClick={onCancel}>إلغاء</button><button type="button" className="adm-button adm-danger" onClick={onConfirm}>{confirmLabel}</button></div>
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}

/** Warns for document exits, in-app links and logout; browser-native prompt remains accessible. */
export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const historyNavigation = (window as Window & { navigation?: EventTarget }).navigation;
    const traverse = (event: Event) => {
      const navigation = event as Event & { navigationType?: string; canIntercept?: boolean };
      if (navigation.navigationType === 'traverse' && navigation.canIntercept && event.cancelable && !event.defaultPrevented && !window.confirm('لديك تغييرات غير محفوظة. هل تريد مغادرة الصفحة دون حفظها؟')) event.preventDefault();
    };
    const navigate = (event: MouseEvent | SubmitEvent) => {
      const target = event.target as HTMLElement;
      const link = target.closest?.('a[href]') as HTMLAnchorElement | null;
      const logout = target.closest?.('form[action="/api/auth/logout"]');
      if (!link && !logout) return;
      if (event instanceof MouseEvent && (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0)) return;
      if (link && (link.target === '_blank' || link.href === location.href)) return;
      if (!window.confirm('لديك تغييرات غير محفوظة. هل تريد مغادرة الصفحة دون حفظها؟')) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', navigate, true);
    document.addEventListener('submit', navigate, true);
    historyNavigation?.addEventListener('navigate', traverse);
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', navigate, true); document.removeEventListener('submit', navigate, true); historyNavigation?.removeEventListener('navigate', traverse); };
  }, [dirty]);
}

export function SaveBar({ onCancel, onSave, children }: { onCancel: () => void; onSave: () => void; children?: ReactNode }) {
  return <div className="adm-save-bar"><div><span className="adm-unsaved-dot" />{children ?? 'لديك تغييرات غير محفوظة'}</div><div><button type="button" className="adm-button" onClick={onCancel}>تراجع</button><button type="button" className="adm-button adm-primary" onClick={onSave}>حفظ التغييرات</button></div></div>;
}

export function OrderedListEditor({ title, itemLabel, items, onChange, error, itemIds }: { title: string; itemLabel: string; items: string[]; onChange: (items: string[], ids?: (string | undefined)[]) => void; itemIds?: (string | undefined)[]; error?: string }) {
  const list = useRef<HTMLOListElement>(null);
  function move(index: number, direction: number) {
    const next = [...items];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    const ids = itemIds ? [...itemIds] : undefined;
    if(ids) [ids[index],ids[index+direction]]=[ids[index+direction],ids[index]];
    onChange(next,ids);
    requestAnimationFrame(() => list.current?.querySelectorAll('input')[index + direction]?.focus());
  }
  function add() { onChange([...items, ''],itemIds ? [...itemIds,undefined] : undefined); requestAnimationFrame(() => { const inputs = list.current?.querySelectorAll('input'); inputs?.[inputs.length - 1]?.focus(); }); }
  return <><div className="adm-editor-section-title"><div><h2>{title}</h2><p>قائمة مرتبة · {items.length} {itemLabel}. يمكنك تعديل البنود وترتيبها مباشرة.</p></div><button className="adm-button" type="button" onClick={add}><Plus size={16} />إضافة {itemLabel}</button></div>
    {!items.length ? <EmptyState title={`لم تُضف ${title} بعد`} description="أضف البيانات المؤكدة فقط. يمكنك استكمال هذه القائمة لاحقًا."><button type="button" className="adm-button" onClick={add}>إضافة أول {itemLabel}</button></EmptyState> : <ol className="adm-editable-list" ref={list}>{items.map((item, i) => <li key={i}><span className="adm-list-number">{String(i + 1).padStart(2, '0')}</span><input aria-label={`${itemLabel} ${i + 1}`} value={item} aria-invalid={Boolean(error && !item.trim())} onChange={e => onChange(items.map((value, j) => j === i ? e.target.value : value),itemIds)} /><div className="adm-list-actions"><button className="adm-icon-button" type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`نقل لأعلى: ${itemLabel} ${i + 1}`}><ArrowUp size={16} /></button><button className="adm-icon-button" type="button" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label={`نقل لأسفل: ${itemLabel} ${i + 1}`}><ArrowDown size={16} /></button><button className="adm-icon-button" type="button" onClick={() => onChange(items.filter((_, j) => j !== i),itemIds?.filter((_,j)=>j!==i))} aria-label={`حذف ${itemLabel} ${i + 1}`}><Trash2 size={16} /></button></div></li>)}</ol>}
    {error && <p className="adm-field-error" role="alert">{error}</p>}
    <p className="adm-hint">تُحفظ القائمة مع تغييرات البرنامج. يمكن استعادة النسخة المحفوظة عبر «تراجع».</p>
  </>;
}

export function ImageEditor({ value, name, onChange }: { value?: string; name: string; onChange: (image: string | undefined) => void }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [remove, setRemove] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function upload(file?: File) {
    if (!file) return;
    setError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setError('اختر صورة JPG أو PNG أو WebP بحجم لا يتجاوز 5 ميجابايت.'); return; }
    setLoading(true);
    try {
      const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onerror = reject; reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(file); });
      await new Promise<void>((resolve, reject) => { const img = new window.Image(); img.onload = () => img.width > 8000 || img.height > 8000 ? reject(new Error()) : resolve(); img.onerror = reject; img.src = data; });
      if (mounted.current) onChange(data);
    } catch { if (mounted.current) setError('تعذر قراءة الصورة. استخدم ملفًا صالحًا بأبعاد لا تتجاوز 8000 بكسل.'); }
    finally { if (mounted.current) setLoading(false); }
  }
  return <><div className="adm-editor-section-title"><div><h2>صورة البرنامج</h2><p>صورة واضحة تساعد الموظف على تمييز البرنامج.</p></div></div>
    <div className="adm-media-layout"><div className="adm-media-preview">{value ? <img src={value} alt={`صورة ${name}`} /> : <EmptyState title="لم تُضف صورة" description="اختر صورة لعرض معاينة هنا." />}</div><div className="adm-media-tools"><strong>الصورة الرئيسية</strong><p>يُفضّل مقاس مربع 1200 × 1200 بكسل، مع مساحة آمنة حول النص والشعار.</p><p className="adm-hint">JPG، PNG، WebP · حتى 5 ميجابايت.<br />تُحفظ الصورة مؤقتًا ضمن هذه المعاينة.</p><input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="adm-sr-only" aria-label="اختيار صورة البرنامج" onChange={e => { void upload(e.target.files?.[0]); e.target.value = ''; }} /><button className="adm-button" type="button" disabled={loading} onClick={() => input.current?.click()}><Upload size={17} />{loading ? 'جارٍ تجهيز الصورة…' : value ? 'استبدال الصورة' : 'اختيار صورة'}</button>{value && <button className="adm-button" type="button" disabled={loading} onClick={() => setRemove(true)}><X size={17} />إزالة الصورة</button>}{error && <p className="adm-field-error" role="alert">{error}</p>}</div></div>
    <ConfirmDialog open={remove} title="إزالة صورة البرنامج؟" description="ستظهر مساحة فارغة بدل الصورة. يمكنك التراجع قبل حفظ البرنامج." onCancel={() => setRemove(false)} onConfirm={() => { onChange(undefined); setRemove(false); }} confirmLabel="إزالة الصورة" />
  </>;
}
