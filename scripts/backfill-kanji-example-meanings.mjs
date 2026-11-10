import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { localDatabaseUrl } from './canonical-import.mjs';
import { JMDICT_URL, localDictionary } from '../src/lib/server/generation/dictionary.mjs';

// Kanji flashcard example words (sourceWord sentences) with no English meaning get the first JMdict
// sense of the exact word + reading, stored as an approved dictionaryFieldSupplement that
// src/components/example-meaning.ts already resolves. Words an approved vocabulary record already
// glosses are skipped (the card uses that). Dry run unless --apply; --target neon writes to Neon.
const apply = process.argv.includes('--apply');
const target = process.argv.includes('--target') ? process.argv[process.argv.indexOf('--target') + 1] : 'local';
process.env.DATABASE_URL = await localDatabaseUrl(target === 'neon' ? 'POSTGRES_DATABASE_URL' : 'LOCAL_DATABASE_URL');
const db = new PrismaClient();
const JMDICT_TITLE = 'EDRDG JMdict · EDRDG / Jim Breen · CC BY-SA 4.0';
const PLACEHOLDER = /^(?:meaning )?not supplied\b/i;
const str = v => typeof v === 'string' ? v.trim() : Array.isArray(v) ? v.join('').trim() : '';

const dict = await localDictionary();
if (dict.metadata.status !== 'ready') throw new Error('Local JMdict is unavailable; run scripts/update-reader-dictionary.mjs first.');
const source = await db.source.findFirst({ where: { sourceType: 'dictionary', title: JMDICT_TITLE } })
  ?? (apply ? await db.source.create({ data: { id: randomUUID(), sourceType: 'dictionary', title: JMDICT_TITLE, language: 'ja', fileReference: JMDICT_URL } }) : { id: 'dry-run' });

const vocabHas = new Set((await db.vocabulary.findMany({ where: { item: { status: 'approved' } }, select: { writtenForm: true, reading: true, meaningEn: true } }))
  .filter(v => v.meaningEn && !PLACEHOLDER.test(v.meaningEn)).map(v => `${v.writtenForm}\0${v.reading}`));
const kanji = await db.item.findMany({ where: { kind: 'kanji', status: 'approved' }, select: { id: true, contentLinks: { select: { content: { select: { kind: true, status: true, payloadJson: true } } } } } });
const counts = { words: 0, created: 0, hasMeaning: 0, ambiguous: 0, missing: 0 }, unresolved = [], planned = [];
for (const item of kanji) {
  const contents = item.contentLinks.map(l => l.content).filter(c => c.status === 'approved');
  const done = new Set();
  for (const c of contents.filter(c => c.kind === 'sentence' && c.payloadJson?.sourceWord === true)) {
    const p = c.payloadJson, japanese = str(p.japanese), reading = str(p.reading);
    if (!japanese || !reading || done.has(japanese + reading)) continue;
    done.add(japanese + reading); counts.words++;
    const supplemented = contents.some(x => x.kind === 'explanation' && str(x.payloadJson?.originalJapanese) === japanese && str(x.payloadJson?.selectedMeanings)
      && str(x.payloadJson?.dictionaryEvidence?.originalReading || x.payloadJson?.dictionaryEvidence?.reading) === reading);
    if (str(p.translation) || str(p.meanings) || supplemented || vocabHas.has(`${japanese}\0${reading}`)) { counts.hasMeaning++; continue; }
    const candidates = (await dict.lookup(japanese)).filter(e => e.readings.includes(reading));
    if (candidates.length !== 1) { counts[candidates.length ? 'ambiguous' : 'missing']++; unresolved.push(`${japanese}（${reading}）`); continue; }
    const [entry] = candidates, meanings = entry.senses[0]?.meanings.slice(0, 4) ?? [];
    if (!meanings.length) { counts.missing++; unresolved.push(`${japanese}（${reading}）`); continue; }
    planned.push({ itemId: item.id, japanese, reading, entry, meanings });
  }
}
console.log(planned.slice(0, 8).map(x => `${x.japanese}（${x.reading}） => ${x.meanings.join(' · ')}`).join('\n'));
if (apply) for (const { itemId, japanese, reading, entry, meanings } of planned) {
  await db.content.create({ data: {
    id: randomUUID(), kind: 'explanation', origin: 'user', status: 'approved', revision: 1,
    payloadJson: { kind: 'dictionaryFieldSupplement', fieldPath: 'meaning_en', addedBy: 'dictionary', originalJapanese: japanese, selectedMeanings: meanings, translation: meanings.join(' · '),
      dictionaryEvidence: { originalReading: reading, entry: entry.id },
      acceptance: 'Explicit user request on 10 November 2026 for English meanings beside kanji flashcard example words', reviewBasis: 'user_accepted_without_pdf_comparison',
      sourceRecordKey: `kanji-example/dictionary/${japanese}/${reading}`,
      acceptedLimitations: ['Supplemental reference meaning from EDRDG JMdict (first sense); not an English translation printed in the book.'] },
    items: { create: { itemId, role: 'support' } },
    sourceEntries: { create: { id: randomUUID(), sourceId: source.id, sourceRecordKey: `accepted/kanji-example/${itemId}/${japanese}-${reading}-jmdict-${entry.id}`, revision: 1,
      fieldPresenceJson: { reference: 'supplied' }, verificationStatus: 'verified', verifiedAt: new Date(), originalPayloadJson: { url: JMDICT_URL, title: `${JMDICT_TITLE}; entry ${entry.id}`, entry: entry.id, reading, selected_sense: `sense 1: ${meanings.join('; ')}` } } },
  } });
  counts.created++;
}
console.log(JSON.stringify({ target, apply, ...counts, planned: planned.length, unresolved }, null, 1));
await db.$disconnect();
