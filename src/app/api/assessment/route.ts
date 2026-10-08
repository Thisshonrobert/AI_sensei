import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/server/db';
import { LOCAL_USER_ID,createUser } from '@/lib/server/review/service.mjs';
import { AssessmentError,startAssessment,assessmentView,currentAssessment,saveAnswer,beginReading,submitAssessment,selfGrade,continuePractice,reportQuestion } from '@/lib/server/assessment/service.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const id=z.string().uuid();
const input=z.discriminatedUnion('action',[
 z.object({action:z.literal('start'),size:z.number().int().min(1).max(20),domain:z.enum(['mixed','vocabulary','kanji','grammar']),readingMinutes:z.number().int().min(1).max(15)}).strict(),
 z.object({action:z.literal('answer'),sessionId:id,questionId:id,clientEventId:id,answer:z.object({response:z.string().min(1).max(2000),reading:z.string().max(500).optional()}).strict()}).strict(),
 z.object({action:z.literal('reading'),sessionId:id}).strict(),
 z.object({action:z.literal('submit'),sessionId:id}).strict(),
 z.object({action:z.literal('practice'),sessionId:id}).strict(),
 z.object({action:z.literal('report'),sessionId:id,questionId:id}).strict(),
 z.object({action:z.literal('grade'),sessionId:id,questionId:id,outcome:z.enum(['correct','incorrect','ungraded']),components:z.object({readingCorrect:z.boolean(),meaningCorrect:z.boolean()}).strict().optional()}).strict(),
]);
const send=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'no-store'}});
const local=(r:NextRequest)=>['127.0.0.1','localhost'].includes(r.nextUrl.hostname)&&/^(127\.0\.0\.1|localhost)(:\d{1,5})?$/.test(r.headers.get('host')||'');
function failure(e:unknown){return e instanceof AssessmentError?send({error:e.message},e.status):e instanceof z.ZodError?send({error:'Invalid assessment request'},400):send({error:'Test could not be saved. Retry or resume your committed answers.'},500);}
export async function GET(request:NextRequest){
 if(!local(request)||request.headers.get('sec-fetch-site')==='cross-site')return send({error:'Local access only'},403);
 try{const sessionId=request.nextUrl.searchParams.get('session');return send(sessionId?await assessmentView(db,LOCAL_USER_ID,id.parse(sessionId)):await currentAssessment(db,LOCAL_USER_ID));}catch(e){return failure(e);}
}
export async function POST(request:NextRequest){
 const origin=local(request)?new URL(`${request.nextUrl.protocol}//${request.headers.get('host')}`).origin:null;
 if(!origin||request.headers.get('origin')!==origin||request.headers.get('sec-fetch-site')==='cross-site')return send({error:'Same-origin local request required'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return send({error:'JSON required'},415);
 try{
  const body=await request.text();if(body.length>10000)return send({error:'Request too large'},413);
  let raw;try{raw=JSON.parse(body);}catch{return send({error:'Invalid JSON'},400);}const data=input.parse(raw);
  if(data.action==='start'){await createUser(db);const s=await startAssessment(db,LOCAL_USER_ID,data);return send(await assessmentView(db,LOCAL_USER_ID,s.id));}
  if(data.action==='answer'){const {action,...payload}=data;void action;return send(await saveAnswer(db,LOCAL_USER_ID,payload));}
  if(data.action==='reading')return send(await beginReading(db,LOCAL_USER_ID,data.sessionId));
  if(data.action==='submit')return send(await submitAssessment(db,LOCAL_USER_ID,data.sessionId));
  if(data.action==='practice'){const s=await continuePractice(db,LOCAL_USER_ID,data.sessionId);return send(await assessmentView(db,LOCAL_USER_ID,s.id));}
  if(data.action==='report')return send(await reportQuestion(db,LOCAL_USER_ID,{sessionId:data.sessionId,questionId:data.questionId}));
  if(data.action==='grade'&&'outcome' in data){const {action,...payload}=data;void action;return send(await selfGrade(db,LOCAL_USER_ID,payload));}
  return send({error:'Invalid action'},400);
 }catch(e){return failure(e);}
}
