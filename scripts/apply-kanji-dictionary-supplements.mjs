import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { localDatabaseUrl } from './canonical-import.mjs';

process.env.DATABASE_URL = await localDatabaseUrl('LOCAL_DATABASE_URL');
const db = new PrismaClient();

const KANJIDIC2_TITLE = 'EDRDG KANJIDIC2 · EDRDG / Jim Breen · CC BY-SA 4.0';
const KANJIDIC2_FILE = 'https://www.edrdg.org/pub/Nihongo/kanjidic2.xml.gz';
const MEANING_PATHS = ['meaning_en', 'meanings_en', 'meaning', 'meanings'];
// A printed English book meaning is authoritative; never supplement over it.
const hasEnglishText = value => (Array.isArray(value) ? value : [value])
  .some(item => typeof item === 'string' && /[A-Za-z]/.test(item));

const raw = JSON.parse(await readFile('.local/kanji-dictionary-meanings.json', 'utf8'));
const items = raw.filter(r => Array.isArray(r.meanings) && r.meanings.length > 0);

console.log(`Loaded ${items.length} kanji dictionary items to supplement.`);

// Record the dictionary that actually supplied the gloss. KanjiAPI serves the
// EDRDG KANJIDIC2 dataset; Takoboto is recorded only for genuine Takoboto lookups.
function evidence(item) {
  if (item.source === 'takoboto') {
    return { title: `Takoboto: ${item.glyph}`, url: `https://takoboto.jp/?q=${encodeURIComponent(item.glyph)}` };
  }
  if (item.source === 'kanjiapi') {
    return { title: `KANJIDIC2 via kanjiapi.dev: ${item.glyph}`, url: `https://kanjiapi.dev/v1/kanji/${encodeURIComponent(item.glyph)}` };
  }
  throw new Error(`Unknown kanji dictionary source: ${item.source}`);
}

async function dictionarySource(kind) {
  if (kind === 'kanjiapi') {
    const existing = await db.source.findFirst({ where: { title: { startsWith: 'EDRDG KANJIDIC2' } } });
    if (existing) return existing;
    return db.source.create({ data: { id: randomUUID(), title: KANJIDIC2_TITLE, sourceType: 'dictionary', language: 'ja', fileReference: KANJIDIC2_FILE } });
  }
  if (kind === 'takoboto') {
    const existing = await db.source.findFirst({ where: { sourceType: 'dictionary', title: 'Takoboto dictionary', fileReference: 'https://takoboto.jp' } });
    if (existing) return existing;
    return db.source.create({ data: { id: randomUUID(), title: 'Takoboto dictionary', sourceType: 'dictionary', language: 'ja', fileReference: 'https://takoboto.jp' } });
  }
  throw new Error(`Unknown kanji dictionary source: ${kind}`);
}

const sources = new Map();
for (const kind of new Set(items.map(item => item.source))) sources.set(kind, await dictionarySource(kind));
console.log('Using dictionary sources:', [...sources].map(([kind, source]) => `${kind}=${source.id}`).join(', '));

const pathRank = path => {
  const rank = MEANING_PATHS.indexOf(path);
  return rank === -1 ? MEANING_PATHS.length : rank;
};

let createdCount = 0;
let skippedCount = 0;
let bookMeaningCount = 0;
const failures = [];

for (const item of items) {
  try {
    const outcome = await db.$transaction(async tx => {
      // A kanji may carry several field supplements (meaning, components, …).
      // Resolve every current record so one empty supplement cannot hide an
      // already-approved English meaning.
      const current = await tx.content.findMany({
        where: {
          status: 'approved',
          successor: null,
          payloadJson: { path: ['kind'], equals: 'dictionaryFieldSupplement' },
          items: { some: { itemId: item.itemId } },
        },
        select: {
          id: true, origin: true, revision: true, payloadJson: true,
          sourceEntries: { select: { source: { select: { sourceType: true } } } },
        },
      });

      const hasDictionaryMeaning = current.some(content => Array.isArray(content.payloadJson?.selectedMeanings)
        && content.payloadJson.selectedMeanings.length > 0
        && content.sourceEntries.some(entry => entry.source.sourceType === 'dictionary'));
      if (hasDictionaryMeaning) return 'skipped';

      // The book already prints an English meaning for this kanji: keep that
      // wording and never add a dictionary gloss beside it.
      const book = await tx.kanji.findUnique({ where: { itemId: item.itemId }, select: { meaningsJson: true } });
      if (book && hasEnglishText(book.meaningsJson)) return 'book-meaning-present';

      // Supersede the latest current revision so the immutable revision chain
      // stays contiguous even when an item has several field supplements.
      const existing = current.sort((a, b) => (b.revision ?? 0) - (a.revision ?? 0)
        || pathRank(a.payloadJson?.fieldPath) - pathRank(b.payloadJson?.fieldPath)
        || String(a.id).localeCompare(String(b.id)))[0] ?? null;

      const glyph = item.glyph;
      const meanings = item.meanings;
      const citation = evidence(item);
      const source = sources.get(item.source);
      const revision = (existing?.revision ?? 0) + 1;

      await tx.content.create({
        data: {
          id: randomUUID(),
          kind: 'explanation',
          origin: existing?.origin ?? 'user',
          status: 'approved',
          revision,
          supersedesId: existing?.id ?? null,
          payloadJson: {
            kind: 'dictionaryFieldSupplement',
            fieldPath: 'meaning_en',
            addedBy: 'dictionary',
            selectedMeanings: meanings,
            translation: meanings.join(' · '),
            acceptance: 'Explicit user acceptance on 23 October 2026 without PDF comparison',
            additionKey: 'field-0',
            reviewBasis: 'user_accepted_without_pdf_comparison',
            sourceRecordKey: `kanji/dictionary/${glyph}`,
            originalEnrichment: {
              field: 'meaning_en',
              value: meanings,
              origin: 'dictionary',
              sources: [
                {
                  url: citation.url,
                  title: citation.title,
                  selected_sense: meanings.join('; '),
                },
              ],
              review_status: 'unreviewed',
            },
            acceptedLimitations: [
              'Supplemental reference meaning from the EDRDG KANJIDIC2 dictionary; not an English translation printed in the book.',
            ],
          },
          items: {
            create: {
              itemId: item.itemId,
              role: 'support',
            },
          },
          sourceEntries: {
            create: {
              id: randomUUID(),
              sourceId: source.id,
              sourceRecordKey: `accepted/kanji/${glyph}/field-0-rev-${revision}-kanjidic2`,
              revision: 1,
              fieldPresenceJson: {
                reference: 'supplied',
              },
              verificationStatus: 'verified',
              verifiedAt: new Date(),
              originalPayloadJson: {
                url: citation.url,
                title: citation.title,
                selected_sense: meanings.join('; '),
              },
            },
          },
        },
      });
      return 'created';
    });
    if (outcome === 'created') createdCount++;
    else if (outcome === 'book-meaning-present') bookMeaningCount++;
    else skippedCount++;
  } catch (error) {
    // A previous partial import may have left an irregular revision chain.
    // Report the glyph and continue; the resolver still prefers dictionary evidence.
    failures.push({ glyph: item.glyph, code: error.code ?? null, message: String(error.message).split('\n')[0].slice(0, 160) });
  }
}

console.log(JSON.stringify({ createdCount, skippedCount, bookMeaningCount, failed: failures.length, total: items.length, failures }, null, 2));
if (failures.length) process.exitCode = 1;
await db.$disconnect();
