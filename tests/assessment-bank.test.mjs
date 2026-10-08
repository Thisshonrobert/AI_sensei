import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { parseBank, bankHash } from '../src/lib/server/assessment/bank.mjs';
const target=randomUUID();
const bank=()=>({version:1,passages:[],questions:[{id:randomUUID(),domain:'vocabulary',objective:'vocab_reading_meaning',primaryTargetItemId:target,targetIds:[target],supportingItemIds:[],exposesItemIds:[],prompt:'Recall both components',format:'short_answer',options:[],supportingReviewed:true,unresolved:false,rubric:{mode:'self',expectedAnswer:'reading + selected meaning',explanation:'Checked rubric',acceptableAnswers:[]}}]});
test('bank requires reviewed supporting language and rubric; hash binds every reviewed field',()=>{
 const b=bank();assert.equal(parseBank(b).questions.length,1);
 const hash=bankHash(b);b.questions[0].prompt='changed';assert.notEqual(bankHash(b),hash);
 b.questions[0].supportingReviewed=false;assert.throws(()=>parseBank(b));
 b.questions[0].supportingReviewed=true;b.questions[0].rubric.expectedAnswer='';assert.throws(()=>parseBank(b));
});
test('bank rejects dangling primary targets, unsafe choice keys and unpaired reading',()=>{
 const b=bank();b.questions[0].primaryTargetItemId=randomUUID();assert.throws(()=>parseBank(b));
 const c=bank();c.questions[0].rubric.mode='choice';c.questions[0].rubric.acceptableAnswers=['X'];assert.throws(()=>parseBank(c));
 const r=bank();r.questions[0].domain='reading';r.questions[0].passageId=randomUUID();assert.throws(()=>parseBank(r));
});
test('cumulative passages retain exposure links for an 85-item study week',()=>{
 const b=bank();b.questions[0].exposesItemIds=Array.from({length:85},()=>randomUUID());
 assert.equal(parseBank(b).questions[0].exposesItemIds.length,85);
});
