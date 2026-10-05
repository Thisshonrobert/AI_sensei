export const kinds = ['vocabulary', 'kanji', 'grammar'] as const;
export type Kind = typeof kinds[number];
export const titles: Record<Kind, string> = { vocabulary: 'Vocabulary', kanji: 'Kanji', grammar: 'Grammar' };
export function parseKind(value: string): Kind | null {
  return kinds.find(kind => kind === value) ?? null;
}
export function pageInput(input: {page?: string; query?: string}) {
  const requested = Number(input.page || 1);
  const page = Number.isSafeInteger(requested) && requested >= 1 && requested <= 10000 ? requested : 1;
  return { page, skip: (page - 1) * 50, query: (typeof input.query === 'string' ? input.query : '').trim().slice(0, 100) };
}
