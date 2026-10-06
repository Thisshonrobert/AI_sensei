import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { createUser, syncCards, startSession, sessionView, introduce, commitResponse, rate, stopSession } from '../src/lib/server/review/service.mjs';
import { previewPromotion, recordApproval, promote } from '../src/lib/server/content/canonical-import.mjs';
const enabled=!!process.env.REVIEW_TEST_URL;
let db=enabled?new PrismaClient({datasourceUrl:process.env.REVIEW_TEST_URL,errorFormat:'minimal'}):null;
test.after(async()=>{await db?.$disconnect();});
const now=new Date('2026-10-06T10:00:00Z');
async function fixture({count=8,kanji=false}={}) {
 const sourceId=randomUUID();
 await db.source.create({data:{id:sourceId,title:'Synthetic review fixture',edition:'test',sourceType:'book',language:'ja'}});
 const entries=Array.from({length:count},(_,i)=>({source_record_key:`entry-${i}`,word:`試験${i}`,reading:`しけん${i}`,pos:'noun',sense:`test-${i}`,meanings:[`test sense ${i}`],source_pdf_pages:[1],source_printed_pages:['1'],review_status:'unreviewed',issues:[],examples:[]}));
 if(kanji)entries.push({source_record_key:'kanji',character:'試',meanings:['test'],on_readings:['シ'],kun_readings:[],example_words:[],source_pdf_pages:[1],source_printed_pages:['1'],review_status:'unreviewed',issues:[],examples:[]});
 // Each importer batch has one content family. Keep kanji fixtures separate below.
 const batch=await db.importBatch.create({data:{sourceId,fileHash:randomUUID(),pageRangeJson:{},extractorVersion:'fixture',schemaVersion:1,status:'draft',stagedJson:{content_type:'vocabulary',source:{edition:'test'},entries:entries.slice(0,count),lesson_questions:[],exercise_passages:[]},validationErrorsJson:[]}});
 const records=entries.slice(0,count).map(e=>({recordKey:e.source_record_key,family:'entry',identityVerified:true,sourceVerified:true,printedPage:'1',pdfPageIndex:0,match:{mode:'create',canonicalKey:randomUUID()},typed:{writtenForm:e.word,reading:e.reading,partOfSpeech:'noun',senseKey:e.sense,meaningEn:e.meanings[0],acceptedGlossesJson:[],alternativeFormsJson:[],usageJson:{}},fieldPresence:{meanings:'supplied'},fieldOrigins:{},citations:[],kanjiLinks:[]}));
 const selection={batchId:batch.id,records};
 const preview=await previewPromotion(db,selection);
 for(const r of preview.records)await recordApproval(db,selection,r.recordKey,r.confirmationToken,'synthetic-test');
 await promote(db,selection);
 const user=await createUser(db,randomUUID(),'Asia/Calcutta');
 await db.user.update({where:{id:user.id},data:{settingsJson:{...(await db.user.findUnique({where:{id:user.id}})).settingsJson,newCardLimits:{vocabulary:5,kanji:0,grammar:0,total:8}}}});
 await syncCards(db,user.id,now);
 return user;
}
async function ready(user,time=now) {
 const s=await startSession(db,user.id,{now:time,includeNew:true});
 let v=await sessionView(db,user.id,s.id,time);
 if(v.card.status==='new')await introduce(db,user.id,s.id,v.card.id,time);
 v=await sessionView(db,user.id,s.id,time);
 const eventId=randomUUID();
 const input={sessionId:s.id,cardId:v.card.id,stateVersion:v.card.stateVersion,clientEventId:eventId,answer:{reading:'しけん',meaning:'a valid equivalent paraphrase'}};
 await commitResponse(db,user.id,input,time);
 return {...input,rating:3,components:{readingCorrect:true,meaningCorrect:true}};
}
let glyphIndex=0;
async function coreContext(user,{context=true,meaning=true}={}) {
 const glyph=String.fromCodePoint(0x4e10+glyphIndex++),sourceId=randomUUID();
 await db.source.create({data:{id:sourceId,title:'Synthetic core kanji',edition:'test',sourceType:'book',language:'ja'}});
 const raw={source_record_key:'core',character:glyph,meanings:meaning?['synthetic meaning']:[],on_readings:['シ'],kun_readings:[],examples:[],example_words:context?[{word:`${glyph}験`,reading:'しけん',meanings:['source context sense'],source_pdf_pages:[1]}]:[],source_pdf_pages:[1],source_printed_pages:['1'],review_status:'unreviewed',issues:[]};
 const batch=await db.importBatch.create({data:{sourceId,fileHash:randomUUID(),pageRangeJson:{},extractorVersion:'fixture',schemaVersion:1,status:'draft',stagedJson:{content_type:'kanji',source:{edition:'test'},entries:[raw],lesson_questions:[],exercise_passages:[]},validationErrorsJson:[]}});
 const selection={batchId:batch.id,records:[{recordKey:'core',family:'entry',identityVerified:true,sourceVerified:true,printedPage:'1',pdfPageIndex:0,match:{mode:'create',canonicalKey:glyph},typed:{glyph,meaningsJson:raw.meanings,onReadingsJson:['シ'],kunReadingsJson:[],notes:null},fieldPresence:{meanings:meaning?'supplied':'not_supplied'},fieldOrigins:{},citations:[],kanjiLinks:[]}]};
 const preview=await previewPromotion(db,selection);await recordApproval(db,selection,'core',preview.records[0].confirmationToken,'synthetic-test');await promote(db,selection);
 await syncCards(db,user.id,now);
 return (await db.kanji.findUnique({where:{glyph}})).itemId;
}
async function approvedGrammar(user) {
 const sourceId=randomUUID();
 await db.source.create({data:{id:sourceId,title:'Synthetic grammar',edition:'test',sourceType:'book',language:'ja'}});
 const raw={source_record_key:'pattern',pattern:'〜もの',formation:['noun + もの'],meanings:['synthetic sense'],source_pdf_pages:[1],source_printed_pages:['1'],examples:[],review_status:'unreviewed',issues:[]};
 const question={source_record_key:'cloze',prompt:'Synthetic cue: noun + ____',origin:'book',format:'fill_in_blank',options:[],answer_specification:{acceptable_answers:['もの','equivalent answer']},source_pdf_pages:[1],source_printed_pages:['1']};
 const batch=await db.importBatch.create({data:{sourceId,fileHash:randomUUID(),pageRangeJson:{},extractorVersion:'fixture',schemaVersion:1,status:'draft',stagedJson:{content_type:'grammar',source:{edition:'test'},entries:[raw],lesson_questions:[question],exercise_passages:[]},validationErrorsJson:[]}});
 const selection={batchId:batch.id,records:[{recordKey:'pattern',family:'entry',identityVerified:true,sourceVerified:true,printedPage:'1',pdfPageIndex:0,match:{mode:'create',canonicalKey:randomUUID()},typed:{pattern:'〜もの',patternVariantsJson:[],explanationJa:null,explanationEn:'synthetic sense',nuance:null,formationRulesJson:[{label:'synthetic',precedingForm:'noun',attachment:'もの',exceptions:[],sourceWording:'noun + もの'}],usageJson:{}},fieldPresence:{meanings:'supplied'},fieldOrigins:{},citations:[],kanjiLinks:[]},{recordKey:'cloze',family:'question',identityVerified:true,sourceVerified:true,printedPage:'1',pdfPageIndex:0,targets:[{recordKey:'pattern'}],answerVerified:true,targetsVerified:true}]};
 const preview=await previewPromotion(db,selection);for(const r of preview.records)await recordApproval(db,selection,r.recordKey,r.confirmationToken,'synthetic-test');await promote(db,selection);
 await syncCards(db,user.id,now);
 return (await db.item.findUnique({where:{kind_canonicalKey:{kind:'grammar',canonicalKey:selection.records[0].match.canonicalKey}}})).id;
}
test('source-complete core creates exactly two independent objectives; source context references stay unscheduled', {skip:!enabled}, async()=>{
 const u=await fixture();const itemId=await coreContext(u);
 const cards=await db.card.findMany({where:{userId:u.id,itemId},orderBy:{objective:'asc'}});
 assert.equal(cards.length,2);
 const reading=cards.find(c=>c.objective==='kanji_reading_context'),meaning=cards.find(c=>c.objective==='kanji_meaning');
 assert.ok(reading.contextVocabularyItemId);assert.notEqual(reading.id,meaning.id);
 assert.equal(await db.card.count({where:{userId:u.id,itemId:reading.contextVocabularyItemId}}),0);
 assert.equal(await db.userItem.count({where:{userId:u.id,itemId:reading.contextVocabularyItemId}}),0);
 await db.user.update({where:{id:u.id},data:{settingsJson:{...(await db.user.findUnique({where:{id:u.id}})).settingsJson,newCardLimits:{vocabulary:0,kanji:2,grammar:0,total:8}}}});
 const s=await startSession(db,u.id,{now,includeNew:true});const view=await sessionView(db,u.id,s.id,now);
 await introduce(db,u.id,s.id,view.card.id,now);
 const input={sessionId:s.id,cardId:view.card.id,stateVersion:0,clientEventId:randomUUID(),answer:view.card.objective==='kanji_meaning'?{meaning:'test'}:{reading:'しけん'}};
 await commitResponse(db,u.id,input,now);await rate(db,u.id,{...input,rating:3,components:{correct:true}},now);
 const sibling=cards.find(c=>c.id!==view.card.id);
 const after=await db.card.findUnique({where:{id:sibling.id}});
 assert.deepEqual(after.fsrsStateJson,sibling.fsrsStateJson);assert.equal(after.dueAt,sibling.dueAt);assert.equal(after.stateVersion,0);
 assert.equal(after.buriedUntil.toISOString(),'2026-10-06T18:30:00.000Z');
 assert.equal((await db.card.findUnique({where:{id:view.card.id}})).stateVersion,1);
 const missing=await coreContext(u,{context:false});
 assert.equal(await db.card.count({where:{userId:u.id,itemId:missing,objective:'kanji_reading_context'}}),0);
 const gaps=await syncCards(db,u.id,now);assert.ok(gaps.gaps.some(g=>g.itemId===missing));
});
test('pool is dormant and unresolved grammar/incidental kanji stay excluded', {skip:!enabled}, async()=>{
 const u=await fixture({count:2,kanji:true});
 const a=await syncCards(db,u.id,now);const b=await syncCards(db,u.id,now);
 assert.equal(a.created,0);assert.equal(b.created,0);
 assert.equal(await db.userItem.count({where:{userId:u.id}}),0);
 assert.equal(await db.card.count({where:{userId:u.id,status:'active'}}),0);
 assert.equal(await db.card.count({where:{userId:u.id,objective:'grammar_cloze'}}),0);
});
test('duplicate/concurrent event has one effect; stale different event conflicts; component failure is Again', {skip:!enabled}, async()=>{
 const u=await fixture();const input=await ready(u);
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
test('transaction rollback leaves committed response but no orphan log or changed state', {skip:!enabled}, async()=>{
 const u=await fixture();const input=await ready(u);
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
test('stop, disconnect/restart and resume preserve committed response, selection and due dates', {skip:!enabled}, async()=>{
 const u=await fixture();const input=await ready(u);
 const selection=(await db.studySession.findUnique({where:{id:input.sessionId}})).selectionSnapshotJson;
 const before=await db.card.findMany({where:{userId:u.id},orderBy:{id:'asc'}});
 await stopSession(db,u.id,input.sessionId,now);await db.$disconnect();
 db=new PrismaClient({datasourceUrl:process.env.REVIEW_TEST_URL,errorFormat:'minimal'});
 assert.equal((await startSession(db,u.id,{now,includeNew:true})).id,input.sessionId);
 const view=await sessionView(db,u.id,input.sessionId,now);
 assert.equal(view.attempt.clientEventId,input.clientEventId);assert.ok(view.answer);
 assert.deepEqual((await db.studySession.findUnique({where:{id:input.sessionId}})).selectionSnapshotJson,selection);
 assert.deepEqual(await db.card.findMany({where:{userId:u.id},orderBy:{id:'asc'}}),before);
});
test('caps hold across repeated sessions; due-first, heavy backlog and timezone reset', {skip:!enabled}, async()=>{
 const u=await fixture({count:12});
 await db.user.update({where:{id:u.id},data:{settingsJson:{...(await db.user.findUnique({where:{id:u.id}})).settingsJson,newCardLimits:{vocabulary:5,kanji:0,grammar:0,total:8}}}});
 for(let i=0;i<5;i++){const input=await ready(u);await rate(db,u.id,{...input,rating:4},now);}
 const session=await startSession(db,u.id,{now,includeNew:true});
 assert.equal((await sessionView(db,u.id,session.id,now)).card,null);
 assert.equal(await db.card.count({where:{userId:u.id,introductionDay:'2026-10-06'}}),5);
 const tomorrow=new Date('2026-10-06T18:31:00Z');
 const s=await startSession(db,u.id,{now:tomorrow,includeNew:true});
 assert.ok((await sessionView(db,u.id,s.id,tomorrow)).card);
});
test('ownership, unrevealed front and append-only logs are enforced', {skip:!enabled}, async()=>{
 const u=await fixture();const other=await createUser(db,randomUUID(),'UTC');
 const s=await startSession(db,u.id,{now,includeNew:true});
 const front=await sessionView(db,u.id,s.id,now);
 assert.equal(front.answer,undefined);assert.equal(front.card.answerSpecJson,undefined);
 await assert.rejects(()=>sessionView(db,other.id,s.id,now),/ownership/i);
 const input=await ready(u);await rate(db,u.id,input,now);
 await assert.rejects(()=>db.reviewLog.updateMany({where:{userId:u.id},data:{rating:4}}));
});
test('learning step becoming due interrupts introductions without rewriting the saved selection', {skip:!enabled}, async()=>{
 const u=await fixture();const input=await ready(u);
 await rate(db,u.id,{...input,rating:1},now);
 const before=(await db.studySession.findUnique({where:{id:input.sessionId}})).selectionSnapshotJson;
 const later=new Date(now.getTime()+61000);
 const v=await sessionView(db,u.id,input.sessionId,later);
 assert.equal(v.card,null);assert.ok(v.actionableDue>0);
 assert.deepEqual((await db.studySession.findUnique({where:{id:input.sessionId}})).selectionSnapshotJson,before);
 const next=await startSession(db,u.id,{now:later,includeNew:true});
 assert.equal((await sessionView(db,u.id,next.id,later)).card.id,input.cardId);
});
test('different canonical senses sharing a written-word reading are separated as siblings', {skip:!enabled}, async()=>{
 const u=await fixture({count:2});
 const groups=await db.card.findMany({where:{userId:u.id,objective:'vocab_reading_meaning'},include:{item:{include:{vocabulary:true}}}});
 const pairs=groups.filter(c=>c.item.vocabulary.writtenForm==='試験0');
 assert.ok(pairs.length>=2);
 assert.notEqual(pairs[0].itemId,pairs[1].itemId);
 assert.ok(pairs[0].siblingKey);assert.equal(pairs[0].siblingKey,pairs[1].siblingKey);
 const s=await startSession(db,u.id,{now,includeNew:true});
 const selected=(await db.studySession.findUnique({where:{id:s.id}})).selectionSnapshotJson.entries;
 const keys=await db.card.findMany({where:{id:{in:selected.map(e=>e.cardId)},siblingKey:{not:null}},select:{siblingKey:true}});
 assert.equal(new Set(keys.map(c=>c.siblingKey)).size,keys.length);
});
test('global eight and 5/2/1 type caps count kanji objectives, with grammar accepted alternatives', {skip:!enabled}, async()=>{
 const u=await fixture({count:12});await coreContext(u);await coreContext(u);const grammarId=await approvedGrammar(u);
 await db.user.update({where:{id:u.id},data:{settingsJson:{...(await db.user.findUnique({where:{id:u.id}})).settingsJson,newCardLimits:{vocabulary:5,kanji:2,grammar:1,total:8}}}});
 const s=await startSession(db,u.id,{now,includeNew:true});
 let introduced=0;
 for(;;){const v=await sessionView(db,u.id,s.id,now);if(!v.card)break;
  const c=v.card;await introduce(db,u.id,s.id,c.id,now);introduced++;
  const answer=c.objective==='vocab_reading_meaning'?{reading:'synthetic',meaning:'paraphrase'}:c.objective==='kanji_meaning'?{meaning:'synthetic'}:c.objective==='kanji_reading_context'?{reading:'synthetic'}:{response:'equivalent answer'};
  const input={sessionId:s.id,cardId:c.id,stateVersion:c.stateVersion,clientEventId:randomUUID(),answer};
  await commitResponse(db,u.id,input,now);await rate(db,u.id,{...input,rating:4,components:c.objective==='vocab_reading_meaning'?{readingCorrect:true,meaningCorrect:true}:{correct:true}},now);
 }
 assert.equal(introduced,8);
 const counts=(await sessionView(db,u.id,s.id,now)).used;
 assert.deepEqual(counts,{total:8,vocabulary:5,kanji:2,grammar:1});
 const grammar=await db.card.findFirst({where:{userId:u.id,itemId:grammarId}});
 assert.deepEqual(grammar.answerSpecJson.alternatives,['equivalent answer']);
});
test('heavy backlog pauses all new introductions and preserves overdue dates', {skip:!enabled}, async()=>{
 const u=await fixture({count:41});
 const cards=await db.card.findMany({where:{userId:u.id,status:'new'},take:50});
 await db.card.updateMany({where:{id:{in:cards.map(c=>c.id)}},data:{status:'active',dueAt:now,fsrsStateJson:{...cards[0].fsrsStateJson,due:now.toISOString()},introducedAt:new Date('2026-10-05T10:00:00Z'),introductionDay:'2026-10-05'}});
 const before=await db.card.findMany({where:{userId:u.id,status:'active'},select:{id:true,dueAt:true},orderBy:{id:'asc'}});
 const s=await startSession(db,u.id,{now,includeNew:true});const v=await sessionView(db,u.id,s.id,now);
 assert.equal(v.introductionsPaused,true);assert.equal(v.card.status,'active');
 assert.equal((await db.studySession.findUnique({where:{id:s.id}})).selectionSnapshotJson.entries.some(e=>e.role==='new'),false);
 assert.deepEqual(await db.card.findMany({where:{userId:u.id,status:'active'},select:{id:true,dueAt:true},orderBy:{id:'asc'}}),before);
});
test('contextual reading, vocabulary and kanji meaning successes never propagate scheduler state', {skip:!enabled}, async()=>{
 const u=await fixture();const itemId=await coreContext(u);
 await db.user.update({where:{id:u.id},data:{settingsJson:{...(await db.user.findUnique({where:{id:u.id}})).settingsJson,newCardLimits:{vocabulary:5,kanji:2,grammar:1,total:8}}}});
 const cards=await db.card.findMany({where:{userId:u.id,itemId}});
 const reading=cards.find(c=>c.objective==='kanji_reading_context'),meaning=cards.find(c=>c.objective==='kanji_meaning');
 const vocabulary=await db.vocabulary.findUnique({where:{itemId:reading.contextVocabularyItemId}});
 // Explicit synthetic vocabulary activation for this source reference; reference creation itself remains dormant.
 const vocabularyCard=await db.card.create({data:{userId:u.id,itemId:vocabulary.itemId,objective:'vocab_reading_meaning',promptSpecJson:{text:vocabulary.writtenForm,cue:'Synthetic combined objective',sourceEntryIds:reading.promptSpecJson.sourceEntryIds},answerSpecJson:{reading:vocabulary.reading,meaning:vocabulary.meaningEn},fsrsStateJson:reading.fsrsStateJson,siblingKey:reading.siblingKey}});
 async function selected(c,time){
  const prior=await db.studySession.findFirst({where:{userId:u.id,status:{in:['active','paused']}}});
  if(prior)await db.studySession.update({where:{id:prior.id},data:{status:'completed',endedAt:time}});
  const current=await db.card.findUnique({where:{id:c.id}});
  const s=await db.studySession.create({data:{userId:u.id,startedAt:time,selectionSeed:randomUUID(),selectionSnapshotJson:{entries:[{cardId:c.id,stateVersion:current.stateVersion,role:'new'}]}}});
  await introduce(db,u.id,s.id,c.id,time);
  const input={sessionId:s.id,cardId:c.id,stateVersion:current.stateVersion,clientEventId:randomUUID(),answer:c.objective==='vocab_reading_meaning'?{reading:'synthetic',meaning:'paraphrase'}:{reading:'synthetic'}};
  await commitResponse(db,u.id,input,time);await rate(db,u.id,{...input,rating:4,components:c.objective==='vocab_reading_meaning'?{readingCorrect:true,meaningCorrect:true}:{correct:true}},time);
 }
 await selected(reading,now);
 const meaningAfter=await db.card.findUnique({where:{id:meaning.id}}),vocabAfter=await db.card.findUnique({where:{id:vocabularyCard.id}});
 assert.deepEqual(meaningAfter.fsrsStateJson,meaning.fsrsStateJson);assert.equal(meaningAfter.stateVersion,0);
 assert.deepEqual(vocabAfter.fsrsStateJson,vocabularyCard.fsrsStateJson);assert.equal(vocabAfter.stateVersion,0);
 const readingAfter=await db.card.findUnique({where:{id:reading.id}});
 await selected(vocabularyCard,new Date('2026-10-06T18:31:00Z'));
 const readingAgain=await db.card.findUnique({where:{id:reading.id}});
 assert.deepEqual(readingAgain.fsrsStateJson,readingAfter.fsrsStateJson);assert.equal(readingAgain.stateVersion,readingAfter.stateVersion);assert.equal(readingAgain.dueAt.toISOString(),readingAfter.dueAt.toISOString());
 assert.deepEqual((await db.card.findUnique({where:{id:meaning.id}})).fsrsStateJson,meaning.fsrsStateJson);
});
