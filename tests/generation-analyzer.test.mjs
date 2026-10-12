import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeDraft } from '../src/lib/server/generation/analyzer.mjs';
const id='10000000-0000-4000-8000-000000000001';
const word={id,kind:'vocabulary',revision:1,writtenForm:'食べる',reading:'たべる',meaning:'eat',variants:[]};
const value=(japanese,uses=[])=>({japanese,uses,issues:[],support:[]});
test('single-kanji dictionary words are valid context, but a glyph inside a longer word is not',async()=>{
 const check=(japanese,glyph,start,end,reading)=>analyzeDraft(value(japanese,[{itemId:id,start,end,reading,sense:'context'}]),{targets:[{id,kind:'kanji',writtenForm:glyph,variants:[]}],support:[]});
 const valid=await check('僕は元気です。','僕',0,1,'ぼく');
 assert.ok(!valid.problems.some(p=>p.code==='target_scope_violation'));
 const invalid=await check('健康です。','健',0,1,'けん');
 assert.ok(invalid.problems.some(p=>p.code==='target_scope_violation'));
});
test('independent analyzer resolves lemma with an approved construction and keeps untracked support informational',async()=>{
 const r=await analyzeDraft(value('食べました。りんごです。'),{targets:[word],support:[{id:'grammar',kind:'grammar',writtenForm:'ました',variants:[]}]});
 assert.equal(r.analyzerStatus,'ready');assert.ok(r.tokens.some(t=>t.lemma==='食べる'&&t.code==='known_inflection'));
 assert.ok(r.tokens.some(t=>t.surface==='りんご'&&t.code==='untracked_support'));assert.ok(r.tokens.some(t=>t.code==='punctuation'));
 assert.equal(r.tokens[0].start,0);assert.equal(r.tokens.at(-1).end,'食べました。りんごです。'.length);
});
test('longest approved phrase resolves before split tokens and emoji preserve UTF-16 positions',async()=>{
 const r=await analyzeDraft(value('😀気をつける。'),{targets:[{...word,writtenForm:'気をつける',reading:'きをつける'}],support:[]});
 const phrase=r.matches.find(m=>m.code==='approved_phrase');assert.ok(phrase);assert.equal(phrase.start,2);assert.equal(phrase.end,7);
});
test('ambiguous senses and mismatched declared readings stay explicit problems',async()=>{
 const r=await analyzeDraft(value('食べる。',[{itemId:id,start:0,end:3,reading:'のむ',sense:'eat'}]),{targets:[word],support:[{...word,id:'other',meaning:'different sense'}]});
 assert.ok(r.problems.some(p=>p.code==='ambiguous_sense'));assert.ok(r.problems.some(p=>p.code==='suspicious_reading'));
});
