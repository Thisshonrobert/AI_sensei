import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProviderDraft } from '../src/lib/server/generation/contract.mjs';
const id='11111111-1111-4111-8111-111111111111';
const output=()=>({version:1,kind:'sentence',title:'Context',japanese:'僕は健康です。😀僕も健康です。',translation:'I am healthy.',uses:[{itemId:id,quote:'健康',occurrence:1,reading:'けんこう',sense:'health'}],omissions:[],support:[],issues:[],sentences:[{quote:'僕は健康です。',occurrence:0,translation:'I am healthy.'},{quote:'😀僕も健康です。',occurrence:0,translation:'I am healthy too.'}],questions:[]});
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
test('provider passages cannot exceed fifteen sentence lines',()=>{
 assert.throws(()=>normalizeProviderDraft({...output(),kind:'passage',japanese:Array(16).fill('僕です。').join('\n')}),/fifteen/);
});
