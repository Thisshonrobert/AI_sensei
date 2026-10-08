export function sentenceUnits(draft){
 const ranges=Array.from(new Intl.Segmenter('ja',{granularity:'sentence'}).segment(draft.japanese));
 return ranges.map((s,i)=>{const end=s.index+s.segment.length,translation=draft.sentences?.find(t=>t.start>=s.index&&t.end<=end&&!draft.japanese.slice(s.index,t.start).trim()&&!draft.japanese.slice(t.end,end).trim())?.translation||(draft.kind==='sentence'&&ranges.length===1?draft.translation:null);return {id:`sentence-${i}`,start:s.index,end,japanese:s.segment,translation};});
}
