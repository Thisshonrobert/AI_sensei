import test from 'node:test';
import assert from 'node:assert/strict';
import { allocate, selectAssessment } from '../src/lib/server/assessment/selection.mjs';
const now=new Date('2026-10-08T10:00:00Z');
const item=(id,extra={})=>({id,kind:'vocabulary',status:'approved',introducedAt:'2026-09-01T00:00:00Z',baselineStatus:'none',...extra});
const question=(id,target,extra={})=>({id,revision:1,domain:'vocabulary',primaryTargetItemId:target,targetIds:[target],exposesItemIds:[],...extra});
test('domain allocation uses largest remainder and deterministic tie order',()=>{
 assert.deepEqual(allocate(20,[8,5,5,2]),[8,5,5,2]);
 assert.deepEqual(allocate(3,[30,30,20,20]),[1,1,1,0]);
});
test('cumulative eligibility includes old and baseline without cards, excludes unseen, future and excluded targets',()=>{
 const items=[item('old'),item('base',{introducedAt:null,baselineStatus:'assumed'}),item('unseen',{introducedAt:null}),item('future',{introducedAt:'2026-10-09T00:00:00Z'}),item('excluded',{excludedFromTests:true})];
 const r=selectAssessment({items,questions:items.map(i=>question(i.id,i.id)),now,seed:'s',size:20});
 assert.deepEqual(new Set(r.questions.map(q=>q.primaryTargetItemId)),new Set(['old','base']));
 assert.equal(r.questions.find(q=>q.primaryTargetItemId==='base').stratum,'baseline');
 assert.equal(r.questions.length,2);
});
test('seeded sampling is stable, redistributes zero-baseline slots and never repeats a target',()=>{
 const items=Array.from({length:25},(_,i)=>item(`i${i}`,{introducedAt:'2026-10-07T00:00:00Z'}));
 const questions=items.flatMap(i=>[question(`a${i.id}`,i.id),question(`b${i.id}`,i.id)]);
 const input={items,questions,now,seed:'seed',size:20};const r=selectAssessment(input);
 assert.deepEqual(selectAssessment(input),r);assert.equal(r.questions.length,20);
 assert.equal(new Set(r.questions.map(q=>q.primaryTargetItemId)).size,20);
 assert.ok(r.questions.every(q=>q.stratum==='recent'));
});
test('weak baseline overrides baseline; prefer unexposed and least recently tested question alternatives',()=>{
 const items=[item('base',{introducedAt:null,baselineStatus:'verified',needsAttention:true}),item('old'),item('shown',{reviewedToday:true})];
 const questions=[question('repeat','old',{lastQuestionAt:'2026-10-07T00:00:00Z'}),question('fresh','old'),question('weak','base'),question('shown','shown')];
 const r=selectAssessment({items,questions,now,seed:'s',size:2,domain:'vocabulary'});
 assert.ok(r.questions.some(q=>q.id==='weak'&&q.stratum==='weak'));assert.ok(r.questions.some(q=>q.id==='fresh'));
});
test('answer-exposing links conflict symmetrically including supporting sentences',()=>{
 const items=[item('a'),item('b'),item('c')];
 const r=selectAssessment({items,questions:[question('a','a',{exposesItemIds:['b']}),question('b','b'),question('c','c')],now,seed:'s',size:20});
 assert.equal(r.questions.length,2);assert.ok(!(r.questions.some(q=>q.id==='a')&&r.questions.some(q=>q.id==='b')));
});
test('reading selects two questions from one passage and shortens sparse pools without duplicate targets',()=>{
 const items=[item('a'),item('b'),item('c')];
 const questions=[question('a','a',{domain:'reading',passageId:'p'}),question('b','b',{domain:'reading',passageId:'p'}),question('c','c',{domain:'reading',passageId:'orphan'})];
 const r=selectAssessment({items,questions,now,seed:'s',size:20});
 assert.equal(r.questions.length,2);assert.equal(r.coverage.reading,2);
 assert.ok(r.questions.every(q=>q.passageId==='p'));
});
