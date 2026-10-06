import type { PrismaClient } from '@prisma/client';
export type Answer = {reading?:string;meaning?:string;response?:string;acceptedGlosses?:string[];alternatives?:string[]};
export type ReviewCard = {id:string;itemId:string;objective:string;status:string;stateVersion:number;prompt:{text:string;cue:string;highlight?:string;sourceEntryIds:string[];sources:{id:string;sourceId:string}[]}};
export type SessionView = {sessionId:string;status:string;completed:number;total:number;deferred:number;due:number;actionableDue:number;buriedDue:number;introductionsPaused:boolean;used:Record<string,number>;limits:Record<string,number>;repairSuggested:boolean;card:ReviewCard|null;attempt?:{clientEventId:string;answer:Answer;readingMatch?:boolean};answer?:Answer};
export type ResponseInput = {sessionId:string;cardId:string;stateVersion:number;clientEventId:string;answer:Answer};
export const LOCAL_USER_ID:string;
export class ReviewError extends Error {status:number}
export function createUser(db:PrismaClient,id?:string,timezone?:string):Promise<{id:string}>;
export function syncCards(db:PrismaClient,userId:string,now?:Date):Promise<{created:number;gaps:{itemId:string;reason:string}[];boundedPool:number;limit:number}>;
export function startSession(db:PrismaClient,userId:string,options?:{now?:Date;includeNew?:boolean}):Promise<{id:string}>;
export function sessionView(db:PrismaClient,userId:string,id:string,now?:Date):Promise<SessionView>;
export function introduce(db:PrismaClient,userId:string,sessionId:string,cardId:string,now?:Date):Promise<{answer:Answer}>;
export function commitResponse(db:PrismaClient,userId:string,input:ResponseInput,now?:Date):Promise<{clientEventId:string;answer:Answer;readingMatch?:boolean}>;
export function rate(db:PrismaClient,userId:string,input:ResponseInput & {rating:number;components:Record<string,boolean>},now?:Date):Promise<{reviewLogId:string;cardId:string;rating:number;stateVersion:number;dueAt:string}>;
export function stopSession(db:PrismaClient,userId:string,id:string,now?:Date):Promise<{savedAt:string}>;
