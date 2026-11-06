import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { localDatabaseUrl } from './canonical-import.mjs';
import { JMDICT_URL, localDictionary } from '../src/lib/server/generation/dictionary.mjs';
import { vocabularyComponentAidSchema } from '../src/lib/server/content/vocabulary-components.mjs';

// Backfills vocabulary the book import left without kanji tiles or an example sentence.
//  - Kanji tiles: each kanji of the word is aligned to its sound in the book reading using the local
//    KANJIDIC2 readings (rendaku/sokuon allowed); meanings are KANJIDIC2 glosses. Ambiguous or unalignable
//    words fall back to one whole-word tile with the JMdict gloss, or are reported and skipped.
//    Stored as the same approved vocabularyComponentAid content the existing aids use.
//  - Examples: --sentences a.json,b.json (AI-written, origin "generated"), validated before insert.
// Dry run unless --apply. Re-running skips items that already have either record.
// Setup: place EDRDG kanjidic2.xml.gz in private-data/dictionary-kanji/ (https://www.edrdg.org/pub/Nihongo/kanjidic2.xml.gz).
const arg = name => process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : null;
const apply = process.argv.includes('--apply');
const sentenceFiles = arg('--sentences')?.split(',') ?? [];
process.env.DATABASE_URL = await localDatabaseUrl('LOCAL_DATABASE_URL');
const db = new PrismaClient();

const KANJIDIC2_TITLE = 'EDRDG KANJIDIC2 · EDRDG / Jim Breen · CC BY-SA 4.0';
const KANJIDIC2_FILE = 'https://www.edrdg.org/pub/Nihongo/kanjidic2.xml.gz';
const JMDICT_TITLE = 'EDRDG JMdict · EDRDG / Jim Breen · CC BY-SA 4.0';
const ACCEPTANCE = 'Explicit user request on 29 October 2026 to fill missing vocabulary kanji components and examples';
const hira = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
const isKanji = c => /[一-鿿々]/u.test(c);
const plainKana = s => /^[ぁ-ゖー。、！？]+$/u.test(s);

// --- KANJIDIC2 -------------------------------------------------------------------------------
const xml = gunzipSync(await readFile('private-data/dictionary-kanji/kanjidic2.xml.gz')).toString('utf8');
const kd = new Map();
for (const [, block] of xml.matchAll(/<character>([\s\S]*?)<\/character>/g)) {
  const glyph = block.match(/<literal>(.)<\/literal>/u)?.[1];
  if (!glyph) continue;
  const reads = type => [...block.matchAll(new RegExp(`<reading r_type="${type}">([^<]+)</reading>`, 'g'))].map(m => m[1]);
  const on = reads('ja_on').map(hira);
  const kun = reads('ja_kun').map(r => hira(r).replace(/^-|-$/g, '').split('.')[0].replace(/-$/, '')).filter(Boolean);
  const meanings = [...block.matchAll(/<meaning>([^<]+)<\/meaning>/g)].map(m => m[1]);
  kd.set(glyph, { on, kun, meanings });
}
const RENDAKU = { か: 'が', き: 'ぎ', く: 'ぐ', け: 'げ', こ: 'ご', さ: 'ざ', し: 'じ', す: 'ず', せ: 'ぜ', そ: 'ぞ', た: 'だ', ち: 'ぢ', つ: 'づ', て: 'で', と: 'ど', は: 'ば', ひ: 'び', ふ: 'ぶ', へ: 'べ', ほ: 'ぼ' };
const HANDAKU = { は: 'ぱ', ひ: 'ぴ', ふ: 'ぷ', へ: 'ぺ', ほ: 'ぽ' };
// Candidate [sound, cost] pairs for one kanji; cost 0 = dictionary sound, 1 = rendaku/sokuon variant.
function candidates(glyph) {
  const e = kd.get(glyph);
  if (!e) return [];
  const out = new Map();
  const add = (s, c) => { if (s && !(out.get(s) <= c)) out.set(s, c); };
  for (const r of [...e.on, ...e.kun]) {
    add(r, 0);
    if (RENDAKU[r[0]]) add(RENDAKU[r[0]] + r.slice(1), 1);
    if (HANDAKU[r[0]]) add(HANDAKU[r[0]] + r.slice(1), 1);
    if (/[つちくき]$/.test(r) && r.length > 1) add(r.slice(0, -1) + 'っ', 1);
  }
  return [...out];
}
// Best unambiguous alignment of the word's characters to its reading, or null.
function align(form, reading) {
  const chars = [...hira(form)], orig = [...form], target = [...hira(reading)];
  const memo = new Map();
  const go = (i, j, prev) => {
    if (i === chars.length) return j === target.length ? [{ cost: 0, parts: [] }] : [];
    const key = `${i},${j},${prev ?? ''}`;
    if (memo.has(key)) return memo.get(key);
    let res = [];
    const c = chars[i];
    if (!isKanji(orig[i])) { if (target[j] === c) res = go(i + 1, j + 1, null).map(x => ({ ...x, parts: [null, ...x.parts] })); }
    else {
      const cands = orig[i] === '々' ? (prev ? candidates(prev).concat(candidates(prev).map(([s, k]) => [s, k])) : []) : candidates(orig[i]);
      for (const [s, cost] of cands) {
        const chunk = [...s];
        if (target.slice(j, j + chunk.length).join('') !== s) continue;
        for (const x of go(i + 1, j + chunk.length, orig[i] === '々' ? prev : orig[i])) res.push({ cost: x.cost + cost, parts: [{ glyph: orig[i] === '々' ? prev : orig[i], text: orig[i], reading: [...reading].slice(j, j + chunk.length).join('') }, ...x.parts] });
        if (res.length > 200) break;
      }
    }
    memo.set(key, res);
    return res;
  };
  const all = go(0, 0, null);
  if (!all.length) return null;
  const min = Math.min(...all.map(x => x.cost));
  const best = [...new Map(all.filter(x => x.cost === min).map(x => [x.parts.map(p => p && p.reading).join('|'), x])).values()];
  return best.length === 1 ? best[0].parts.filter(Boolean) : null;
}
// Strip book decorations: （する）/（な）, ～ marks, and a な the reading does not carry (的な -> 的).
const core = (w, reading = '') => { const x = w.replace(/[（(][^）)]*[）)]/g, '').replace(/[～〜~]/g, '').trim(); return x.endsWith('な') && reading && !reading.replace(/[（(][^）)]*[）)]/g, '').endsWith('な') ? x.slice(0, -1) : x; };

const dict = await localDictionary();
async function jmdictGloss(form, reading) {
  if (dict.metadata.status !== 'ready') return null;
  const hit = (await dict.lookup(form)).find(c => c.readings.includes(reading));
  return hit ? { id: hit.id, meanings: hit.senses[0].meanings.slice(0, 2) } : null;
}

// --- Plan ----------------------------------------------------------------------------------------
const vocab = await db.vocabulary.findMany({ where: { item: { status: 'approved' } }, select: { itemId: true, writtenForm: true, reading: true, item: { select: { revision: true } } } });
const hasContent = async (itemId, where) => !!await db.content.findFirst({ where: { status: 'approved', successor: null, ...where, items: { some: { itemId } } }, select: { id: true } });
const plan = [], skipped = [], stats = { aligned: 0, wholeWord: 0, noKanji: 0, alreadyHave: 0 };
for (const v of vocab) {
  const form = core(v.writtenForm, v.reading), reading = core(v.reading);
  if (![...form].some(isKanji)) { stats.noKanji++; continue; }
  if (await hasContent(v.itemId, { payloadJson: { path: ['kind'], equals: 'vocabularyComponentAid' } })) { stats.alreadyHave++; continue; }
  const parts = align(form, reading);
  let components, used = new Set(['kanjidic']);
  if (parts?.every(p => kd.get(p.glyph)?.meanings.length)) {
    components = parts.map(p => ({ text: p.text, reading: p.reading, meanings: kd.get(p.glyph).meanings.slice(0, 2), readingType: 'contextual', meaningOrigin: 'dictionary',
      evidence: [{ source: 'EDRDG KANJIDIC2', url: KANJIDIC2_FILE, entryId: p.glyph }] }));
    stats.aligned++;
  } else {
    const j = await jmdictGloss(form, reading);
    if (!j || !/^[ぁ-ゖァ-ヺー]+$/u.test(reading)) { skipped.push(`${v.writtenForm}|${v.reading}`); continue; }
    components = [{ text: form, reading, meanings: j.meanings, readingType: 'whole_word', note: 'Whole-word reading; the kanji sounds could not be separated unambiguously.', meaningOrigin: 'dictionary', evidence: [{ source: 'EDRDG JMdict', url: JMDICT_URL, entryId: j.id }] }];
    used = new Set(['jmdict']); stats.wholeWord++;
  }
  const payload = { kind: 'vocabularyComponentAid', word: v.writtenForm, reading: v.reading, itemRevision: v.item.revision, components,
    additionKey: 'dictionary-checked-components-v2', reviewBasis: 'user_accepted_without_pdf_comparison', acceptance: ACCEPTANCE, uncertainty: [],
    sourceRecordKey: `vocabulary/dictionary/${v.writtenForm}/${v.reading}`, reviewMethod: 'Automatic KANJIDIC2/JMdict alignment; not compared with the book PDF.' };
  const ok = vocabularyComponentAidSchema.safeParse(payload);
  if (!ok.success) { skipped.push(`${v.writtenForm}|${v.reading} (schema)`); continue; }
  plan.push({ v, payload, used });
}

const sentencePlan = [], sentenceErrors = [];
for (const s of (await Promise.all(sentenceFiles.map(async f => JSON.parse(await readFile(f, 'utf8'))))).flat()) {
  try {
    const v = vocab.find(x => x.writtenForm === s.word);
    if (!v) throw new Error('unknown word');
    if (await hasContent(v.itemId, { kind: 'sentence' }) || sentencePlan.some(p => p.v === v)) continue;
    const w = core(v.writtenForm, v.reading), r = core(v.reading);
    const stem = (x, hasKanji) => hasKanji && /[ぁ-ん]$/u.test(x) ? x.slice(0, -1) : x; // verbs/adjectives conjugate: compare stems
    if (!s.japanese.includes(stem(w, [...w].some(isKanji)))) throw new Error('sentence lacks the word');
    if (!plainKana(s.reading)) throw new Error('reading is not plain hiragana');
    if (!s.reading.includes(stem(r, [...w].some(isKanji)))) throw new Error('reading lacks the word reading');
    if (!/[A-Za-z]{3}/.test(s.translation)) throw new Error('translation missing');
    sentencePlan.push({ v, s });
  } catch (e) { sentenceErrors.push(`${s.word}: ${e.message}`); }
}

console.log(JSON.stringify({ apply, vocab: vocab.length, ...stats, aidsToWrite: plan.length, skippedNoAid: skipped.length, sentencesToWrite: sentencePlan.length, sentenceErrors }, null, 1));
console.log('skipped:', skipped.join(' ; '));
for (const { v, payload } of plan.filter((_, i) => i % 12 === 0 || payload0(_).whole)) console.log(v.writtenForm, v.reading, '=>', payload.components.map(c => `${c.text}[${c.reading}]=${c.meanings.join('/')}${c.readingType === 'whole_word' ? ' (whole)' : ''}`).join('  '));
function payload0(p) { return { whole: p.payload.components[0].readingType === 'whole_word' }; }
if (!apply) { await db.$disconnect(); process.exit(0); }

const sourceFor = async (title, fileReference) => await db.source.findFirst({ where: { sourceType: 'dictionary', title: { startsWith: title.split(' · ')[0] } } })
  ?? await db.source.create({ data: { id: randomUUID(), title, sourceType: 'dictionary', language: 'ja', fileReference } });
const sources = { kanjidic: await sourceFor(KANJIDIC2_TITLE, KANJIDIC2_FILE), jmdict: await sourceFor(JMDICT_TITLE, JMDICT_URL) };
for (let i = 0; i < plan.length; i += 100) {
  await db.$transaction(async tx => {
    for (const { v, payload, used } of plan.slice(i, i + 100)) {
      await tx.content.create({ data: { id: randomUUID(), kind: 'explanation', origin: 'generated', status: 'approved', revision: 1, payloadJson: payload,
        items: { create: { itemId: v.itemId, role: 'support' } },
        sourceEntries: { create: [...used].map(tag => ({ id: randomUUID(), sourceId: sources[tag].id, sourceRecordKey: `accepted/vocabulary/${v.itemId}/component-aid-${tag}`, revision: 1,
          fieldPresenceJson: { reference: 'supplied' }, verificationStatus: 'verified', verifiedAt: new Date(), originalPayloadJson: { title: `${tag} component meanings for ${v.writtenForm}`, selected_sense: payload.components.map(c => `${c.text}: ${c.meanings.join('; ')}`).join(' | ') } })) } } });
    }
  }, { timeout: 120000 });
}
await db.$transaction(async tx => {
  for (const { v, s } of sentencePlan) {
    await tx.content.create({ data: { id: randomUUID(), kind: 'sentence', origin: 'generated', status: 'approved', revision: 1,
      payloadJson: { japanese: s.japanese, reading: s.reading, translation: s.translation, meanings: null, sourceWord: false, addedBy: 'AI', generatedBy: 'Claude Haiku', acceptance: ACCEPTANCE,
        acceptedLimitations: ['AI-written example sentence; not from the book and not independently verified.'] },
      items: { create: { itemId: v.itemId, role: 'target' } } } });
  }
}, { timeout: 120000 });
console.log(`Wrote ${plan.length} component aids and ${sentencePlan.length} sentences.`);
await db.$disconnect();
