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
