export type ReviewCaps = { vocabulary: number; kanji: number; grammar: number };
export const DEFAULT_CAPS: Readonly<ReviewCaps>;
export function category(card: { objective: string }): keyof ReviewCaps;
export function splitCap(remaining: number, waiting: number, due: number): { first: number; due: number };
export function retrievability(state: object, now: Date, config: { parameters: object }): number;
export function planQueue<T extends { id: string; objective: string; dueAt: Date; fsrsStateJson: object }>(input: {
  waiting: T[]; due: T[]; caps: Partial<ReviewCaps>; used: Partial<ReviewCaps>; now: Date; config: { parameters: object }; siblings: (a: T, b: T) => boolean;
}): T[];
