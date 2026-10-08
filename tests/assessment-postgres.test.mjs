import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { createUser, LOCAL_USER_ID, startSession, sessionView, stopSession, updateBudget, syncCards,introduce,commitResponse,rate } from '../src/lib/server/review/service.mjs';
import { bankHash, publishBank } from '../src/lib/server/assessment/bank.mjs';
import { startAssessment, assessmentView, saveAnswer, beginReading, submitAssessment, selfGrade, continuePractice,reportQuestion } from '../src/lib/server/assessment/service.mjs';
import { markStudied } from '../src/lib/server/review/service.mjs';
const enabled=!!process.env.ASSESSMENT_TEST_URL;
const db=enabled?new PrismaClient({datasourceUrl:process.env.ASSESSMENT_TEST_URL,errorFormat:'minimal'}):null;
const now=new Date('2026-10-08T10:00:00Z');
test.after(()=>db?.$disconnect());
async function fixture({reading=false,local=false,ruleReading=false}={}){
 const user=await createUser(db,local?LOCAL_USER_ID:randomUUID());
 const sourceId=randomUUID();await db.source.create({data:{id:sourceId,title:'Synthetic assessment evidence',sourceType:'book',language:'ja'}});
 const ids=Array.from({length:reading?4:2},()=>randomUUID());
 await db.$transaction(async tx=>{
  for(const [i,id] of ids.entries()){
   const e=randomUUID(),typed={writtenForm:`試験${i}`,reading:`しけん${i}`,partOfSpeech:'noun',senseKey:id,meaningEn:`synthetic sense ${i}`,acceptedGlossesJson:[],alternativeFormsJson:[],usageJson:{}};
   const origins=Object.fromEntries(Object.keys(typed).map(k=>[k,e]));
   await tx.item.create({data:{id,kind:'vocabulary',canonicalKey:id,status:'approved',revision:1,fieldOriginsJson:origins}});
   await tx.vocabulary.create({data:{itemId:id,...typed}});
   await tx.sourceEntry.create({data:{id:e,sourceId,itemId:id,sourceRecordKey:id,revision:1,originalPayloadJson:{synthetic:true},fieldPresenceJson:{},verificationStatus:'verified',verifiedAt:now}});
   await tx.itemRevision.create({data:{itemId:id,revision:1,typedJson:typed,fieldOriginsJson:origins}});
   await tx.userItem.create({data:{userId:user.id,itemId:id,familiarity:'introduced',introducedAt:new Date(+now-10*86400000)}});
  }
 },{timeout:30000,maxWait:30000});
 const passageId=randomUUID();
 const questions=ids.map((id,i)=>({id:randomUUID(),domain:reading&&i>1?'reading':'vocabulary',objective:reading&&i>1?'comprehension':'vocab_reading_meaning',primaryTargetItemId:id,targetIds:[id],supportingItemIds:[],exposesItemIds:[],prompt:`Synthetic question ${i}`,format:'short_answer',options:[],supportingReviewed:true,unresolved:false,...(reading&&i>1?{passageId}:{}),rubric:{mode:'self',expectedAnswer:`private answer ${i}`,explanation:`private feedback ${i}`,acceptableAnswers:[]}}));
 if(ruleReading)for(const q of questions.filter(q=>q.domain==='reading')){q.format='multiple_choice';q.options=[{label:'A',text:'Synthetic A'},{label:'B',text:'Synthetic B'}];q.rubric.mode='choice';q.rubric.acceptableAnswers=['A'];}
 const bank={version:1,questions,passages:reading?[{id:passageId,title:'Synthetic reading',japanese:'試験の文章です。続きも読みます。',targetIds:[ids[2]],supportingItemIds:[],exposesItemIds:[],supportingReviewed:true,unresolved:false}]:[]};
 await publishBank(db,bank,{confirmation:bankHash(bank),reviewer:'synthetic-test'});
 return {user,ids,questions,bank};
}
const answer=(s,q,value='my response')=>({sessionId:s,questionId:q,clientEventId:randomUUID(),answer:{response:value,reading:'しけん'}});

test('flexible studied inactive targets enter new weekly tests without changing a running selection', {skip:!enabled},async()=>{
 const f=await fixture();
 await db.userItem.update({where:{userId_itemId:{userId:f.user.id,itemId:f.ids[1]}},data:{introducedAt:null,familiarity:'unseen'}});
 const s=await startAssessment(db,f.user.id,{now});const frozen=(await db.studySession.findUnique({where:{id:s.id}})).selectionSnapshotJson;
 assert.equal(frozen.questions.length,1);assert.equal(frozen.questions[0].primaryTargetItemId,f.ids[0]);
 const time=new Date(+now+1000);await markStudied(db,f.user.id,f.ids[1],time);
 await markStudied(db,f.user.id,f.ids[1],new Date(+time+86400000));
 assert.equal((await db.userItem.findUnique({where:{userId_itemId:{userId:f.user.id,itemId:f.ids[1]}}})).introducedAt.toISOString(),time.toISOString());
 assert.equal(await db.card.count({where:{userId:f.user.id,status:'active'}}),0);assert.equal(await db.reviewLog.count({where:{userId:f.user.id}}),0);
 assert.deepEqual((await db.studySession.findUnique({where:{id:s.id}})).selectionSnapshotJson,frozen);
 await saveAnswer(db,f.user.id,answer(s.id,frozen.questions[0].id),time);await submitAssessment(db,f.user.id,s.id,time);
 const next=await startAssessment(db,f.user.id,{now:new Date(+time+1000)});const view=await assessmentView(db,f.user.id,next.id,time);
 assert.ok(view.questions.some(q=>q.primaryTargetItemId===f.ids[1]));
});
test('weekly refresh retains selection; eligibility needs no cards; responses hide feedback and retries are exact', {skip:!enabled},async()=>{
 const f=await fixture();const s=await startAssessment(db,f.user.id,{now});
 const before=await db.studySession.findUnique({where:{id:s.id}});
 assert.equal((await startAssessment(db,f.user.id,{now:new Date(+now+1000)})).id,s.id);
 const v=await assessmentView(db,f.user.id,s.id,now);assert.equal(v.total,2);assert.equal(v.questions.length,2);assert.ok(!JSON.stringify(v).includes('private answer'));
 const a=answer(s.id,v.questions[0].id);await saveAnswer(db,f.user.id,a,now);await saveAnswer(db,f.user.id,a,now);
 assert.equal(await db.attempt.count({where:{sessionId:s.id}}),1);
 await assert.rejects(()=>saveAnswer(db,f.user.id,{...a,answer:{response:'changed'}},now));
 await assert.rejects(()=>saveAnswer(db,randomUUID(),a,now));
 assert.deepEqual((await db.studySession.findUnique({where:{id:s.id}})).selectionSnapshotJson,before.selectionSnapshotJson);
 await assert.rejects(()=>db.studySession.update({where:{id:s.id},data:{selectionSnapshotJson:{changed:true}}}));
});
test('daily and weekly sessions coexist without daily budget/stop mutations reaching weekly sessions', {skip:!enabled},async()=>{
 const f=await fixture();const w=await startAssessment(db,f.user.id,{now});const d=await startSession(db,f.user.id,{now,includeNew:false});
 assert.notEqual(d.id,w.id);assert.equal((await sessionView(db,f.user.id,d.id,now)).total,0);
 await assert.rejects(()=>sessionView(db,f.user.id,w.id,now));await assert.rejects(()=>stopSession(db,f.user.id,w.id,now));
 await updateBudget(db,f.user.id,25);assert.equal((await db.studySession.findUnique({where:{id:w.id}})).timeBudgetMinutes,30);
});
test('reading deadline begins on presentation, survives refresh/background and late continuation is separate practice', {skip:!enabled},async()=>{
 const f=await fixture({reading:true});const s=await startAssessment(db,f.user.id,{now,readingMinutes:1});
 let v=await assessmentView(db,f.user.id,s.id,now);assert.equal(v.reading,null);assert.equal(v.questions.length,2);
 for(const q of v.questions)await saveAnswer(db,f.user.id,answer(s.id,q.id),now);
 const presentation=new Date(+now+600000);await beginReading(db,f.user.id,s.id,presentation);
 const deadline=new Date(+presentation+60000).toISOString();
 await beginReading(db,f.user.id,s.id,new Date(+presentation+30000));
 v=await assessmentView(db,f.user.id,s.id,new Date(+presentation+61000));assert.equal(v.timing.deadline,deadline);assert.equal(v.timing.expired,true);
 await assert.rejects(()=>saveAnswer(db,f.user.id,answer(s.id,v.questions.find(q=>q.domain==='reading').id),new Date(+presentation+61000)));
 const final=await submitAssessment(db,f.user.id,s.id,new Date(+presentation+61000));assert.equal(final.status,'completed');assert.equal(final.timing.expired,true);assert.ok(JSON.stringify(final).includes('private answer'));
 const p=await continuePractice(db,f.user.id,s.id,new Date(+presentation+62000));assert.notEqual(p.id,s.id);
 assert.equal((await continuePractice(db,f.user.id,s.id,new Date(+presentation+63000))).id,p.id);
 assert.equal((await assessmentView(db,f.user.id,p.id,now)).mode,'practice');
 const original=(await db.studySession.findUnique({where:{id:s.id}})).assessmentResultJson;
 const practice=await assessmentView(db,f.user.id,p.id,new Date(+presentation+63000));assert.equal(practice.readyForReading,false);
 for(const q of practice.questions)await saveAnswer(db,f.user.id,answer(p.id,q.id),new Date(+presentation+64000));
 const report=await submitAssessment(db,f.user.id,p.id,new Date(+presentation+65000));assert.equal(report.summary.graded,0);assert.equal(report.summary.assisted,2);
 assert.deepEqual((await db.studySession.findUnique({where:{id:s.id}})).assessmentResultJson,original);
});
test('submission/self grading flags only failed primary targets and changes no Card/ReviewLog state', {skip:!enabled},async()=>{
 const f=await fixture();await syncCards(db,f.user.id,now);
 const daily=await startSession(db,f.user.id,{now,includeNew:true});let dv=await sessionView(db,f.user.id,daily.id,now);
 await introduce(db,f.user.id,daily.id,dv.card.id,now);dv=await sessionView(db,f.user.id,daily.id,now);
 const recall={sessionId:daily.id,cardId:dv.card.id,stateVersion:dv.card.stateVersion,clientEventId:randomUUID(),answer:{reading:'しけん',meaning:'synthetic sense'}};
 await commitResponse(db,f.user.id,recall,now);await rate(db,f.user.id,{...recall,rating:3,components:{readingCorrect:true,meaningCorrect:true}},now);
 const s=await startAssessment(db,f.user.id,{now});const v=await assessmentView(db,f.user.id,s.id,now);
 const cards=await db.card.findMany({where:{userId:f.user.id},orderBy:{id:'asc'}}),logs=await db.reviewLog.findMany({where:{userId:f.user.id},orderBy:{id:'asc'}});assert.ok(cards.length>0);assert.equal(logs.length,1);
 await assert.rejects(()=>selfGrade(db,f.user.id,{sessionId:s.id,questionId:v.questions[0].id,outcome:'incorrect',components:{readingCorrect:false,meaningCorrect:true}},now));
 for(const q of v.questions)await saveAnswer(db,f.user.id,answer(s.id,q.id),now);
 await submitAssessment(db,f.user.id,s.id,now);
 const grade={sessionId:s.id,questionId:v.questions[0].id,outcome:'correct',components:{readingCorrect:false,meaningCorrect:true}};
 let final=await selfGrade(db,f.user.id,grade,now);assert.equal(final.results[0].outcome,'incorrect');
 await selfGrade(db,f.user.id,grade,now);
 await assert.rejects(()=>selfGrade(db,f.user.id,{...grade,components:{readingCorrect:true,meaningCorrect:true}},now));
 assert.equal((await db.userItem.findUnique({where:{userId_itemId:{userId:f.user.id,itemId:v.questions[0].primaryTargetItemId}}})).needsAttention,true);
 assert.equal((await db.userItem.findUnique({where:{userId_itemId:{userId:f.user.id,itemId:v.questions[1].primaryTargetItemId}}})).needsAttention,false);
 assert.deepEqual(await db.card.findMany({where:{userId:f.user.id},orderBy:{id:'asc'}}),cards);assert.deepEqual(await db.reviewLog.findMany({where:{userId:f.user.id},orderBy:{id:'asc'}}),logs);
 await assert.rejects(()=>db.attempt.updateMany({where:{sessionId:s.id},data:{answerJson:{changed:true}}}));
});
test('bank exact-hash publication is repeat-safe and rolls back invalid primary targets', {skip:!enabled},async()=>{
 const f=await fixture();assert.equal((await publishBank(db,f.bank,{confirmation:bankHash(f.bank),reviewer:'synthetic-test'})).inserted,0);
 const invalid=structuredClone(f.bank);invalid.questions.forEach(q=>q.id=randomUUID());invalid.questions[1].targetIds=[randomUUID()];invalid.questions[1].primaryTargetItemId=invalid.questions[1].targetIds[0];
 const count=await db.content.count();await assert.rejects(()=>publishBank(db,invalid,{confirmation:bankHash(invalid),reviewer:'synthetic-test'}));assert.equal(await db.content.count(),count);
 await assert.rejects(()=>publishBank(db,f.bank,{confirmation:'wrong',reviewer:'synthetic-test'}));
});
test('database-backed selection accepts enabled baseline without cards and rejects unseen/excluded N2', {skip:!enabled},async()=>{
 const f=await fixture({reading:true});
 await db.userItem.update({where:{userId_itemId:{userId:f.user.id,itemId:f.ids[0]}},data:{introducedAt:null,baselineStatus:'assumed'}});
 await db.userItem.update({where:{userId_itemId:{userId:f.user.id,itemId:f.ids[2]}},data:{introducedAt:null,familiarity:'unseen'}});
 await db.userItem.update({where:{userId_itemId:{userId:f.user.id,itemId:f.ids[3]}},data:{excludedFromTests:true}});
 const s=await startAssessment(db,f.user.id,{now});const v=await assessmentView(db,f.user.id,s.id,now);
 assert.equal(v.total,2);assert.equal(v.questions.find(q=>q.primaryTargetItemId===f.ids[0]).baselineCheck,true);
 assert.equal(v.reading,null);assert.ok(v.omissions.length>0);
});
test('failed submission rolls back outcomes, attention and completion together', {skip:!enabled},async()=>{
 const f=await fixture();const s=await startAssessment(db,f.user.id,{now});const v=await assessmentView(db,f.user.id,s.id,now);
 for(const q of v.questions)await saveAnswer(db,f.user.id,answer(s.id,q.id),now);
 const before=await db.attempt.findMany({where:{sessionId:s.id},orderBy:{id:'asc'}});
 await db.$executeRawUnsafe(`CREATE FUNCTION fail_assessment_completion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic failure'; END $$`);
 await db.$executeRawUnsafe(`CREATE TRIGGER fail_assessment BEFORE UPDATE ON study_sessions FOR EACH ROW WHEN (NEW.id='${s.id}'::uuid AND NEW.status='completed') EXECUTE FUNCTION fail_assessment_completion()`);
 try{await assert.rejects(()=>submitAssessment(db,f.user.id,s.id,now));assert.equal((await db.studySession.findUnique({where:{id:s.id}})).status,'active');assert.deepEqual(await db.attempt.findMany({where:{sessionId:s.id},orderBy:{id:'asc'}}),before);}finally{await db.$executeRawUnsafe('DROP TRIGGER fail_assessment ON study_sessions');await db.$executeRawUnsafe('DROP FUNCTION fail_assessment_completion()');}
 await submitAssessment(db,f.user.id,s.id,now);
});
test('ambiguous questions stay ungraded and are omitted from later samples until a reviewed correction', {skip:!enabled},async()=>{
 const f=await fixture();const s=await startAssessment(db,f.user.id,{now});const v=await assessmentView(db,f.user.id,s.id,now);
 for(const q of v.questions)await saveAnswer(db,f.user.id,answer(s.id,q.id),now);
 await submitAssessment(db,f.user.id,s.id,now);
 const report=await selfGrade(db,f.user.id,{sessionId:s.id,questionId:v.questions[0].id,outcome:'ungraded'},now);
 assert.equal(report.results[0].outcome,'ungraded');
 const next=await startAssessment(db,f.user.id,{now:new Date(+now+1000)});const chosen=await assessmentView(db,f.user.id,next.id,new Date(+now+1000));
 assert.equal(chosen.total,1);assert.ok(chosen.questions.every(q=>q.id!==v.questions[0].id));
});
test('reported rule-graded ambiguity preserves the original grade, removes unaided scoring and does not blame the learner', {skip:!enabled},async()=>{
 const f=await fixture({reading:true,ruleReading:true});const s=await startAssessment(db,f.user.id,{now});
 let v=await assessmentView(db,f.user.id,s.id,now);for(const q of v.questions)await saveAnswer(db,f.user.id,answer(s.id,q.id),now);
 v=await beginReading(db,f.user.id,s.id,now);for(const q of v.questions.filter(q=>q.domain==='reading'))await saveAnswer(db,f.user.id,answer(s.id,q.id,'A'),now);
 const finished=await submitAssessment(db,f.user.id,s.id,now);assert.equal(finished.summary.graded,2);
 const q=v.questions.find(q=>q.domain==='reading');const input={sessionId:s.id,questionId:q.id};
 const report=await reportQuestion(db,f.user.id,input,now);assert.equal(report.summary.graded,1);assert.equal(report.results.find(r=>r.questionId===q.id).outcome,'ungraded');
 await reportQuestion(db,f.user.id,input,now);
 const a=await db.attempt.findFirst({where:{sessionId:s.id,contentId:q.id}});assert.equal(a.feedbackJson.originalOutcome,'correct');assert.equal(a.feedbackJson.repairRequested,true);
 assert.equal((await db.userItem.findUnique({where:{userId_itemId:{userId:f.user.id,itemId:q.primaryTargetItemId}}})).needsAttention,false);
 await assert.rejects(()=>db.attempt.update({where:{id:a.id},data:{outcome:'correct'}}));
});
if(process.env.ASSESSMENT_BROWSER_TEST)await fixture({reading:true,local:true});
