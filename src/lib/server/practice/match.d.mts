import type { PrismaClient } from '@prisma/client';
export type MatchKind = 'vocabulary' | 'kanji';
export type MatchPair = { id: string; prompt: string; answer: string };
export const MATCH_SIZE: Record<MatchKind, number>;
export function vocabAnswer(answer: { reading?: unknown; meaning: string }): string;
export function kanjiAnswer(kanji: { onReadingsJson?: unknown; kunReadingsJson?: unknown } | null | undefined, meaning: string): string;
export function pickMatchPairs(candidates: MatchPair[], options?: { size?: number; random?: () => number }): MatchPair[];
export function matchCandidates(db: PrismaClient, userId: string, kind: MatchKind): Promise<MatchPair[]>;
export function matchPairs(db: PrismaClient, userId: string, kind: MatchKind): Promise<{ kind: MatchKind; pairs: MatchPair[] }>;
