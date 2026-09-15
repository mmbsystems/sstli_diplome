"use client";
import { useRef, useState } from 'react';
import type { AdminProgram } from '@/lib/admin/types';
export default function ManagedImageEditor({ program, disabled, onSaved, onBusy }: {
  program: AdminProgram; disabled: boolean;
  onSaved: (patch: { version: number; image?: string; updatedAt: string }) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [busy,setBusy]=useState(false); const [message,setMessage]=useState(''); const locked=useRef(false);
  async function submit(file?: File) {
    if(disabled||locked.current)return;
    locked.current=true;setBusy(true);onBusy(true);setMessage('');
    try {
      const form=new FormData();form.set('id',program.id);form.set('expectedVersion',String(program.version));form.set('action',file?'upload':'remove');if(file)form.set('file',file);
      const response=await fetch('/api/admin/program-images',{method:'POST',body:form});const result=await response.json();
      if(!response.ok){setMessage(response.status===409?'تعارض: أعد تحميل البرنامج للحصول على النسخة الحالية.':response.status===422?'اختر صورة JPEG أو PNG أو WebP صالحة، بحد أقصى 5 ميجابايت و8000 بكسل لكل بُعد.':'تعذر تأكيد العملية. أعد تحميل البرنامج للتحقق قبل المحاولة مجددًا.');return;}
      onSaved({version:result.image.version,image:result.image.image??undefined,updatedAt:result.image.updatedAt});
      setMessage(result.image.cleanupPending?'تم حفظ الصورة. يحتاج مسؤول التشغيل إلى مراجعة تنظيف الصورة السابقة.':'تم حفظ تغيير الصورة.');
    }catch{setMessage('تعذر تأكيد العملية. أعد تحميل البرنامج للتحقق قبل المحاولة مجددًا.');}
    finally{locked.current=false;setBusy(false);onBusy(false);}
  }
  return <div className="adm-media-layout"><div className="adm-media-preview">{program.image?<img src={program.image} alt={`صورة ${program.name}`} style={{objectPosition:program.imagePosition??'center'}}/>:<p>لا توجد صورة للبرنامج.</p>}</div><div className="adm-media-tools"><h2>صورة البرنامج</h2><p>JPEG، PNG، WebP · حتى 5 ميجابايت.</p>{disabled&&<p>احفظ تعديلات البرنامج أولًا. الصور غير قابلة للتعديل أثناء الأرشفة.</p>}<label>رفع أو استبدال الصورة<input type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled||busy} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void submit(file);}}/></label>{program.image?.startsWith(`/api/program-images/${program.id}/`)&&<button type="button" className="adm-button" disabled={disabled||busy} onClick={()=>{if(window.confirm('إزالة الصورة المرفوعة من هذا البرنامج؟'))void submit();}}>إزالة الصورة المرفوعة</button>}{busy&&<p role="status">جارٍ حفظ الصورة…</p>}{message&&<p role="status">{message}</p>}</div></div>;
}
