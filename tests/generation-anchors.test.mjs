import test from 'node:test';
import assert from 'node:assert/strict';
import * as contract from '../src/lib/server/generation/contract.mjs';
const {normalizeProviderDraft,unprovidedKanji}=contract;
const id='11111111-1111-4111-8111-111111111111';
const output=()=>({version:1,kind:'sentence',title:'Context',japanese:'僕は健康です。😀僕も健康です。',translation:'I am healthy.',uses:[{itemId:id,quote:'健康',occurrence:1,reading:'けんこう',sense:'health'}],omissions:[],support:[],issues:[],sentences:[{quote:'僕は健康です。',occurrence:0,translation:'I am healthy.'},{quote:'😀僕も健康です。',occurrence:0,translation:'I am healthy too.'}],questions:[]});
test('practice keeps supplied study kanji and requires kana for incidental kanji',()=>{
 assert.equal(typeof unprovidedKanji,'function');
 const scope={targets:[{writtenForm:'健康',variants:[]}],support:[{writtenForm:'僕',variants:['私']}]};
 assert.deepEqual(unprovidedKanji({...output(),japanese:'僕は健康です。私もげんきです。'},scope),[]);
 assert.deepEqual(unprovidedKanji({...output(),japanese:'僕は健康です。審査と履歴。審査。'},scope),['審','査','履','歴']);
 assert.deepEqual(unprovidedKanji({...output(),japanese:'僕は健康です。',title:'審査のはなし'},scope),['審','査']);
 assert.deepEqual(unprovidedKanji({...output(),japanese:'僕は健康です。',questions:[{prompt:'審査は？',options:[{text:'履歴'}],explanation:'弁護'}]},scope),['審','査','履','歴','弁','護']);
 assert.deepEqual(unprovidedKanji({...output(),japanese:'😀𠮷',questions:[]},scope),['𠮷']);
});
test('provider anchors resolve repeated words and UTF-16 positions without model arithmetic',()=>{
 const draft=normalizeProviderDraft(output());
 assert.deepEqual(draft.uses[0],{itemId:id,start:11,end:13,reading:'けんこう',sense:'health'});
 assert.equal(draft.japanese.slice(draft.uses[0].start,draft.uses[0].end),'健康');
 assert.equal(draft.sentences[1].start,7);
});
test('missing or ambiguous anchors cannot silently fabricate positions',()=>{
 assert.throws(()=>normalizeProviderDraft({...output(),uses:[{...output().uses[0],quote:'不存在'}]}));
 assert.throws(()=>normalizeProviderDraft({...output(),uses:[{...output().uses[0],occurrence:10}]}));
 assert.throws(()=>normalizeProviderDraft({...output(),uses:[{...output().uses[0],quote:'\uD83D',occurrence:0}]}));
});
test('provider passages accept 10–15 sentences in one paragraph and reject shorter or longer',()=>{
 const passage=count=>({...output(),kind:'passage',japanese:'僕です。'.repeat(count),uses:[{...output().uses[0],quote:'僕',occurrence:0}],sentences:[],questions:[0,1].map(i=>({prompt:`Who? ${i}`,targetIds:[id],options:[{label:'A',text:'Me'},{label:'B',text:'Someone else'}],answer:'A',explanation:'The narrator speaks.',evidence:{quote:'僕',occurrence:0}}))});
 assert.equal(normalizeProviderDraft(passage(10)).japanese,'僕です。'.repeat(10));
 assert.equal(normalizeProviderDraft(passage(15)).japanese,'僕です。'.repeat(15));
 assert.throws(()=>normalizeProviderDraft(passage(9)),/10–15 sentences/);
 assert.throws(()=>normalizeProviderDraft(passage(16)),/10–15 sentences/);
 assert.throws(()=>normalizeProviderDraft({...passage(16),japanese:Array(16).fill('僕です。').join('\n')}),/10–15 sentences/);
});
