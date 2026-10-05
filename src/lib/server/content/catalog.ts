import 'server-only';
import { Prisma } from '@prisma/client';
import { db } from '../db';
import { type Kind, pageInput } from './catalog-input';

export const sourceSelect = { id: true, title: true, edition: true, sourceType: true, language: true } satisfies Prisma.SourceSelect;
export const citationSelect = { id: true, revision: true, successor: { select: { id: true } }, printedPage: true, pdfPageIndex: true, fieldPresenceJson: true, sourceRecordKey: true, source: { select: sourceSelect } } satisfies Prisma.SourceEntrySelect;
export const itemSelect = { id: true, kind: true, status: true, revision: true, fieldOriginsJson: true, vocabulary: true, kanji: true, grammar: true } satisfies Prisma.ItemSelect;
export const contentSelect = { id: true, revision: true, successor: { select: { id: true } }, kind: true, origin: true, status: true, payloadJson: true, sourceEntries: { select: citationSelect, take: 20, where: { successor: null } } } satisfies Prisma.ContentSelect;
export type CatalogItem = Prisma.ItemGetPayload<{ select: typeof itemSelect }>;
export type Citation = Prisma.SourceEntryGetPayload<{ select: typeof citationSelect }>;
export type CatalogContent = Prisma.ContentGetPayload<{ select: typeof contentSelect }>;

export async function listItems(kind: Kind, input: {page?: string; query?: string}) {
  const paging = pageInput(input);
  const contains = { contains: paging.query, mode: 'insensitive' as const };
  const filter: Prisma.ItemWhereInput = !paging.query ? {} : kind === 'vocabulary' ? { vocabulary: { OR: [{ writtenForm: contains }, { reading: contains }, { meaningEn: contains }] } } : kind === 'kanji' ? { kanji: { glyph: contains } } : { grammar: { pattern: contains } };
  const where = { kind, status: 'approved', ...filter };
  const [items, count] = await Promise.all([
    db.item.findMany({ where, select: itemSelect, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 50, skip: paging.skip }),
    db.item.count({ where }),
  ]);
  return { items, count, ...paging };
}
export async function itemDetail(kind: Kind, id: string) {
  if (!isUuid(id)) return null;
  const item = await db.item.findFirst({ where: { id, kind, status: 'approved' }, select: {
    ...itemSelect, sourceEntries: { select: citationSelect, where: { successor: null }, take: 30 },
    contentLinks: { where: { content: { successor: null } }, select: { content: { select: contentSelect } }, take: 120, orderBy: { contentId: 'asc' } },
  } });
  if (!item) return null;
  const originIds = Object.values(item.fieldOriginsJson as Prisma.JsonObject).filter((value): value is string => typeof value === 'string' && isUuid(value));
  const exactEvidence = await db.sourceEntry.findMany({ where: { itemId: id, id: { in: originIds } }, select: citationSelect, take: 20 });
  const sourceEntries = [...new Map([...item.sourceEntries, ...exactEvidence].map(entry => [entry.id, entry])).values()];
  return { ...item, sourceEntries };
}
export function isUuid(id: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id); }
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
