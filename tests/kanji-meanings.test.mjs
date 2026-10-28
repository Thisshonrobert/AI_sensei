import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveKanjiMeanings, isKanjiMeaningSupplement } from '../src/lib/server/content/kanji-meanings.mjs';

const supplement = (id, payload, extra = {}) => ({
  id, kind: 'explanation', status: 'approved', origin: 'user', revision: 1,
  createdAt: '2026-10-12T08:35:00.000Z', successor: null, payloadJson: { kind: 'dictionaryFieldSupplement', ...payload }, ...extra,
});
const dictionary = (id, meanings, extra = {}) => supplement(id, { fieldPath: 'meaning_en', addedBy: 'dictionary', selectedMeanings: meanings }, extra);
const ai = (id, fieldPath, meanings, extra = {}) => supplement(id, { fieldPath, addedBy: 'AI', selectedMeanings: meanings }, { origin: 'generated', ...extra });

test('a printed English book meaning wins over dictionary and AI wording', () => {
  const resolved = resolveKanjiMeanings([
    ai('ai-new', 'meanings', ['neighbor; neighboring'], { createdAt: '2026-10-12T08:40:11.223Z' }),
    dictionary('dict', ['Neighbor']),
    ai('ai-old', 'meanings', ['neighbor; adjacent'], { createdAt: '2026-10-12T08:39:40.599Z' }),
  ], ['Neighbour']);
  assert.equal(resolved.text, 'Neighbour');
  assert.equal(resolved.source, 'book');
  assert.equal(resolved.supplement, null);
  assert.deepEqual(resolved.original, ['Neighbour']);
});

test('Japanese-only book wording keeps the approved English dictionary gloss', () => {
  const resolved = resolveKanjiMeanings([
    ai('ai-new', 'meanings', ['neighbor; neighboring'], { createdAt: '2026-10-12T08:40:11.223Z' }),
    dictionary('dict', ['Neighbor']),
    ai('ai-old', 'meanings', ['neighbor; adjacent'], { createdAt: '2026-10-12T08:39:40.599Z' }),
  ], ['隣の人']);
  assert.equal(resolved.text, 'Neighbor');
  assert.equal(resolved.source, 'supplement');
  assert.equal(resolved.supplement.id, 'dict');
  assert.deepEqual(resolved.original, ['隣の人']);
});

test('newest revision wins within the same source', () => {
  const resolved = resolveKanjiMeanings([
    dictionary('revision-1', ['brain'], { revision: 1 }),
    dictionary('revision-2', ['brain'], { revision: 2, createdAt: '2026-10-12T08:45:54.194Z' }),
  ], ['頭にある臓器']);
  assert.equal(resolved.supplement.id, 'revision-2');
  assert.equal(resolved.text, 'brain');
  assert.deepEqual(resolved.original, ['頭にある臓器']);
});

test('field paths are ranked deterministically when both forms exist', () => {
  const resolved = resolveKanjiMeanings([
    ai('meanings', 'meanings', ['fallback']),
    ai('meaning-en', 'meaning_en', ['primary']),
  ]);
  assert.equal(resolved.text, 'primary');
});

test('drafts, superseded records, empty glosses and other kinds are ignored', () => {
  const rows = [
    dictionary('draft', ['draft value'], { status: 'draft' }),
    dictionary('superseded', ['historical value'], { successor: { id: 'current' } }),
    dictionary('empty', []),
    supplement('mnemonic', { fieldPath: 'meaning_en', addedBy: 'dictionary', selectedMeanings: ['story'] }, { kind: 'mnemonic' }),
    supplement('other-path', { fieldPath: 'reading', addedBy: 'dictionary', selectedMeanings: ['よみ'] }),
    ai('ok', 'meanings', ['approved value']),
  ];
  assert.equal(rows.filter(isKanjiMeaningSupplement).length, 1);
  const resolved = resolveKanjiMeanings(rows, ['本文']);
  assert.equal(resolved.text, 'approved value');
});

test('book wording is preserved when no approved English supplement exists', () => {
  const resolved = resolveKanjiMeanings([], ['頭にある臓器']);
  assert.equal(resolved.text, '頭にある臓器');
  assert.deepEqual(resolved.meanings, ['頭にある臓器']);
  assert.equal(resolved.source, 'book');
  assert.equal(resolved.supplement, null);
});

test('an import placeholder meaning is treated as missing and the dictionary gloss fills it', () => {
  assert.equal(resolveKanjiMeanings([dictionary('dict', ['information magazine'])], 'Meaning not supplied by source').text, 'information magazine');
  assert.equal(resolveKanjiMeanings([], 'Meaning not supplied by source').text, '');
});
