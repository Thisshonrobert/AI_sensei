import { readingTokens } from './analyzer.mjs';
import { localDictionary } from './dictionary.mjs';
import { N5_N3_KANJI } from './contract.mjs';
export { N5_N3_KANJI };
// Kanji the learner counts as known for "according to my knowledge" furigana: studied kanji plus N5–N3.
export async function knownKanji(db,userId){
 const studied=await db.kanji.findMany({where:{item:{status:'approved',userItems:{some:{userId,introducedAt:{not:null}}}}},select:{glyph:true},take:5000});
 return [...new Set([...N5_N3_KANJI,...studied.map(k=>k.glyph)])].join('');
}
const han=text=>/\p{Script=Han}/u.test(text);
const hiragana=text=>text.replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60));
const boundary=(text,n)=>Number.isInteger(n)&&n>=0&&n<=text.length&&!(n>0&&n<text.length&&/[\uD800-\uDBFF]/.test(text[n-1])&&/[\uDC00-\uDFFF]/.test(text[n]));
const overlap=(a,b)=>a.start<b.end&&b.start<a.end;
// Particles and auxiliaries stay tappable but are not underlined as content words.
const content=t=>!['助詞','助動詞','記号'].includes(t.pos);
// て/で + a non-independent verb carries aspect; the remaining auxiliaries carry voice, polarity, politeness and tense.
const aspect={いる:'progressive',ある:'resultative state',しまう:'completed',おく:'done in advance',みる:'try doing',くる:'coming about',いく:'going on',くれる:'favour received',あげる:'favour given',もらう:'favour received'};
const auxiliary=[[t=>['れる','られる'].includes(t.basic_form),'passive / potential'],[t=>['せる','させる'].includes(t.basic_form),'causative'],[t=>t.basic_form==='たい','want to'],
 [t=>t.pos==='助動詞'&&['ない','ぬ','ん'].includes(t.basic_form),'negative'],[t=>t.basic_form==='ます','polite'],[t=>t.basic_form==='た'&&/^[たださ]ら$/.test(t.surface_form),'conditional'],
 [t=>t.basic_form==='た'&&!/ら$/.test(t.surface_form),'past'],[t=>['う','よう'].includes(t.basic_form)&&t.pos==='助動詞','volitional']];
// Satori-style "sentence form" label from local tokens only, e.g. 降っていた → "Progressive | past".
export function conjugationLabel(tokens){
 const tail=tokens.slice(1),labels=[];
 tail.forEach((t,i)=>{const prev=tail[i-1]??tokens[0];if(t.pos==='動詞'&&t.pos_detail_1==='非自立'&&(['て','で'].includes(prev.surface_form)||i===0)&&aspect[t.basic_form])labels.push(aspect[t.basic_form]);else if(['ちゃう','じゃう'].includes(t.basic_form))labels.push('completed');});
 for(const [match,label] of auxiliary)if(tail.some(match)&&!labels.includes(label))labels.push(label);
 if(!labels.length)return null;const text=labels.join(' | ');return text[0].toUpperCase()+text.slice(1);
}

export async function prepareReader(run,options={}){
 const text=run.draft.japanese;if(text.length>2000)throw new Error('Reader passage limit exceeded');
 const local=options.lookup?{lookup:options.lookup,metadata:{status:'ready'}}:await localDictionary();
 const dictionary={...local.metadata};let tokens=[];
 try{tokens=(await readingTokens(text)).flatMap(t=>{
  // IPADIC can group unknown ideographs with emoji as symbols. Split only
  // Unicode symbol boundaries; retain unknown lexical runs without readings.
  if(t.word_type!=='UNKNOWN'||!han(t.surface_form))return [t];
  return [...t.surface_form.matchAll(/[\p{L}\p{N}\p{M}ー々]+/gu)].map(m=>({...t,surface_form:m[0],start:t.start+m.index,end:t.start+m.index+m[0].length}));
 });}catch{dictionary.analyzerUnavailable=true;}
 const tokenStarts=new Set(tokens.map(t=>t.start)),tokenEnds=new Set(tokens.map(t=>t.end));
 const words=[],annotations=run.draft.uses.filter(u=>boundary(text,u.start)&&boundary(text,u.end)&&u.start<u.end&&(!tokens.length||(tokenStarts.has(u.start)&&tokenEnds.has(u.end)))).sort((a,b)=>(b.end-b.start)-(a.end-a.start)||Number(run.scope.targets.find(t=>t.id===b.itemId)?.kind==='vocabulary')-Number(run.scope.targets.find(t=>t.id===a.itemId)?.kind==='vocabulary')||a.start-b.start);
 for(const u of annotations)if(!words.some(w=>overlap(w,u))){const inside=tokens.filter(t=>t.start>=u.start&&t.end<=u.end);words.push({...u,surface:text.slice(u.start,u.end),readingSource:'annotation',entries:[],ambiguous:false,content:true,form:conjugationLabel(inside)});}
 const looked=new Map();
 async function lookup(form){if(!looked.has(form)){try{looked.set(form,await local.lookup(form));}catch{dictionary.status='unavailable';looked.set(form,[]);}}return looked.get(form);}
 for(let i=0;i<tokens.length;i++){
  const first=tokens[i];if(words.some(w=>overlap(w,first))||(first.pos==='記号'&&!han(first.surface_form)))continue;
  let last=i,entries=[],lemma=first.basic_form==='*'?null:first.basic_form;
  const inflectedRoot=['動詞','形容詞'].includes(first.pos)&&lemma&&lemma!==first.surface_form;
  // Longest dictionary compound on real tokenizer boundaries, never kanji readings.
  for(let j=i;j<Math.min(tokens.length,i+8);j++){
   const t=tokens[j];if(t.pos==='記号'||t.pos==='助詞'||t.pos==='助動詞'||(j>i&&t.start!==tokens[j-1].end)||t.end-first.start>40||words.some(w=>overlap(w,{start:first.start,end:t.end})))break;
   const surface=text.slice(first.start,t.end);if(!han(surface)||(j===i&&inflectedRoot))continue;
   const found=await lookup(surface);if(found.length){last=j;entries=found;lemma=surface;}
  }
  if(!entries.length)entries=lemma?await lookup(lemma):[];
  // Keep conjugated surface with attached auxiliaries (including て + non-independent verb).
  const suru=first.pos==='名詞'&&first.pos_detail_1==='サ変接続'&&tokens[i+1]?.basic_form==='する'&&tokens[i+1].start===first.end&&!words.some(w=>overlap(w,tokens[i+1]));
  if(last===i&&suru)last++;
  if((last===i&&['動詞','形容詞'].includes(first.pos))||suru){
   while(last+1<tokens.length&&last-i<7){
    const next=tokens[last+1],after=tokens[last+2];
    const attached=next.pos==='助動詞'||(next.pos==='動詞'&&['非自立','接尾'].includes(next.pos_detail_1))||(next.pos==='助詞'&&['て','で'].includes(next.surface_form)&&after&&(after.pos==='助動詞'||after.pos_detail_1==='非自立'));
    if(!attached||next.start!==tokens[last].end||next.end-first.start>40||words.some(w=>overlap(w,next)))break;last++;
   }
  }
  const end=tokens[last].end,surface=text.slice(first.start,end);
  const readings=[...new Set(entries.flatMap(e=>e.readings).map(hiragana))];
  const spanTokens=tokens.slice(i,last+1),analyzed=spanTokens.every(t=>t.reading&&t.reading!=='*')?hiragana(spanTokens.map(t=>t.reading).join('')):null;
  const inflected=lemma&&lemma!==surface;
  const reading=analyzed||readings[0]||null;
  const readingSource=analyzed?(inflected||!readings.includes(analyzed)?'analyzer':'dictionary'):readings.length?'dictionary':'unavailable';
  words.push({start:first.start,end,surface,lemma,reading,readingSource,content:content(first),form:conjugationLabel(spanTokens),ambiguous:readings.length>1||entries.length>1,entries:entries.slice(0,8).map(e=>({...e,senses:e.senses.slice(0,8)})),truncated:!!entries.truncated||entries.length>8||entries.some(e=>e.senses.length>8)});i=last;
 }
 // If tokenization failed, expose unsegmented text for editable external lookup.
 if(!tokens.length)for(const m of text.matchAll(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー々]+/gu)){const span={start:m.index,end:m.index+m[0].length};if(han(m[0])&&!words.some(w=>overlap(w,span)))words.push({...span,surface:m[0],reading:null,readingSource:'unavailable',entries:[],ambiguous:false,content:true,form:null});}
 words.sort((a,b)=>a.start-b.start);
 // Satori-style expression entries: a JMdict phrase spanning 2–5 consecutive words (悲鳴を上げた → 悲鳴を上げる).
 // It must start and end on a content word, hold kanji, and the analyzer reading of its leading words must
 // match the entry reading, so 今日は never becomes こんにちは. Longest match per start wins.
 const expressions=[];
 for(let a=0;a<words.length;a++){
  if(!words[a].content)continue;
  for(let b=Math.min(words.length-1,a+4);b>a;b--){
   const span=words.slice(a,b+1),last=span[span.length-1];
   if(!last.content||span.some((w,k)=>k&&w.start!==span[k-1].end)||span.slice(0,-1).some(w=>!w.reading))continue;
   const surface=text.slice(span[0].start,last.end);if(!han(surface))continue;
   const prefix=text.slice(span[0].start,last.start),lead=hiragana(span.slice(0,-1).map(w=>w.reading).join(''));
   const forms=[...new Set([surface,last.lemma&&last.lemma!==last.surface?prefix+last.lemma:null].filter(Boolean))];
   let found=null;
   for(const form of forms){const entries=(await lookup(form)).filter(e=>e.readings.some(r=>hiragana(r).startsWith(lead)));if(entries.length){found={start:span[0].start,end:last.end,form,entries:entries.slice(0,2).map(e=>({...e,senses:e.senses.slice(0,3)}))};break;}}
   if(found){expressions.push(found);break;}
  }
 }
 for(const w of words){const inside=expressions.filter(x=>x.start<=w.start&&w.end<=x.end);if(inside.length)w.expressions=inside;}
 // Annotate-call output applies only to the passage revision it was made for.
 const annotation=run.report?.annotation;
 if(!annotation||annotation.failure||annotation.revision!==run.revision)return {text,revision:run.revision,words,dictionary};
 for(const g of annotation.glosses){const w=words.find(w=>w.start===g.start&&!w.itemId&&!w.gloss);if(w)w.gloss={lemma:g.lemma,reading:g.reading,sense:g.sense,pos:g.pos,source:g.source};}
 return {text,revision:run.revision,words,dictionary,grammarNotes:annotation.grammarNotes,sentenceNotes:annotation.sentenceNotes};
}
