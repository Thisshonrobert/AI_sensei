import {z} from 'zod';
const label=z.string().trim().min(1).max(200);
const kana=z.string().trim().min(1).max(100).regex(/^[\u3041-\u3096\u30a1-\u30fa\u30fc]+$/u);
export const vocabularyComponentAidSchema=z.object({
 kind:z.literal('vocabularyComponentAid'),itemRevision:z.number().int().positive(),word:label,reading:label,
 components:z.array(z.object({text:label,reading:kana.nullable(),meanings:z.array(label).min(1).max(20),readingType:z.enum(['contextual','dictionary_form','whole_word']),note:z.string().max(1000).optional()}).passthrough().refine(c=>c.reading!==null||(c.readingType==='whole_word'&&!!c.note?.trim()))).min(1).max(24),
}).passthrough();
// Supplementary explanations never overwrite the item's textbook fields or recall prompt.
export function vocabularyComponentAid(item,contents) {
 if(!item.vocabulary)return null;
 const matches=contents.filter(c=>c.kind==='explanation'&&c.status==='approved'&&!c.successor&&['generated','user'].includes(c.origin)&&c.payloadJson?.kind==='vocabularyComponentAid');
 const current=matches.filter(c=>c.payloadJson.itemRevision===item.revision&&c.payloadJson.word===item.vocabulary.writtenForm&&c.payloadJson.reading===item.vocabulary.reading);
 if(current.length!==1)return null;
 const parsed=vocabularyComponentAidSchema.safeParse(current[0].payloadJson);
 return parsed.success?parsed.data:null;
}
