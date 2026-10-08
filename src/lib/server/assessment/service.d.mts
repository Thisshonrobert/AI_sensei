import type { PrismaClient } from '@prisma/client';
export type AssessmentQuestion={id:string;prompt:string;format:string;options:{label:string;text:string}[];domain:string;objective:string;primaryTargetItemId:string;stratum:string;baselineCheck:boolean;recentExposure:boolean;answer:{response?:string;reading?:string}|null};
export type AssessmentResult={questionId:string;primaryTargetItemId:string;targetKind:string;domain:string;objective:string;prompt:string;rubric:{mode:string;expectedAnswer:string;explanation:string;acceptableAnswers:string[]};outcome:string;answer:{response?:string;reading?:string};assisted:boolean;expired:boolean;canSelfGrade:boolean;canReport:boolean;repairRequested:boolean;sourceIds:string[];origin:string};
export type AssessmentView={sessionId:string;status:string;mode:string;total:number;requestedSize:number;coverage:Record<string,number>;omissions:string[];readingMinutes:number;furigana:string;timing:{startedAt:string;deadline:string;expired:boolean;remainingMs:number}|null;questions:AssessmentQuestion[];reading:{id:string;title:string;japanese:string;origin:string}|null;readyForReading:boolean;results?:AssessmentResult[];summary?:{correct:number;graded:number;ungraded:number;assisted:number;expired:number};repairTargets?:string[]};
export class AssessmentError extends Error {status:number}
export function startAssessment(db:PrismaClient,userId:string,options?:{now?:Date;size?:number;domain?:string;readingMinutes?:number}):Promise<{id:string}>;
export function assessmentView(db:PrismaClient,userId:string,id:string,now?:Date):Promise<AssessmentView>;
export function currentAssessment(db:PrismaClient,userId:string):Promise<AssessmentView|null>;
export function assessmentAvailability(db:PrismaClient,userId:string):Promise<{count:number;domains:Record<string,number>}>;
export function saveAnswer(db:PrismaClient,userId:string,input:{sessionId:string;questionId:string;clientEventId:string;answer:{response:string;reading?:string}},now?:Date):Promise<AssessmentView>;
export function beginReading(db:PrismaClient,userId:string,id:string,now?:Date):Promise<AssessmentView>;
export function submitAssessment(db:PrismaClient,userId:string,id:string,now?:Date):Promise<AssessmentView>;
export function selfGrade(db:PrismaClient,userId:string,input:{sessionId:string;questionId:string;outcome:'correct'|'incorrect'|'ungraded';components?:{readingCorrect:boolean;meaningCorrect:boolean}},now?:Date):Promise<AssessmentView>;
export function continuePractice(db:PrismaClient,userId:string,id:string,now?:Date):Promise<{id:string}>;
export function reportQuestion(db:PrismaClient,userId:string,input:{sessionId:string;questionId:string},now?:Date):Promise<AssessmentView>;
