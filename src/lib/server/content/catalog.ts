import 'server-only';
import { Prisma } from '@prisma/client';
import { db } from '../db';
import { type Kind, pageInput } from './catalog-input';
import { resolveKanjiMeanings } from './kanji-meanings.mjs';
import { vocabularyComponentAid } from './vocabulary-components.mjs';

export const sourceSelect = { id: true, title: true, edition: true, sourceType: true, language: true } satisfies Prisma.SourceSelect;
// Only the linked record is included, never a book, batch or raw source payload.
export const citationSelect = { id: true, revision: true, successor: { select: { id: true } }, printedPage: true, pdfPageIndex: true, fieldPresenceJson: true, sourceRecordKey: true, source: { select: sourceSelect },
  item: { select: { vocabulary: {select:{writtenForm:true,reading:true,meaningEn:true}}, kanji:{select:{glyph:true,meaningsJson:true,onReadingsJson:true,kunReadingsJson:true}}, grammar:{select:{pattern:true,explanationJa:true,explanationEn:true}} } },
  content: { select: { kind:true,status:true,origin:true,payloadJson:true } },
} satisfies Prisma.SourceEntrySelect;
export const itemSelect = { id: true, kind: true, status: true, revision: true, fieldOriginsJson: true, vocabulary: true, kanji: true, grammar: true } satisfies Prisma.ItemSelect;
export const contentSelect = { id: true, revision: true, successor: { select: { id: true } }, kind: true, origin: true, status: true, payloadJson: true, sourceEntries: { select: citationSelect, take: 20, where: { successor: null } } } satisfies Prisma.ContentSelect;
export type CatalogItem = Prisma.ItemGetPayload<{ select: typeof itemSelect }>;
export type Citation = Prisma.SourceEntryGetPayload<{ select: typeof citationSelect }>;
export type CatalogContent = Prisma.ContentGetPayload<{ select: typeof contentSelect }>;
// Browse-list meaning resolution needs no citations or revision history.
export const kanjiMeaningSelect = { id: true, kind: true, origin: true, status: true, revision: true, createdAt: true, successor: { select: { id: true } }, payloadJson: true } satisfies Prisma.ContentSelect;

// Approved English kanji and vocabulary glosses are field supplements; the book wording stays untouched.
export async function listKanjiMeanings(items: readonly { id: string; kanji: { meaningsJson: Prisma.JsonValue } | null; vocabulary?: { meaningEn: string } | null }[]) {
  const book = new Map(items.map(item => [item.id, item.kanji?.meaningsJson ?? item.vocabulary?.meaningEn ?? null]));
  const ids = [...book.keys()];
  if (!ids.length) return new Map<string, string>();
  const rows = await db.content.findMany({
    where: { kind: 'explanation', status: 'approved', successor: null, payloadJson: { path: ['kind'], equals: 'dictionaryFieldSupplement' }, items: { some: { itemId: { in: ids } } } },
    select: { ...kanjiMeaningSelect, items: { where: { itemId: { in: ids } }, select: { itemId: true } } },
  });
  const byItem = new Map<string, typeof rows>();
  for (const row of rows) for (const link of row.items) byItem.set(link.itemId, [...(byItem.get(link.itemId) ?? []), row]);
  return new Map([...byItem].map(([itemId, contents]) => [itemId, resolveKanjiMeanings(contents, book.get(itemId)).text]));
}

export async function listItems(kind: Kind, input: {page?: string; query?: string}) {
  const paging = pageInput(input);
  const contains = { contains: paging.query, mode: 'insensitive' as const };
  const filter: Prisma.ItemWhereInput = !paging.query ? {} : kind === 'vocabulary' ? { vocabulary: { OR: [{ writtenForm: contains }, { reading: contains }, { meaningEn: contains }] } } : kind === 'kanji' ? { kanji: { glyph: contains } } : { grammar: { pattern: contains } };
  const where = { kind, status: 'approved', ...filter };
  const [items, count] = await Promise.all([
    db.item.findMany({ where, select: itemSelect, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 50, skip: paging.skip }),
    db.item.count({ where }),
  ]);
  const contextCount=kind==='vocabulary'?await db.item.count({where:{...where,sourceEntries:{some:{curriculumRole:'context_reference',successor:null}}}}):0;
  return { items, count, contextCount, ...paging };
}
// Items the learner has marked studied at least once (introducedAt is set once and never cleared).
export async function studiedIds(userId: string, ids: readonly string[]) {
  if (!ids.length) return new Set<string>();
  const rows = await db.userItem.findMany({ where: { userId, itemId: { in: [...ids] }, introducedAt: { not: null } }, select: { itemId: true } });
  return new Set(rows.map(row => row.itemId));
}
// Dashboard "resume": the list page and entry right after the most recently studied one, in list order.
export async function resumeHref(kind: Kind, userId: string) {
  const last = await db.userItem.findFirst({ where: { userId, introducedAt: { not: null }, item: { kind, status: 'approved' } }, orderBy: { introducedAt: 'desc' }, select: { item: { select: { id: true, createdAt: true } } } });
  if (!last) return `/${kind}`;
  const where = { kind, status: 'approved' } as const;
  const { id, createdAt } = last.item;
  const [before, total] = await Promise.all([
    db.item.count({ where: { ...where, OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: id } }] } }),
    db.item.count({ where }),
  ]);
  const index = Math.min(before + 1, total - 1);
  const next = await db.item.findFirst({ where, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], skip: index, select: { id: true } });
  return next ? `/${kind}?page=${Math.floor(index / 50) + 1}#item-${next.id}` : `/${kind}`;
}
const jsonText = (value: Prisma.JsonValue | undefined) => typeof value === 'string' ? value.trim() : '';
const wordKey = (writtenForm: string, reading: string) => `${writtenForm}\u0000${reading}`;
// A kanji card's example words reuse an approved vocabulary record with the same written form
// and reading for their English meaning. Missing book glosses stay missing; nothing is invented.
async function exampleWordMeanings(contents: CatalogContent[]) {
  const words = [...new Map(contents
    .filter(content => content.kind === 'sentence' && content.status === 'approved')
    .map(content => content.payloadJson && typeof content.payloadJson === 'object' && !Array.isArray(content.payloadJson) ? content.payloadJson as Prisma.JsonObject : {})
    .filter(payload => payload.sourceWord === true)
    .map(payload => ({ writtenForm: jsonText(payload.japanese), reading: jsonText(payload.reading) }))
    .filter(word => word.writtenForm && word.reading)
    .map(word => [wordKey(word.writtenForm, word.reading), word])).values()];
  if (!words.length) return {};
  const rows = await db.vocabulary.findMany({
    where: { item: { status: 'approved' }, OR: words.map(({ writtenForm, reading }) => ({ writtenForm, reading })) },
    select: {
      writtenForm: true, reading: true, meaningEn: true,
      item: { select: { revision: true, contentLinks: {
        where: { content: { status: 'approved', successor: null, kind: 'explanation' } },
        select: { content: { select: { id: true, kind: true, origin: true, status: true, revision: true, createdAt: true, successor: { select: { id: true } }, payloadJson: true } } },
      } } },
    },
    take: 20,
  });
  const found = new Map<string, Set<string>>();
  for (const row of rows) {
    const rowContents = row.item.contentLinks.map(link => link.content);
    let meaning = resolveKanjiMeanings(rowContents, row.meaningEn).text;
    if (!meaning) {
      const aid = vocabularyComponentAid({ revision: row.item.revision, vocabulary: { writtenForm: row.writtenForm, reading: row.reading } }, rowContents);
      meaning = [...new Set((aid?.components ?? []).flatMap(component => component.meanings))].join(' · ');
    }
    if (!meaning) continue;
    const key = wordKey(row.writtenForm, row.reading);
    found.set(key, (found.get(key) ?? new Set()).add(meaning));
  }
  // Competing senses would make an arbitrary pick; show only unambiguous meanings.
  return Object.fromEntries([...found].filter(([, meanings]) => meanings.size === 1).map(([key, meanings]) => [key, [...meanings][0]]));
}
export async function itemDetail(kind: Kind, id: string) {
  if (!isUuid(id)) return null;
  const item = await db.item.findFirst({ where: { id, kind, status: 'approved' }, select: {
    createdAt: true,
    ...itemSelect, vocabulary: {include:{kanjiLinks:{where:{kanji:{item:{status:'approved'}}},take:24,select:{kanji:{select:{itemId:true,glyph:true,meaningsJson:true}}}}}}, sourceEntries: { select: citationSelect, where: { successor: null }, take: 30 },
    contentLinks: { where: { content: { successor: null } }, select: { content: { select: contentSelect } }, take: 120, orderBy: { contentId: 'asc' } },
  } });
  if (!item) return null;
  const originIds = Object.values(item.fieldOriginsJson as Prisma.JsonObject).filter((value): value is string => typeof value === 'string' && isUuid(value));
  const exactEvidence = await db.sourceEntry.findMany({ where: { itemId: id, id: { in: originIds } }, select: citationSelect, take: 20 });
  const sourceEntries = [...new Map([...item.sourceEntries, ...exactEvidence].map(entry => [entry.id, entry])).values()];
  const kanjiInWord = item.vocabulary ? await db.kanji.findMany({where:{glyph:{in:[...new Set(Array.from(item.vocabulary.writtenForm))].slice(0,24)},item:{status:'approved'}},select:{itemId:true,glyph:true,meaningsJson:true},take:24}) : [];
  // Exact stored glyph matches are display aids; this does not create canonical relationships.
  const linkedKanji = [...new Map([...(item.vocabulary?.kanjiLinks.map(l=>l.kanji)||[]),...kanjiInWord].map(k=>[k.itemId,k])).values()];
  const exampleMeanings = item.kind === 'kanji' ? await exampleWordMeanings(item.contentLinks.map(link => link.content)) : {};
  return { ...item, sourceEntries, linkedKanji, exampleMeanings };
}
export function isUuid(id: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id); }
export async function itemNeighbors(kind:Kind,id:string,createdAt:Date) {
  // Same deterministic order as the catalog, without loading the entire collection.
  const adjacent=async(direction:'previous'|'next')=>{
    const comparison=direction==='previous'?'lt':'gt';
    const order=direction==='previous'?'desc':'asc';
    return db.item.findFirst({where:{kind,status:'approved',OR:[{createdAt:{[comparison]:createdAt}},{createdAt,id:{[comparison]:id}}]},select:{id:true},orderBy:[{createdAt:order},{id:order}]});
  };
  const [previous,next]=await Promise.all([adjacent('previous'),adjacent('next')]);
  return {previous,next};
}
export async function sourceList(input: {page?: string}) {
  const paging = pageInput(input);
  const [sources, count] = await Promise.all([db.source.findMany({ select: { ...sourceSelect, _count: { select: { entries: true } } }, orderBy: { id: 'asc' }, take: 50, skip: paging.skip }), db.source.count()]);
  return { sources, count, ...paging };
}
export async function sourceDetail(id: string, input: {page?: string; record?: string}) {
  if (!isUuid(id)) return null;
  const source = await db.source.findUnique({ where: { id }, select: sourceSelect });
  if (!source) return null;
  const paging = pageInput(input);
  const focused = input.record && isUuid(input.record) ? input.record : undefined;
  const where = { sourceId: id, ...(focused ? { id: focused } : { successor: null, OR: [{ itemId: { not: null } }, { content: { successor: null } }] }) };
  const [entries, count] = await Promise.all([
    db.sourceEntry.findMany({ where, select: { ...citationSelect, item: { select: itemSelect }, content: { select: contentSelect } }, orderBy: [{ pdfPageIndex: 'asc' }, { sourceRecordKey: 'asc' }, { id: 'asc' }], take: 50, skip: paging.skip }),
    db.sourceEntry.count({ where }),
  ]);
  return { source, entries, count, ...paging, focused: !!focused };
}
