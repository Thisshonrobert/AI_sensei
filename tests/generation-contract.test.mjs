import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { parseDraft, validateScope, reviewHash, allowedKanji, unprovidedKanji, providerDraftJsonSchema, normalizeProviderDraft, reconcileDispositions } from '../src/lib/server/generation/contract.mjs';
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
test('allowed kanji are derived from forms and variants, and the provider schema mirrors structural minimums',()=>{
 const sc={targets:[{id:targetId,kind:'vocabulary',revision:1,writtenForm:'食べる',variants:['食う'],meaning:'eat'}],support:[{id:randomUUID(),kind:'kanji',revision:1,writtenForm:'学校',variants:[],meaning:['school']}]};
 // Target/support kanji plus the Waller N5–N3 inventory (amendment A7).
 for(const glyph of ['学','校','食','先','生','教'])assert.ok(allowedKanji(sc).includes(glyph));assert.equal(allowedKanji(sc).length,619);
 const value={...draft(),japanese:'食べました。学校。',translation:'I ate. School.'};
 assert.deepEqual(unprovidedKanji(value,sc),[]);
 assert.deepEqual(unprovidedKanji({...value,japanese:'教育。審査。'},sc),['審','査']);
 const q=providerDraftJsonSchema.properties.questions;
 assert.equal(q.minItems,2);assert.equal(q.items.properties.targetIds.minItems,1);
 assert.equal(q.items.properties.options.minItems,2);assert.equal(q.items.properties.prompt.minLength,1);
 assert.equal(providerDraftJsonSchema.properties.uses.items.properties.itemId.minLength,1);
 assert.equal(providerDraftJsonSchema.properties.sentences.minItems,1);assert.equal('maxItems' in q,false);
});
test('a missing quoted annotation reports the exact quote for the correction retry',()=>{
 const value={...draft(),uses:[{itemId:targetId,quote:'飲みました',occurrence:0,reading:'のみました',sense:'drink'}],sentences:[{quote:'食べました。',occurrence:0,translation:'I ate.'}]};
 assert.throws(()=>normalizeProviderDraft(value),/飲みました/);
});
test('an absent use quote can be recorded as an omission instead of failing the whole draft',()=>{
 const dropped=[];
 const value={...draft(),support:[{quote:'。',occurrence:0,classification:'punctuation',explanation:''}],uses:[{itemId:targetId,quote:'飲みました',occurrence:0,reading:'のみました',sense:'drink'}],sentences:[{quote:'食べました。',occurrence:0,translation:'I ate.'}]};
 const parsed=normalizeProviderDraft(value,id=>dropped.push(id));
 assert.deepEqual(parsed.uses,[]);assert.deepEqual(dropped,[targetId]);
});
test('large-pool bookkeeping slips are reconciled into disclosed omissions without touching text',()=>{
 const other=randomUUID(),wide={...scope,targets:[...scope.targets,{id:other,kind:'vocabulary',revision:1,writtenForm:'飲む',reading:'のむ',meaning:'drink'}]};
 const value={...draft(),omissions:[{itemId:targetId,reason:'Used anyway'},{itemId:randomUUID(),reason:'Unknown'}]};
 const {draft:fixed,repaired}=reconcileDispositions(value,wide);
 assert.equal(fixed.japanese,value.japanese);assert.equal(fixed.uses.length,1);
 assert.deepEqual(fixed.omissions.map(o=>o.itemId),[other]);assert.equal(repaired,3);
 assert.equal(validateScope(fixed,wide).problems.length,0);
 const dropped=reconcileDispositions(draft(),scope,[{itemId:targetId,start:0,end:5}]).draft;
 assert.deepEqual(dropped.uses,[]);assert.deepEqual(dropped.omissions.map(o=>o.itemId),[targetId]);
 assert.equal(reconcileDispositions(draft(),scope).repaired,0);
});
test('question tags shrink to demonstrated targets, fall back to the nearest demonstrated target, and otherwise still fail',()=>{
 const other=randomUUID(),wide={...scope,targets:[...scope.targets,{id:other,kind:'vocabulary',revision:1,writtenForm:'飲む',reading:'のむ',meaning:'drink'}]};
 const q=(ids,evidence={start:0,end:5})=>({prompt:'何をしましたか',targetIds:ids,options:[{label:'A',text:'食べた'},{label:'B',text:'寝た'}],answer:'A',explanation:'本文',evidence});
 const value={...draft(),kind:'passage',questions:[q([targetId,other]),q([other])]};
 const fixed=reconcileDispositions(value,wide);
 assert.deepEqual(fixed.draft.questions.map(x=>x.targetIds),[[targetId],[targetId]]);
 assert.equal(validateScope(fixed.draft,wide).problems.length,0);
 const nearby=reconcileDispositions({...value,questions:[q([targetId]),q([other],{start:5,end:6})]},wide);
 assert.deepEqual(nearby.draft.questions[1].targetIds,[targetId]);
 const unanchored=reconcileDispositions({...value,uses:[],questions:[q([targetId]),q([other],{start:5,end:6})]},wide);
 assert.deepEqual(unanchored.draft.questions[1].targetIds,[other]);
 assert.ok(validateScope(unanchored.draft,wide).problems.some(p=>p.code==='target_scope_violation'&&p.itemId===other));
});
