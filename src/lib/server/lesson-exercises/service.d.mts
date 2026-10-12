import type { PrismaClient } from '@prisma/client';
export type LessonGroup={sourceId:string;lessonKey:string;lessonTitle:string;sourceTitle:string;total:number;studied:number;complete:boolean;unlocked:boolean};
export type LessonView={sessionId:string;status:string;lessonTitle:string;sourceTitle:string;questions:{id:string;revision:number;questionNumber?:string|number|null;prompt:string;format:string;options:{label:string;text:string}[];passage:{id:string;revision:number;japanese:string|null}|null;response:string|null;answer?:string|null;reason?:{answer_reason:string;origin:string;status:string}|null}[]};
export class LessonExerciseError extends Error{status:number;constructor(message:string,status?:number);}
export function listLessonExercises(db:PrismaClient,userId:string):Promise<LessonGroup[]>;
export function currentLessonExercises(db:PrismaClient,userId:string):Promise<LessonView|null>;
export function lessonExercisesView(db:PrismaClient,userId:string,id:string):Promise<LessonView>;
export function startLessonExercises(db:PrismaClient,userId:string,input:{sourceId:string;lessonKey:string}):Promise<LessonView>;
export function commitLessonResponse(db:PrismaClient,userId:string,input:{sessionId:string;questionId:string;clientEventId:string;response:string}):Promise<LessonView>;
