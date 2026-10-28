import test from 'node:test';
import assert from 'node:assert/strict';
import { pickMatchPairs, kanjiAnswer, vocabAnswer, MATCH_SIZE } from '../src/lib/server/practice/match.mjs';

const c = (id, answer, r) => ({ id, prompt: `p${id}`, answer, r });

test('pickMatchPairs takes size pairs with unique answers in shuffled order', () => {
  const candidates = [c(1, 'Plan', .1), c(2, ' plan ', .2), c(3, 'time', .9), c(4, 'errand', .3), c(5, 'incident', .4), c(6, 'river', .5), c(7, 'mountain', .6), c(8, 'sea', .7), c(9, 'sky', .8)];
  let x = 0;
  const pairs = pickMatchPairs(candidates, { size: 6, random: () => (x += .1) });
  assert.deepEqual(pairs.map(p => p.id), [1, 3, 4, 5, 6, 7]);
  assert.deepEqual(Object.keys(pairs[0]).sort(), ['answer', 'id', 'prompt']);
});

test('pickMatchPairs returns [] below three pairs', () => {
  assert.deepEqual(pickMatchPairs([c(1, 'a', .1), c(2, 'b', .2)]), []);
  assert.deepEqual(pickMatchPairs([c(1, 'a', .1), c(2, 'A', .2), c(3, 'b', .3)]), []);
  assert.equal(pickMatchPairs([c(1, 'a', .1), c(2, 'b', .2), c(3, 'c', .3)]).length, 3);
});

test('pickMatchPairs order follows the random source', () => {
  const tied = [c(1, 'a', .1), c(2, 'b', .5), c(3, 'c', .9), c(4, 'd', .2)];
  const ids = random => pickMatchPairs(tied, { size: 3, random }).map(p => p.id);
  const seq = step => { let x = step > 0 ? 0 : 1; return () => (x += step); };
  assert.deepEqual(ids(seq(.1)), [1, 2, 3]);
  assert.deepEqual(ids(seq(-.1)), [4, 3, 2]);
});

test('match sizes are 20 vocabulary and 10 kanji', () => {
  assert.deepEqual(MATCH_SIZE, { vocabulary: 20, kanji: 10 });
  const many = Array.from({ length: 40 }, (_, i) => c(i, `a${i}`, 0));
  assert.equal(pickMatchPairs(many).length, 20);
  assert.equal(pickMatchPairs(many, { size: MATCH_SIZE.kanji }).length, 10);
});

test('kanjiAnswer pairs a hiragana reading with the meaning, meaning only without readings', () => {
  assert.equal(kanjiAnswer({ onReadingsJson: ['シ'], kunReadingsJson: [] }, 'test'), 'し · test');
  assert.equal(kanjiAnswer({ onReadingsJson: ['シ'], kunReadingsJson: ['こころ.みる'] }, 'try'), 'こころみる · try');
  assert.equal(kanjiAnswer({ onReadingsJson: [], kunReadingsJson: [] }, 'test'), 'test');
  assert.equal(kanjiAnswer(null, 'test'), 'test');
});

test('vocabAnswer pairs the hiragana reading with the meaning, meaning only without a reading', () => {
  assert.equal(vocabAnswer({ reading: 'せいぶつ', meaning: 'living thing' }), 'せいぶつ · living thing');
  assert.equal(vocabAnswer({ reading: 'セイブツ', meaning: 'living thing' }), 'せいぶつ · living thing');
  assert.equal(vocabAnswer({ meaning: 'living thing' }), 'living thing');
});
