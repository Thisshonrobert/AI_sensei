import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { localDatabaseUrl } from './canonical-import.mjs';
import { referencePresentation } from '../src/lib/server/content/reference-presentation.mjs';
import { readingTokens } from '../src/lib/server/generation/analyzer.mjs';

// Adds a hiragana reading and/or English meaning to vocabulary and grammar example sentences that lack them, as an approved
// exampleLanguage supplement (the book sentence payload stays untouched; referencePresentation merges it).
// Readings come from local kuromoji/IPADIC; a vocabulary reading must contain the item's own reading, else it is reported and skipped.
// Meanings come from --translations file.json ({ japanese: english }, AI-written). Dry run unless --apply.
const apply = process.argv.includes('--apply');
const tf = process.argv.includes('--translations') ? process.argv[process.argv.indexOf('--translations') + 1] : null;
const rf = process.argv.includes('--readings') ? process.argv[process.argv.indexOf('--readings') + 1] : null;
const manual = rf ? JSON.parse(await readFile(rf, 'utf8')) : {}; // hand-checked readings for digits/Latin and words kuromoji misreads
const translations = tf ? JSON.parse(await readFile(tf, 'utf8')) : {};
process.env.DATABASE_URL = await localDatabaseUrl('LOCAL_DATABASE_URL');
const db = new PrismaClient();
const ACCEPTANCE = 'Explicit user request on 29 October 2026 to fill missing vocabulary example-sentence readings';
const hira = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
const plainKana = s => /^[ぁ-ゖー。、！？「」…\n・（）～/／ ]+$/u.test(s);
const core = w => w.replace(/[（(][^）)]*[）)]/g, '').replace(/[～〜~]/g, '').trim();
const stem = x => /[ぁ-ん]$/u.test(x) ? x.slice(0, -1) : x; // verbs/adjectives conjugate: compare stems

const items = await db.item.findMany({ where: { status: 'approved', OR: [{ vocabulary: { isNot: null } }, { grammar: { isNot: null } }, { kanji: { isNot: null } }] }, select: { id: true, vocabulary: { select: { writtenForm: true, reading: true } },
  contentLinks: { select: { content: { include: { sourceEntries: true, successor: true } } } } } });
const plan = [], skipped = [];
for (const it of items) {
  for (const r of referencePresentation(it.contentLinks.map(l => l.content).filter(c => c.kind !== 'question'))) {
    const p = r.content.payloadJson, sp = r.supplement?.payloadJson ?? {};
    if (r.content.kind !== 'sentence' || r.content.status !== 'approved') continue;
    const hasMeaning = [p.translation, p.meanings, sp.translation, sp.selectedMeanings].some(v => (Array.isArray(v) ? v.join('') : v)?.trim?.());
    const given = hasMeaning ? null : translations[p.japanese] ?? null; // string (AI-written) or { text, src: 'JMdict' }
    const translation = given && (given.text ?? given), src = given?.src ?? null;
    if (r.reading && !translation) continue;
    if (plan.some(x => x.japanese === p.japanese && x.itemId === it.id)) continue;
    const japanese = p.japanese;
    let reading = r.reading || manual[japanese] || hira((await readingTokens(japanese)).map(t => (t.surface_form === '日本' ? 'ニホン' : t.reading) || t.surface_form).join(''));
    if (!r.reading && !manual[japanese]) {
      const vw = it.vocabulary && stem(core(it.vocabulary.reading).replace(/な$/, ''));
      if (!plainKana(reading)) { skipped.push(`${japanese} (non-kana: ${reading})`); reading = ''; }
      else if (vw && !reading.includes(vw)) { skipped.push(`${it.vocabulary.writtenForm}[${it.vocabulary.reading}] ${japanese} => ${reading}`); reading = ''; }
    }
    if (reading || translation) plan.push({ itemId: it.id, japanese, reading: r.reading ? '' : reading, translation, src });
    else if (!hasMeaning) skipped.push(`${japanese} (no translation supplied)`);
  }
}
console.log(`to write ${plan.length}, skipped ${skipped.length}`);
skipped.forEach(s => console.log('skip:', s));
plan.filter((_, i) => i % 80 === 0).forEach(p => console.log(p.japanese, '=>', p.reading, '|', p.translation));
if (apply) {
  for (let i = 0; i < plan.length; i += 100) await db.$transaction(plan.slice(i, i + 100).map(({ itemId, japanese, reading, translation, src }) => db.content.create({ data: { id: randomUUID(), kind: 'explanation', origin: 'generated', status: 'approved', revision: 1,
    payloadJson: { kind: 'exampleLanguage', originalJapanese: japanese, ...reading && { reading }, ...translation && { translation }, addedBy: src ? 'dictionary' : 'AI', generatedBy: src ? 'JMdict first-sense lookup' : 'kuromoji/IPADIC reading; Claude meaning', acceptance: ACCEPTANCE,
      acceptedLimitations: [src ? 'Dictionary gloss (first JMdict sense for the exact word and reading); not from the book and not chosen for context.' : 'AI-added reading (local dictionary analyzer) and/or English meaning; not from the book and not independently verified.'] },
    items: { create: { itemId, role: 'support' } } } })), { timeout: 120000 });
  console.log(`Wrote ${plan.length} supplements.`);
}
await db.$disconnect();
