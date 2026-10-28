import { pathToFileURL } from 'node:url';

// Amendment A6: one kanji recall card. Reading-in-a-word cards are retired (never deleted) so their
// review history stays. Dry run by default; pass --apply to change rows. Prints counts only.
export async function retireKanjiReadingCards(db, { apply = false } = {}) {
  const where = { objective: 'kanji_reading_context', status: { in: ['new', 'active'] } };
  const found = await db.card.count({ where });
  if (!apply || !found) return { found, retired: 0, apply };
  // card_due_state requires a non-new card's dueAt to equal its stored FSRS due. A never-reviewed card has
  // no dueAt, so it takes the due date already in its own initial state; no review or rating is created.
  const retired = await db.$transaction(async tx =>
    (await tx.card.updateMany({ where: { ...where, status: 'active' }, data: { status: 'retired' } })).count
    + await tx.$executeRaw`UPDATE cards SET status='retired', "dueAt"=("fsrsStateJson"->>'due')::timestamptz WHERE objective='kanji_reading_context' AND status='new'`);
  return { found, retired, apply };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { PrismaClient } = await import('@prisma/client');
  const { localDatabaseUrl } = await import('./canonical-import.mjs');
  const url = new URL(await localDatabaseUrl());
  if (!['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('Local database required');
  const db = new PrismaClient({ datasourceUrl: url.toString(), errorFormat: 'minimal' });
  try { console.log(JSON.stringify(await retireKanjiReadingCards(db, { apply: process.argv.includes('--apply') }))); }
  finally { await db.$disconnect(); }
}
