import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { configuration, initialState, schedule } from '../src/lib/server/review/scheduler.mjs';
import { retrievability } from '../src/lib/server/review/selection.mjs';
import { retireKanjiReadingCards } from '../scripts/retire-kanji-reading-cards.mjs';
import { matchCandidates, matchPairs } from '../src/lib/server/practice/match.mjs';
import { createUser, syncCards, startSession, sessionView, resumeSession, introduce, commitResponse, rate, stopSession, dashboard, updateBudget, markUnfamiliar } from '../src/lib/server/review/service.mjs';
import { previewPromotion, recordApproval, promote } from '../src/lib/server/content/canonical-import.mjs';
import { grammarComparisons, studyContent } from '../src/lib/server/content/study.mjs';
import * as reviews from '../src/lib/server/review/service.mjs';
const enabled=!!process.env.REVIEW_TEST_URL;
let db=enabled?new PrismaClient({datasourceUrl:process.env.REVIEW_TEST_URL,errorFormat:'minimal'}):null;
test.after(async()=>{await db?.$disconnect();});
test('personal release dashboard, active time and attention preserve recall evidence', {skip:!enabled}, async()=>{
 const u=await fixture({count:2});
 await updateBudget(db,u.id,25);
 await assert.rejects(()=>updateBudget(db,u.id,0));
 const s=await startSession(db,u.id,{now});
 let v=await sessionView(db,u.id,s.id,now);
 assert.equal(v.timeBudgetMinutes,25); assert.equal(v.elapsedActiveMs,0); assert.equal(v.study,undefined);
 await markUnfamiliar(db,u.id,v.card.itemId);
 await introduce(db,u.id,s.id,v.card.id,now);
 const before=await db.card.findUnique({where:{id:v.card.id}});
 await markUnfamiliar(db,u.id,before.itemId);
 const learner=await db.userItem.findUnique({where:{userId_itemId:{userId:u.id,itemId:before.itemId}}});
 assert.equal(learner.needsAttention,true); assert.equal(learner.familiarity,'introduced');
 assert.equal(learner.introducedAt.toISOString(),new Date(+now-2*60000).toISOString(),'the original study date is preserved');
 assert.deepEqual(await db.card.findUnique({where:{id:before.id}}),before);
 const d=await dashboard(db,u.id,now);assert.equal(d.progress.vocabulary.introduced,2);assert.ok(d.progress.vocabulary.total>=2);assert.equal(d.sessionId,s.id);
 const stop=new Date(+now+5*60000);await stopSession(db,u.id,s.id,stop);await stopSession(db,u.id,s.id,new Date(+stop+60000));
 v=await sessionView(db,u.id,s.id,new Date(+stop+60*60000));assert.equal(v.elapsedActiveMs,5*60000);
 const restart=new Date(+stop+60*60000);await startSession(db,u.id,{now:restart});
 v=await sessionView(db,u.id,s.id,new Date(+restart+10*60000));assert.equal(v.elapsedActiveMs,15*60000);
 // A second sub-threshold segment keeps accruing; an abandoned open segment would not.
 const pause=new Date(+restart+10*60000);await stopSession(db,u.id,s.id,pause);await startSession(db,u.id,{now:pause});
 v=await sessionView(db,u.id,s.id,new Date(+pause+10*60000));assert.equal(v.elapsedActiveMs,25*60000);
 assert.equal(v.timeBudgetReached,true);assert.equal(v.used.vocabulary,0,'introducing is not answering');
 assert.equal(await db.reviewLog.count({where:{userId:u.id}}),0);
 const other=await fixture({count:1});const empty=await startSession(db,other.id,{now});assert.equal((await sessionView(db,other.id,empty.id,now)).timeBudgetMinutes,30);
});
const now=new Date('2026-10-06T10:00:00Z');
const distinctMeanings=['time','incident','errand','plan'];
async function fixture({count=8,kanji=false,meanings=null,studied=true}={}) {
 const sourceId=randomUUID();
 await db.source.create({data:{id:sourceId,title:'Synthetic review fixture',edition:'test',sourceType:'book',language:'ja'}});
 const entries=Array.from({length:count},(_,i)=>({source_record_key:`entry-${i}`,word:`試験${i}`,reading:`しけん${i}`,pos:'noun',sense:`test-${i}`,meanings:[meanings?.[i%meanings.length]||`test sense ${i}`],source_pdf_pages:[1],source_printed_pages:['1'],review_status:'unreviewed',issues:[],examples:[]}));
 if(kanji)entries.push({source_record_key:'kanji',character:'試',meanings:['test'],on_readings:['シ'],kun_readings:[],example_words:[],source_pdf_pages:[1],source_printed_pages:['1'],review_status:'unreviewed',issues:[],examples:[]});
 // Each importer batch has one content family. Keep kanji fixtures separate below.
 const batch=await db.importBatch.create({data:{sourceId,fileHash:randomUUID(),pageRangeJson:{},extractorVersion:'fixture',schemaVersion:1,status:'draft',stagedJson:{content_type:'vocabulary',source:{edition:'test'},entries:entries.slice(0,count),lesson_questions:[],exercise_passages:[]},validationErrorsJson:[]}});
 const records=entries.slice(0,count).map(e=>({recordKey:e.source_record_key,family:'entry',identityVerified:true,sourceVerified:true,printedPage:'1',pdfPageIndex:0,match:{mode:'create',canonicalKey:randomUUID()},typed:{writtenForm:e.word,reading:e.reading,partOfSpeech:'noun',senseKey:e.sense,meaningEn:e.meanings[0],acceptedGlossesJson:[],alternativeFormsJson:[],usageJson:{}},fieldPresence:{meanings:'supplied'},fieldOrigins:{},citations:[],kanjiLinks:[]}));
 const selection={batchId:batch.id,records};
 const preview=await previewPromotion(db,selection);
 for(const r of preview.records)await recordApproval(db,selection,r.recordKey,r.confirmationToken,'synthetic-test');
 await promote(db,selection);
 const user=await createUser(db,randomUUID(),'Asia/Calcutta');
 await syncCards(db,user.id,now);
 const keys=records.map(r=>r.match.canonicalKey);
 const items=await db.item.findMany({where:{canonicalKey:{in:keys}},select:{id:true,canonicalKey:true},take:count});
 const fixtureIds=items.sort((a,b)=>keys.indexOf(a.canonicalKey)-keys.indexOf(b.canonicalKey)).map(i=>i.id);
 // Studied items (oldest first) are what daily recall draws on; studied:false leaves only cards.
 if(studied)await db.userItem.createMany({data:fixtureIds.map((itemId,i)=>({userId:user.id,itemId,familiarity:'introduced',introducedAt:new Date(+now-(count-i)*60000)}))});
 return {...user,fixtureIds};
}
async function ready(user,time=now) {
 const s=await startSession(db,user.id,{now:time});
 let v=await sessionView(db,user.id,s.id,time);
 if(v.card.status==='new')await introduce(db,user.id,s.id,v.card.id,time);
 v=await sessionView(db,user.id,s.id,time);
 const eventId=randomUUID();
 const input={sessionId:s.id,cardId:v.card.id,stateVersion:v.card.stateVersion,clientEventId:eventId,answer:{reading:'しけん',meaning:'a valid equivalent paraphrase'}};
 await commitResponse(db,user.id,input,time);
 return {...input,rating:3,components:{readingCorrect:true,meaningCorrect:true}};
}
let glyphIndex=0;
test('flexible study completion is idempotent and preserves scheduler and first-study evidence', {skip:!enabled}, async()=>{
 assert.equal(typeof reviews.markStudied,'function');
 const u=await fixture({count:2});
 const c=await db.card.findFirst({where:{userId:u.id}});
 const before=await db.card.findMany({where:{userId:u.id},orderBy:{id:'asc'}});
 await Promise.all([reviews.markStudied(db,u.id,c.itemId,now),reviews.markStudied(db,u.id,c.itemId,new Date(+now+1000))]);
 const first=await db.userItem.findUnique({where:{userId_itemId:{userId:u.id,itemId:c.itemId}}});
 await reviews.markStudied(db,u.id,c.itemId,new Date(+now+86400000));
 assert.deepEqual(await db.userItem.findUnique({where:{userId_itemId:{userId:u.id,itemId:c.itemId}}}),first);
 assert.deepEqual(await db.card.findMany({where:{userId:u.id},orderBy:{id:'asc'}}),before);
 assert.equal(await db.reviewLog.count({where:{userId:u.id}}),0);
 assert.equal(await db.attempt.count({where:{userId:u.id}}),0);
 await db.userItem.update({where:{userId_itemId:{userId:u.id,itemId:c.itemId}},data:{familiarity:'familiar',notes:'Synthetic retained note',excludedFromTests:true}});
 const familiar=await db.userItem.findUnique({where:{userId_itemId:{userId:u.id,itemId:c.itemId}}});
 await reviews.markStudied(db,u.id,c.itemId,new Date(+now+86400000));
 assert.deepEqual(await db.userItem.findUnique({where:{userId_itemId:{userId:u.id,itemId:c.itemId}}}),familiar);
 for(const status of ['suspended','retired']){
  await db.card.update({where:{id:c.id},data:{status,dueAt:now}});
  await reviews.markStudied(db,u.id,c.itemId,now);await syncCards(db,u.id,now);
  assert.equal((await db.card.findUnique({where:{id:c.id}})).status,status);
  assert.equal(await db.card.count({where:{userId:u.id,itemId:c.itemId}}),1);
 }
});
async function coreContext(user,{context=true,meaning=true}={}) {
 const glyph=String.fromCodePoint(0x4e10+glyphIndex++),sourceId=randomUUID();
 await db.source.create({data:{id:sourceId,title:'Synthetic core kanji',edition:'test',sourceType:'book',language:'ja'}});
 const raw={source_record_key:'core',character:glyph,meanings:meaning?['synthetic meaning']:[],on_readings:['シ'],kun_readings:[],examples:[],example_words:context?[{word:`${glyph}験`,reading:'しけん',meanings:['source context sense'],source_pdf_pages:[1]}]:[],source_pdf_pages:[1],source_printed_pages:['1'],review_status:'unreviewed',issues:[]};
 const batch=await db.importBatch.create({data:{sourceId,fileHash:randomUUID(),pageRangeJson:{},extractorVersion:'fixture',schemaVersion:1,status:'draft',stagedJson:{content_type:'kanji',source:{edition:'test'},entries:[raw],lesson_questions:[],exercise_passages:[]},validationErrorsJson:[]}});
 const selection={batchId:batch.id,records:[{recordKey:'core',family:'entry',identityVerified:true,sourceVerified:true,printedPage:'1',pdfPageIndex:0,match:{mode:'create',canonicalKey:glyph},typed:{glyph,meaningsJson:raw.meanings,onReadingsJson:['シ'],kunReadingsJson:[],notes:null},fieldPresence:{meanings:meaning?'supplied':'not_supplied'},fieldOrigins:{},citations:[],kanjiLinks:[]}]};
 const preview=await previewPromotion(db,selection);await recordApproval(db,selection,'core',preview.records[0].confirmationToken,'synthetic-test');await promote(db,selection);
 const itemId=(await db.kanji.findUnique({where:{glyph}})).itemId;
 await syncCards(db,user.id,now,[itemId]);
 return itemId;
}
async function approvedGrammar(user,{withQuestion=true}={}) {
 const sourceId=randomUUID();
 await db.source.create({data:{id:sourceId,title:'Synthetic grammar',edition:'test',sourceType:'book',language:'ja'}});
 const raw={source_record_key:'pattern',pattern:'〜もの',formation:['noun + もの'],meanings:['synthetic sense'],source_pdf_pages:[1],source_printed_pages:['1'],examples:[],review_status:'unreviewed',issues:[]};
 const question={source_record_key:'cloze',prompt:'Synthetic cue: noun + ____',origin:'book',format:'fill_in_blank',options:[],answer_specification:{acceptable_answers:['もの','equivalent answer']},source_pdf_pages:[1],source_printed_pages:['1']};
 const batch=await db.importBatch.create({data:{sourceId,fileHash:randomUUID(),pageRangeJson:{},extractorVersion:'fixture',schemaVersion:1,status:'draft',stagedJson:{content_type:'grammar',source:{edition:'test'},entries:[raw],lesson_questions:[question],exercise_passages:[]},validationErrorsJson:[]}});
 const selection={batchId:batch.id,records:[{recordKey:'pattern',family:'entry',identityVerified:true,sourceVerified:true,printedPage:'1',pdfPageIndex:0,match:{mode:'create',canonicalKey:randomUUID()},typed:{pattern:'〜もの',patternVariantsJson:[],explanationJa:null,explanationEn:'synthetic sense',nuance:null,formationRulesJson:[{label:'synthetic',precedingForm:'noun',attachment:'もの',exceptions:[],sourceWording:'noun + もの'}],usageJson:{}},fieldPresence:{meanings:'supplied'},fieldOrigins:{},citations:[],kanjiLinks:[]},{recordKey:'cloze',family:'question',identityVerified:true,sourceVerified:true,printedPage:'1',pdfPageIndex:0,targets:[{recordKey:'pattern'}],answerVerified:true,targetsVerified:true}]};
 if(!withQuestion)selection.records.pop();
 const preview=await previewPromotion(db,selection);for(const r of preview.records)await recordApproval(db,selection,r.recordKey,r.confirmationToken,'synthetic-test');await promote(db,selection);
 const itemId=(await db.item.findUnique({where:{kind_canonicalKey:{kind:'grammar',canonicalKey:selection.records[0].match.canonicalKey}}})).id;
 await syncCards(db,user.id,now,[itemId]);
 return itemId;
}

test('source-complete core creates exactly one kanji objective with a reading-and-meaning cue', {skip:!enabled}, async()=>{
 const u=await fixture({meanings:distinctMeanings,studied:false});const itemId=await coreContext(u);
 const cards=await db.card.findMany({where:{userId:u.id,itemId}});
 assert.deepEqual(cards.map(c=>c.objective),['kanji_meaning']);
 assert.equal(cards[0].promptSpecJson.cue,'Choose the reading and meaning.');
 assert.equal(await db.card.count({where:{userId:u.id,objective:'kanji_reading_context'}}),0);
 const missing=await coreContext(u,{context:false});
 assert.equal(await db.card.count({where:{userId:u.id,itemId:missing,objective:'kanji_meaning'}}),1);
 const gaps=await syncCards(db,u.id,now);assert.equal(gaps.gaps.some(g=>g.itemId===missing),false,'a missing source word no longer blocks kanji recall');
});
test('pool is dormant and unresolved grammar/incidental kanji stay excluded', {skip:!enabled}, async()=>{
 const u=await fixture({count:2,kanji:true,meanings:distinctMeanings,studied:false});
 const a=await syncCards(db,u.id,now);const b=await syncCards(db,u.id,now);
 assert.equal(a.created,0);assert.equal(b.created,0);
 assert.equal(await db.userItem.count({where:{userId:u.id}}),0);
 assert.equal(await db.card.count({where:{userId:u.id,status:'active'}}),0);
 assert.equal(await db.card.count({where:{userId:u.id,objective:'grammar_cloze'}}),0);
});
test('duplicate/concurrent event has one effect; stale different event conflicts; component failure is Again', {skip:!enabled}, async()=>{
 const u=await fixture({count:2});const input=await ready(u);
 const pair=await Promise.all([rate(db,u.id,input,now),rate(db,u.id,input,now)]);
 assert.deepEqual(pair[0],pair[1]);
 assert.equal(await db.reviewLog.count({where:{userId:u.id}}),1);
 assert.equal((await db.card.findUnique({where:{id:input.cardId}})).stateVersion,1);
 const {rating:unusedRating,components:unusedComponents,...response}=input;
 const stale={...response,clientEventId:randomUUID()};
 await assert.rejects(()=>commitResponse(db,u.id,stale,now),/stale/i);
 await assert.rejects(()=>rate(db,u.id,{...input,clientEventId:randomUUID()},now),/stale/i);
 const next=await ready(u);
 assert.equal((await rate(db,u.id,{...next,rating:4,components:{readingCorrect:true,meaningCorrect:false}},now)).rating,1);
});

test('existing pool synchronization batches card lookup and preserves every card state', {skip:!enabled}, async()=>{
 const u=await fixture({count:2});
 const before=await db.card.findMany({where:{userId:u.id},orderBy:{id:'asc'}});
 let probes=0;
 const measured=db.$extends({query:{card:{findFirst({args,query}){probes++;return query(args);}}}});
 const result=await syncCards(measured,u.id,now);
 assert.equal(result.created,0);
 assert.equal(probes,0,'Existing cards must not incur one remote lookup per objective');
 assert.deepEqual(await db.card.findMany({where:{userId:u.id},orderBy:{id:'asc'}}),before);
});
test('transaction rollback leaves committed response but no orphan log or changed state', {skip:!enabled}, async()=>{
 const u=await fixture({count:1});const input=await ready(u);
 const before=await db.card.findUnique({where:{id:input.cardId}});
 // A real database failure after the review log insert, not a mocked transaction.
 await db.$executeRawUnsafe(`CREATE FUNCTION fail_review_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic rollback'; END $$`);
 await db.$executeRawUnsafe(`CREATE TRIGGER fail_review BEFORE UPDATE ON cards FOR EACH ROW WHEN (NEW.id='${input.cardId}'::uuid) EXECUTE FUNCTION fail_review_update()`);
 await assert.rejects(()=>rate(db,u.id,input,now));
 assert.equal(await db.reviewLog.count({where:{userId:u.id}}),0);
 assert.deepEqual(await db.card.findUnique({where:{id:input.cardId}}),before);
 assert.equal((await db.attempt.findUnique({where:{userId_clientEventId:{userId:u.id,clientEventId:input.clientEventId}}})).reviewLogId,null);
 await db.$executeRawUnsafe('DROP TRIGGER fail_review ON cards');
 await db.$executeRawUnsafe('DROP FUNCTION fail_review_update()');
 assert.equal((await rate(db,u.id,input,now)).stateVersion,1);
});
test('abandoned active session does not accrue wall-clock days and resume starts a fresh segment', {skip:!enabled}, async()=>{
 const u=await fixture({count:1});
 const s=await startSession(db,u.id,{now});
 await db.studySession.update({where:{id:s.id},data:{activeSince:new Date(+now-3*86400000)}});
 let v=await sessionView(db,u.id,s.id,now);
 assert.equal(v.elapsedActiveMs,0);
 assert.equal(v.idleTooLong,true);
 assert.equal(v.timeBudgetReached,false);
 await resumeSession(db,u.id,s.id,now);
 v=await sessionView(db,u.id,s.id,new Date(+now+10*60000));
 assert.equal(v.elapsedActiveMs,10*60000);
 assert.equal(v.idleTooLong,false);
 const stopped=new Date(+now+10*60000);
 await stopSession(db,u.id,s.id,stopped);
 v=await sessionView(db,u.id,s.id,new Date(+stopped+60*60000));
 assert.equal(v.elapsedActiveMs,10*60000);
});
test('stop, disconnect/restart and resume preserve committed response, selection and due dates', {skip:!enabled}, async()=>{
 const u=await fixture({count:1});const input=await ready(u);
 const selection=(await db.studySession.findUnique({where:{id:input.sessionId}})).selectionSnapshotJson;
 const before=await db.card.findMany({where:{userId:u.id},orderBy:{id:'asc'}});
 await stopSession(db,u.id,input.sessionId,now);await db.$disconnect();
 db=new PrismaClient({datasourceUrl:process.env.REVIEW_TEST_URL,errorFormat:'minimal'});
 assert.equal((await startSession(db,u.id,{now})).id,input.sessionId);
 const view=await sessionView(db,u.id,input.sessionId,now);
 assert.equal(view.attempt.clientEventId,input.clientEventId);assert.ok(view.answer);
 assert.deepEqual((await db.studySession.findUnique({where:{id:input.sessionId}})).selectionSnapshotJson,selection);
 assert.deepEqual(await db.card.findMany({where:{userId:u.id},orderBy:{id:'asc'}}),before);
});
test('caps hold across repeated sessions; due-first, heavy backlog and timezone reset', {skip:!enabled}, async()=>{
 const u=await fixture({count:12});
 await reviews.updateCaps(db,u.id,{vocabulary:5,kanji:40,grammar:10});
 for(let i=0;i<5;i++){const input=await ready(u);await rate(db,u.id,{...input,rating:4},now);}
 const session=await startSession(db,u.id,{now});
 assert.equal((await sessionView(db,u.id,session.id,now)).card,null);
 assert.equal(await db.card.count({where:{userId:u.id,introductionDay:'2026-10-06'}}),5);
 const tomorrow=new Date('2026-10-06T18:31:00Z');
 const s=await startSession(db,u.id,{now:tomorrow});
 assert.ok((await sessionView(db,u.id,s.id,tomorrow)).card);
});
test('ownership, unrevealed front and append-only logs are enforced', {skip:!enabled}, async()=>{
 const u=await fixture();const other=await createUser(db,randomUUID(),'UTC');
 const s=await startSession(db,u.id,{now});
 const front=await sessionView(db,u.id,s.id,now);
 assert.equal(front.answer,undefined);assert.equal(front.card.answerSpecJson,undefined);
 await assert.rejects(()=>sessionView(db,other.id,s.id,now),/ownership/i);
 const input=await ready(u);await rate(db,u.id,input,now);
 await assert.rejects(()=>db.reviewLog.updateMany({where:{userId:u.id},data:{rating:4}}));
});
test('a due learning card does not defer first recall of studied items', {skip:!enabled}, async()=>{
 const u=await fixture();const input=await ready(u);
 await rate(db,u.id,{...input,rating:1},now);
 const later=new Date(now.getTime()+61000);
 const v=await sessionView(db,u.id,input.sessionId,later);
 assert.ok(v.actionableDue>0);assert.equal(v.card.status,'new');assert.notEqual(v.card.id,input.cardId);
});
test('different canonical senses sharing a written-word reading are separated as siblings', {skip:!enabled}, async()=>{
 const u=await fixture({count:2});
 const groups=await db.card.findMany({where:{userId:u.id,objective:'vocab_reading_meaning'},include:{item:{include:{vocabulary:true}}}});
 const pairs=groups.filter(c=>c.item.vocabulary.writtenForm==='試験0');
 assert.ok(pairs.length>=2);
 assert.notEqual(pairs[0].itemId,pairs[1].itemId);
 assert.ok(pairs[0].siblingKey);assert.equal(pairs[0].siblingKey,pairs[1].siblingKey);
 const s=await startSession(db,u.id,{now});
 const selected=(await db.studySession.findUnique({where:{id:s.id}})).selectionSnapshotJson.entries;
 const keys=await db.card.findMany({where:{id:{in:selected.map(e=>e.cardId)},siblingKey:{not:null}},select:{siblingKey:true}});
 assert.equal(new Set(keys.map(c=>c.siblingKey)).size,keys.length);
});
test('per-type daily caps hold for vocabulary, kanji and grammar, with grammar accepted alternatives', {skip:!enabled}, async()=>{
 const u=await fixture({count:12});const grammarId=await approvedGrammar(u);
 for(const id of [await coreContext(u),await coreContext(u),await coreContext(u),grammarId,await approvedGrammar(u)])await reviews.markStudied(db,u.id,id,now);
 await reviews.updateCaps(db,u.id,{vocabulary:5,kanji:2,grammar:1});
 const s=await startSession(db,u.id,{now});
 let introduced=0;
 for(;;){const v=await sessionView(db,u.id,s.id,now);if(!v.card)break;
  const c=v.card;
  const answer=c.objective==='vocab_reading_meaning'?{reading:'synthetic',meaning:'paraphrase'}:c.objective==='kanji_meaning'?{meaning:'synthetic'}:c.objective==='kanji_reading_context'?{reading:'synthetic'}:{response:'equivalent answer'};
  const input={sessionId:s.id,cardId:c.id,stateVersion:c.stateVersion,clientEventId:randomUUID(),answer};
  await commitResponse(db,u.id,input,now);introduced++;await rate(db,u.id,{...input,rating:4,components:c.objective==='vocab_reading_meaning'?{readingCorrect:true,meaningCorrect:true}:{correct:true}},now);
 }
 assert.equal(introduced,8);
 const counts=(await sessionView(db,u.id,s.id,now)).used;
 assert.deepEqual(counts,{vocabulary:5,kanji:2,grammar:1});
 const grammar=await db.card.findFirst({where:{userId:u.id,itemId:grammarId}});
 assert.deepEqual(grammar.answerSpecJson.alternatives,['equivalent answer']);
});
test('heavy backlog no longer blocks first recall and preserves overdue dates', {skip:!enabled}, async()=>{
 const u=await fixture({count:45});
 const cards=await db.card.findMany({where:{userId:u.id,status:'new',itemId:{in:u.fixtureIds.slice(0,41)}}});
 await db.card.updateMany({where:{id:{in:cards.map(c=>c.id)}},data:{status:'active',dueAt:now,fsrsStateJson:{...cards[0].fsrsStateJson,due:now.toISOString()},introducedAt:new Date('2026-10-05T10:00:00Z'),introductionDay:'2026-10-05'}});
 const before=await db.card.findMany({where:{userId:u.id,status:'active'},select:{id:true,dueAt:true},orderBy:{id:'asc'}});
 const s=await startSession(db,u.id,{now});const v=await sessionView(db,u.id,s.id,now);
 assert.equal(v.card.status,'new');
 const roles=(await db.studySession.findUnique({where:{id:s.id}})).selectionSnapshotJson.entries.map(e=>e.role);
 assert.equal(roles.filter(x=>x==='new').length,4);assert.equal(roles.filter(x=>x==='review').length,41);
 assert.deepEqual(await db.card.findMany({where:{userId:u.id,status:'active'},select:{id:true,dueAt:true},orderBy:{id:'asc'}}),before);
});
test('a kanji meaning success never propagates scheduler state to other cards', {skip:!enabled}, async()=>{
 const u=await fixture({count:1,studied:false});const itemId=await coreContext(u);
 await reviews.markStudied(db,u.id,itemId,now);
 const others=await db.card.findMany({where:{userId:u.id,itemId:{not:itemId}},orderBy:{id:'asc'}});
 const s=await startSession(db,u.id,{now});const v=await sessionView(db,u.id,s.id,now);
 assert.equal(v.card.objective,'kanji_meaning');
 const input={sessionId:s.id,cardId:v.card.id,stateVersion:0,clientEventId:randomUUID(),answer:{meaning:'synthetic meaning'}};
 await commitResponse(db,u.id,input,now);await rate(db,u.id,{...input,rating:3,components:{correct:true}},now);
 const after=await db.card.findMany({where:{userId:u.id,itemId:{not:itemId}},orderBy:{id:'asc'}});
 assert.deepEqual(after.map(c=>[c.id,c.stateVersion,c.fsrsStateJson,c.dueAt]),others.map(c=>[c.id,c.stateVersion,c.fsrsStateJson,c.dueAt]));
});

test('approved grammar comparisons are reciprocal, validated and read-only; reveal uses stored formation', {skip:!enabled}, async()=>{
 const u=await fixture({count:1,meanings:distinctMeanings,studied:false});const a=await approvedGrammar(u),b=await approvedGrammar(u);
 const comparisonId=randomUUID(),examples=[randomUUID(),randomUUID()];
 await db.$transaction(async tx=>{
  for(const [i,itemId] of [a,b].entries())await tx.content.create({data:{id:examples[i],kind:'sentence',origin:'user',status:'approved',revision:1,payloadJson:{japanese:`synthetic example ${i}`,translation:`meaning ${i}`},items:{create:{itemId,role:'target'}}}});
  await tx.content.create({data:{id:comparisonId,kind:'explanation',origin:'user',status:'approved',revision:1,payloadJson:{explanationType:'grammar_comparison',grammarItemIds:[a,b],difference:'synthetic checked distinction',examples:[a,b].map((grammarItemId,i)=>({grammarItemId,contentId:examples[i]}))},items:{create:[{itemId:a,role:'target'},{itemId:b,role:'target'}]}}});
 });
 const before=await db.card.findMany({where:{userId:u.id},orderBy:{id:'asc'}});
 assert.deepEqual(await grammarComparisons(db,a),await grammarComparisons(db,b));
 assert.equal((await grammarComparisons(db,a)).length,1);
 const card=before.find(c=>c.itemId===a);const back=await studyContent(db,card);assert.equal(back.grammar.guidanceLabel,'General guidance');assert.deepEqual(back.grammar.formation,['noun + もの']);
 assert.deepEqual(await db.card.findMany({where:{userId:u.id},orderBy:{id:'asc'}}),before);
 assert.equal(await db.userItem.count({where:{userId:u.id}}),0);
 await assert.rejects(()=>db.content.create({data:{kind:'explanation',origin:'user',status:'approved',revision:1,payloadJson:{explanationType:'grammar_comparison',grammarItemIds:[a,a],difference:'bad',examples:[]}}}));
 const draft=await db.content.create({data:{kind:'explanation',origin:'user',status:'draft',revision:1,payloadJson:{explanationType:'grammar_comparison'},items:{create:{itemId:a,role:'target'}}}});
 assert.ok(draft);assert.equal((await grammarComparisons(db,a)).length,1);
 // This scenario selects its own comparison targets, not cards from earlier fixtures.
 await db.card.updateMany({where:{userId:u.id,itemId:{notIn:[a,b]}},data:{buriedUntil:new Date(+now+86400000)}});
 await reviews.markStudied(db,u.id,a,now);
 const session=await startSession(db,u.id,{now});let view=await sessionView(db,u.id,session.id,now);
 assert.equal(view.card.objective,'grammar_cloze');assert.equal(view.study,undefined);
 const first=await introduce(db,u.id,session.id,view.card.id,now);assert.ok(first.study.grammar.formation.length);
 view=await sessionView(db,u.id,session.id,now);assert.equal(view.study,undefined);
 await commitResponse(db,u.id,{sessionId:session.id,cardId:view.card.id,stateVersion:0,clientEventId:randomUUID(),answer:{response:'もの'}},now);
 view=await sessionView(db,u.id,session.id,now);assert.equal(view.study.grammar.guidanceLabel,'General guidance');
 assert.equal(await db.reviewLog.count({where:{userId:u.id}}),0);
});

test('existing hash-approved import publishes a curated comparison to both grammar details', {skip:!enabled}, async()=>{
 const u=await fixture({count:1}),a=await approvedGrammar(u),b=await approvedGrammar(u);
 const examples=[];for(const itemId of [a,b]){const sentence=await db.content.create({data:{kind:'sentence',origin:'user',status:'approved',revision:1,payloadJson:{japanese:'synthetic approved example'},items:{create:{itemId,role:'target'}}}});examples.push({grammarItemId:itemId,contentId:sentence.id});}
 const evidence=await db.sourceEntry.findFirst({where:{itemId:a,importBatchId:{not:null}}});const original=await db.importBatch.findUnique({where:{id:evidence.importBatchId}});
 const batch=await db.importBatch.create({data:{sourceId:original.sourceId,fileHash:randomUUID(),pageRangeJson:{},extractorVersion:'fixture',schemaVersion:1,status:'draft',stagedJson:original.stagedJson,validationErrorsJson:[]}});
 const {itemId:unused,...typed}=await db.grammar.findUnique({where:{itemId:a}});
 const selection={batchId:batch.id,records:[{recordKey:'pattern',family:'entry',identityVerified:true,sourceVerified:true,printedPage:'1',pdfPageIndex:0,match:{mode:'reuse',itemId:a,expectedRevision:1},typed,fieldPresence:{meanings:'supplied'},fieldOrigins:{},citations:[],kanjiLinks:[],additions:[{key:'comparison',origin:'generated',unresolved:false,citations:[],payload:{explanationType:'grammar_comparison',grammarItemIds:[a,b],difference:'synthetic human-approved comparison',examples}}]}]};
 await assert.rejects(()=>previewPromotion(db,{...selection,records:[{...selection.records[0],match:{mode:'correct',itemId:a,expectedRevision:1}}]}),/corrections separately/);
 const preview=await previewPromotion(db,selection);await recordApproval(db,selection,'pattern',preview.records[0].confirmationToken,'synthetic-test');
 const secondEvidence=await db.sourceEntry.findFirst({where:{itemId:b,importBatchId:{not:null}}});const secondOriginal=await db.importBatch.findUnique({where:{id:secondEvidence.importBatchId}});
 const correctionBatch=await db.importBatch.create({data:{sourceId:secondOriginal.sourceId,fileHash:randomUUID(),pageRangeJson:{},extractorVersion:'fixture',schemaVersion:1,status:'draft',stagedJson:secondOriginal.stagedJson,validationErrorsJson:[]}});
 const {itemId:ignored,...secondTyped}=await db.grammar.findUnique({where:{itemId:b}});
 const correction={batchId:correctionBatch.id,records:[{...selection.records[0],match:{mode:'correct',itemId:b,expectedRevision:1},typed:{...secondTyped,explanationEn:'synthetic corrected guidance'},additions:[]}]};
 const correctionPreview=await previewPromotion(db,correction);await recordApproval(db,correction,'pattern',correctionPreview.records[0].confirmationToken,'synthetic-test');await promote(db,correction);
 await assert.rejects(()=>promote(db,selection),/approval/i);
 const refreshed=await previewPromotion(db,selection);assert.notEqual(refreshed.records[0].confirmationToken,preview.records[0].confirmationToken);
 await recordApproval(db,selection,'pattern',refreshed.records[0].confirmationToken,'synthetic-test');await promote(db,selection);
 assert.equal((await grammarComparisons(db,a)).length,1);assert.deepEqual(await grammarComparisons(db,a),await grammarComparisons(db,b));
 const before=await db.content.count();await promote(db,selection);assert.equal(await db.content.count(),before);
 const laterBatch=await db.importBatch.create({data:{sourceId:secondOriginal.sourceId,fileHash:randomUUID(),pageRangeJson:{},extractorVersion:'fixture',schemaVersion:1,status:'draft',stagedJson:secondOriginal.stagedJson,validationErrorsJson:[]}});
 const later={...correction,batchId:laterBatch.id,records:[{...correction.records[0],match:{mode:'correct',itemId:b,expectedRevision:2},typed:{...secondTyped,explanationEn:'synthetic later correction'}}]};
 const laterPreview=await previewPromotion(db,later);await recordApproval(db,later,'pattern',laterPreview.records[0].confirmationToken,'synthetic-test');await promote(db,later);
 assert.equal((await grammarComparisons(db,a)).length,0);assert.equal((await grammarComparisons(db,b)).length,0);
});

test('flexible waiting pool is oldest first, represents partial kanji and exposes missing grammar/context', {skip:!enabled},async()=>{
 const u=await fixture({count:2,studied:false});const oldest=u.fixtureIds[1];
 await reviews.markStudied(db,u.id,oldest,new Date(+now-86400000));await reviews.markStudied(db,u.id,u.fixtureIds[0],now);
 const s=await startSession(db,u.id,{now});assert.equal((await sessionView(db,u.id,s.id,now)).card.itemId,oldest);
 const ku=await fixture({count:1,studied:false}),core=await coreContext(ku),missing=await coreContext(ku,{context:false}),grammar=await approvedGrammar(ku,{withQuestion:false});
 for(const id of [core,missing,grammar])await reviews.markStudied(db,ku.id,id,now);
 const ks=await startSession(db,ku.id,{now});const v=await sessionView(db,ku.id,ks.id,now);
 await introduce(db,ku.id,ks.id,v.card.id,now);
 const d=await dashboard(db,ku.id,now);assert.equal(d.partialItems,0);assert.equal(d.blockedItems,1);assert.equal(d.missingObjectives,1);
 const st=await reviews.studyStatus(db,ku.id,core);assert.equal(st.waiting,0);assert.equal(st.active,1);
 assert.deepEqual((await reviews.studyStatus(db,ku.id,grammar)).missing,['grammar_cloze']);
 assert.deepEqual((await reviews.studyStatus(db,ku.id,missing)).missing,[]);
});
test('parallel starts share one session, double introduce has one effect, and re-marking keeps cards', {skip:!enabled},async()=>{
 const u=await fixture({count:3});
 const pair=await Promise.all([startSession(db,u.id,{now}),startSession(db,u.id,{now})]);assert.equal(pair[0].id,pair[1].id);
 const s=pair[0],v=await sessionView(db,u.id,s.id,now);
 await Promise.all([introduce(db,u.id,s.id,v.card.id,now),introduce(db,u.id,s.id,v.card.id,now)]);
 assert.equal(await db.card.count({where:{userId:u.id,status:'active'}}),1);
 const before=await db.card.findMany({where:{userId:u.id},orderBy:{id:'asc'}});
 await reviews.markStudied(db,u.id,v.card.itemId,new Date(+now+1000));assert.deepEqual(await db.card.findMany({where:{userId:u.id},orderBy:{id:'asc'}}),before);
});

test('flexible study records 135 items and 135 dormant objectives without synthetic recall', {skip:!enabled},async()=>{
 const u=await fixture({count:100,studied:false}),ids=[...u.fixtureIds];
 for(let i=0;i<30;i++)ids.push(await coreContext(u));
 for(let i=0;i<5;i++)ids.push(await approvedGrammar(u));
 const before=await db.card.findMany({where:{userId:u.id},orderBy:{id:'asc'}});
 for(const id of ids)await reviews.markStudied(db,u.id,id,now);
 assert.equal(await db.userItem.count({where:{userId:u.id,introducedAt:{not:null}}}),135);
 const after=await db.card.findMany({where:{userId:u.id},orderBy:{id:'asc'}});assert.deepEqual(after,before);
 const d=await dashboard(db,u.id,now);assert.equal(d.studiedToday,135);assert.equal(d.waitingItems,135);assert.equal(d.waitingObjectives,135);assert.deepEqual(d.used,{vocabulary:0,kanji:0,grammar:0});
 assert.equal(await db.card.count({where:{userId:u.id,status:'active'}}),0);assert.equal(await db.attempt.count({where:{userId:u.id}}),0);assert.equal(await db.reviewLog.count({where:{userId:u.id}}),0);
});

test('choice recall exposes four options, hides the answer snapshot, and grades both components server-side', {skip:!enabled}, async()=>{
 const u=await fixture({count:4,meanings:distinctMeanings});
 const s=await startSession(db,u.id,{now});
 let v=await sessionView(db,u.id,s.id,now);
 await introduce(db,u.id,s.id,v.card.id,now);
 v=await sessionView(db,u.id,s.id,now);
 assert.ok(v.recall);
 assert.equal(v.recall.choices.length,4);
 assert.equal(v.answer,undefined);
 assert.equal(v.card.answerSpecJson,undefined);
 assert.equal('correctChoiceId' in v.recall,false);
 assert.equal(v.recall.choices.some(choice=>'tier' in choice),false);
 const card=await db.card.findUnique({where:{id:v.card.id}});
 const correct=v.recall.choices.find(choice=>choice.reading===card.answerSpecJson.reading&&choice.meaning===card.answerSpecJson.meaning);
 assert.ok(correct,'the correct pair is one of the four options');
 const input={sessionId:s.id,cardId:v.card.id,stateVersion:v.card.stateVersion,clientEventId:randomUUID(),answer:{choiceId:correct.id,choiceFingerprint:v.recall.fingerprint}};
 const committed=await commitResponse(db,u.id,input,now);
 assert.equal(committed.grader,'objective');
 assert.deepEqual(await commitResponse(db,u.id,input,now),committed,'choice retry is idempotent');
 const attempt=await db.attempt.findUnique({where:{userId_clientEventId:{userId:u.id,clientEventId:input.clientEventId}}});
 assert.equal(attempt.grader,'objective');
 assert.equal(attempt.feedbackJson.readingCorrect,true);
 assert.equal(attempt.feedbackJson.meaningCorrect,true);
 assert.equal(attempt.promptSnapshotJson.choices.length,4);
 const reveal=await sessionView(db,u.id,s.id,now);
 assert.equal(reveal.recall,null);
 assert.equal(reveal.attempt.choice.reading,correct.reading);
 assert.equal(reveal.attempt.choice.meaning,correct.meaning);
 assert.equal(reveal.attempt.components.correct,true);
 assert.equal(await rate(db,u.id,{...input,rating:4,components:{}},now).then(r=>r.rating),3,'choice mode caps Easy at Good');
});

test('a new card can be answered before study and its first commit activates it', {skip:!enabled}, async()=>{
 const u=await fixture({count:4,meanings:distinctMeanings});
 const s=await startSession(db,u.id,{now});
 let v=await sessionView(db,u.id,s.id,now);
 assert.equal(v.card.status,'new');
 assert.ok(v.recall,'a new card offers the recall choice before any answer is revealed');
 assert.equal(v.answer,undefined);
 const card=await db.card.findUnique({where:{id:v.card.id}});
 const correct=v.recall.choices.find(choice=>choice.reading===card.answerSpecJson.reading&&choice.meaning===card.answerSpecJson.meaning);
 assert.ok(correct,'the correct pair is one of the four options');
 const input={sessionId:s.id,cardId:v.card.id,stateVersion:v.card.stateVersion,clientEventId:randomUUID(),answer:{choiceId:correct.id,choiceFingerprint:v.recall.fingerprint}};
 assert.equal((await commitResponse(db,u.id,input,now)).grader,'objective');
 const active=await db.card.findUnique({where:{id:v.card.id}});
 assert.equal(active.status,'active');
 assert.equal(active.introducedAt.toISOString(),now.toISOString());
 assert.equal(active.dueAt.toISOString(),now.toISOString());
 const learner=await db.userItem.findUnique({where:{userId_itemId:{userId:u.id,itemId:v.card.itemId}}});
 assert.equal(learner.introducedAt.toISOString(),new Date(+now-4*60000).toISOString(),'the original study date is preserved');
 assert.equal(learner.familiarity,'introduced');
 const reveal=await sessionView(db,u.id,s.id,now);
 assert.equal(reveal.answer.reading,card.answerSpecJson.reading);
 assert.equal(reveal.attempt.components.correct,true);
 assert.ok('study' in reveal);
 assert.equal((await rate(db,u.id,{...input,rating:3,components:{}},now)).rating,3);
 assert.equal(await db.reviewLog.count({where:{userId:u.id}}),1);
});
test('a wrong component forces Again and a stale choice fingerprint is rejected', {skip:!enabled}, async()=>{
 const u=await fixture({count:4,meanings:distinctMeanings});
 const s=await startSession(db,u.id,{now});
 let v=await sessionView(db,u.id,s.id,now);
 await introduce(db,u.id,s.id,v.card.id,now);
 v=await sessionView(db,u.id,s.id,now);
 const card=await db.card.findUnique({where:{id:v.card.id}});
 const partial=v.recall.choices.find(choice=>choice.reading===card.answerSpecJson.reading&&choice.meaning!==card.answerSpecJson.meaning);
 assert.ok(partial,'a same-reading decoy must exist');
 const input={sessionId:s.id,cardId:v.card.id,stateVersion:v.card.stateVersion,clientEventId:randomUUID(),answer:{choiceId:partial.id,choiceFingerprint:v.recall.fingerprint}};
 await commitResponse(db,u.id,input,now);
 assert.equal((await rate(db,u.id,{...input,rating:4,components:{readingCorrect:true,meaningCorrect:true}},now)).rating,1);
 const next=await fixture({count:4,meanings:distinctMeanings});
 const ns=await startSession(db,next.id,{now});
 let nv=await sessionView(db,next.id,ns.id,now);
 await introduce(db,next.id,ns.id,nv.card.id,now);
 nv=await sessionView(db,next.id,ns.id,now);
 const stale={sessionId:ns.id,cardId:nv.card.id,stateVersion:nv.card.stateVersion,clientEventId:randomUUID(),answer:{choiceId:nv.recall.choices[0].id,choiceFingerprint:'0000000000000000'}};
 await assert.rejects(()=>commitResponse(db,next.id,stale,now),/changed|offered/i);
});

// Sprint recall (26 Oct 2026): daily caps, 70/30 split and retrievability order.
function reviewedState(days,base=new Date(+now-90*86400000)) {
 let state=initialState(base);
 for(const d of days)state=schedule(state,new Date(+base+d*86400000),3,configuration()).card;
 return state;
}
async function makeDue(cardIds,state) {
 // The card_due_state constraint ties dueAt to the FSRS state's own due date.
 const dueAt=new Date(state.due);assert.ok(dueAt<=now);
 await db.card.updateMany({where:{id:{in:cardIds}},data:{status:'active',dueAt,fsrsStateJson:state,introducedAt:new Date(+now-30*86400000),introductionDay:'2026-09-06'}});
}
async function answerAll(user,sessionId,time) {
 let answered=0;
 for(;;){const v=await sessionView(db,user.id,sessionId,time);if(!v.card)return answered;
  const input={sessionId,cardId:v.card.id,stateVersion:v.card.stateVersion,clientEventId:randomUUID(),answer:{reading:'synthetic',meaning:'paraphrase'}};
  await commitResponse(db,user.id,input,time);await rate(db,user.id,{...input,rating:4,components:{readingCorrect:true,meaningCorrect:true}},time);answered++;}
}
test('thirty studied vocabulary all enter one session beyond the old allowance', {skip:!enabled}, async()=>{
 const u=await fixture({count:30});
 const s=await startSession(db,u.id,{now});
 assert.equal((await sessionView(db,u.id,s.id,now)).total,30);
});
test('cap holds across two sessions in one study day and resets at local midnight', {skip:!enabled}, async()=>{
 const u=await fixture({count:6});
 await reviews.updateCaps(db,u.id,{vocabulary:3,kanji:40,grammar:10});
 const late=new Date('2026-10-06T18:20:00Z'),after=new Date('2026-10-06T18:40:00Z');// 23:50 and 00:10 IST
 const s=await startSession(db,u.id,{now:late});assert.equal(await answerAll(u,s.id,late),3);
 const again=await startSession(db,u.id,{now:late});assert.equal((await sessionView(db,u.id,again.id,late)).card,null);
 assert.deepEqual((await dashboard(db,u.id,late)).used,{vocabulary:3,kanji:0,grammar:0});
 const next=await startSession(db,u.id,{now:after});assert.ok((await sessionView(db,u.id,next.id,after)).card);
 assert.equal((await dashboard(db,u.id,after)).used.vocabulary,0);
});
test('70/30 split mixes first-recall and due cards, first recall first', {skip:!enabled}, async()=>{
 const u=await fixture({count:20});
 await reviews.updateCaps(db,u.id,{vocabulary:10,kanji:40,grammar:10});
 const due=await db.card.findMany({where:{userId:u.id,itemId:{in:u.fixtureIds.slice(10)}},select:{id:true}});
 await makeDue(due.map(c=>c.id),reviewedState([0,2]));
 await db.userItem.updateMany({where:{userId:u.id,itemId:{in:u.fixtureIds.slice(10)}},data:{introducedAt:new Date(+now-30*86400000)}});
 const s=await startSession(db,u.id,{now});
 const roles=(await db.studySession.findUnique({where:{id:s.id}})).selectionSnapshotJson.entries.map(e=>e.role);
 assert.deepEqual(roles,[...Array(7).fill('new'),...Array(3).fill('review')]);
});
test('due cards come lowest retrievability first', {skip:!enabled}, async()=>{
 const u=await fixture({count:2,studied:false});
 const [a,b]=await Promise.all(u.fixtureIds.map(itemId=>db.card.findFirst({where:{userId:u.id,itemId}})));
 await makeDue([a.id],reviewedState([0,1,5,15]));await makeDue([b.id],reviewedState([0]));
 const s=await startSession(db,u.id,{now});
 assert.deepEqual((await db.studySession.findUnique({where:{id:s.id}})).selectionSnapshotJson.entries.map(e=>e.cardId),[b.id,a.id]);
});
test('daily caps validate, persist and show on the dashboard', {skip:!enabled}, async()=>{
 const u=await fixture({count:2});
 await assert.rejects(()=>reviews.updateCaps(db,u.id,{vocabulary:301,kanji:40,grammar:10}));
 await assert.rejects(()=>reviews.updateCaps(db,u.id,{vocabulary:-1,kanji:40,grammar:10}));
 let d=await dashboard(db,u.id,now);assert.deepEqual(d.caps,{vocabulary:100,kanji:40,grammar:10});assert.equal(d.waitingFirstRecall,2);assert.equal(d.reviewMoreAvailable,false);
 await reviews.updateCaps(db,u.id,{vocabulary:50,kanji:20,grammar:5});
 d=await dashboard(db,u.id,now);assert.deepEqual(d.caps,{vocabulary:50,kanji:20,grammar:5});
});
async function answer(user,sessionId,v,time,rating=4) {
 const input={sessionId,cardId:v.card.id,stateVersion:v.card.stateVersion,clientEventId:randomUUID(),answer:{reading:'synthetic',meaning:'paraphrase'}};
 await commitResponse(db,user.id,input,time);
 const ok=rating>1;
 await rate(db,user.id,{...input,rating,components:{readingCorrect:ok,meaningCorrect:ok}},time);
 return input;
}
const entriesOf=async id=>(await db.studySession.findUnique({where:{id}})).selectionSnapshotJson.entries;
test('an Again card returns once at the end of the session as a genuine second review', {skip:!enabled}, async()=>{
 const u=await fixture({count:2});
 const s=await startSession(db,u.id,{now});
 let v=await sessionView(db,u.id,s.id,now);const first=v.card.id;
 await answer(u,s.id,v,now,1);
 const snapshot=await entriesOf(s.id);
 v=await sessionView(db,u.id,s.id,now);assert.equal(v.total,3);assert.notEqual(v.card.id,first);await answer(u,s.id,v,now);
 const t=new Date(+now+2000);// before the 1-minute learning step: early review inside the session is allowed
 v=await sessionView(db,u.id,s.id,t);assert.equal(v.card.id,first);assert.equal(v.card.role,'again');
 await answer(u,s.id,v,t,1);
 assert.equal(await db.reviewLog.count({where:{cardId:first}}),2);
 assert.deepEqual(await entriesOf(s.id),snapshot,'the saved selection itself stays immutable');
 v=await sessionView(db,u.id,s.id,t);assert.equal(v.card,null);assert.equal(v.completed,3);assert.equal(v.total,3,'a second Again does not re-queue again');
});
test('replaying the same Again rating event does not re-queue twice', {skip:!enabled}, async()=>{
 const u=await fixture({count:2});
 const s=await startSession(db,u.id,{now});const v=await sessionView(db,u.id,s.id,now);
 const input={sessionId:s.id,cardId:v.card.id,stateVersion:v.card.stateVersion,clientEventId:randomUUID(),answer:{reading:'x',meaning:'y'}};
 await commitResponse(db,u.id,input,now);
 const rated={...input,rating:1,components:{readingCorrect:false,meaningCorrect:false}};
 await Promise.all([rate(db,u.id,rated,now),rate(db,u.id,rated,now)]);await rate(db,u.id,rated,now);
 assert.equal((await sessionView(db,u.id,s.id,now)).total,3);
});
async function makeActive(cardIds,state) {
 await db.card.updateMany({where:{id:{in:cardIds}},data:{status:'active',dueAt:new Date(state.due),fsrsStateJson:state,introducedAt:new Date(+now-30*86400000),introductionDay:'2026-09-06'}});
}
test('review more serves not-due cards lowest retrievability first and writes genuine logs', {skip:!enabled}, async()=>{
 const u=await fixture({count:3,studied:false});
 const [a,b]=await Promise.all(u.fixtureIds.slice(0,2).map(itemId=>db.card.findFirst({where:{userId:u.id,itemId}})));
 const base=new Date(+now-2*86400000);
 const strong=reviewedState([0,1],base),weak=reviewedState([0,1.9],base);
 assert.ok(new Date(strong.due)>now&&new Date(weak.due)>now);
 await makeActive([a.id],weak);await makeActive([b.id],strong);
 const s=await startSession(db,u.id,{now,reviewMore:true});
 const session=await db.studySession.findUnique({where:{id:s.id}});
 assert.equal(session.selectionSnapshotJson.mode,'more');
 const order=session.selectionSnapshotJson.entries.map(e=>e.cardId);
 const ra=retrievability(weak,now,configuration()),rb=retrievability(strong,now,configuration());assert.notEqual(ra,rb);
 assert.deepEqual(order,ra<rb?[a.id,b.id]:[b.id,a.id]);
 assert.equal(await answerAll(u,s.id,now),2);
 assert.equal(await db.reviewLog.count({where:{userId:u.id}}),2);
});
test('review more with no not-due cards returns no session', {skip:!enabled}, async()=>{
 const u=await fixture({count:1});
 assert.deepEqual(await startSession(db,u.id,{now,reviewMore:true}),{id:null});
 assert.equal(await db.studySession.count({where:{userId:u.id}}),0);
});
test('a version-1 snapshot session still renders, accepts an answer and completes', {skip:!enabled}, async()=>{
 const u=await fixture({count:1});
 const c=await db.card.findFirst({where:{userId:u.id,itemId:u.fixtureIds[0]}});
 const s=await db.studySession.create({data:{userId:u.id,startedAt:now,activeSince:now,selectionSeed:randomUUID(),selectionSnapshotJson:{policyVersion:1,studyDay:'2026-10-06',includeNew:true,introductionsPaused:false,entries:[{cardId:c.id,stateVersion:0,role:'new'}]}}});
 let v=await sessionView(db,u.id,s.id,now);assert.equal(v.card.id,c.id);
 await answer(u,s.id,v,now);
 v=await sessionView(db,u.id,s.id,now);assert.equal(v.card,null);assert.equal(v.completed,1);
});

test('retire step retires reading cards, keeps their logs, and is idempotent', {skip:!enabled}, async()=>{
 const u=await fixture({count:1,studied:false});const itemId=await coreContext(u);
 const meaning=await db.card.findFirst({where:{userId:u.id,itemId}});
 // A legacy row as earlier releases created it; its source-word chain is irrelevant to retiring, so the
 // isolated synthetic test database skips integrity triggers for this one insert.
 const reading=await db.$transaction(async tx=>{await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica');
  return tx.card.create({data:{userId:u.id,itemId,objective:'kanji_reading_context',promptSpecJson:{...meaning.promptSpecJson,cue:'legacy'},answerSpecJson:{reading:'し'},fsrsStateJson:meaning.fsrsStateJson}});});
 const other=await coreContext(u);const otherMeaning=await db.card.findFirst({where:{userId:u.id,itemId:other}});
 // A never-reviewed legacy card (status new, no due date) must retire too.
 const unseen=await db.$transaction(async tx=>{await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica');
  return tx.card.create({data:{userId:u.id,itemId:other,objective:'kanji_reading_context',promptSpecJson:{...otherMeaning.promptSpecJson,cue:'legacy'},answerSpecJson:{reading:'し'},fsrsStateJson:otherMeaning.fsrsStateJson}});});
 await reviews.markStudied(db,u.id,itemId,now);
 const s=await db.studySession.create({data:{userId:u.id,startedAt:now,activeSince:now,selectionSeed:randomUUID(),selectionSnapshotJson:{policyVersion:2,mode:'daily',studyDay:'2026-10-06',entries:[{cardId:reading.id,stateVersion:0,role:'new'}]}}});
 const input={sessionId:s.id,cardId:reading.id,stateVersion:0,clientEventId:randomUUID(),answer:{reading:'し'}};
 await commitResponse(db,u.id,input,now);await rate(db,u.id,{...input,rating:3,components:{correct:true}},now);
 const logs=await db.reviewLog.count({where:{cardId:reading.id}});assert.equal(logs,1);
 assert.deepEqual(await retireKanjiReadingCards(db,{apply:false}),{found:2,retired:0,apply:false});
 assert.equal((await db.card.findUnique({where:{id:reading.id}})).status,'active');
 assert.deepEqual(await retireKanjiReadingCards(db,{apply:true}),{found:2,retired:2,apply:true});
 assert.equal((await db.card.findUnique({where:{id:reading.id}})).status,'retired');
 const u2=await db.card.findUnique({where:{id:unseen.id}});assert.equal(u2.status,'retired');assert.equal(u2.stateVersion,0);assert.equal(u2.dueAt.toISOString(),new Date(unseen.fsrsStateJson.due).toISOString());
 assert.deepEqual(await retireKanjiReadingCards(db,{apply:true}),{found:0,retired:0,apply:true});
 assert.equal(await db.reviewLog.count({where:{cardId:reading.id}}),logs);
 assert.equal((await db.card.findUnique({where:{id:meaning.id}})).status,'new');
});

// Match practice (read-only).
const footprint=async userId=>({attempts:await db.attempt.count({where:{userId}}),logs:await db.reviewLog.count({where:{userId}}),sessions:await db.studySession.count({where:{userId}}),cards:JSON.stringify(await db.card.findMany({where:{userId},orderBy:{id:'asc'}})),items:JSON.stringify(await db.userItem.findMany({where:{userId},orderBy:{itemId:'asc'}}))});
test('match draws every studied card, pending in-session ones included, and writes nothing', {skip:!enabled}, async()=>{
 const u=await fixture({count:8});
 const cards=await Promise.all(u.fixtureIds.map(itemId=>db.card.findFirst({where:{userId:u.id,itemId}})));
 await makeActive(cards.slice(0,4).map(c=>c.id),reviewedState([0,1],new Date(+now-2*86400000)));
 await makeActive([cards[4].id],reviewedState([0,1,5,15]));// due before now: still eligible
 await db.userItem.delete({where:{userId_itemId:{userId:u.id,itemId:cards[7].itemId}}});// not studied
 const pending=await db.studySession.create({data:{userId:u.id,startedAt:now,activeSince:now,selectionSeed:randomUUID(),selectionSnapshotJson:{policyVersion:2,mode:'more',studyDay:'2026-10-06',entries:[{cardId:cards[0].id,stateVersion:0,role:'review'}]}}});
 assert.ok(pending.id);
 const before=await footprint(u.id);
 const candidates=await matchCandidates(db,u.id,'vocabulary');
 assert.deepEqual(new Set(candidates.map(c=>c.id)),new Set(cards.slice(0,7).map(c=>c.id)));
 const card=await db.card.findUnique({where:{id:cards[1].id}});
 const one=candidates.find(c=>c.id===card.id);assert.equal(one.prompt,card.promptSpecJson.text);assert.equal(one.answer,`${card.answerSpecJson.reading} · ${card.answerSpecJson.meaning}`);
 const result=await matchPairs(db,u.id,'vocabulary');assert.equal(result.kind,'vocabulary');
 for(let i=0;i<2;i++)await matchPairs(db,u.id,'kanji');
 assert.deepEqual(await footprint(u.id),before);
});
test('kanji match answer pairs the hiragana reading with the meaning', {skip:!enabled}, async()=>{
 const u=await fixture({count:1,studied:false});const itemId=await coreContext(u);
 const card=await db.card.findFirst({where:{userId:u.id,itemId}});
 await db.userItem.upsert({where:{userId_itemId:{userId:u.id,itemId}},create:{userId:u.id,itemId,familiarity:'introduced',introducedAt:now},update:{introducedAt:now}});
 const [candidate]=await matchCandidates(db,u.id,'kanji');
 assert.equal(candidate.prompt,card.promptSpecJson.text);assert.equal(candidate.answer,'し · synthetic meaning');
});

// Final review fixes.
test('an open session from an earlier study day is completed and today gets a fresh queue', {skip:!enabled}, async()=>{
 const u=await fixture({count:4});
 const s=await startSession(db,u.id,{now});const v=await sessionView(db,u.id,s.id,now);await answer(u,s.id,v,now);
 const tomorrow=new Date('2026-10-07T04:00:00Z');
 assert.equal((await dashboard(db,u.id,tomorrow)).sessionId,null,'yesterday\'s session is not offered as today\'s block');
 const next=await startSession(db,u.id,{now:tomorrow});
 assert.notEqual(next.id,s.id);
 assert.equal((await db.studySession.findUnique({where:{id:s.id}})).status,'completed');
 assert.equal((await db.studySession.findUnique({where:{id:next.id}})).selectionSnapshotJson.studyDay,'2026-10-07');
 assert.ok((await sessionView(db,u.id,next.id,tomorrow)).card);
});
test('review-more answers do not use up the daily cap', {skip:!enabled}, async()=>{
 const u=await fixture({count:4,studied:false});
 const cards=await Promise.all(u.fixtureIds.map(itemId=>db.card.findFirst({where:{userId:u.id,itemId}})));
 await makeActive(cards.slice(0,2).map(c=>c.id),reviewedState([0,1],new Date(+now-2*86400000)));
 await reviews.updateCaps(db,u.id,{vocabulary:2,kanji:40,grammar:10});
 const more=await startSession(db,u.id,{now,reviewMore:true});assert.equal(await answerAll(u,more.id,now),2);
 for(const id of u.fixtureIds.slice(2))await reviews.markStudied(db,u.id,id,now);
 const daily=await startSession(db,u.id,{now});
 assert.equal((await sessionView(db,u.id,daily.id,now)).total,2);
 assert.deepEqual((await dashboard(db,u.id,now)).used,{vocabulary:0,kanji:0,grammar:0});
});
