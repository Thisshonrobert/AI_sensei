import test from 'node:test';
import assert from 'node:assert/strict';
import { hashJson, normalizeKanji, validateSelection, approvalToken } from '../src/lib/server/content/canonical-import.mjs';

test('hash binds exact payload but not object property order', () => {
 assert.equal(hashJson({a:1,b:2}),hashJson({b:2,a:1}));
 assert.notEqual(hashJson({a:[1,2]}),hashJson({a:[2,1]}));
});
test('kanji NFC preserves compatibility and variation identities', () => {
 assert.equal(normalizeKanji('実'),'実');
 assert.equal(normalizeKanji('神'),'神');
 assert.notEqual(normalizeKanji('神'),normalizeKanji('神'));
 assert.notEqual(normalizeKanji('葛'),normalizeKanji('葛\u{E0100}'));
 assert.throws(()=>normalizeKanji('実施'),/one kanji/);
});
test('explicit source-specific identity, sense and POS required; JSON approved status is insufficient', () => {
 assert.throws(()=>validateSelection({batchId:'bad',records:[]}),/validation/i);
 assert.throws(()=>validateSelection({batchId:'00000000-0000-4000-8000-000000000001',records:[{recordKey:'one',family:'entry',printedPage:null,pdfPageIndex:null,identityVerified:true,sourceVerified:true,status:'approved'}]}),/validation/i);
 assert.throws(()=>validateSelection({batchId:'00000000-0000-4000-8000-000000000001',records:[{recordKey:'one',family:'entry',printedPage:null,pdfPageIndex:null,identityVerified:true,sourceVerified:false}]}),/validation/i);
 assert.notEqual(approvalToken('a','key','hash'),approvalToken('a','other','hash'));
});

test('acceptance basis and unresolved supplementary decisions are preserved in the approval hash', () => {
 const input={batchId:'00000000-0000-4000-8000-000000000001',records:[{recordKey:'one',family:'entry',printedPage:null,pdfPageIndex:null,identityVerified:true,sourceVerified:true,reviewBasis:'user_accepted_without_pdf_comparison',additions:[{key:'reading',origin:'generated',payload:{reading:'test',uncertainty:['name reading unresolved']},unresolved:true,citations:[]}]}]};
 const parsed=validateSelection(input);
 assert.equal(parsed.records[0].reviewBasis,'user_accepted_without_pdf_comparison');
 assert.equal(parsed.records[0].additions[0].unresolved,true);
 const changed=structuredClone(parsed);changed.records[0].additions[0].unresolved=false;
 assert.notEqual(hashJson(parsed),hashJson(changed));
 assert.throws(()=>validateSelection({...input,records:[{...input.records[0],additions:[{...input.records[0].additions[0],origin:'book'}]}]}),/validation/);
});

test('human answer-text check and intentional grammar deferral are explicit hashed decisions', () => {
 const record={recordKey:'q',family:'question',printedPage:null,pdfPageIndex:null,identityVerified:true,sourceVerified:true,answerVerified:false,targetsVerified:false,targets:[],questionReview:{sourceAnswerTextVerified:true,grammarConnections:'intentionally_deferred',usage:'reference_only'}};
 const input={batchId:'00000000-0000-4000-8000-000000000001',records:[record]};
 const parsed=validateSelection(input);
 assert.deepEqual(parsed.records[0].questionReview,record.questionReview);
 const changed=structuredClone(parsed);changed.records[0].questionReview.sourceAnswerTextVerified=false;
 assert.notEqual(hashJson(parsed),hashJson(changed));
 assert.throws(()=>validateSelection({...input,records:[{...record,targetsVerified:true}]}),/deferred/i);
 assert.throws(()=>validateSelection({...input,records:[{...record,family:'entry'}]}),/question/i);
});
