export type ProgramCategory = "diploma" | "qualifying-course" | "development-course";
export type StudyMode = "onsite" | "online";
export type Gender = "male" | "female" | "both";
export interface Program { id:string; slug:string; name:string; category:ProgramCategory; image?:string; imagePosition?:string; description:string; duration:{label:string;standard?:string;withSummerTerm?:string}; accreditedHours?:number; curriculum?:string[]; careerPaths?:string[]; contentPending?:boolean; classificationPending?:boolean; }
export interface Offering { id:string; programId:string; category:ProgramCategory; studyMode:StudyMode; city?:string; region?:string; branch?:string; gender?:Gender; price?:number; accreditedHours?:number; minDownPayment?:number; installments?:number; active:boolean; }
export interface FilterOptions { category:ProgramCategory; studyMode:StudyMode; city?:string; }
