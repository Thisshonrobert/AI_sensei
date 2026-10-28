import { glossOverlap, normalizeReading } from './text.mjs';

export const CHOICE_COUNT = 4;

function hash(value) {
  let h = 2166136261 >>> 0;
  for (const char of String(value)) { h ^= char.codePointAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, '0');
}
function longHash(value) { return `${hash(value)}${hash(`${value}|2`)}`; }
function random(seed) {
  let state = Number.parseInt(hash(seed), 16) >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function shuffled(items, seed) {
  const next = random(seed), copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
}
function pairKey(choice) { return `${normalizeReading(choice.reading || '')}|${String(choice.meaning || '').trim().toLowerCase()}`; }
function optionId(seed, index, choice) { return longHash(`${seed}|${index}|${pairKey(choice)}`).slice(0, 12); }
function fingerprint(seed, format, choices) { return longHash(`${seed}|${format}|${choices.map(choice => `${choice.id}|${pairKey(choice)}`).join(';')}`).slice(0, 16); }

function assemble(seed, format, correct, decoys) {
  const unique = new Map([[pairKey(correct), correct]]);
  for (const decoy of decoys) {
    if (unique.size >= CHOICE_COUNT) break;
    const key = pairKey(decoy);
    if (!unique.has(key)) unique.set(key, decoy);
  }
  if (unique.size !== CHOICE_COUNT) return null;
  const choices = shuffled([...unique.values()], `${seed}|order`).map((choice, index) => ({
    id: optionId(seed, index, choice),
    ...(choice.reading ? { reading: choice.reading } : {}),
    ...(choice.meaning ? { meaning: choice.meaning } : {}),
    tier: choice.tier,
  }));
  return { format, choices, correctChoiceId: choices.find(choice => pairKey(choice) === pairKey(correct)).id, fingerprint: fingerprint(seed, format, choices) };
}

export function buildVocabChoices({ target, candidates, seed }) {
  if (!target?.reading?.trim() || !target?.meaning?.trim()) return null;
  const accepted = [target.meaning, ...(target.acceptedGlosses || [])].filter(Boolean);
  const safe = [];
  for (const item of candidates || []) {
    if (!item?.reading?.trim() || !item?.meaning?.trim()) continue;
    if (item.meaning === 'Meaning not supplied by source') continue;
    if (item.itemId === target.itemId || item.writtenForm === target.writtenForm) continue;
    if (accepted.some(gloss => String(gloss).trim().toLowerCase() === String(item.meaning).trim().toLowerCase())) continue;
    safe.push({ itemId: item.itemId, reading: item.reading, meaning: item.meaning, pos: item.partOfSpeech || '' });
  }
  const used = new Set([pairKey({ reading: target.reading, meaning: target.meaning })]);
  const take = (pool, tier) => {
    for (const item of shuffled(pool, `${seed}|${tier}`)) {
      const key = pairKey(item);
      if (!used.has(key)) { used.add(key); return item; }
    }
    return null;
  };
  const sameReading = safe.filter(item => !glossOverlap(item.meaning, accepted.join(' ')));
  const otherReadings = safe.filter(item => normalizeReading(item.reading) !== normalizeReading(target.reading));
  const samePos = otherReadings.filter(item => item.pos && item.pos === target.partOfSpeech);
  const sameReadingCandidate = take(sameReading, 'same_reading');
  const readingForMeaning = take(samePos, 'same_meaning') || take(otherReadings, 'same_meaning_fallback');
  const unrelated = take(otherReadings, 'unrelated') || take(safe, 'unrelated_fallback');
  const decoys = [
    ...(sameReadingCandidate ? [{ reading: target.reading, meaning: sameReadingCandidate.meaning, tier: 'same_reading' }] : []),
    ...(readingForMeaning ? [{ reading: readingForMeaning.reading, meaning: target.meaning, tier: 'same_meaning' }] : []),
    ...(unrelated ? [{ reading: unrelated.reading, meaning: unrelated.meaning, tier: 'unrelated' }] : []),
  ];
  return assemble(seed, 'vocab_pair', { reading: target.reading, meaning: target.meaning, tier: 'correct' }, decoys);
}

const HIRAGANA = /^[\u3041-\u309fー]+$/u;
const isEnglishMeaning = value => {
  const text = String(value || '').trim();
  return /^[\x20-\x7E]+$/.test(text) && /[A-Za-z]/.test(text);
};
const cleanGloss = value => String(value || '').replace(/^\([^)]*\)\s*/u, '').split(';')[0].trim();
const displayMeaning = value => cleanGloss(value).toLowerCase();
const firstReading = values => (values || []).map(value => normalizeReading(String(value || '').trim())).find(value => HIRAGANA.test(value)) || '';
const dictionaryCache = new Map();

async function dictionaryEntries(lookup, form) {
  if (typeof lookup !== 'function' || !form) return [];
  const key = String(form).trim();
  if (!key) return [];
  if (dictionaryCache.has(key)) return dictionaryCache.get(key);
  let entries = [];
  try { entries = await lookup(key) || []; } catch { entries = []; }
  const normalized = entries.map(entry => ({
    readings: [...new Set((entry.readings || []).map(reading => normalizeReading(String(reading || '').trim())).filter(reading => HIRAGANA.test(reading)))],
    glosses: [...new Set((entry.senses || []).flatMap(sense => sense.meanings || []).map(cleanGloss).filter(Boolean))],
  })).filter(entry => entry.readings.length && entry.glosses.length);
  if (dictionaryCache.size >= 800) dictionaryCache.delete(dictionaryCache.keys().next().value);
  dictionaryCache.set(key, normalized);
  return normalized;
}

async function japanesePair({ japanese, lookup }) {
  const forms = [String(japanese || '').trim(), String(japanese || '').trim().replace(/(?:する|な|に)$/u, '')].filter((form, index, all) => form && all.indexOf(form) === index);
  for (const form of forms) {
    const entries = await dictionaryEntries(lookup, form);
    if (!entries.length) continue;
    const reading = entries[0].readings[0];
    const meaning = displayMeaning(entries[0].glosses[0]);
    if (reading && meaning) return { reading, meaning, glosses: entries[0].glosses, readingSource: 'word' };
  }
  return null;
}

async function englishPair({ english, onReadings, kunReadings, examples, examplesFor, itemId, glyph, lookup, allowReadingFallback, sourceMode }) {
  const meaning = displayMeaning(english);
  if (!meaning) return null;
  if (sourceMode === 'bare') {
    if (!allowReadingFallback) return null;
    const reading = firstReading(kunReadings) || firstReading(onReadings);
    return reading ? { reading, meaning, readingSource: 'bare' } : null;
  }
  const words = Array.isArray(examples) && examples.length ? examples : typeof examplesFor === 'function' ? await examplesFor({ itemId, glyph }) : [];
  for (const example of words || []) {
    const word = String(example?.word || '').trim();
    if (!word || (glyph && !word.includes(glyph))) continue;
    const entries = await dictionaryEntries(lookup, word);
    if (!entries.length) continue;
    const entry = entries[0];
    const reading = normalizeReading(String(example?.reading || '').trim()) || entry.readings[0];
    if (!HIRAGANA.test(reading)) continue;
    if (!entry.glosses.some(gloss => glossOverlap(gloss, english))) continue;
    return { reading, meaning, glosses: entry.glosses, readingSource: 'word' };
  }
  if (!allowReadingFallback) return null;
  const reading = firstReading(kunReadings) || firstReading(onReadings);
  return reading ? { reading, meaning, readingSource: 'bare' } : null;
}

async function kanjiMeaningPair({ meaning, meanings, onReadings, kunReadings, examples, examplesFor, itemId, glyph, lookup, allowReadingFallback, sourceMode }) {
  const values = (meanings || []).map(value => String(value).trim()).filter(Boolean);
  const english = isEnglishMeaning(meaning) ? String(meaning).trim() : values.find(isEnglishMeaning);
  if (english) return englishPair({ english, onReadings, kunReadings, examples, examplesFor, itemId, glyph, lookup, allowReadingFallback, sourceMode });
  const japanese = values.find(value => !isEnglishMeaning(value));
  return japanese ? japanesePair({ japanese, lookup }) : null;
}

export async function buildKanjiMeaningChoices({ target, candidates, seed, lookup, examplesFor }) {
  if (!target?.meaning?.trim()) return null;
  let lookups = 24;
  const limitedLookup = async form => {
    if (lookups <= 0 || typeof lookup !== 'function') return [];
    lookups -= 1;
    return lookup(form);
  };
  const correct = await kanjiMeaningPair({ ...target, meaning: target.meaning, examplesFor, lookup: limitedLookup, allowReadingFallback: true });
  if (!correct) return null;
  // Every option must come from the same reading kind. A bare kanji reading next to
  // whole-word readings is the only odd one out and gives the correct option away.
  const sourceMode = correct.readingSource === 'bare' ? 'bare' : 'word';
  const readings = new Set([normalizeReading(correct.reading)]);
  const meanings = new Set([correct.meaning]);
  const accepted = [target.meaning, ...(target.meanings || []), ...(correct.glosses || [])].filter(Boolean).join(' ');
  const decoys = [];
  const ordered = shuffled(candidates || [], `${seed}|kanji-meaning`);
  let attempts = 0;
  for (const candidate of ordered) {
    if (decoys.length >= CHOICE_COUNT - 1 || attempts >= 24) break;
    attempts += 1;
    const pair = await kanjiMeaningPair({ ...candidate, lookup: limitedLookup, examplesFor, allowReadingFallback: sourceMode !== 'word', sourceMode });
    if (!pair || pair.readingSource !== sourceMode) continue;
    const reading = normalizeReading(pair.reading);
    if (!reading || readings.has(reading) || meanings.has(pair.meaning)) continue;
    if (glossOverlap(pair.meaning, accepted)) continue;
    readings.add(reading);
    meanings.add(pair.meaning);
    decoys.push({ ...pair, tier: 'unrelated' });
  }
  return assemble(seed, 'kanji_meaning', { ...correct, tier: 'correct' }, decoys);
}

export function buildKanjiReadingChoices({ target, candidates, seed }) {
  if (!target?.reading?.trim()) return null;
  const correct = { reading: target.reading, tier: 'correct' };
  const seen = new Set([pairKey(correct)]);
  const pool = [];
  for (const item of candidates || []) {
    const reading = String(item?.reading || '').trim();
    if (!reading || item.itemId === target.itemId) continue;
    if (normalizeReading(reading) === normalizeReading(target.reading)) continue;
    const entry = { reading, tier: 'unrelated' };
    if (seen.has(pairKey(entry))) continue;
    seen.add(pairKey(entry));
    pool.push(entry);
  }
  return assemble(seed, 'kanji_reading', correct, shuffled(pool, `${seed}|kanji-reading`).slice(0, CHOICE_COUNT - 1));
}
