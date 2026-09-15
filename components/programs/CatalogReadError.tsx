import Link from 'next/link';
export default function CatalogReadError() {
  return <div className="container section"><div className="empty" role="alert"><strong>تعذرت قراءة البرامج حاليًا</strong><p>يرجى المحاولة مرة أخرى لاحقًا.</p><Link className="secondary-btn" href="/programs">إعادة المحاولة</Link></div></div>;
}
