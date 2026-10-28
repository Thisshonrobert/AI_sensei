import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJmdict, dictionaryCandidates } from '../src/lib/server/generation/dictionary.mjs';
import { readingTokens } from '../src/lib/server/generation/analyzer.mjs';
import { validateAnnotation, annotationPrompt } from '../src/lib/server/generation/annotate.mjs';
import { prepareReader } from '../src/lib/server/generation/reader.mjs';

const xml=`<?xml version="1.0"?><!DOCTYPE JMdict [<!ENTITY n "noun"><!ENTITY v5r "Godan verb with 'ru' ending">]><JMdict>
<entry><ent_seq>1</ent_seq><k_ele><keb>雨</keb></k_ele><r_ele><reb>あめ</reb></r_ele><sense><pos>&n;</pos><gloss>rain</gloss></sense></entry>
<entry><ent_seq>2</ent_seq><k_ele><keb>降る</keb></k_ele><r_ele><reb>ふる</reb></r_ele><sense><pos>&v5r;</pos><gloss>to precipitate</gloss><gloss>to fall (e.g. rain)</gloss></sense></entry>
<entry><ent_seq>4</ent_seq><k_ele><keb>勉強</keb></k_ele><r_ele><reb>べんきょう</reb></r_ele><sense><pos>&n;</pos><gloss>study</gloss></sense></entry>
<entry><ent_seq>3</ent_seq><k_ele><keb>今日</keb></k_ele><r_ele><reb>きょう</reb></r_ele><sense><pos>&n;</pos><gloss>today</gloss></sense></entry>
</JMdict>`;
const entries=parseJmdict(xml),lookup=async form=>dictionaryCandidates(entries,form);
const japanese='今日は雨が降っていた。食べる。';
const draft={kind:'passage',japanese,uses:[{itemId:'eat',start:11,end:14,reading:'たべる',sense:'eat'}]};
const scope={targets:[{id:'eat',kind:'vocabulary',writtenForm:'食べる'},{id:'grammar-te-iru',kind:'grammar',writtenForm:'〜ている'}],support:[]};
const gloss=(quote,lemma,reading,sense,occurrence=0)=>({quote,occurrence,lemma,reading,sense,pos:'model pos'});

test('glosses must sit on word boundaries, match a JMdict lemma and reading, and avoid target uses',async()=>{
 const tokens=await readingTokens(japanese);
 const a=await validateAnnotation({glosses:[
  gloss('降っていた','降る','フル','to precipitate; to fall (e.g. rain)'),
  gloss('雨','雨','あめ','shower of rain'),
  gloss('今','今日','きょう','today'),
  gloss('今日','今日','こんにち','today'),
  gloss('食べる','食べる','たべる','eat'),
  gloss('雨','雨','あめ','rain'),
  gloss('今日','今日','きょう','today',1)
 ],grammarNotes:[],sentenceNotes:[]},{draft,scope,tokens,lookup});
 assert.deepEqual(a.glosses.map(g=>[g.start,g.end,g.source]),[[5,10,'dictionary'],[3,4,'ai']]);
 assert.equal(a.glosses[0].reading,'ふる');assert.equal(a.glosses[0].pos,"Godan verb with 'ru' ending");assert.equal(a.glosses[1].pos,'model pos');
});
test('a repeated word glossed twice with occurrence 0 covers both occurrences',async()=>{
 const text='雨と雨。',d={kind:'passage',japanese:text,uses:[]};
 const a=await validateAnnotation({glosses:[gloss('雨','雨','あめ','rain'),gloss('雨','雨','あめ','rain'),gloss('雨','雨','あめ','rain')],grammarNotes:[],sentenceNotes:[]},{draft:d,scope,tokens:await readingTokens(text),lookup});
 assert.deepEqual(a.glosses.map(g=>[g.start,g.end]),[[0,1],[2,3]]);
});
test('without analyzer tokens no gloss can be checked, and malformed output is rejected',async()=>{
 const a=await validateAnnotation({glosses:[gloss('雨','雨','あめ','rain')],grammarNotes:[],sentenceNotes:[]},{draft,scope,tokens:[],lookup});
 assert.deepEqual(a.glosses,[]);
 await assert.rejects(()=>validateAnnotation({glosses:'x'},{draft,scope,tokens:[],lookup}));
 await assert.rejects(()=>validateAnnotation({glosses:[gloss('\uD800','雨','あめ','rain')],grammarNotes:[],sentenceNotes:[]},{draft,scope,tokens:[],lookup}));
});
test('grammar notes resolve, drop overlaps, keep only supplied grammar target ids, and cap at 25',async()=>{
 const note=(quote,itemId,occurrence=0)=>({quote,occurrence,pattern:'〜ている',explanation:'Ongoing state.',...(itemId?{itemId}:{})});
 const a=await validateAnnotation({glosses:[],grammarNotes:[note('ていた','grammar-te-iru'),note('いた'),note('今日は','eat'),note('missing')],sentenceNotes:[]},{draft,scope,tokens:[],lookup});
 assert.deepEqual(a.grammarNotes.map(n=>[n.start,n.end,n.itemId??null]),[[7,10,'grammar-te-iru'],[0,3,null]]);
 const many=await validateAnnotation({glosses:[],grammarNotes:Array.from({length:30},(_,i)=>note('。',undefined,i)),sentenceNotes:[]},{draft:{...draft,japanese:'。'.repeat(30)},scope,tokens:[],lookup});
 assert.equal(many.grammarNotes.length,25);
});
test('sentence notes map 1-based numbers to sentence ids and drop empty or unknown sentences',async()=>{
 const a=await validateAnnotation({glosses:[],grammarNotes:[],sentenceNotes:[{sentence:1,literal:'As for today, rain was falling.'},{sentence:2},{sentence:9,note:'x'},{sentence:1,note:'duplicate'}]},{draft,scope,tokens:[],lookup});
 assert.deepEqual(a.sentenceNotes,[{sentenceId:'sentence-0',literal:'As for today, rain was falling.'}]);
});
test('a suru-verb lemma falls back to its JMdict noun entry',async()=>{
 const text='毎日勉強しています。',d={kind:'passage',japanese:text,uses:[]};
 const a=await validateAnnotation({glosses:[gloss('勉強しています','勉強する','べんきょうする','study')],grammarNotes:[],sentenceNotes:[]},{draft:d,scope,tokens:await readingTokens(text),lookup});
 assert.deepEqual(a.glosses.map(g=>[g.start,g.end,g.lemma,g.reading,g.source]),[[2,9,'勉強する','べんきょう','dictionary']]);
});
test('the prompt numbers sentences, lists targets to skip and offers only supplied grammar targets',()=>{
 const p=annotationPrompt(draft,scope);
 assert.match(p,/1\. 今日は雨が降っていた。/);assert.match(p,/"食べる"/);assert.match(p,/grammar-te-iru/);
});
test('the reader attaches a current-revision annotation and ignores a stale one',async()=>{
 const annotation={revision:3,glosses:[{start:5,end:10,lemma:'降る',reading:'ふる',sense:'to fall (e.g. rain)',pos:'verb',source:'dictionary'}],grammarNotes:[{start:7,end:10,pattern:'〜ている',explanation:'Ongoing.'}],sentenceNotes:[{sentenceId:'sentence-0',literal:'Rain was falling.'}]};
 const run=revision=>({id:'r',revision,status:'draft',scope,draft,report:{annotation}});
 const current=await prepareReader(run(3),{lookup});
 assert.equal(current.words.find(w=>w.start===5).gloss.sense,'to fall (e.g. rain)');
 assert.equal(current.grammarNotes.length,1);assert.equal(current.sentenceNotes[0].literal,'Rain was falling.');
 const stale=await prepareReader(run(4),{lookup});
 assert.ok(stale.words.every(w=>!w.gloss));assert.equal(stale.grammarNotes,undefined);
});
