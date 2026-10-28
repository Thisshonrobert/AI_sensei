const text=v=>typeof v==='string'?v:'';
const meaning=p=>typeof p.selectedMeanings==='string'?p.selectedMeanings:Array.isArray(p.selectedMeanings)?p.selectedMeanings.join(' · '):text(p.translation);
const reading=p=>text(p.reading)||text(p.dictionaryEvidence?.originalReading)||text(p.dictionaryEvidence?.reading);
// Approved field supplements are applied to the item's own fields; they are not examples.
const fieldSupplement=c=>c.status==='approved'&&c.payloadJson?.kind==='dictionaryFieldSupplement';
// Presentation only: immutable source payloads and canonical identities stay intact.
export function referencePresentation(contents){
 const consumed=new Set();
 const complete=contents.some(c=>c.status==='approved'&&['dictionaryKanjiReference','generatedKanjiMnemonic'].includes(c.payloadJson.kind)&&text(c.payloadJson.meaningMnemonic));
 const rows=contents.map(content=>{
  const p=content.payloadJson;let supplement=null,resolvedReading=text(p.reading);
  if(content.kind==='sentence'&&content.status==='approved'){
   // Dictionary word meanings are JMdict lookups; an unreviewed one still fills a sentence that has no meaning.
   const sameJapanese=contents.filter(c=>c.kind==='explanation'&&(c.status==='approved'||c.payloadJson.kind==='dictionaryWordMeaning')&&!c.successor&&text(c.payloadJson.originalJapanese)===text(p.japanese));
   // Generated example-language records repeat the book sentence. Merge one usable record
   // as the sentence reading/translation and never render the duplicates as extra examples.
   const examples=sameJapanese.filter(c=>c.payloadJson.kind==='exampleLanguage');
   examples.forEach(c=>consumed.add(c.id));
   const example=examples.find(c=>reading(c.payloadJson)&&meaning(c.payloadJson))||examples.find(c=>reading(c.payloadJson))||examples.find(c=>meaning(c.payloadJson))||null;
   const matches=sameJapanese.filter(c=>c.payloadJson.kind!=='exampleLanguage'&&meaning(c.payloadJson)&&reading(c.payloadJson)&&(!resolvedReading||reading(c.payloadJson)===resolvedReading));
   if(example){supplement=example;resolvedReading ||= reading(example.payloadJson);}
   else if(matches.length===1){supplement=matches[0];resolvedReading ||= reading(supplement.payloadJson);consumed.add(supplement.id);}
  }
  return {content,reading:resolvedReading,supplement};
 });
 return rows.filter(({content})=>!fieldSupplement(content)&&!consumed.has(content.id)&&!(complete&&content.payloadJson.kind==='dictionaryKanjiReference'&&!text(content.payloadJson.meaningMnemonic)&&text(content.payloadJson.meaningMnemonicExcerpt)));
}
