import { pathToFileURL } from 'node:url';
import { rebuildKanjiMeaningCard } from '../src/lib/server/review/service.mjs';

// Repair for stale kanji_meaning cards created before an approved English field supplement
// existed: their answer stores the Japanese book keyword, which choice-mode recall cannot use
// ("Recall the selected core meaning" must offer English options). Retirement and recreation go
// through the dedicated rebuildKanjiMeaningCard service path, so each recreation is gated on a
// resolvable English gloss and bumps templateVersion past the retired prior. Dry run by default;
// --apply changes rows. Targets the local study database by default; --neon targets the shared
// Neon database with TLS. Prints counts and glyphs only.
export async function repairKanjiMeaningCards(db,{apply=false}={}) {
  // A recall answer must be printable ASCII with Latin letters — the same rule the choice
  // builder applies with its isEnglishMeaning check. Candidates are bounded to kanji_meaning cards.
  const isEnglishGloss = value => { const text = String(value ?? '').trim(); return /^[\x20-\x7E]+$/.test(text) && /[A-Za-z]/.test(text); };
  const candidates = await db.card.findMany({
    where: { objective: 'kanji_meaning', status: { in: ['new', 'active'] } },
    select: { id: true, status: true, userId: true, itemId: true, answerSpecJson: true, item: { select: { kanji: { select: { glyph: true } } } } },
  });
  const stale = candidates.filter(card => !isEnglishGloss(card.answerSpecJson?.meaning));
  const glyphs = stale.map(card => card.item.kanji?.glyph ?? card.itemId).sort();
  if (!apply || !stale.length) return { candidates: candidates.length, stale: stale.length, retired: 0, recreated: 0, stillExcluded: 0, glyphs, apply };

  // One stale card per user:item pair; rebuild retires every live version of that objective.
  const targets = [...new Map(stale.map(card => [`${card.userId}:${card.itemId}`, { userId: card.userId, itemId: card.itemId }])).values()];
  let retired = 0, recreated = 0, stillExcluded = 0;
  for (const target of targets) {
    const result = await rebuildKanjiMeaningCard(db, target.userId, target.itemId);
    retired += result.retired ?? 0;
    if (result.recreated) recreated++; else stillExcluded++;
  }
  return { candidates: candidates.length, stale: stale.length, retired, recreated, stillExcluded, glyphs, apply };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { PrismaClient } = await import('@prisma/client');
  const { localDatabaseUrl } = await import('./canonical-import.mjs');
  const { databaseConnection } = await import('./backup.mjs');
  const neon = process.argv.includes('--neon');
  const raw = await localDatabaseUrl(neon ? 'POSTGRES_DATABASE_URL' : 'LOCAL_DATABASE_URL');
  let url;
  if (neon) {
    url = databaseConnection(raw).toString(); // throws unless a neon.tech URL with sslmode=require
  } else {
    const parsed = new URL(raw);
    if (!['127.0.0.1', 'localhost'].includes(parsed.hostname)) throw new Error('Local database required');
    url = parsed.toString();
  }
  const db = new PrismaClient({ datasourceUrl: url, errorFormat: 'minimal' });
  try {
    console.log(JSON.stringify(await repairKanjiMeaningCards(db, { apply: process.argv.includes('--apply') })));
  } finally { await db.$disconnect(); }
}
