const text=v=>typeof v==='string'?v:'';
const meaning=p=>typeof p.selectedMeanings==='string'?p.selectedMeanings:Array.isArray(p.selectedMeanings)?p.selectedMeanings.join(' · '):'';
const reading=p=>text(p.reading)||text(p.dictionaryEvidence?.originalReading)||text(p.dictionaryEvidence?.reading);
// Presentation only: immutable source payloads and canonical identities stay intact.
export function referencePresentation(contents){
 const consumed=new Set();
 const complete=contents.some(c=>c.status==='approved'&&['dictionaryKanjiReference','generatedKanjiMnemonic'].includes(c.payloadJson.kind)&&text(c.payloadJson.meaningMnemonic));
 const rows=contents.map(content=>{
  const p=content.payloadJson;let supplement=null,resolvedReading=text(p.reading);
  if(content.kind==='sentence'&&content.status==='approved'){
   const matches=contents.filter(c=>c.kind==='explanation'&&c.status==='approved'&&!c.successor&&text(c.payloadJson.originalJapanese)===text(p.japanese)&&meaning(c.payloadJson)&&reading(c.payloadJson)&&(!resolvedReading||reading(c.payloadJson)===resolvedReading));
   if(matches.length===1){supplement=matches[0];resolvedReading ||= reading(supplement.payloadJson);consumed.add(supplement.id);}
  }
  return {content,reading:resolvedReading,supplement};
 });
 return rows.filter(({content})=>!consumed.has(content.id)&&!(complete&&content.payloadJson.kind==='dictionaryKanjiReference'&&!text(content.payloadJson.meaningMnemonic)&&text(content.payloadJson.meaningMnemonicExcerpt)));
}
