import {Suspense} from "react";import ProgramExplorer from "@/components/programs/ProgramExplorer";
export default function ProgramsPage(){return <Suspense fallback={<div className="container section"><div className="empty"><strong>جارٍ تجهيز البرامج...</strong></div></div>}><ProgramExplorer/></Suspense>}
