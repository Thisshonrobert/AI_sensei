import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { parseDraft, validateScope, reviewHash } from '../src/lib/server/generation/contract.mjs';
const targetId=randomUUID();
const scope={targets:[{id:targetId,kind:'vocabulary',revision:1,writtenForm:'食べる',reading:'たべる',meaning:'eat'}],support:[]};
export function draft(id=targetId){return {version:1,kind:'sentence',title:'A meal',japanese:'食べました。',translation:'I ate.',uses:[{itemId:id,start:0,end:5,reading:'たべました',sense:'eat'}],omissions:[],support:[{start:5,end:6,classification:'punctuation',explanation:''}],issues:[],questions:[]};}
test('strict generated contract rejects provenance and malformed boundaries',()=>{
 assert.equal(parseDraft(draft()).kind,'sentence');
 assert.throws(()=>parseDraft({...draft(),origin:'book'}));
 assert.throws(()=>parseDraft({...draft(),japanese:'😀食べる',uses:[{itemId:targetId,start:1,end:3,reading:'x',sense:'x'}]}));
 assert.throws(()=>parseDraft({...draft(),uses:[{...draft().uses[0],end:200}]}));
});
test('target scope and untracked support have separate outcomes and omissions must reconcile',()=>{
 const value=draft();value.support=[{start:0,end:5,classification:'untracked_support',explanation:'Unregistered expression'}];
 const report=validateScope(value,scope);
 assert.equal(report.problems.length,0);assert.equal(report.untracked.length,1);
 assert.ok(validateScope(draft(randomUUID()),scope).problems.some(p=>p.code==='target_scope_violation'));
 assert.ok(validateScope({...draft(),uses:[]},scope).problems.some(p=>p.code==='missing_target_disposition'));
 assert.ok(validateScope({...draft(),issues:[{code:'suspicious_reading',start:0,end:5,reason:'Check conjugation'}]},scope).problems.some(p=>p.code==='suspicious_reading'));
});
test('model claims cannot approve scope; review hash changes with corrected content',()=>{
 assert.throws(()=>parseDraft({...draft(),supportingReviewed:true}));
 assert.notEqual(reviewHash(draft(),scope),reviewHash({...draft(),translation:'We ate.'},scope));
});
