import {Suspense} from "react";import ProgramExplorer from "@/components/programs/ProgramExplorer";
import {requireUser} from '@/lib/auth';
import {programs} from '@/data/programs';
import {offerings} from '@/data/offerings';
export default async function ProgramsPage(){await requireUser();return <Suspense fallback={<div className="container section"><div className="empty"><strong>جارٍ تجهيز البرامج...</strong></div></div>}><ProgramExplorer programs={programs} offerings={offerings}/></Suspense>}
