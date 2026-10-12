import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { createUser,LOCAL_USER_ID } from '../src/lib/server/review/service.mjs';
import { listLessonExercises,startLessonExercises,lessonExercisesView,commitLessonResponse } from '../src/lib/server/lesson-exercises/service.mjs';
import { assessmentView } from '../src/lib/server/assessment/service.mjs';
import { answerReasonData } from '../src/lib/server/content/lesson-answer-reasons.mjs';
const enabled=!!process.env.LESSON_EXERCISES_TEST_URL,db=enabled?new PrismaClient({datasourceUrl:process.env.LESSON_EXERCISES_TEST_URL,errorFormat:'minimal'}):null;
test.after(()=>db?.$disconnect());
async function fixture(local=false){
 const user=await createUser(db,local?LOCAL_USER_ID:randomUUID()),sourceId=randomUUID(),ids=[randomUUID(),randomUUID()],questionId=randomUUID();
 await db.$transaction(async db=>{
 await db.source.create({data:{id:sourceId,title:'Synthetic grammar book',sourceType:'book',language:'ja'}});
 await db.importBatch.create({data:{sourceId,fileHash:randomUUID(),pageRangeJson:{},extractorVersion:'synthetic',schemaVersion:2,status:'draft',validationErrorsJson:[],stagedJson:{content_type:'grammar',batch:{lesson_key:'lesson-1',expected_grammar_count:2},entries:ids.map(source_record_key=>({source_record_key}))}}});
 for(const [i,id]of ids.entries()){
  const entryId=randomUUID(),typed={pattern:`Synthetic grammar ${i}`,patternVariantsJson:[],explanationJa:null,explanationEn:'Synthetic explanation',nuance:null,formationRulesJson:[],usageJson:{}};
  const fieldOriginsJson=Object.fromEntries(Object.keys(typed).map(key=>[key,entryId]));
  await db.item.create({data:{id,kind:'grammar',canonicalKey:id,status:'approved',revision:1,fieldOriginsJson}});await db.grammar.create({data:{itemId:id,...typed}});
  await db.sourceEntry.create({data:{id:entryId,sourceId,itemId:id,sourceRecordKey:id,revision:1,lessonKey:'lesson-1',lessonTitle:'Synthetic lesson',originalPayloadJson:{},fieldPresenceJson:{},verificationStatus:'verified',verifiedAt:new Date()}});
  await db.itemRevision.create({data:{itemId:id,revision:1,typedJson:typed,fieldOriginsJson}});
  await db.userItem.create({data:{userId:user.id,itemId:id,...(i===0?{introducedAt:new Date()}:{} )}});
 }
 await db.content.create({data:{id:questionId,kind:'question',origin:'book',status:'draft',revision:1,payloadJson:{prompt:'Synthetic choose?',format:'multiple_choice',options:[{label:'1',text:'First'},{label:'2',text:'Second'}],answer_specification:{correct_option_labels:['2'],source_answer_text:'2'},questionReview:{sourceAnswerTextVerified:true,grammarConnections:'intentionally_deferred',usage:'reference_only'},answerVerified:false,targetsVerified:false}}});
 await db.sourceEntry.create({data:{sourceId,contentId:questionId,sourceRecordKey:questionId,revision:1,lessonKey:'lesson-1',lessonTitle:'Synthetic lesson',originalPayloadJson:{},fieldPresenceJson:{},verificationStatus:'verified',verifiedAt:new Date()}});
 const question=await db.content.findUnique({where:{id:questionId}});
 await db.content.create({data:answerReasonData(question,{answer_reason:'Synthetic generated reason: the second option fits.'})});
 });
 return {user,sourceId,ids,questionId};
}
test('lesson gating, frozen feedback, durable idempotent commitment and ownership preserve learner state',{skip:!enabled},async()=>{
 const f=await fixture(),selection={sourceId:f.sourceId,lessonKey:'lesson-1'};
 assert.equal((await listLessonExercises(db,f.user.id)).find(l=>l.sourceId===f.sourceId).unlocked,false);
 await assert.rejects(()=>startLessonExercises(db,f.user.id,selection),e=>e.status===422);
 await db.userItem.update({where:{userId_itemId:{userId:f.user.id,itemId:f.ids[1]}},data:{introducedAt:new Date()}});
 const before=await db.userItem.findMany({where:{userId:f.user.id},orderBy:{itemId:'asc'}}),s=await startLessonExercises(db,f.user.id,selection);
 assert.equal(s.questions[0].answer,undefined);assert.equal((await startLessonExercises(db,f.user.id,selection)).sessionId,s.sessionId);
 await assert.rejects(()=>assessmentView(db,f.user.id,s.sessionId),e=>e.status===403);
 const original=await db.content.findUnique({where:{id:f.questionId}});
 await db.$transaction(async tx=>{
  const replacement=await tx.content.create({data:{kind:'question',origin:'book',status:'draft',revision:2,supersedesId:f.questionId,payloadJson:{...original.payloadJson,prompt:'Changed draft question'}}});
  await tx.sourceEntry.create({data:{sourceId:f.sourceId,contentId:replacement.id,sourceRecordKey:replacement.id,revision:1,lessonKey:'lesson-1',originalPayloadJson:{},fieldPresenceJson:{},verificationStatus:'verified',verifiedAt:new Date()}});
 });
 assert.equal((await lessonExercisesView(db,f.user.id,s.sessionId)).questions[0].prompt,'Synthetic choose?');
 const input={sessionId:s.sessionId,questionId:f.questionId,clientEventId:randomUUID(),response:'1'};
 const committed=await commitLessonResponse(db,f.user.id,input);assert.equal(committed.questions[0].answer,'2');assert.equal(committed.questions[0].reason.answer_reason,'Synthetic generated reason: the second option fits.');assert.equal(committed.status,'completed');
 assert.deepEqual(await commitLessonResponse(db,f.user.id,input),committed);assert.deepEqual(await lessonExercisesView(db,f.user.id,s.sessionId),committed);
 await assert.rejects(()=>commitLessonResponse(db,f.user.id,{...input,response:'2'}),e=>e.status===409);
 await assert.rejects(()=>lessonExercisesView(db,randomUUID(),s.sessionId),e=>e.status===403);
 assert.deepEqual(await db.userItem.findMany({where:{userId:f.user.id},orderBy:{itemId:'asc'}}),before);
 assert.equal(await db.card.count({where:{userId:f.user.id}}),0);assert.equal(await db.attempt.count({where:{userId:f.user.id}}),0);assert.equal(await db.reviewLog.count({where:{userId:f.user.id}}),0);
 const other=await db.studySession.create({data:{userId:f.user.id,mode:'practice',selectionSeed:'synthetic',selectionSnapshotJson:{questions:[]}}});
 await assert.rejects(()=>lessonExercisesView(db,f.user.id,other.id),e=>e.status===403);
});
test('synthetic browser lesson fixture',{skip:!enabled||!process.env.LESSON_EXERCISES_BROWSER_TEST},async()=>{
 const f=await fixture(true);await db.userItem.update({where:{userId_itemId:{userId:f.user.id,itemId:f.ids[1]}},data:{introducedAt:new Date()}});
});
test('staged split-batch source grammar keys prevent partial-lesson unlock',{skip:!enabled},async()=>{
 const f=await fixture();await db.userItem.update({where:{userId_itemId:{userId:f.user.id,itemId:f.ids[1]}},data:{introducedAt:new Date()}});
 await db.importBatch.create({data:{sourceId:f.sourceId,fileHash:randomUUID(),pageRangeJson:{},extractorVersion:'synthetic',schemaVersion:2,status:'draft',validationErrorsJson:[],stagedJson:{content_type:'grammar',batch:{lesson_key:'lesson-1',expected_grammar_count:3},entries:[...f.ids.map(source_record_key=>({source_record_key})),{source_record_key:'not-promoted'}]}}});
 const group=(await listLessonExercises(db,f.user.id)).find(g=>g.sourceId===f.sourceId);assert.equal(group.unlocked,false);assert.equal(group.complete,false);assert.equal(group.total,3);
 await assert.rejects(()=>startLessonExercises(db,f.user.id,{sourceId:f.sourceId,lessonKey:'lesson-1'}),e=>e.status===422);
});
