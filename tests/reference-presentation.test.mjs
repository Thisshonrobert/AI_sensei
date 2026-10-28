import test from 'node:test';
import assert from 'node:assert/strict';
import {referencePresentation} from '../src/lib/server/content/reference-presentation.mjs';
const c=(id,kind,payloadJson,status='approved')=>({id,kind,payloadJson,status,successor:null});
test('word supplements merge into examples; missing readings use a unique stored dictionary reading',()=>{
 const word=c('word','sentence',{sourceWord:true,japanese:'合成語',reading:null});
 const supplement=c('meaning','explanation',{originalJapanese:'合成語',selectedMeanings:['Synthetic word'],dictionaryEvidence:{originalReading:'ごうせいご'}});
 const rows=referencePresentation([word,supplement]);
 assert.equal(rows.length,1);assert.equal(rows[0].content.id,'word');assert.equal(rows[0].reading,'ごうせいご');assert.equal(rows[0].supplement.id,'meaning');
 assert.equal(word.payloadJson.reading,null);
});
test('generated example-language duplicates merge into the book sentence with reading and translation',()=>{
 const book=c('book','sentence',{japanese:'誰でも最初は失敗するものだから、そんなに落ち込まないで。',reading:null,translation:null});
 const generated=c('generated','explanation',{kind:'exampleLanguage',originalJapanese:'誰でも最初は失敗するものだから、そんなに落ち込まないで。',reading:'だれでもさいしょはしっぱいするものだから、そんなにおちこまないで。',translation:'Everyone makes mistakes at first, so don\'t feel so down.'});
 const rows=referencePresentation([book,generated]);
 assert.equal(rows.length,1);assert.equal(rows[0].content.id,'book');assert.equal(rows[0].supplement.id,'generated');
 assert.equal(rows[0].reading,'だれでもさいしょはしっぱいするものだから、そんなにおちこまないで。');
 assert.equal(rows[0].supplement.payloadJson.translation,'Everyone makes mistakes at first, so don\'t feel so down.');
});
test('generated example-language duplicates without a reading or translation stay hidden',()=>{
 const book=c('book','sentence',{japanese:'どんなに長い夜でも、必ず明けるものだ。',reading:null,translation:null});
 const generated=c('generated','explanation',{kind:'exampleLanguage',originalJapanese:'どんなに長い夜でも、必ず明けるものだ。',reading:null,translation:null});
 const rows=referencePresentation([book,generated]);
 assert.equal(rows.length,1);assert.equal(rows[0].content.id,'book');assert.equal(rows[0].supplement,null);
});
test('multiple generated duplicates collapse to one supplement',()=>{
 const book=c('book','sentence',{japanese:'親は子どもがいくつになっても心配するもんだ。',reading:null,translation:null});
 const first=c('first','explanation',{kind:'exampleLanguage',originalJapanese:'親は子どもがいくつになっても心配するもんだ。',translation:'Parents worry.'});
 const second=c('second','explanation',{kind:'exampleLanguage',originalJapanese:'親は子どもがいくつになっても心配するもんだ。',reading:'おやはこどもがいくつになってもしんぱいするもんだ。',translation:'Parents always worry about their children.'});
 const rows=referencePresentation([book,first,second]);
 assert.equal(rows.length,1);assert.equal(rows[0].content.id,'book');assert.equal(rows[0].supplement.id,'second');
 assert.equal(rows[0].reading,'おやはこどもがいくつになってもしんぱいするもんだ。');
});
test('approved field supplements never render as examples; unresolved drafts stay visible',()=>{
 const example=c('example','sentence',{japanese:'隣の人',translation:'The neighbor'});
 const approved=c('approved-meaning','explanation',{kind:'dictionaryFieldSupplement',fieldPath:'meanings',selectedMeanings:['Neighbor']});
 const approvedComponents=c('approved-components','explanation',{kind:'dictionaryFieldSupplement',fieldPath:'learning_components'});
 const draft=c('draft-meaning','explanation',{kind:'dictionaryFieldSupplement',fieldPath:'meaning_en',selectedMeanings:['brain']},'draft');
 const rows=referencePresentation([example,approved,approvedComponents,draft]);
 assert.deepEqual(rows.map(r=>r.content.id),['example','draft-meaning']);
});
test('competing readings and meanings remain separate, drafts cannot enrich; complete mnemonic replaces excerpt display',()=>{
 const word=c('word','sentence',{sourceWord:true,japanese:'生物',reading:null});
 const a=c('a','explanation',{originalJapanese:'生物',selectedMeanings:['Life'],dictionaryEvidence:{reading:'せいぶつ'}});
 const b=c('b','explanation',{originalJapanese:'生物',selectedMeanings:['Food'],dictionaryEvidence:{reading:'なまもの'}});
 const draft=c('draft','explanation',{originalJapanese:'生物',selectedMeanings:['Draft'],dictionaryEvidence:{reading:'せいぶつ'}},'draft');
 const excerpt=c('excerpt','explanation',{kind:'dictionaryKanjiReference',meaningMnemonicExcerpt:'Short excerpt'});
 const full=c('full','explanation',{kind:'generatedKanjiMnemonic',meaningMnemonic:'A complete original story.'});
 const rows=referencePresentation([word,a,b,draft,excerpt,full]);
 assert.equal(rows.find(r=>r.content.id==='word').reading,'');assert.equal(rows.find(r=>r.content.id==='word').supplement,null);
 assert.ok(rows.some(r=>r.content.id==='a'));assert.ok(rows.some(r=>r.content.id==='b'));assert.ok(rows.some(r=>r.content.id==='draft'));
 assert.ok(!rows.some(r=>r.content.id==='excerpt'));assert.ok(rows.some(r=>r.content.id==='full'));
});
test('a draft JMdict word meaning fills the matching book example and is not shown separately',()=>{
 const book=c('book','sentence',{japanese:'お腹',reading:'おなか',translation:null});
 const draft=c('draft','explanation',{kind:'dictionaryWordMeaning',originalJapanese:'お腹',reading:'おなか',selectedMeanings:['belly','abdomen','stomach']},'draft');
 const rows=referencePresentation([book,draft]);
 assert.deepEqual(rows.map(r=>r.content.id),['book']);assert.equal(rows[0].supplement.id,'draft');
});
