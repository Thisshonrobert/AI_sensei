import type { Run,ReaderReference } from './service.mjs';
export function prepareReader(run:Run):Promise<ReaderReference>;
export const N5_N3_KANJI:string;
export function knownKanji(db:import('@prisma/client').PrismaClient,userId:string):Promise<string>;
export function conjugationLabel(tokens:{surface_form:string;basic_form:string;pos:string;pos_detail_1:string}[]):string|null;
