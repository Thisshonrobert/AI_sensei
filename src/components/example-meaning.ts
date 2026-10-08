import type { CatalogContent } from '@/lib/server/content/catalog';
import { object, text } from './reference';

// Enrichment stays separate from immutable book content and must be approved.
export function exampleMeaning(content:CatalogContent,references:CatalogContent[]) {
  const p=object(content.payloadJson);
  if(text(p.translation)||text(p.meanings)) return null;
  const japanese=text(p.japanese),reading=text(p.reading);
  if(!japanese || !reading) return null;
  const matches=references.filter(reference=>{
    const addition=object(reference.payloadJson),evidence=object(addition.dictionaryEvidence ?? null);
    return reference.status==='approved' && reference.kind==='explanation' && text(addition.originalJapanese)===japanese && text(addition.selectedMeanings) &&
      text(evidence.originalReading || evidence.reading)===reading;
  });
  // Multiple competing senses need an explicit decision, not arbitrary query order.
  return matches.length===1?matches[0]:null;
}
