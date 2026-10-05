import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { previewPromotion, previewBatch, confirmEdition, recordApproval, promote } from '../src/lib/server/content/canonical-import.mjs';

const enabled=!!process.env.CANONICAL_TEST_URL;
const db=enabled?new PrismaClient({datasourceUrl:process.env.CANONICAL_TEST_URL}):null;
test.after(async()=>{await db?.$disconnect();});
async function fixture(kind='kanji', override={}, sourceId=randomUUID()) {
 await db.source.upsert({where:{id:sourceId},create:{id:sourceId,title:'Synthetic source',edition:'test-edition',sourceType:'book',language:'ja'},update:{}});
 const entry={source_record_key:'entry-1',source_pdf_pages:[1],source_printed_pages:['1'],review_status:'unreviewed',issues:[],character:'実',meanings:['test'],on_readings:['ジツ'],kun_readings:[],example_words:[{word:'実験',reading:'じっけん',meanings:['test experiment'],source_pdf_pages:[1]}],examples:[],...override};
 const b=await db.importBatch.create({data:{sourceId,fileHash:randomUUID(),pageRangeJson:{processed:[1]},extractorVersion:'synthetic',schemaVersion:1,status:'draft',stagedJson:{content_type:kind,source:{edition:'test-edition'},entries:[entry],lesson_questions:[],exercise_passages:[]},validationErrorsJson:[]}});
 return {batchId:b.id,records:[{recordKey:'entry-1',family:'entry',printedPage:'1',pdfPageIndex:0,identityVerified:true,sourceVerified:true,match:{mode:'create',canonicalKey:kind==='kanji'?'実':randomUUID()},typed:kind==='kanji'?{glyph:'実',meaningsJson:['test'],onReadingsJson:['ジツ'],kunReadingsJson:[],notes:null}:{writtenForm:override.word,reading:override.reading,partOfSpeech:override.pos,senseKey:override.sense,meaningEn:override.meanings?.[0]||'test',acceptedGlossesJson:[],alternativeFormsJson:[],usageJson:{}},fieldPresence:{meanings:'supplied'},fieldOrigins:{},citations:[],kanjiLinks:[]}]};
}
async function approve(selection) {
 const p=await previewPromotion(db,selection);
 for(const r of p.records) await recordApproval(db,selection,r.recordKey,r.confirmationToken,'synthetic-test-reviewer');
 return p;
}

test('accepted extraction and separate generated/dictionary additions retain honest provenance and draft status', {skip:!enabled}, async()=>{
 const a=await fixture('kanji',{character:'値'});
 a.records[0].typed.glyph='値';a.records[0].match.canonicalKey='値';
 a.records[0].reviewBasis='user_accepted_without_pdf_comparison';
 const citation={sourceId:randomUUID(),sourceTitle:'Synthetic dictionary',sourceUrl:'https://example.org/dictionary',sourceRecordKey:'value',originalPayloadJson:{evidence:'synthetic'},fieldPresence:{meanings:'supplied'},printedPage:null,pdfPageIndex:null};
 const source=await db.importBatch.findUnique({where:{id:a.batchId}});
 await db.source.update({where:{id:source.sourceId},data:{edition:null}});
 a.records[0].additions=[{key:'meaning',origin:'user',payload:{selectedMeanings:['synthetic value'],uncertainty:[]},unresolved:false,citations:[citation]},{key:'reading',origin:'generated',payload:{reading:'uncertain',uncertainty:['ambiguous name']},unresolved:true,citations:[citation]}];
 const preview=await approve(a);
 const changed=structuredClone(a);changed.records[0].additions[0].payload.selectedMeanings=['changed'];
 await assert.rejects(()=>promote(db,changed),/approval/);
 await promote(db,a);
 const receipt=await db.sourceEntry.findFirst({where:{importBatchId:a.batchId,sourceRecordKey:'entry-1'}});
 assert.equal(receipt.fieldPresenceJson.reviewBasis,'user_accepted_without_pdf_comparison');
 const additions=await db.content.findMany({where:{items:{some:{itemId:receipt.itemId}},kind:'explanation'},include:{sourceEntries:true}});
 assert.equal(additions.length,2);
 assert.equal(additions.find(c=>c.origin==='generated').status,'draft');
 assert.equal(additions.find(c=>c.origin==='user').sourceEntries.length,2);
 assert.equal(preview.records[0].review.decision.reviewBasis,'user_accepted_without_pdf_comparison');
 const before=await db.content.count();assert.equal((await promote(db,a)).promoted,0);assert.equal(await db.content.count(),before);
 const invalid=structuredClone(a);invalid.records[0].additions[1].unresolved=false;
 await assert.rejects(()=>previewPromotion(db,invalid),/new draft|Uncertain/);
 const correction=await fixture('kanji',{character:'値'},source.sourceId);
 correction.records[0]={...structuredClone(a.records[0]),match:{mode:'reuse',itemId:receipt.itemId,expectedRevision:1}};
 correction.records[0].additions[0].payload.selectedMeanings=['corrected value'];
 await approve(correction);await promote(db,correction);
 const revisions=await db.content.findMany({where:{kind:'explanation',items:{some:{itemId:receipt.itemId}}}});
 assert.equal(revisions.length,4);assert.equal(revisions.filter(c=>c.revision===2&&c.supersedesId).length,2);
 assert.equal((await promote(db,correction)).promoted,0);
 const without=await fixture('kanji',{character:'値'},source.sourceId);
 without.records[0]=structuredClone(correction.records[0]);without.records[0].additions[1].citations=[];
 await approve(without);await promote(db,without);
 const restored=await fixture('kanji',{character:'値'},source.sourceId);
 restored.records[0]=structuredClone(correction.records[0]);
 await approve(restored);await promote(db,restored);
 assert.equal((await promote(db,restored)).promoted,0);
});
test('real PostgreSQL: partial approved promotion, repeat no-op, exact kanji reuse/two citations, immutable revisions', {skip:!enabled}, async()=>{
 const a=await fixture('kanji',{example_words:[{word:'実験',reading:'じっけん',meanings:['test experiment'],source_pdf_pages:[2]}]});
 await assert.rejects(()=>promote(db,a),/approval/i);
 await approve(a);
 const first=await promote(db,a);
 assert.equal(first.promoted,1);
 const exampleEvidence=await db.sourceEntry.findFirst({where:{importBatchId:a.batchId,sourceRecordKey:'entry-1/example/1'}});
 assert.equal(exampleEvidence.pdfPageIndex,null);
 assert.deepEqual(exampleEvidence.originalPayloadJson.source_pdf_pages,[2]);
 const committedBefore=await db.importBatch.findUnique({where:{id:a.batchId}});
 assert.equal((await promote(db,a)).promoted,0);
 assert.equal((await db.importBatch.findUnique({where:{id:a.batchId}})).committedAt?.toISOString(),committedBefore.committedAt?.toISOString());
 const item=await db.item.findUnique({where:{kind_canonicalKey:{kind:'kanji',canonicalKey:'実'}}});
 const b=await fixture();
 const auto=await approve(b); assert.equal(auto.records[0].review.resolvedMode,'reuse');
 await promote(db,b);
 assert.equal(await db.sourceEntry.count({where:{itemId:item.id}}),2);
 assert.equal(await db.kanji.count({where:{glyph:'実'}}),1);
 assert.equal(await db.content.count({where:{items:{some:{itemId:item.id}},kind:'sentence'}}),2); // one retained source-word per citation
 await assert.rejects(()=>db.sourceEntry.updateMany({where:{itemId:item.id},data:{printedPage:'999'}}));
 const c=await fixture('kanji',{meanings:['corrected']},(await db.importBatch.findUnique({where:{id:a.batchId}})).sourceId);
 c.records[0].typed.meaningsJson=['corrected'];
 c.records[0].match={mode:'correct',itemId:item.id,expectedRevision:1};
 await approve(c); await promote(db,c);
 assert.equal(await db.itemRevision.count({where:{itemId:item.id}}),2);
 const revisions=await db.sourceEntry.findMany({where:{itemId:item.id},orderBy:{revision:'asc'}});
 assert.equal(revisions.at(-1).revision,2);
 assert.ok(revisions.at(-1).supersedesId);
 assert.equal((await promote(db,c)).promoted,0);
 const changed=structuredClone(a);changed.records[0].typed.notes='different';
 await assert.rejects(()=>approve(changed),/new draft batch/);
});
test('payload changes invalidate approval and failed transaction rolls back every record', {skip:!enabled}, async()=>{
 const a=await fixture('vocabulary',{word:'生',reading:'せい',pos:'noun',sense:'life',meanings:['life']});
 await approve(a); a.records[0].typed.meaningEn='changed';
 await assert.rejects(()=>promote(db,a),/approval/i);
 a.records[0].typed.meaningEn='life';
 const batch=await db.importBatch.findUnique({where:{id:a.batchId}});
 const extra={...batch.stagedJson.entries[0],source_record_key:'entry-2'};
 await db.importBatch.update({where:{id:a.batchId},data:{stagedJson:{...batch.stagedJson,entries:[...batch.stagedJson.entries,extra]}}});
 a.records.push({...structuredClone(a.records[0]),recordKey:'entry-2',match:{mode:'create',canonicalKey:randomUUID()}});
 await approve(a);
 // Real PostgreSQL fault in the second write proves the first is rolled back.
 await db.$executeRawUnsafe(`CREATE FUNCTION fail_second_synthetic_record() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."sourceRecordKey"='entry-2' THEN RAISE EXCEPTION 'synthetic storage failure'; END IF; RETURN NEW; END $$`);
 await db.$executeRawUnsafe('CREATE TRIGGER fail_second_record BEFORE INSERT ON source_entries FOR EACH ROW EXECUTE FUNCTION fail_second_synthetic_record()');
 const before=await db.item.count();
 await assert.rejects(()=>promote(db,a));
 assert.equal(await db.item.count(),before);
 assert.equal(await db.sourceEntry.count({where:{importBatchId:a.batchId}}),0);
 await db.$executeRawUnsafe('DROP TRIGGER fail_second_record ON source_entries');
});
test('homograph readings, parts of speech and senses remain distinct', {skip:!enabled}, async()=>{
 for(const [reading,pos,sense] of [['なま','noun','raw'],['せい','noun','life'],['なま','adjective','raw'],['せい','noun','student']]) {
  const a=await fixture('vocabulary',{word:'生',reading,pos,sense,meanings:[sense]});
  await approve(a); await promote(db,a);
 }
 assert.equal(await db.vocabulary.count({where:{writtenForm:'生'}}),4);
});
test('database rejects missing/wrong typed rows and invalid field provenance', {skip:!enabled}, async()=>{
 await assert.rejects(()=>db.item.create({data:{id:randomUUID(),kind:'grammar',canonicalKey:randomUUID(),status:'approved',revision:1,fieldOriginsJson:{}}}));
 const kanji=await db.kanji.findUnique({where:{glyph:'実'}});
 await assert.rejects(()=>db.vocabulary.create({data:{itemId:kanji.itemId,writtenForm:'実',reading:'じつ',partOfSpeech:'noun',senseKey:'fake',meaningEn:'fake',acceptedGlossesJson:[],alternativeFormsJson:[],usageJson:{}}}));
 const a=await fixture('vocabulary',{word:'語',reading:'ご',pos:'noun',sense:'word',meanings:['word']});
 a.records[0].fieldOrigins={meaningEn:randomUUID()};
 await assert.rejects(()=>approve(a),/provenance|evidence/i);
});
test('unresolved questions stay draft, partial batch stays partial, verified dependencies required', {skip:!enabled}, async()=>{
 const a=await fixture('vocabulary',{word:'試験',reading:'しけん',pos:'noun',sense:'exam',meanings:['exam']});
 const batch=await db.importBatch.findUnique({where:{id:a.batchId}});
 const q={source_record_key:'q-1',prompt:'Synthetic?',format:'multiple_choice',options:[{label:'a',text:'A'}],answer_specification:null,target_grammar_keys:[],source_pdf_pages:[1],source_printed_pages:['1'],origin:'book'};
 await db.importBatch.update({where:{id:a.batchId},data:{stagedJson:{...batch.stagedJson,lesson_questions:[q]}}});
 await approve(a); await promote(db,a);
 assert.equal((await db.importBatch.findUnique({where:{id:a.batchId}})).status,'partial');
 const onlyQ={batchId:a.batchId,records:[{recordKey:'q-1',family:'question',printedPage:'1',pdfPageIndex:0,identityVerified:true,sourceVerified:true,targets:[],answerVerified:false,targetsVerified:false,additions:[{key:'translation',origin:'generated',payload:{translation:'Synthetic draft translation',uncertainty:['answer conflict']},unresolved:true,citations:[]}]}]};
 await approve(onlyQ); await promote(db,onlyQ);
 const content=await db.content.findFirst({where:{kind:'question',sourceEntries:{some:{importBatchId:a.batchId}}}});
 assert.equal(content.status,'draft');
 assert.equal(await db.content.count({where:{parentContentId:content.id,kind:'explanation',status:'draft'}}),1);
 assert.equal(await db.content.count({where:{kind:'question',status:'approved'}}),0);
 assert.equal((await db.importBatch.findUnique({where:{id:a.batchId}})).status,'partial');
});

test('corrected answer text and human grammar deferral retain immutable ungraded history', {skip:!enabled}, async()=>{
 const a=await fixture('vocabulary',{word:'試験',reading:'しけん',pos:'noun',sense:'exam',meanings:['exam']});
 const original=await db.importBatch.findUnique({where:{id:a.batchId}});
 const q={source_record_key:'checked-q',prompt:'Synthetic checked question?',format:'multiple_choice',options:[{label:'a',text:'A'}],answer_specification:{source_answer_text:'corrected source answer',correct_option_labels:['a']},origin:'book'};
 await db.importBatch.update({where:{id:a.batchId},data:{stagedJson:{...original.stagedJson,lesson_questions:[{...q,answer_specification:{...q.answer_specification,source_answer_text:'prior source answer'}}]}}});
 const record={recordKey:'checked-q',family:'question',printedPage:null,pdfPageIndex:null,identityVerified:true,sourceVerified:true,targets:[],answerVerified:false,targetsVerified:false};
 const first={batchId:a.batchId,records:[record]};await approve(first);await promote(db,first);
 const old=await db.content.findFirst({where:{kind:'question',sourceEntries:{some:{importBatchId:a.batchId}}}});
 const b=await db.importBatch.create({data:{sourceId:original.sourceId,fileHash:randomUUID(),pageRangeJson:{},extractorVersion:'synthetic-correction',schemaVersion:1,status:'draft',stagedJson:{...original.stagedJson,lesson_questions:[q]},validationErrorsJson:[]}});
 const correction={batchId:b.id,records:[{...record,questionReview:{sourceAnswerTextVerified:true,grammarConnections:'intentionally_deferred',usage:'reference_only'}}]};
 await approve(correction);await promote(db,correction);assert.equal((await promote(db,correction)).promoted,0);
 const next=await db.content.findUnique({where:{supersedesId:old.id}});
 assert.equal(next.status,'draft');assert.equal(next.payloadJson.questionReview.sourceAnswerTextVerified,true);
 assert.equal(next.payloadJson.questionReview.grammarConnections,'intentionally_deferred');
 assert.equal(next.payloadJson.answer_specification.source_answer_text,q.answer_specification.source_answer_text);
 assert.equal((await db.content.findUnique({where:{id:old.id}})).payloadJson.answer_specification.source_answer_text,'prior source answer');
 assert.equal(await db.contentItem.count({where:{contentId:next.id,role:'target'}}),0);
});

test('grammar construction identities, verified dependency questions, corrections and origin restrictions', {skip:!enabled}, async()=>{
 const sourceId=randomUUID();
 const g1=await fixture('grammar',{pattern:'〜もの',formation:['noun + もの'],meanings:['test meaning']},sourceId);
 g1.records[0].typed={pattern:'〜もの',patternVariantsJson:[],explanationJa:null,explanationEn:'test meaning',nuance:null,formationRulesJson:[{label:'test',precedingForm:'noun',attachment:'もの',exceptions:[],sourceWording:'noun + もの'}],usageJson:{}};
 const b=await db.importBatch.findUnique({where:{id:g1.batchId}});
 const q={source_record_key:'q-approved',prompt:'Synthetic question?',origin:'book',format:'multiple_choice',options:[{label:'1',text:'A'},{label:'2',text:'B'}],answer_specification:{correct_option_labels:['1'],ordered_option_labels:[],acceptable_answers:[],target_position:null},source_pdf_pages:[1],source_printed_pages:['1']};
 await db.importBatch.update({where:{id:b.id},data:{stagedJson:{...b.stagedJson,lesson_questions:[q]}}});
 g1.records.push({recordKey:'q-approved',family:'question',identityVerified:true,sourceVerified:true,printedPage:'1',pdfPageIndex:0,targets:[{recordKey:'entry-1'}],answerVerified:true,targetsVerified:true});
 await approve(g1);await promote(db,g1);
 const first=await db.content.findFirst({where:{kind:'question',sourceEntries:{some:{importBatchId:b.id}}}});
 assert.equal(first.status,'approved');
 const g2=await fixture('grammar',{pattern:'〜もの',formation:['different construction']});
 g2.records[0].typed={...g1.records[0].typed,nuance:'different construction'};
 await approve(g2);await promote(db,g2);
 assert.equal(await db.grammar.count({where:{pattern:'〜もの'}}),2);
 const secondTarget=await db.item.findUnique({where:{kind_canonicalKey:{kind:'grammar',canonicalKey:g2.records[0].match.canonicalKey}}});
 await assert.rejects(()=>db.contentItem.create({data:{contentId:first.id,itemId:secondTarget.id,role:'target'}}));
 const correction=await db.importBatch.create({data:{sourceId,fileHash:randomUUID(),pageRangeJson:{processed:[1]},extractorVersion:'synthetic',schemaVersion:2,status:'draft',stagedJson:{...b.stagedJson,entries:[],lesson_questions:[{...q,prompt:'Corrected synthetic?'}]},validationErrorsJson:[]}});
 const target=await db.item.findUnique({where:{kind_canonicalKey:{kind:'grammar',canonicalKey:g1.records[0].match.canonicalKey}}});
 const selection={batchId:correction.id,records:[{...g1.records[1],targets:[{itemId:target.id}]}]};
 await approve(selection);await promote(db,selection);
 assert.equal(await db.content.count({where:{supersedesId:first.id}}),1);
 await assert.rejects(()=>db.content.update({where:{id:first.id},data:{payloadJson:{prompt:'overwritten'}}}));
 const bad=await fixture('kanji',{origin:'generated',character:'字'});
 bad.records[0].typed.glyph='字';bad.records[0].match.canonicalKey='字';
 await assert.rejects(()=>approve(bad),/origin|generated/);
});

test('dictionary provenance is separate and foreign-item references fail at DB boundary', {skip:!enabled}, async()=>{
 const sourceId=randomUUID();
 const s=await fixture('kanji',{character:'字',meanings:[],example_words:[]});
 s.records[0].match.canonicalKey='字';s.records[0].typed.glyph='字';
 s.records[0].typed.onReadingsJson=null;s.records[0].typed.kunReadingsJson=null;
 s.records[0].citations=[{sourceId,sourceTitle:'Synthetic dictionary',sourceUrl:'https://example.invalid/dictionary',sourceRecordKey:'dictionary-entry',originalPayloadJson:{meanings:['test dictionary gloss']},fieldPresence:{meanings:'supplied'},printedPage:null,pdfPageIndex:null}];
 s.records[0].typed.meaningsJson=['test dictionary gloss'];s.records[0].fieldOrigins={meaningsJson:'citation:0'};
 await approve(s);assert.equal(await db.source.findUnique({where:{id:sourceId}}),null);await promote(db,s);
 const item=await db.kanji.findUnique({where:{glyph:'字'},include:{item:true}});
 const evidence=await db.sourceEntry.findUnique({where:{id:item.item.fieldOriginsJson.meaningsJson}});
 assert.equal(evidence.sourceId,sourceId);
 assert.equal(item.onReadingsJson,null);
 const other=await db.item.findUnique({where:{kind_canonicalKey:{kind:'kanji',canonicalKey:'実'}}});
 await assert.rejects(()=>db.$transaction(async tx=>{
  await tx.itemRevision.create({data:{itemId:other.id,revision:other.revision+1,typedJson:{...await db.kanji.findUnique({where:{itemId:other.id}})},fieldOriginsJson:{meaningsJson:evidence.id}}});
  await tx.item.update({where:{id:other.id},data:{revision:other.revision+1,fieldOriginsJson:{meaningsJson:evidence.id}}});
 }));
});

test('inventory is read-only while edition is unknown and edition confirmation is explicit', {skip:!enabled}, async()=>{
 const s=await fixture('vocabulary',{word:'本',reading:'ほん',pos:'noun',sense:'book',meanings:['book']});
 const b=await db.importBatch.findUnique({where:{id:s.batchId}});
 await db.source.update({where:{id:b.sourceId},data:{edition:null}});
 const inventory=await previewBatch(db,s.batchId);
 assert.equal(inventory.blocked,1);assert.equal(inventory.ready,0);
 await assert.rejects(()=>approve(s),/edition/);
 await assert.rejects(()=>confirmEdition(db,b.sourceId,'synthetic-edition','wrong','synthetic-reviewer'),/confirmation/);
 await confirmEdition(db,b.sourceId,'synthetic-edition',`edition:${b.sourceId}:${inventory.editionConfirmationHash}:synthetic-edition`,'synthetic-reviewer');
 await approve(s);await promote(db,s);
 await assert.rejects(()=>confirmEdition(db,b.sourceId,'other','wrong','synthetic-reviewer'),/once/);
});
