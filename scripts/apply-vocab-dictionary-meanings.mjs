import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { localDatabaseUrl } from './canonical-import.mjs';
import { JMDICT_URL, localDictionary } from '../src/lib/server/generation/dictionary.mjs';

// Fills vocabulary whose book import carries no English meaning with the first sense of a
// single unambiguous local JMdict match. Book fields stay untouched: the gloss is an approved
// dictionaryFieldSupplement (same shape as scripts/apply-kanji-dictionary-supplements.mjs),
// and existing cards that still hold the placeholder get the gloss as their answer.
process.env.DATABASE_URL = await localDatabaseUrl('LOCAL_DATABASE_URL');
const db = new PrismaClient();
const PLACEHOLDER = 'Meaning not supplied by source';
const JMDICT_TITLE = 'EDRDG JMdict · EDRDG / Jim Breen · CC BY-SA 4.0';
const suru = value => value.replace(/[（(]する[）)]$/u, '');

const dict = await localDictionary();
if (dict.metadata.status !== 'ready') throw new Error('Local JMdict is unavailable; run scripts/update-reader-dictionary.mjs first.');
const source = await db.source.findFirst({ where: { sourceType: 'dictionary', title: JMDICT_TITLE } })
  ?? await db.source.create({ data: { id: randomUUID(), title: JMDICT_TITLE, sourceType: 'dictionary', language: 'ja', fileReference: JMDICT_URL } });

const vocab = await db.vocabulary.findMany({ where: { OR: [{ meaningEn: PLACEHOLDER }, { meaningEn: '' }], item: { status: 'approved' } }, select: { itemId: true, writtenForm: true, reading: true } });
const counts = { created: 0, skipped: 0, ambiguous: 0, missing: 0, cardsUpdated: 0 };
const unresolved = [];
for (const v of vocab) {
  const form = suru(v.writtenForm), reading = suru(v.reading);
  const candidates = (await dict.lookup(form)).filter(c => c.readings.includes(reading));
  if (candidates.length !== 1) { counts[candidates.length ? 'ambiguous' : 'missing']++; unresolved.push(v.writtenForm); continue; }
  const [entry] = candidates, meanings = entry.senses[0]?.meanings.slice(0, 4) ?? [];
  if (!meanings.length) { counts.missing++; unresolved.push(v.writtenForm); continue; }
  await db.$transaction(async tx => {
    const current = await tx.content.findFirst({ where: { status: 'approved', successor: null, payloadJson: { path: ['kind'], equals: 'dictionaryFieldSupplement' }, AND: [{ payloadJson: { path: ['fieldPath'], equals: 'meaning_en' } }], items: { some: { itemId: v.itemId } } } });
    if (current) { counts.skipped++; return; }
    const record = { url: JMDICT_URL, title: `${JMDICT_TITLE}; entry ${entry.id}`, entry: entry.id, edition: dict.metadata.edition ?? dict.metadata.sha256, reading, selected_sense: `sense 1: ${meanings.join('; ')}` };
    await tx.content.create({ data: {
      id: randomUUID(), kind: 'explanation', origin: 'user', status: 'approved', revision: 1,
      payloadJson: { kind: 'dictionaryFieldSupplement', fieldPath: 'meaning_en', addedBy: 'dictionary', selectedMeanings: meanings, translation: meanings.join(' · '),
        acceptance: 'Explicit user request on 26 October 2026 to fill missing vocabulary meanings from JMdict',
        reviewBasis: 'user_accepted_without_pdf_comparison', sourceRecordKey: `vocabulary/dictionary/${v.writtenForm}/${v.reading}`,
        acceptedLimitations: ['Supplemental reference meaning from EDRDG JMdict (first sense); not an English translation printed in the book.'] },
      items: { create: { itemId: v.itemId, role: 'support' } },
      sourceEntries: { create: { id: randomUUID(), sourceId: source.id, sourceRecordKey: `accepted/vocabulary/${v.itemId}/meaning_en-jmdict-${entry.id}`, revision: 1,
        fieldPresenceJson: { reference: 'supplied' }, verificationStatus: 'verified', verifiedAt: new Date(), originalPayloadJson: record } },
    } });
    counts.created++;
    const cards = await tx.card.findMany({ where: { itemId: v.itemId, objective: 'vocab_reading_meaning' }, select: { id: true, answerSpecJson: true } });
    for (const card of cards) if ([PLACEHOLDER, ''].includes(card.answerSpecJson.meaning)) {
      await tx.card.update({ where: { id: card.id }, data: { answerSpecJson: { ...card.answerSpecJson, meaning: meanings.join('; '), acceptedGlosses: meanings } } });
      counts.cardsUpdated++;
    }
  });
}
console.log(JSON.stringify({ total: vocab.length, ...counts, unresolved }, null, 2));
await db.$disconnect();
