import Image from 'next/image';
import {redirect} from 'next/navigation';
import {currentUser} from '@/lib/auth';
import LoginForm from './LoginForm';
// Inherit every root robots directive, including Googlebot and nocache.
export const metadata = {title: 'تسجيل الدخول'};
export default async function LoginPage() {
  if (await currentUser()) redirect('/programs?category=diploma');
  return <section className="login-shell"><div className="panel login-panel">
    <Image src="/sstli_logo.jpg" width={88} height={88} alt="شعار المعهد السعودي المتخصص العالي للتدريب" priority/>
    <h1>تسجيل الدخول</h1><p>بوابة موظفي المعهد السعودي المتخصص العالي للتدريب</p>
    <LoginForm/>
  </div></section>;
}
