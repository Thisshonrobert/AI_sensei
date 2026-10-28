import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/server/db';
import { LOCAL_USER_ID, ReviewError, createUser, syncCards, startSession, sessionView, resumeSession, introduce, commitResponse, rate, stopSession, updateBudget, markUnfamiliar, markStudied, updateCaps, currentSession } from '@/lib/server/review/service.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const id=z.string().uuid();
const answer=z.object({
 reading:z.string().max(500).optional(),
 meaning:z.string().max(2000).optional(),
 response:z.string().max(2000).optional(),
 choiceId:z.string().min(8).max(40).optional(),
 choiceFingerprint:z.string().regex(/^[a-f0-9]{8,32}$/).optional(),
}).strict();
const response={sessionId:id,cardId:id,stateVersion:z.number().int().nonnegative(),clientEventId:id,answer};
const caps=z.object({vocabulary:z.number().int().min(0).max(300),kanji:z.number().int().min(0).max(300),grammar:z.number().int().min(0).max(300)}).strict();
const input=z.discriminatedUnion('action',[
 z.object({action:z.literal('start'),reviewMore:z.boolean().optional()}).strict(),
 z.object({action:z.literal('introduce'),sessionId:id,cardId:id}).strict(),
 z.object({action:z.literal('respond'),...response}).strict(),
 z.object({action:z.literal('rate'),...response,rating:z.number().int().min(1).max(4),components:z.record(z.boolean()).optional()}).strict(),
 z.object({action:z.literal('resume'),sessionId:id}).strict(),
 z.object({action:z.literal('stop'),sessionId:id}).strict(),
 z.object({action:z.literal('budget'),minutes:z.number().int().min(5).max(60)}).strict(),
 z.object({action:z.literal('attention'),itemId:id}).strict(),
 z.object({action:z.literal('studied'),itemId:id}).strict(),
 z.object({action:z.literal('caps'),values:caps}).strict(),
]);
function send(value:unknown,status=200){return NextResponse.json(value,{status,headers:{'Cache-Control':'no-store'}});}
function local(request:NextRequest){return ['127.0.0.1','localhost'].includes(request.nextUrl.hostname)&&/^(127\.0\.0\.1|localhost)(:\d{1,5})?$/.test(request.headers.get('host')||'');}
function failure(error:unknown){
 if(error instanceof ReviewError)return send({error:error.message},error.status);
 if(error instanceof z.ZodError)return send({error:'Invalid review request'},400);
 // Database diagnostics must never include learner responses or secrets in the HTTP payload/log.
 return send({error:'Review could not be saved. Your committed response is retained; retry or resume.'},500);
}
export async function GET(request:NextRequest){
 if(!local(request)||request.headers.get('sec-fetch-site')==='cross-site')return send({error:'Local access only'},403);
 try {
  const id=await currentSession(db,LOCAL_USER_ID);
  return send(id?await sessionView(db,LOCAL_USER_ID,id):null);
 }catch(error){return failure(error);}
}
export async function POST(request:NextRequest){
 const expectedOrigin=local(request)?new URL(`${request.nextUrl.protocol}//${request.headers.get('host')}`).origin:null;
 if(!expectedOrigin||request.headers.get('origin')!==expectedOrigin||request.headers.get('sec-fetch-site')==='cross-site')return send({error:'Same-origin local request required'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return send({error:'JSON required'},415);
 if(Number(request.headers.get('content-length')||0)>10000)return send({error:'Request too large'},413);
 try {
  const body=await request.text();if(body.length>10000)return send({error:'Request too large'},413);
  let raw;try{raw=JSON.parse(body);}catch{return send({error:'Invalid JSON'},400);}
  const data=input.parse(raw);
  if(data.action==='start'){
   await createUser(db);
   const pool=await syncCards(db,LOCAL_USER_ID);
   const session=await startSession(db,LOCAL_USER_ID,{reviewMore:data.reviewMore});
   if(!session.id)return send({empty:true});
   return send({...await sessionView(db,LOCAL_USER_ID,session.id),contentGaps:pool.gaps.length});
  }
  if(data.action==='introduce')return send(await introduce(db,LOCAL_USER_ID,data.sessionId,data.cardId));
  if(data.action==='budget'){await createUser(db);return send(await updateBudget(db,LOCAL_USER_ID,data.minutes));}
  if(data.action==='attention'){await createUser(db);return send(await markUnfamiliar(db,LOCAL_USER_ID,data.itemId));}
  if(data.action==='studied'){await createUser(db);return send(await markStudied(db,LOCAL_USER_ID,data.itemId));}
  if(data.action==='caps'){await createUser(db);return send(await updateCaps(db,LOCAL_USER_ID,data.values));}
  if(data.action==='resume')return send(await resumeSession(db,LOCAL_USER_ID,data.sessionId));
  if(data.action==='stop')return send(await stopSession(db,LOCAL_USER_ID,data.sessionId));
  const {action,...payload}=data;
  if(action==='respond')return send(await commitResponse(db,LOCAL_USER_ID,payload));
  if(action==='rate'&&'rating' in payload)return send(await rate(db,LOCAL_USER_ID,payload));
  return send({error:'Invalid action'},400);
 }catch(error){return failure(error);}
}
