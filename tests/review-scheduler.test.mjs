import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyCard, fsrs, generatorParameters } from 'ts-fsrs';
import { configuration, schedule, studyDay, nextStudyDay, effectiveRating } from '../src/lib/server/review/scheduler.mjs';
import { normalizeReading } from '../src/lib/server/review/service.mjs';

test('all fixed-time transitions round-trip the complete pinned library card/log', () => {
 const now = new Date('2026-10-06T10:00:00Z');
 const config = configuration();
 assert.deepEqual(config.parameters, generatorParameters({ request_retention: .9, enable_fuzz: false, enable_short_term: true, learning_steps: ['1m','10m'], relearning_steps: ['10m'] }));
 assert.equal(config.libraryVersion, '5.4.2');
 for (const rating of [1,2,3,4]) {
  const card = createEmptyCard(now);
  const result = schedule(JSON.parse(JSON.stringify(card)), now, rating, config);
  assert.deepEqual(result, JSON.parse(JSON.stringify(fsrs(config.parameters).next(card, now, rating))));
  const later = new Date(result.card.due);
  assert.deepEqual(schedule(result.card, later, 1, config), JSON.parse(JSON.stringify(fsrs(config.parameters).next(result.card, later, 1))));
 }
 assert.equal(schedule(JSON.parse(JSON.stringify(createEmptyCard(now))), now, 1, config).card.due,'2026-10-06T10:01:00.000Z');
 assert.equal(schedule(JSON.parse(JSON.stringify(createEmptyCard(now))), now, 3, config).card.due,'2026-10-06T10:10:00.000Z');
});
test('combined recall forces Again on either failure; equivalent meaning uses self assessment', () => {
 for (const pair of [[false,true],[true,false],[false,false]]) assert.equal(effectiveRating('vocab_reading_meaning',4,{readingCorrect:pair[0],meaningCorrect:pair[1]}),1);
 assert.equal(effectiveRating('vocab_reading_meaning',3,{readingCorrect:true,meaningCorrect:true}),3);
 assert.throws(()=>effectiveRating('vocab_reading_meaning',3,{}));
});
test('IANA study days and next local midnight include offset and DST boundaries', () => {
 assert.equal(studyDay(new Date('2026-10-05T19:00:00Z'),'Asia/Calcutta'),'2026-10-06');
 assert.equal(nextStudyDay(new Date('2026-10-05T19:00:00Z'),'Asia/Calcutta').toISOString(),'2026-10-06T18:30:00.000Z');
 assert.equal(nextStudyDay(new Date('2026-03-08T06:00:00Z'),'America/New_York').toISOString(),'2026-03-09T04:00:00.000Z');
});
test('reading comparison normalizes kana and whitespace without erasing long-vowel distinctions',()=>{
 assert.equal(normalizeReading('  ｼﾞｯｼ　'),normalizeReading('じっし'));
 assert.equal(normalizeReading('ジッシ'),normalizeReading('じっし'));
 assert.notEqual(normalizeReading('おお'),normalizeReading('おう'));
});
