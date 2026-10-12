import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/server/db';
import { LOCAL_USER_ID,createUser } from '@/lib/server/review/service.mjs';
import { LessonExerciseError,listLessonExercises,currentLessonExercises,lessonExercisesView,startLessonExercises,commitLessonResponse } from '@/lib/server/lesson-exercises/service.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const id=z.string().uuid();
const input=z.discriminatedUnion('action',[
 z.object({action:z.literal('start'),sourceId:id,lessonKey:z.string().min(1).max(300)}).strict(),
 z.object({action:z.literal('answer'),sessionId:id,questionId:id,clientEventId:id,response:z.string().trim().min(1).max(2000)}).strict(),
]);
const send=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'no-store'}});
const local=(r:NextRequest)=>['127.0.0.1','localhost'].includes(r.nextUrl.hostname)&&/^(127\.0\.0\.1|localhost)(:\d{1,5})?$/.test(r.headers.get('host')||'');
function failure(e:unknown){return e instanceof LessonExerciseError?send({error:e.message},e.status):e instanceof z.ZodError?send({error:'Invalid lesson exercise request'},400):send({error:'Lesson exercises could not be saved. Retry or resume.'},500);}
export async function GET(request:NextRequest){
 if(!local(request)||request.headers.get('sec-fetch-site')==='cross-site')return send({error:'Local access only'},403);
 try{const session=request.nextUrl.searchParams.get('session');return send(session?await lessonExercisesView(db,LOCAL_USER_ID,id.parse(session)):{lessons:await listLessonExercises(db,LOCAL_USER_ID),current:await currentLessonExercises(db,LOCAL_USER_ID)});}catch(e){return failure(e);}
}
export async function POST(request:NextRequest){
 const origin=local(request)?new URL(`${request.nextUrl.protocol}//${request.headers.get('host')}`).origin:null;
 if(!origin||request.headers.get('origin')!==origin||request.headers.get('sec-fetch-site')==='cross-site')return send({error:'Same-origin local request required'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return send({error:'JSON required'},415);
 try{const body=await request.text();if(body.length>10000)return send({error:'Request too large'},413);let raw;try{raw=JSON.parse(body);}catch{return send({error:'Invalid JSON'},400);}const data=input.parse(raw);
  if(data.action==='start'){await createUser(db);const {sourceId,lessonKey}=data;return send(await startLessonExercises(db,LOCAL_USER_ID,{sourceId,lessonKey}));}
  const {action,...payload}=data;void action;return send(await commitLessonResponse(db,LOCAL_USER_ID,payload));
 }catch(e){return failure(e);}
}
