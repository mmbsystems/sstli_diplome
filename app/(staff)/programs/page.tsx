import {Suspense} from "react";import ProgramExplorer from "@/components/programs/ProgramExplorer";
import {loadStaffCatalog} from '@/lib/catalog/load';
import CatalogReadError from '@/components/programs/CatalogReadError';
export default async function ProgramsPage(){const state=await loadStaffCatalog();if(state.status==='unavailable')return <CatalogReadError/>;return <Suspense fallback={<div className="container section"><div className="empty"><strong>جارٍ تجهيز البرامج...</strong></div></div>}><ProgramExplorer programs={state.catalog.programs} offerings={state.catalog.offerings}/></Suspense>}
