import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/server/db';
import { LOCAL_USER_ID,createUser } from '@/lib/server/review/service.mjs';
import { GenerationError,generationView,generationList,generationTargets,exportPrompt,importDraft,approveDraft,retireRun,hideRun,generateDraft,saveContext,MAX_APPROVAL_BODY_CHARS } from '@/lib/server/generation/service.mjs';
import { providerConfiguration } from '@/lib/server/generation/gemini.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const id=z.string().uuid();
const input=z.discriminatedUnion('action',[
 z.object({action:z.literal('export'),purpose:z.enum(['sentence','passage']),topic:z.string().trim().min(1).max(200),targetIds:z.array(id).min(1).max(120).optional()}).strict(),
 z.object({action:z.literal('generate'),purpose:z.literal('passage'),topic:z.string().trim().min(1).max(200),targetIds:z.array(id).min(1).max(120).optional(),review:z.boolean()}).strict(),
 z.object({action:z.literal('context'),runId:id,itemId:id,revision:z.number().int().positive(),sentenceId:z.string().max(40)}).strict(),
 z.object({action:z.literal('import'),runId:id,draft:z.unknown(),modelId:z.string().trim().min(1).max(100)}).strict(),
 z.object({action:z.literal('approve'),runId:id,approval:z.unknown()}).strict(),
 z.object({action:z.literal('report'),runId:id,reason:z.string().trim().min(1).max(1000)}).strict(),
 z.object({action:z.literal('hide'),runId:id}).strict(),
]);
const send=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'no-store'}});
const local=(r:NextRequest)=>['127.0.0.1','localhost'].includes(r.nextUrl.hostname)&&/^(127\.0\.0\.1|localhost)(:\d{1,5})?$/.test(r.headers.get('host')||'');
function failure(e:unknown){return e instanceof GenerationError?send({error:e.message},e.status):e instanceof z.ZodError?send({error:'Invalid generation request'},400):send({error:'Practice could not be saved. Stored reviews remain available.'},500);}
export async function GET(r:NextRequest){
 if(!local(r)||r.headers.get('sec-fetch-site')==='cross-site')return send({error:'Local access only'},403);
 try{const run=r.nextUrl.searchParams.get('run');return send(run?await generationView(db,LOCAL_USER_ID,id.parse(run)):{targets:await generationTargets(db,LOCAL_USER_ID),runs:await generationList(db,LOCAL_USER_ID),provider:providerConfiguration()});}catch(e){return failure(e);}
}
export async function POST(r:NextRequest){
 const origin=local(r)?new URL(`${r.nextUrl.protocol}//${r.headers.get('host')}`).origin:null;
 if(!origin||r.headers.get('origin')!==origin||r.headers.get('sec-fetch-site')==='cross-site')return send({error:'Same-origin local request required'},403);
 if(!r.headers.get('content-type')?.startsWith('application/json'))return send({error:'JSON required'},415);
 try{
  const body=await r.text();if(body.length>MAX_APPROVAL_BODY_CHARS)return send({error:'Request too large'},413);
  let raw;try{raw=JSON.parse(body);}catch{return send({error:'Invalid JSON'},400);}if(raw?.action!=='approve'&&body.length>64000)return send({error:'Request too large'},413);const data=input.parse(raw);
  if(data.action==='export'){await createUser(db);const {action,...payload}=data;void action;return send(await exportPrompt(db,LOCAL_USER_ID,payload));}
  if(data.action==='generate'){await createUser(db);const {action,...payload}=data;void action;return send(await generateDraft(db,LOCAL_USER_ID,payload));}
  if(data.action==='import')return send(await importDraft(db,LOCAL_USER_ID,data.runId,data.draft,data.modelId));
  if(data.action==='approve')return send(await approveDraft(db,LOCAL_USER_ID,data.runId,data.approval));
  if(data.action==='report')return send(await retireRun(db,LOCAL_USER_ID,data.runId,data.reason));
  if(data.action==='context'){const {action,...payload}=data;void action;return send(await saveContext(db,LOCAL_USER_ID,payload));}
  return send(await hideRun(db,LOCAL_USER_ID,data.runId));
 }catch(e){return failure(e);}
}
