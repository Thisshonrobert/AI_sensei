import kuromoji from 'kuromoji';
import { join } from 'node:path';
let ready;
function tokenizer(){return ready??=new Promise((resolve,reject)=>kuromoji.builder({dicPath:join(process.cwd(),'node_modules','kuromoji','dict')}).build((error,result)=>{if(error){ready=undefined;reject(error);}else resolve(result);}));}
export async function readingTokens(text){
 const engine=await tokenizer();let cursor=0;
 return engine.tokenize(text).map(token=>{const start=text.indexOf(token.surface_form,cursor);if(start<cursor)throw new Error('Unreconciled tokenizer span');cursor=start+token.surface_form.length;return {...token,start,end:cursor};});
}
const kana=s=>s.normalize('NFC').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60)).replace(/\s/g,'');
const forms=item=>[item.writtenForm,...(item.variants||[]).filter(v=>typeof v==='string')].filter(Boolean);
// Versioned elementary support preference, not a claim about contextual correctness.
const elementaryParticles=new Set(['は','が','を','に','へ','で','の','も']);
export async function analyzeDraft(draft,scope={targets:[],support:[]}){
 let engine;try{engine=await tokenizer();}catch{return {analyzerStatus:'unavailable',analyzerVersion:'kuromoji-0.1.2',tokens:[],matches:[],problems:[{key:'analysis-0',code:'unreadable_analysis',reason:'Local dictionary unavailable'}],kanjiAudit:[],analysisNote:'Japanese analysis unavailable; retain draft and retry later.'};}
 const registered=[...scope.targets,...scope.support],lexical=registered.filter(i=>i.kind==='vocabulary'),grammar=registered.filter(i=>i.kind==='grammar');
 const matches=[],problems=[];const problem=(code,reason,extra={})=>problems.push({key:`analysis-${problems.length}`,code,reason,...extra});
 // Approved compounds/phrases take precedence over IPADIC's split tokens.
 const phrases=lexical.flatMap(i=>forms(i).map(form=>({item:i,form}))).sort((a,b)=>b.form.length-a.form.length);
 for(let at=0;at<draft.japanese.length;at++){
  const candidates=phrases.filter(p=>draft.japanese.startsWith(p.form,at));if(!candidates.length)continue;
  const longest=candidates[0].form,same=candidates.filter(p=>p.form===longest);
  if(new Set(same.map(p=>p.item.id)).size>1)problem('ambiguous_sense','Multiple registered senses match this written form',{start:at,end:at+longest.length});
  matches.push({start:at,end:at+longest.length,itemIds:same.map(p=>p.item.id),code:same[0].form===same[0].item.writtenForm?'approved_phrase':'approved_variant'});at+=longest.length-1;
 }
 let cursor=0;
 const tokens=engine.tokenize(draft.japanese).map(t=>{
  const start=draft.japanese.indexOf(t.surface_form,cursor),end=start+t.surface_form.length;
  if(start<cursor){problem('unreadable_analysis','Tokenizer offsets could not be reconciled');return null;}cursor=end;
  const covered=matches.find(m=>m.start<=start&&m.end>=end),candidates=lexical.filter(i=>forms(i).includes(t.basic_form));
  let code=covered?.code||'untracked_support';
  if(!covered&&candidates.length){code=t.basic_form===t.surface_form?'known_lexeme':'unresolved';if(code==='unresolved'){
   const construction=grammar.some(g=>forms(g).some(f=>draft.japanese.slice(start,start+25).includes(f.replace(/^[〜～~]/,''))));
   if(construction)code='known_inflection';else problem('unresolved_grammar','Lemma matches, but the inflected construction needs contextual review',{start,end});
  }}
  if(!covered&&candidates.length>1)problem('ambiguous_sense','Lemma has more than one registered sense',{start,end});
  if(t.pos==='記号')code='punctuation';
  if(t.pos==='助詞'&&elementaryParticles.has(t.surface_form)&&['格助詞','係助詞','連体化'].includes(t.pos_detail_1))code='configured_support';
  return {surface:t.surface_form,lemma:t.basic_form==='*'?null:t.basic_form,reading:t.reading||null,pos:t.pos,start,end,code,itemIds:covered?.itemIds||candidates.map(i=>i.id)};
 }).filter(Boolean);
 for(const use of draft.uses){
  const target=scope.targets.find(i=>i.id===use.itemId);if(!target)continue;
  const surface=draft.japanese.slice(use.start,use.end),spanTokens=tokens.filter(t=>t.start>=use.start&&t.end<=use.end);
  if(target.kind==='vocabulary'&&!forms(target).includes(surface)&&!spanTokens.some(t=>forms(target).includes(t.lemma)))problem('target_scope_violation','Declared span does not match target form, approved variant or candidate lemma',{itemId:target.id,start:use.start,end:use.end});
  const contextualReading=spanTokens.length&&spanTokens.every(t=>t.reading)?spanTokens.map(t=>t.reading).join(''):null;
  if(contextualReading&&kana(contextualReading)!==kana(use.reading))problem('suspicious_reading','Proposed whole-word reading differs from local dictionary analysis',{itemId:target.id,start:use.start,end:use.end});
  if(target.kind==='grammar')problem('unresolved_grammar','Grammar use and meaning require contextual review; substring matches cannot verify grammar',{itemId:target.id,start:use.start,end:use.end});
  const singleWord=spanTokens.length===1&&spanTokens[0].start===use.start&&spanTokens[0].end===use.end&&spanTokens[0].lemma&&['名詞','動詞','形容詞','副詞'].includes(spanTokens[0].pos);
  if(target.kind==='kanji'&&(!surface.includes(target.writtenForm)||(surface===target.writtenForm&&!singleWord)))problem('target_scope_violation','Kanji target must span a whole contextual word, including a single-kanji dictionary word when applicable',{itemId:target.id,start:use.start,end:use.end});
 }
 const kanjiAudit=[...new Set(draft.japanese.match(/\p{Script=Han}/gu)||[])].map(glyph=>({glyph,registered:registered.some(i=>i.kind==='kanji'&&i.writtenForm===glyph),learned:false}));
 return {analyzerStatus:'ready',analyzerVersion:'kuromoji-0.1.2/IPADIC',supportPolicyVersion:'elementary-particles-1',tokens,matches,problems,kanjiAudit,analysisNote:'Local dictionary analysis checks candidate forms and readings; elementary particle support is a versioned preference. Contextual meaning, grammar and naturalness still require review.'};
}
