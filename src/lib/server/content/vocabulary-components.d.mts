import type {z} from 'zod';
export type VocabularyComponent={text:string;reading:string|null;meanings:string[];readingType:'contextual'|'dictionary_form'|'whole_word';note?:string};
export type VocabularyComponentAid={kind:'vocabularyComponentAid';itemRevision:number;word:string;reading:string;components:VocabularyComponent[]};
export const vocabularyComponentAidSchema:z.ZodType<VocabularyComponentAid>;
export function vocabularyComponentAid(item:{revision:number;vocabulary:{writtenForm:string;reading:string}|null},contents:{kind:string;status:string;origin:string;successor?:unknown;payloadJson:unknown}[]):VocabularyComponentAid|null;
