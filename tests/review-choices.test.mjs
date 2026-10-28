import test from 'node:test';
import assert from 'node:assert/strict';
import { buildKanjiMeaningChoices, buildKanjiReadingChoices, buildVocabChoices } from '../src/lib/server/review/choices.mjs';

const target={itemId:'t',writtenForm:'試験',reading:'しけん',meaning:'examination',acceptedGlosses:['exam'],partOfSpeech:'noun'};
const candidates=[
 {itemId:'a',writtenForm:'時間',reading:'じかん',meaning:'time',partOfSpeech:'noun'},
 {itemId:'b',writtenForm:'事件',reading:'じけん',meaning:'incident',partOfSpeech:'noun'},
 {itemId:'c',writtenForm:'用事',reading:'ようじ',meaning:'errand',partOfSpeech:'noun'},
];

test('vocabulary options pair real readings and meanings and isolate both components',()=>{
 const set=buildVocabChoices({target,candidates,seed:'session:card:0'});
 assert.ok(set);
 assert.equal(set.choices.length,4);
 assert.equal(new Set(set.choices.map(c=>`${c.reading}|${c.meaning}`)).size,4);
 const correct=set.choices.find(c=>c.id===set.correctChoiceId);
 assert.equal(correct.reading,'しけん');
 assert.equal(correct.meaning,'examination');
 assert.ok(set.choices.some(c=>c.tier==='same_reading'&&c.reading==='しけん'&&c.meaning!=='examination'));
 assert.ok(set.choices.some(c=>c.tier==='same_meaning'&&c.meaning==='examination'&&c.reading!=='しけん'));
 assert.ok(set.choices.some(c=>c.tier==='unrelated'));
 assert.equal(set.choices.some(c=>c.reading==='しけん'&&c.meaning==='exam'),false);
});

test('choice construction is deterministic and never uses the prompt word',()=>{
 const first=buildVocabChoices({target,candidates,seed:'same'});
 const second=buildVocabChoices({target,candidates,seed:'same'});
 assert.deepEqual(first,second);
 assert.equal(first.choices.some(c=>c.meaning===target.writtenForm),false);
 assert.match(first.fingerprint,/^[a-f0-9]{16}$/);
 assert.equal(buildVocabChoices({target,candidates:[candidates[0]],seed:'x'}),null);
});

const dictionary=new Map([
 ['価値',[{readings:['かち'],senses:[{meanings:['value','worth','merit']}]}]],
 ['条件',[{readings:['じょうけん'],senses:[{meanings:['condition','term','requirement']}]}]],
 ['種類',[{readings:['しゅるい'],senses:[{meanings:['variety','kind','type']}]}]],
 ['リーダー',[{readings:['リーダー'],senses:[{meanings:['leader']}]}]],
]);
const lookup=async form=>dictionary.get(form)||[];
const kanjiTarget={itemId:'t',glyph:'価',meaning:'Value',meanings:['Value'],onReadings:['か'],kunReadings:['あたい']};
const kanjiCandidates=[
 {itemId:'a',glyph:'条',meanings:['条件'],onReadings:['じょう'],kunReadings:[]},
 {itemId:'b',glyph:'般',meanings:['種類'],onReadings:['はん'],kunReadings:[]},
 {itemId:'c',glyph:'将',meanings:['リーダー'],onReadings:['しょう'],kunReadings:[]},
];
const examplesFor=async item=>item.itemId==='t'?[{word:'価値',reading:'かち'}]:[];

test('kanji meaning options pair an English meaning with a hiragana reading and stay distinct',async()=>{
 const first=await buildKanjiMeaningChoices({target:kanjiTarget,candidates:kanjiCandidates,seed:'k',lookup,examplesFor});
 assert.ok(first);
 assert.equal(first.choices.length,4);
 assert.equal(new Set(first.choices.map(choice=>choice.reading)).size,4);
 assert.equal(new Set(first.choices.map(choice=>choice.meaning)).size,4);
 for(const choice of first.choices){
  assert.match(choice.reading,/^[\u3041-\u309fー]+$/u);
  assert.match(choice.meaning,/^[a-z]/);
 }
 const correct=first.choices.find(choice=>choice.id===first.correctChoiceId);
 assert.equal(correct.reading,'かち');
 assert.equal(correct.meaning,'value');
 assert.deepEqual(first,await buildKanjiMeaningChoices({target:kanjiTarget,candidates:kanjiCandidates,seed:'k',lookup,examplesFor}));
 assert.equal(await buildKanjiMeaningChoices({target:kanjiTarget,candidates:[],seed:'x',lookup,examplesFor}),null);
});

test('a Japanese source gloss becomes a bilingual option and a missing reading falls back to typed recall',async()=>{
 const target={itemId:'j',glyph:'条',meaning:'条件',meanings:['条件'],onReadings:['じょう'],kunReadings:[]};
 const candidates=[
  {itemId:'t',glyph:'価',meaning:'Value',meanings:['Value'],onReadings:['か'],kunReadings:['あたい']},
  {itemId:'b',glyph:'般',meanings:['種類'],onReadings:['はん'],kunReadings:[]},
  {itemId:'c',glyph:'将',meanings:['リーダー'],onReadings:['しょう'],kunReadings:[]},
 ];
 const set=await buildKanjiMeaningChoices({target,candidates,seed:'j',lookup,examplesFor});
 assert.ok(set);
 const correct=set.choices.find(choice=>choice.id===set.correctChoiceId);
 assert.equal(correct.meaning,'condition');
 assert.equal(correct.reading,'じょうけん');
 assert.equal(await buildKanjiMeaningChoices({target:{itemId:'x',glyph:'x',meaning:'unknown',meanings:['unknown']},candidates:[],seed:'x',lookup,examplesFor}),null);
});

test('kanji reading options are distinct and fall back when the pool is too small',()=>{
 const reading=buildKanjiReadingChoices({target:{itemId:'t',reading:'しけん'},candidates:[{itemId:'a',reading:'じかん'},{itemId:'b',reading:'じけん'},{itemId:'c',reading:'ようじ'}],seed:'r'});
 assert.ok(reading);
 assert.equal(reading.choices.length,4);
 assert.equal(new Set(reading.choices.map(choice=>choice.reading)).size,4);
});

test('a kanji set never mixes a bare kanji reading with word readings',async()=>{
 // 試 has no example word whose gloss matches "test", so the correct option falls back to
 // the kanji reading. Every decoy must then be a bare reading too, otherwise the only
 // single-reading option is obviously the answer.
 const bareLookup=async()=>[];
 const bareTarget={itemId:'t',glyph:'試',meaning:'test',meanings:['test'],onReadings:['し'],kunReadings:['ためす']};
 const bareCandidates=[
  {itemId:'a',glyph:'書',meanings:['write'],onReadings:['しょ'],kunReadings:['かく']},
  {itemId:'b',glyph:'読',meanings:['read'],onReadings:['どく'],kunReadings:['よむ']},
  {itemId:'c',glyph:'験',meanings:['verify'],onReadings:['けん'],kunReadings:['あかす']},
 ];
 const set=await buildKanjiMeaningChoices({target:bareTarget,candidates:bareCandidates,seed:'b',lookup:bareLookup,examplesFor:async()=>[]});
 assert.ok(set);
 const correct=set.choices.find(choice=>choice.id===set.correctChoiceId);
 assert.equal(correct.reading,'ためす');
 const bareReadings=new Set(['ためす','し','かく','しょ','よむ','どく','けん','あかす']);
 for(const choice of set.choices)assert.ok(bareReadings.has(choice.reading),`${choice.reading} is not a bare kanji reading`);
});
