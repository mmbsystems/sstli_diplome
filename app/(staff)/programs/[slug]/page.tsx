import {Suspense} from 'react';
import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {getProgramBySlug} from '@/data/programs';
import {requireUser} from '@/lib/auth';
import {offerings} from '@/data/offerings';
import ProgramDetails from '@/components/program-details/ProgramDetails';
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{await requireUser();const {slug}=await params;const p=getProgramBySlug(slug);return p?{title:p.name,description:p.description.slice(0,155)}:{title:'البرنامج غير موجود'}}
export default async function DetailPage({params}:{params:Promise<{slug:string}>}) {
 await requireUser();
 const {slug}=await params;
 const program=getProgramBySlug(slug);
 if(!program)notFound();
 const available=offerings.filter(o=>o.programId===program.id&&o.active);
 return <Suspense fallback={<div className="container section" role="status">جارٍ تجهيز البرنامج...</div>}><ProgramDetails program={program} available={available}/></Suspense>;
}
