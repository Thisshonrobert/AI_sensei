import type { Prisma } from '@prisma/client';
import type { CatalogContent } from './catalog';
// Resolution reads only identity, provenance and payload. Browse lists select these
// fields without citations or revision history, so they also satisfy this shape.
export type KanjiMeaningContent = Pick<CatalogContent, 'id' | 'kind' | 'origin' | 'status' | 'revision' | 'payloadJson' | 'successor'>
  & { createdAt?: Date | string | null };
export type KanjiMeaningResolution<C extends KanjiMeaningContent = CatalogContent> = {
  meanings: string[];
  text: string;
  source: 'book' | 'supplement';
  supplement: C | null;
  original: string[];
};
export const KANJI_MEANING_FIELD_PATHS: readonly string[];
export function isKanjiMeaningSupplement(content: KanjiMeaningContent): boolean;
export function resolveKanjiMeanings<C extends KanjiMeaningContent>(contents: readonly C[], fallback?: Prisma.JsonValue | null): KanjiMeaningResolution<C>;
