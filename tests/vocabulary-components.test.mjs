import test from 'node:test';
import assert from 'node:assert/strict';
import { vocabularyComponentAid } from '../src/lib/server/content/vocabulary-components.mjs';
const item={revision:2,vocabulary:{writtenForm:'設定',reading:'せってい'}};
const payload={kind:'vocabularyComponentAid',itemRevision:2,word:'設定',reading:'せってい',components:[{text:'設',reading:'せっ',meanings:['establish'],readingType:'contextual',note:'Sound change in this word.'},{text:'定',reading:'てい',meanings:['determine'],readingType:'contextual'}]};
const content={kind:'explanation',origin:'generated',status:'approved',successor:null,payloadJson:payload};
test('component aids require a unique approved current exact identity',()=>{
 assert.deepEqual(vocabularyComponentAid(item,[content]),payload);
 for(const bad of [{...content,status:'draft'},{...content,successor:{id:'later'}},{...content,payloadJson:{...payload,itemRevision:1}},{...content,payloadJson:{...payload,word:'別語'}},{...content,payloadJson:{...payload,reading:'べつご'}}])assert.equal(vocabularyComponentAid(item,[bad]),null);
 assert.equal(vocabularyComponentAid(item,[content,content]),null);
});
test('component aids reject invented kanji readings, missing meanings and unresolved parts',()=>{
 for(const changed of [{reading:'設置'},{meanings:[]},{readingType:'unresolved'},{reading:null,readingType:'contextual'}]) {
  assert.equal(vocabularyComponentAid(item,[{...content,payloadJson:{...payload,components:[{...payload.components[0],...changed}]}}]),null);
 }
 const opaque={text:'熟字',reading:null,meanings:['whole expression'],readingType:'whole_word',note:'Read the expression as a whole; no individual reading is assigned.'};
 assert.ok(vocabularyComponentAid(item,[{...content,payloadJson:{...payload,components:[opaque]}}]));
});
