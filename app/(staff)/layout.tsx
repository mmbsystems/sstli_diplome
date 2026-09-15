import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Link from 'next/link';
import {requireUser} from '@/lib/auth';
export const dynamic = 'force-dynamic';
export default async function StaffLayout({children}:{children: React.ReactNode}) {
  const user = await requireUser();
  const isSuperAdmin = user.role === 'super_admin';
  return (
    <>
      <Header/>
      <div className="container staff-actions">
        <span>مرحبًا، {user.name}</span>
        <form action="/api/auth/logout" method="post">
          <button className="secondary-btn" type="submit">تسجيل الخروج</button>
        </form>
        {isSuperAdmin && (
          <Link href="/admin" className="secondary-btn" style={{ marginRight: 8 }}>
            لوحة التحكم
          </Link>
        )}
      </div>
      {children}
      <Footer/>
    </>
  );
}