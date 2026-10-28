import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJmdict, dictionaryCandidates } from '../src/lib/server/generation/dictionary.mjs';
import { prepareReader } from '../src/lib/server/generation/reader.mjs';
import { installDictionary } from '../scripts/update-reader-dictionary.mjs';
import { mkdtemp,readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const xml=`<?xml version="1.0"?><!DOCTYPE JMdict [<!ENTITY n "noun"><!ENTITY v1 "Ichidan verb">]><JMdict>
<entry><ent_seq>1</ent_seq><k_ele><keb>食べる</keb></k_ele><r_ele><reb>たべる</reb></r_ele><sense><pos>&v1;</pos><gloss>to eat</gloss></sense></entry>
<entry><ent_seq>2</ent_seq><k_ele><keb>今日</keb></k_ele><r_ele><reb>きょう</reb></r_ele><r_ele><reb>こんにち</reb></r_ele><sense><pos>&n;</pos><gloss>today</gloss></sense></entry>
<entry><ent_seq>3</ent_seq><k_ele><keb>図書館</keb></k_ele><r_ele><reb>としょかん</reb></r_ele><sense><pos>&n;</pos><gloss>library</gloss></sense></entry>
<entry><ent_seq>4</ent_seq><k_ele><keb>上手</keb></k_ele><k_ele><keb>上手い</keb></k_ele><r_ele><reb>じょうず</reb><re_restr>上手</re_restr></r_ele><r_ele><reb>うまい</reb><re_restr>上手い</re_restr></r_ele><r_ele><reb>かみて</reb><re_nokanji/></r_ele><sense><pos>&n;</pos><stagk>上手</stagk><stagr>じょうず</stagr><gloss>skillful</gloss></sense><sense><stagk>上手い</stagk><gloss>good</gloss></sense></entry>
</JMdict>`;
const entries=parseJmdict(xml);
const lookup=async form=>dictionaryCandidates(entries,form);
const run=(japanese,uses=[],status='draft')=>({id:'fixture',revision:3,status,scope:{targets:[{id:'eat',kind:'vocabulary',writtenForm:'食べる',variants:[]}],support:[]},draft:{japanese,uses}});
test('JMdict preserves reading/spelling/sense restrictions and inherited POS',()=>{
 const result=dictionaryCandidates(entries,'上手');assert.equal(result.length,1);assert.deepEqual(result[0].readings,['じょうず']);assert.deepEqual(result[0].senses[0].meanings,['skillful']);
 assert.deepEqual(dictionaryCandidates(entries,'上手い')[0].senses[0].pos,['noun']);
 assert.throws(()=>parseJmdict(xml.replace('&n;','&unknown;')),/entity/);
 assert.throws(()=>parseJmdict('<!DOCTYPE JMdict SYSTEM "file:///secret"><JMdict/>'),/external/i);
});
test('non-target compounds, conjugations, ambiguity and missing words remain reference candidates',async()=>{
 const r=await prepareReader(run('😀今日は図書館で食べました。謎語彙。'),{lookup});
 const spans=r.words;const today=spans.find(w=>w.surface==='今日');assert.equal(today.start,2);assert.equal(today.ambiguous,true);assert.equal(today.reading,'きょう');assert.equal(today.readingSource,'dictionary');
 const library=spans.find(w=>w.surface==='図書館');assert.equal(library.reading,'としょかん');assert.equal(library.entries[0].senses[0].pos[0],'noun');
 const ate=spans.find(w=>w.surface==='食べました');assert.equal(ate.lemma,'食べる');assert.equal(ate.reading,'たべました');assert.equal(ate.readingSource,'analyzer');
 assert.ok(spans.some(w=>w.entries.length===0));assert.ok(spans.every(w=>w.itemId===undefined));
 assert.equal(r.revision,3);assert.equal(r.text, '😀今日は図書館で食べました。謎語彙。');
});
test('annotations win, overlaps are deterministic, malformed UTF-16 spans are rejected, input unchanged',async()=>{
 const value=run('😀今日食べる。',[{itemId:'eat',start:4,end:7,reading:'たべる',sense:'approved eating'},{itemId:'kanji',start:4,end:5,reading:'しょく',sense:'character'},{itemId:'invalid',start:1,end:3,reading:'x',sense:'x'}],'approved');
 const before=structuredClone(value);const r=await prepareReader(value,{lookup});const w=r.words.find(w=>w.surface==='食べる');assert.equal(w.itemId,'eat');assert.equal(w.readingSource,'annotation');assert.equal(w.reading,'たべる');assert.equal(r.words.filter(w=>w.start>=4&&w.end<=7).length,1);assert.deepEqual(value,before);
});
test('a partial-character annotation cannot split a tokenizer whole word or hide remaining kanji',async()=>{
 const r=await prepareReader(run('図書館。',[{itemId:'glyph',start:0,end:1,reading:'ず',sense:'character'}]),{lookup});assert.equal(r.words.length,1);assert.equal(r.words[0].surface,'図書館');assert.equal(r.words[0].readingSource,'dictionary');
});
test('dictionary outage leaves analyzer spans and explicit unavailable reference data',async()=>{
 const r=await prepareReader(run('図書館で食べた。'),{lookup:async()=>{throw new Error('missing file');}});assert.equal(r.dictionary.status,'unavailable');assert.ok(r.words.some(w=>w.surface==='食べた'));assert.ok(r.words.every(w=>!w.entries.length));
});
test('suru and connective auxiliary inflections retain whole surfaces without synthesizing kanji readings',async()=>{
 const r=await prepareReader(run('食事しました。食べている。'),{lookup});
 assert.ok(r.words.some(w=>w.surface==='食事しました'&&w.reading==='しょくじしました'));
 assert.ok(r.words.some(w=>w.surface==='食べている'&&w.reading==='たべている'));
});
test('ordinary particles cannot turn a contextual noun into an unrelated longer dictionary expression',async()=>{
 const greeting={id:'greeting',form:'今日は',readings:['こんにちは'],senses:[{meanings:['hello'],pos:['expression'],readings:[],notes:[]}]};
 const r=await prepareReader(run('今日は図書館へ行く。'),{lookup:async form=>form==='今日は'?[greeting]:lookup(form)});
 assert.ok(r.words.some(w=>w.surface==='今日'));assert.ok(!r.words.some(w=>w.surface==='今日は'));
});
test('unrecognized supplementary kanji remains interactive with no guessed reading',async()=>{
 const r=await prepareReader(run('😀𠮷。'),{lookup});const w=r.words.find(w=>w.surface==='𠮷');assert.equal(w.start,2);assert.equal(w.end,4);assert.equal(w.reading,null);assert.deepEqual(w.entries,[]);
});
test('inflected verbs use analyzer lemma rather than noun homographs of their continuative stems',async()=>{
 const entry=form=>[{id:form,form,readings:[form==='行く'?'いく':'いき'],senses:[{meanings:[form==='行く'?'to go':'outbound ticket'],pos:[],readings:[],notes:[]}]}];
 const r=await prepareReader(run('行きました。'),{lookup:async form=>['行く','行き'].includes(form)?entry(form):[]});const w=r.words[0];assert.equal(w.surface,'行きました');assert.equal(w.lemma,'行く');assert.deepEqual(w.entries[0].senses[0].meanings,['to go']);
});
test('reinstalling identical dictionary content publishes a fresh edition and never overwrites the active records',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ai-sensei-dictionary-test-')),metadata={version:1,sha256:'a'.repeat(64),updatedAt:new Date().toISOString()};
 await installDictionary(entries,metadata,'synthetic licence',root);const first=JSON.parse(await readFile(join(root,'current.json'),'utf8')),original=await readFile(join(root,first.edition,'entries.jsonl'),'utf8');
 await installDictionary(entries,metadata,'synthetic licence',root);const second=JSON.parse(await readFile(join(root,'current.json'),'utf8'));assert.notEqual(second.edition,first.edition);assert.equal(await readFile(join(root,first.edition,'entries.jsonl'),'utf8'),original);assert.equal(await readFile(join(root,second.edition,'entries.jsonl'),'utf8'),original);
 const refs=JSON.parse(await readFile(join(root,second.edition,'index.json'),'utf8'));const bytes=Buffer.from(original),[offset,length]=refs['食べる'][0];assert.equal(JSON.parse(bytes.subarray(offset,offset+length).toString()).id,'1');
});
test('every token is a reader word; particles are not content words',async()=>{
 const r=await prepareReader(run('ここで食べる。'),{lookup});
 assert.deepEqual(r.words.map(w=>[w.surface,w.content]),[['ここ',true],['で',false],['食べる',true]]);
});
test('inflected words carry a local Satori-style sentence form label',async()=>{
 const r=await prepareReader(run('雨が降っていた。本を読みました。食べられない。行ってしまった。降ったら、高くなかった。行こう。'),{lookup});
 const form=surface=>r.words.find(w=>w.surface===surface)?.form;
 assert.equal(form('降っていた'),'Progressive | past');assert.equal(form('読みました'),'Polite | past');
 assert.equal(form('食べられない'),'Passive / potential | negative');assert.equal(form('行ってしまった'),'Completed | past');
 assert.equal(form('降ったら'),'Conditional');assert.equal(form('高くなかった'),'Negative | past');assert.equal(form('行こう'),'Volitional');
 assert.equal(form('雨'),null);
});
test('N5–N3 inventory and studied kanji form the known set for knowledge-based furigana',async()=>{
 const { N5_N3_KANJI,knownKanji }=await import('../src/lib/server/generation/reader.mjs');
 assert.equal(N5_N3_KANJI.length,619);assert.ok(N5_N3_KANJI.includes('食'));assert.ok(!N5_N3_KANJI.includes('鬱'));
 assert.deepEqual([...'一十百円日月火水木金土本人今年時分半午前後上下中外学校生先何見行来出入読書話言食飲買会休長高新古大小身的無可坊畑'].filter(c=>!N5_N3_KANJI.includes(c)),[]);
 const db={kanji:{findMany:async()=>[{glyph:'鬱'},{glyph:'食'}]}};
 const known=await knownKanji(db,'user');assert.ok(known.includes('鬱'));assert.equal(known.length,620);
});
test('JMdict phrases spanning several words attach as expression entries to each member word',async()=>{
 const scream={id:'x',form:'悲鳴を上げる',readings:['ひめいをあげる'],senses:[{meanings:['to scream'],pos:['Ichidan verb'],readings:[],notes:[]}]};
 const greeting={id:'g',form:'今日は',readings:['こんにちは'],senses:[{meanings:['hello'],pos:['expression'],readings:[],notes:[]}]};
 const r=await prepareReader(run('悲鳴を上げた。今日は休む。'),{lookup:async form=>form==='悲鳴を上げる'?[scream]:form==='今日は'?[greeting]:lookup(form)});
 for(const surface of ['悲鳴','を','上げた'])assert.equal(r.words.find(w=>w.surface===surface).expressions?.[0].form,'悲鳴を上げる');
 assert.equal(r.words.find(w=>w.surface==='今日').expressions,undefined);
});
