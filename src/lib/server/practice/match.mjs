import { normalizeReading } from '../review/text.mjs';
import { resolveKanjiMeanings } from '../content/kanji-meanings.mjs';

// Match practice is read-only: no Attempt, ReviewLog, card or session writes and no FSRS transition.
const key = answer => String(answer).normalize('NFKC').trim().toLowerCase();
const first = value => (Array.isArray(value) ? value.find(v => typeof v === 'string' && v.trim()) : undefined);

export function kanjiAnswer(kanji, meaning) {
  const raw = first(kanji?.kunReadingsJson) || first(kanji?.onReadingsJson);
  const reading = raw ? normalizeReading(raw.replace(/[.\-]/g, '')) : '';
  return reading ? `${reading} · ${meaning}` : meaning;
}

export function vocabAnswer({ reading, meaning }) {
  const kana = typeof reading === 'string' ? normalizeReading(reading) : '';
  return kana ? `${kana} · ${meaning}` : meaning;
}

export const MATCH_SIZE = { vocabulary: 20, kanji: 10 };

// Random pick, so each deal (Play again included) draws a fresh set from the eligible pool.
export function pickMatchPairs(candidates, { size = MATCH_SIZE.vocabulary, random = Math.random } = {}) {
  const shuffled = candidates.map(c => ({ c, tie: random() })).sort((a, b) => a.tie - b.tie).map(x => x.c);
  const seen = new Set(), pairs = [];
  for (const { id, prompt, answer } of shuffled) {
    if (pairs.length >= size) break;
    if (seen.has(key(answer))) continue;
    seen.add(key(answer)); pairs.push({ id, prompt, answer });
  }
  return pairs.length >= 3 ? pairs : [];
}

// Cards of items marked studied (new or reviewed), including ones waiting in an open session.
export async function matchCandidates(db, userId, kind) {
  const objective = kind === 'kanji' ? 'kanji_meaning' : 'vocab_reading_meaning';
  const cards = await db.card.findMany({
    where: { userId, objective, status: { in: ['new', 'active'] }, item: { status: 'approved', userItems: { some: { userId, introducedAt: { not: null } } } } },
    include: { item: { select: { id: true, kanji: { select: { meaningsJson: true, onReadingsJson: true, kunReadingsJson: true } }, vocabulary: { select: { meaningEn: true } } } } },
    take: 2000,
  });
  // Book meanings can be Japanese-only; take the English gloss the item pages show (printed or approved supplement).
  const supplements = await db.content.findMany({
    where: { kind: 'explanation', status: 'approved', successor: null, payloadJson: { path: ['kind'], equals: 'dictionaryFieldSupplement' }, items: { some: { itemId: { in: cards.map(c => c.item.id) } } } },
    select: { id: true, kind: true, origin: true, status: true, revision: true, createdAt: true, successor: { select: { id: true } }, payloadJson: true, items: { select: { itemId: true } } },
  });
  const byItem = new Map();
  for (const row of supplements) for (const { itemId } of row.items) byItem.set(itemId, [...(byItem.get(itemId) ?? []), row]);
  return cards.flatMap(c => {
    const { item } = c;
    const book = item.kanji?.meaningsJson ?? item.vocabulary?.meaningEn ?? c.answerSpecJson.meaning;
    const meaning = first(resolveKanjiMeanings(byItem.get(item.id) ?? [], book).meanings.filter(m => /[A-Za-z]/.test(m)));
    if (!meaning) return [];
    return [{ id: c.id, prompt: c.promptSpecJson.text, answer: kind === 'kanji' ? kanjiAnswer(item.kanji, meaning) : vocabAnswer({ reading: c.answerSpecJson.reading, meaning }) }];
  });
}

export async function matchPairs(db, userId, kind) {
  return { kind, pairs: pickMatchPairs(await matchCandidates(db, userId, kind), { size: MATCH_SIZE[kind] }) };
}
