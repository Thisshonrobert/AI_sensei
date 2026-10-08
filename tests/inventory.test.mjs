import test from 'node:test';
import assert from 'node:assert/strict';
import {previewBatch} from '../src/lib/server/content/canonical-import.mjs';
test('inventory batches candidate queries while preserving homographs and non-entry records',async()=>{
 for(const kind of ['vocabulary','kanji','grammar']){
  let queries=0;
  const identity=kind==='kanji'?{kanji:{glyph:'本'}}:kind==='vocabulary'?{vocabulary:{writtenForm:'本'}}:{grammar:{pattern:'本'}};
  const candidates=['first','second'].map(id=>({id,kind,canonicalKey:id,revision:1,...identity}));
  const raw={word:'本',character:'本',pattern:'本'};
  const batch={id:'11111111-1111-4111-8111-111111111111',source:{},validationErrorsJson:[],stagedJson:{content_type:kind,entries:[{...raw,source_record_key:'a'},{...raw,source_record_key:'b'}],exercise_passages:[{source_record_key:'passage'}],lesson_questions:[{source_record_key:'question'}]}};
  const tx={importBatch:{findUnique:async()=>batch},item:{findMany:async query=>{queries++;assert.equal(query.take,1001);return candidates;}}};
  const result=await previewBatch({$transaction:async callback=>callback(tx)},batch.id);
  assert.equal(queries,1);assert.equal(result.records.length,4);
  for(const record of result.records.slice(0,2))assert.deepEqual(record.candidates,candidates.map(({id,kind,canonicalKey,revision})=>({id,kind,canonicalKey,revision})));
  for(const record of result.records.slice(2))assert.deepEqual(record.candidates,[]);
 }
});
