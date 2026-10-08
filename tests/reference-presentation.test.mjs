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
