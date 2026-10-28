import test from 'node:test';
import assert from 'node:assert/strict';
import { configuration, initialState, schedule } from '../src/lib/server/review/scheduler.mjs';
import { DEFAULT_CAPS, splitCap, retrievability, planQueue, category } from '../src/lib/server/review/selection.mjs';

const config = configuration();
const t0 = new Date('2026-10-01T00:00:00Z');
const now = new Date('2026-10-20T00:00:00Z');
// Good reviews on different days give different stabilities, so retrievability at `now` differs.
function reviewed(days) {
  let state = initialState(t0);
  let at = t0;
  for (const d of days) { at = new Date(+t0 + d * 86400000); state = schedule(state, at, 3, config).card; }
  return state;
}
let n = 0;
const card = (objective, extra = {}) => ({ id: `c${++n}`, objective, itemId: `i${n}`, dueAt: new Date(+now - 1000), fsrsStateJson: initialState(t0), ...extra });
const siblings = (a, b) => a.itemId === b.itemId;

test('default caps are 100 vocabulary, 40 kanji and 10 grammar', () => {
  assert.deepEqual(DEFAULT_CAPS, { vocabulary: 100, kanji: 40, grammar: 10 });
  assert.equal(category({ objective: 'kanji_meaning' }), 'kanji');
});

test('splitCap holds 70/30 and flows unused share', () => {
  assert.deepEqual(splitCap(100, 150, 80), { first: 70, due: 30 });
  assert.deepEqual(splitCap(100, 20, 80), { first: 20, due: 80 });
  assert.deepEqual(splitCap(100, 150, 5), { first: 95, due: 5 });
  assert.deepEqual(splitCap(0, 10, 10), { first: 0, due: 0 });
  assert.deepEqual(splitCap(7, 10, 10), { first: 4, due: 3 });
  assert.deepEqual(splitCap(-3, 10, 10), { first: 0, due: 0 });
});

test('retrievability is 0 for new state and in (0,1] for reviewed state', () => {
  assert.equal(retrievability(initialState(t0), now, config), 0);
  const r = retrievability(reviewed([0, 1]), now, config);
  assert.ok(r > 0 && r <= 1);
});

test('planQueue orders due cards by lowest retrievability first', () => {
  const weak = card('vocab_reading_meaning', { fsrsStateJson: reviewed([0]) });
  const strong = card('vocab_reading_meaning', { fsrsStateJson: reviewed([0, 1, 4, 12]) });
  const q = planQueue({ waiting: [], due: [strong, weak], caps: DEFAULT_CAPS, used: {}, now, config, siblings });
  assert.deepEqual(q.map(c => c.id), [weak.id, strong.id]);
});

test('planQueue applies per-type caps with the split, first-recall cards first', () => {
  const waiting = [card('vocab_reading_meaning'), card('vocab_reading_meaning'), card('vocab_reading_meaning'), card('kanji_meaning')];
  const due = [0, 1, 2].map(() => card('vocab_reading_meaning', { fsrsStateJson: reviewed([0]) }));
  const q = planQueue({ waiting, due, caps: { vocabulary: 2, kanji: 40, grammar: 10 }, used: {}, now, config, siblings });
  assert.deepEqual(q.map(c => c.id), [waiting[0].id, waiting[3].id, due[0].id]);
});

test('planQueue subtracts used counts and skips siblings', () => {
  const a = card('vocab_reading_meaning');
  const sib = { ...card('vocab_reading_meaning'), itemId: a.itemId };
  const b = card('vocab_reading_meaning');
  assert.deepEqual(planQueue({ waiting: [a, sib, b], due: [], caps: DEFAULT_CAPS, used: {}, now, config, siblings }).map(c => c.id), [a.id, b.id]);
  assert.deepEqual(planQueue({ waiting: [a, b], due: [], caps: DEFAULT_CAPS, used: { vocabulary: 99 }, now, config, siblings }).map(c => c.id), [a.id]);
});
