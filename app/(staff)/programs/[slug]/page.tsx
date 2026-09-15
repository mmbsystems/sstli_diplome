import {Suspense} from 'react';
import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {loadStaffCatalog} from '@/lib/catalog/load';
import CatalogReadError from '@/components/programs/CatalogReadError';
import ProgramDetails from '@/components/program-details/ProgramDetails';
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const state=await loadStaffCatalog();if(state.status==='unavailable')return {title:'تعذرت قراءة البرنامج'};const {slug}=await params;const p=state.catalog.programs.find(p=>p.slug===slug);return p?{title:p.name,description:p.description.slice(0,155)}:{title:'البرنامج غير موجود'}}
export default async function DetailPage({params}:{params:Promise<{slug:string}>}) {
 const state=await loadStaffCatalog();
 if(state.status==='unavailable')return <CatalogReadError/>;
 const {slug}=await params;
 const program=state.catalog.programs.find(p=>p.slug===slug);
 if(!program)notFound();
 const available=state.catalog.offerings.filter(o=>o.programId===program.id&&o.active);
 return <Suspense fallback={<div className="container section" role="status">جارٍ تجهيز البرنامج...</div>}><ProgramDetails program={program} available={available}/></Suspense>;
}
