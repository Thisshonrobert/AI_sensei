import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { verifiedOption, reasonFor } from '../content/lesson-answer-reasons.mjs';
const uuid=z.string().uuid(), lesson=z.object({sourceId:uuid,lessonKey:z.string().min(1).max(300)}).strict();
const kind='lesson-exercises';
export class LessonExerciseError extends Error{constructor(message,status=409){super(message);this.status=status;}}
export function lessonGroups(entries,studied,readiness=[]){
 const groups=new Map(),introduced=new Set(studied.filter(s=>s.introducedAt).map(s=>s.itemId));
 for(const e of entries){const key=JSON.stringify([e.sourceId,e.lessonKey]);if(!groups.has(key))groups.set(key,{sourceId:e.sourceId,lessonKey:e.lessonKey,lessonTitle:e.lessonTitle||e.lessonKey,sourceTitle:e.source.title,items:new Set()});groups.get(key).items.add(e.itemId);}
 return [...groups.values()].map(({items,...g})=>{const known=entries.filter(e=>e.sourceId===g.sourceId&&e.lessonKey===g.lessonKey),meta=readiness.find(r=>r.sourceId===g.sourceId&&r.lessonKey===g.lessonKey),complete=known.every(e=>(!e.verificationStatus||e.verificationStatus==='verified')&&(!e.item?.status||e.item.status==='approved'))&&meta?.expected>0&&!(meta.missing>0)&&items.size>=meta.expected;return {...g,total:Math.max(items.size,meta?.expected||0),studied:[...items].filter(id=>introduced.has(id)).length,complete,unlocked:complete&&[...items].every(id=>introduced.has(id))};});
}
const grammarWhere={successor:null,lessonKey:{not:null},item:{kind:'grammar'}};
const grammarSelect={sourceId:true,lessonKey:true,lessonTitle:true,itemId:true,verificationStatus:true,item:{select:{status:true}},source:{select:{title:true}}};
async function readiness(tx,sourceIds){
 if(!sourceIds.length)return [];
 return tx.$queryRaw`WITH batches AS (
 SELECT "sourceId", "stagedJson"->'batch'->>'lesson_key' AS lesson,
 "stagedJson"->'entries' AS entries,
 CASE WHEN "stagedJson"->'batch'->>'expected_grammar_count' ~ '^[0-9]{1,5}$' THEN ("stagedJson"->'batch'->>'expected_grammar_count')::int ELSE NULL END AS expected
 FROM import_batches WHERE "sourceId"=ANY(${sourceIds}::uuid[]) AND "stagedJson"->>'content_type'='grammar'
 ), keys AS (
 SELECT DISTINCT b."sourceId",b.lesson,b.expected,e->>'source_record_key' AS key FROM batches b
 LEFT JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(b.entries)='array' THEN b.entries ELSE '[]'::jsonb END) e ON TRUE
 ) SELECT k."sourceId",k.lesson AS "lessonKey",max(k.expected)::int AS expected,
 count(*) FILTER (WHERE NOT EXISTS(SELECT 1 FROM source_entries s JOIN items i ON i.id=s."itemId" WHERE s."sourceId"=k."sourceId" AND s."lessonKey"=k.lesson AND s."sourceRecordKey"=k.key AND s."verificationStatus"='verified' AND i.status='approved' AND i.kind='grammar' AND NOT EXISTS(SELECT 1 FROM source_entries next WHERE next."supersedesId"=s.id)))::int AS missing
 FROM keys k GROUP BY k."sourceId",k.lesson LIMIT 2001`;
}
export async function listLessonExercises(db,userId){
 uuid.parse(userId);
 const entries=await db.sourceEntry.findMany({where:grammarWhere,select:grammarSelect,orderBy:[{sourceId:'asc'},{lessonKey:'asc'},{id:'asc'}],take:2001});
 if(entries.length>2000)throw new LessonExerciseError('Lesson library exceeds the bounded pilot limit; narrow the library before exercises.',422);
 const studied=await db.userItem.findMany({where:{userId,itemId:{in:[...new Set(entries.map(e=>e.itemId))]},introducedAt:{not:null}},select:{itemId:true,introducedAt:true},take:2000});
 const metadata=await readiness(db,[...new Set(entries.map(e=>e.sourceId))]);if(metadata.length>2000)throw new LessonExerciseError('Lesson metadata exceeds the bounded pilot limit.',422);
 return lessonGroups(entries,studied,metadata);
}
async function locked(db,userId,work){uuid.parse(userId);return db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM users WHERE id=${userId}::uuid FOR UPDATE`;if(!await tx.user.findUnique({where:{id:userId},select:{id:true}}))throw new LessonExerciseError('User ownership unavailable',403);return work(tx);},{timeout:30000,maxWait:30000});}
async function owned(tx,userId,id){uuid.parse(id);const s=await tx.studySession.findFirst({where:{id,userId,mode:'practice',selectionSnapshotJson:{path:['kind'],equals:kind}}});if(!s)throw new LessonExerciseError('Lesson exercise ownership mismatch',403);return s;}
export function lessonExerciseView(s){const snap=s.selectionSnapshotJson,responses=s.assessmentResultJson?.responses||{};return {sessionId:s.id,status:s.status,lessonTitle:snap.lessonTitle,sourceTitle:snap.sourceTitle,questions:snap.questions.map(q=>({id:q.id,revision:q.revision,questionNumber:q.questionNumber||null,prompt:q.prompt,format:q.format,options:q.options,passage:q.passage,response:responses[q.id]?.response||null,...(responses[q.id]?{answer:q.answer||null,reason:q.reason||null}:{})}))};}
export async function lessonExercisesView(db,userId,id){return locked(db,userId,async tx=>lessonExerciseView(await owned(tx,userId,id)));}
export async function currentLessonExercises(db,userId){uuid.parse(userId);const s=await db.studySession.findFirst({where:{userId,mode:'practice',selectionSnapshotJson:{path:['kind'],equals:kind}},orderBy:{startedAt:'desc'}});return s?lessonExerciseView(s):null;}
export async function startLessonExercises(db,userId,input){const data=lesson.parse(input);return locked(db,userId,async tx=>{
 const entries=await tx.sourceEntry.findMany({where:{...grammarWhere,...data},select:grammarSelect,orderBy:{id:'asc'},take:501});
 if(!entries.length||entries.length>500)throw new LessonExerciseError('No complete bounded grammar lesson is available.',422);
 const studied=await tx.userItem.findMany({where:{userId,itemId:{in:[...new Set(entries.map(e=>e.itemId))]},introducedAt:{not:null}},select:{itemId:true,introducedAt:true},take:500});
 const metadata=await readiness(tx,[data.sourceId]);if(metadata.length>2000)throw new LessonExerciseError('Lesson metadata exceeds the bounded pilot limit.',422);
 const group=lessonGroups(entries,studied,metadata)[0];if(!group.unlocked)throw new LessonExerciseError('Complete source approval and explicitly mark every grammar point in this source lesson studied first.',422);
 const prior=await tx.studySession.findFirst({where:{userId,mode:'practice',status:'active',AND:[{selectionSnapshotJson:{path:['kind'],equals:kind}},{selectionSnapshotJson:{path:['sourceId'],equals:data.sourceId}},{selectionSnapshotJson:{path:['lessonKey'],equals:data.lessonKey}}]},orderBy:{startedAt:'desc'}});if(prior)return lessonExerciseView(prior);
 const rows=await tx.sourceEntry.findMany({where:{...data,verificationStatus:'verified',successor:null,content:{kind:'question',origin:'book',status:{in:['draft','approved']},successor:null}},orderBy:[{orderInSource:'asc'},{id:'asc'}],take:101,select:{content:{select:{id:true,kind:true,origin:true,revision:true,payloadJson:true,parent:{select:{id:true,revision:true,payloadJson:true,successor:{select:{id:true}}}},children:{where:{kind:'explanation',origin:'generated',status:{in:['draft','approved']},successor:null},take:20,select:{id:true,kind:true,parentContentId:true,origin:true,status:true,payloadJson:true,successor:{select:{id:true}}}}}}}});
 if(rows.length>100)throw new LessonExerciseError('This lesson exceeds the 100-question pilot limit.',422);
 const questions=[...new Map(rows.map(r=>[r.content.id,r.content])).values()].filter(q=>typeof q.payloadJson.prompt==='string'&&q.payloadJson.prompt.trim()).map(q=>({id:q.id,revision:q.revision,questionNumber:q.payloadJson.question_number||null,prompt:q.payloadJson.prompt,format:q.payloadJson.format,options:Array.isArray(q.payloadJson.options)?q.payloadJson.options.map(o=>({label:o.label,text:o.text})):[],passage:q.parent?{id:q.parent.id,revision:q.parent.revision,japanese:typeof q.parent.payloadJson.japanese==='string'?q.parent.payloadJson.japanese:null}:null,answer:verifiedOption(q),reason:reasonFor(q,q.children)}));
 if(!questions.length)throw new LessonExerciseError('No stored source questions are available for this lesson.',422);
 const s=await tx.studySession.create({data:{userId,mode:'practice',selectionSeed:randomUUID(),selectionSnapshotJson:{kind,...data,lessonTitle:group.lessonTitle,sourceTitle:group.sourceTitle,questions},assessmentResultJson:{responses:{}}}});return lessonExerciseView(s);
 });}
const responseSchema=z.object({sessionId:uuid,questionId:uuid,clientEventId:uuid,response:z.string().trim().min(1).max(2000)}).strict();
export async function commitLessonResponse(db,userId,input){const data=responseSchema.parse(input);return locked(db,userId,async tx=>{
 const s=await owned(tx,userId,data.sessionId),q=s.selectionSnapshotJson.questions.find(q=>q.id===data.questionId);if(!q)throw new LessonExerciseError('Question is not in this frozen lesson.',422);
 const responses=s.assessmentResultJson?.responses||{},prior=responses[q.id],event=Object.entries(responses).find(([,r])=>r.clientEventId===data.clientEventId);
 if(event&&(event[0]!==q.id||event[1].response!==data.response))throw new LessonExerciseError('Response event was already used.');
 if(prior){if(prior.response!==data.response)throw new LessonExerciseError('This response is already committed.');return lessonExerciseView(s);}
 if(s.status!=='active')throw new LessonExerciseError('Lesson exercise is complete.');
 if(['multiple_choice','sentence_ordering'].includes(q.format)&&q.options.length&&!q.options.some(o=>o.label===data.response))throw new LessonExerciseError('Choose one of the stored option labels.',422);
 const updated={...responses,[q.id]:{response:data.response,clientEventId:data.clientEventId,committedAt:new Date().toISOString()}};
 return lessonExerciseView(await tx.studySession.update({where:{id:s.id},data:{assessmentResultJson:{responses:updated},...(Object.keys(updated).length===s.selectionSnapshotJson.questions.length?{status:'completed',endedAt:new Date()}:{})}}));
 });}
