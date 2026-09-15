"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowUpLeft,
  BookOpen,
  ChevronDown,
  CircleHelp,
  LayoutGrid,
  LogOut,
  MapPin,
  Menu,
  PanelRightClose,
  Settings,
  ShieldCheck,
  Tag,
  Users,
  History,
  X,
} from "lucide-react";
import { useAdmin } from "./AdminProvider";

const navigation = [
  { label: "نظرة عامة", href: "/admin", icon: LayoutGrid },
  { label: "البرامج", href: "/admin/programs", icon: BookOpen },
  { label: "الفروع", href: "/admin/branches", icon: MapPin },
  { label: "الأسعار والعروض", href: "/admin/pricing", icon: Tag },
  { label: "المستخدمون", href: "/admin/users", icon: Users },
  { label: "سجل التعديلات", href: "/admin/activity", icon: History },
  { label: "الإعدادات", icon: Settings },
];

function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <>
      <Link href="/admin" className="adm-brand" onClick={onNavigate}>
        <Image src="/sstli_logo.jpg" width={42} height={42} alt="SSTLI" />
        <span>
          <strong>المعهد السعودي</strong>
          <small>إدارة البرامج التدريبية</small>
        </span>
      </Link>
      <div className="adm-nav-label">مساحة العمل</div>
      <nav className="adm-navigation" aria-label="لوحة الإدارة">
        {navigation.map(({ label, href, icon: Icon }) =>
          href ? (
            <Link
              key={label}
              href={href}
              title={label}
              onClick={onNavigate}
              aria-current={
                (href === "/admin" ? path === href : path.startsWith(href))
                  ? "page"
                  : undefined
              }
            >
              <Icon size={19} strokeWidth={1.7} />
              <span>{label}</span>
            </Link>
          ) : (
            <button
              type="button"
              key={label}
              disabled
              title={`${label} — في مرحلة لاحقة`}
            >
              <Icon size={19} strokeWidth={1.7} />
              <span>{label}</span>
              <small>لاحقًا</small>
            </button>
          ),
        )}
      </nav>
      <div className="adm-sidebar-bottom">
        <Link href="/programs">
          <ArrowUpLeft size={17} />
          <span>الانتقال إلى المستكشف</span>
        </Link>
        <div className="adm-sidebar-note">
          <ShieldCheck size={18} />
          <span>مساحة داخلية للموظفين</span>
        </div>
      </div>
    </>
  );
}

export default function AdminShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { userName } = useAdmin();
  const path = usePathname();
  const context = path.startsWith('/admin/branches/') ? 'تفاصيل الفرع' : path.startsWith('/admin/programs/') ? (path.endsWith('/new') ? 'برنامج جديد' : 'تفاصيل البرنامج') : navigation.find(item => item.href === path)?.label ?? 'لوحة الإدارة';
  return (
    <div className="adm-shell" dir="rtl">
      <aside className="adm-sidebar">
        <AdminSidebar />
      </aside>
      <div className="adm-workspace">
        <header className="adm-header">
          <div className="adm-header-context">
            <Dialog.Root open={open} onOpenChange={setOpen}>
              <Dialog.Trigger asChild>
                <button
                  className="adm-icon-button adm-menu-toggle"
                  aria-label="فتح قائمة الإدارة"
                >
                  <Menu size={20} />
                </button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="adm-overlay" />
                <Dialog.Content className="adm-mobile-nav" dir="rtl">
                  <Dialog.Title className="adm-sr-only">
                    قائمة الإدارة
                  </Dialog.Title>
                  <Dialog.Description className="adm-sr-only">
                    التنقل بين أقسام لوحة الإدارة.
                  </Dialog.Description>
                  <Dialog.Close asChild>
                    <button
                      className="adm-icon-button adm-nav-close"
                      aria-label="إغلاق القائمة"
                    >
                      <X size={20} />
                    </button>
                  </Dialog.Close>
                  <AdminSidebar onNavigate={() => setOpen(false)} />
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
            <PanelRightClose size={17} className="adm-context-icon" />
            <span>لوحة الإدارة</span>
            <span className="adm-header-divider">/</span>
            <strong>{context}</strong>
          </div>
          <details className="adm-profile">
            <summary>
              <span className="adm-avatar">
                {userName.trim().charAt(0) || "م"}
              </span>
              <span className="adm-profile-name">{userName}</span>
              <ChevronDown size={14} />
            </summary>
            <div className="adm-profile-popover">
              <strong>{userName}</strong>
              <p>جلسة مدير النظام · معاينة لوحة الإدارة</p>
              <Link href="/programs">
                <BookOpen size={16} />
                مستكشف البرامج
              </Link>
              <form action="/api/auth/logout" method="post">
                <button>
                  <LogOut size={16} />
                  تسجيل الخروج
                </button>
              </form>
            </div>
          </details>
        </header>
        <div className="adm-content">
          <div className="adm-preview-note">
            <CircleHelp size={15} />
            <span>
              معاينة تجريبية — التغييرات خاصة بهذه الجلسة وتُمسح عند تحديث
              الصفحة.
            </span>
          </div>
          {children}
        </div>
        <footer className="adm-footer">
          <span>المعهد السعودي المتخصص العالي للتدريب</span>
          <span>إدارة المحتوى · نسخة تجريبية</span>
        </footer>
      </div>
    </div>
  );
}
