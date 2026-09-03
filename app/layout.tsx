import type { Metadata, Viewport } from "next";import "./globals.css";import Header from "@/components/layout/Header";import Footer from "@/components/layout/Footer";
export const metadata:Metadata={title:{default:"استكشف برامج SSTLI","template":"%s | المعهد السعودي المتخصص العالي للتدريب"},description:"استكشف دبلومات ودورات المعهد السعودي المتخصص العالي للتدريب حسب طريقة الدراسة والمنطقة."};
export const viewport:Viewport={width:"device-width",initialScale:1,viewportFit:"cover"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ar" dir="rtl"><body><a className="skip" href="#main-content">انتقل إلى المحتوى</a><Header/><main id="main-content">{children}</main><Footer/></body></html>}
