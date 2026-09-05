'use client';
import {useState, type FormEvent} from 'react';
export default function LoginForm() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const fields = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/auth/login', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: fields.get('username'), password: fields.get('password')})});
      const result = await response.json();
      if (!response.ok) {setError(result.error); setBusy(false); return;}
      window.location.assign('/programs?category=diploma');
    } catch {setError('تعذر الاتصال. يرجى المحاولة مجددًا'); setBusy(false);}
  }
  return <form onSubmit={submit} className="login-form">
    <label htmlFor="username">اسم المستخدم</label><input className="input" id="username" name="username" dir="auto" autoComplete="username" maxLength={64} required/>
    <label htmlFor="password">كلمة المرور</label><input className="input" id="password" name="password" type="password" autoComplete="current-password" required/>
    {error && <p className="login-error" role="alert">{error}</p>}
    <button className="primary-btn" type="submit" disabled={busy}>{busy ? 'جارٍ تسجيل الدخول...' : 'تسجيل الدخول'}</button>
  </form>;
}
