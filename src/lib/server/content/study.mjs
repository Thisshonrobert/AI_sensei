import { z } from 'zod';
const uuid=z.string().uuid();
export const comparisonSchema=z.object({explanationType:z.literal('grammar_comparison'),grammarItemIds:z.array(uuid).length(2),difference:z.string().trim().min(1).max(4000),examples:z.array(z.object({grammarItemId:uuid,contentId:uuid})).length(2)}).passthrough().refine(p=>new Set(p.grammarItemIds).size===2&&new Set(p.examples.map(e=>e.grammarItemId)).size===2&&p.examples.every(e=>p.grammarItemIds.includes(e.grammarItemId)));
const sources={where:{verificationStatus:'verified'},take:12,select:{id:true,sourceId:true,printedPage:true,source:{select:{title:true,sourceType:true}}}};
const contentSelect={id:true,origin:true,kind:true,status:true,payloadJson:true,sourceEntries:sources};
const text=v=>typeof v==='string'?v:'';
const words=v=>Array.isArray(v)?v.filter(x=>typeof x==='string'):[];
function example(c){const p=c.payloadJson;return {id:c.id,japanese:text(p.japanese),reading:text(p.reading),translation:text(p.translation),origin:c.origin,sources:c.sourceEntries};}
export async function grammarComparisons(db,itemId){
 const candidates=await db.content.findMany({where:{kind:'explanation',status:'approved',successor:null,items:{some:{itemId}},payloadJson:{path:['explanationType'],equals:'grammar_comparison'}},take:10,orderBy:{id:'asc'},select:{...contentSelect,items:{select:{itemId:true}}}});
 const results=[];
 for(const c of candidates){
  const parsed=comparisonSchema.safeParse(c.payloadJson);if(!parsed.success)continue;const p=parsed.data;
  if(!p.grammarItemIds.includes(itemId)||!p.grammarItemIds.every(id=>c.items.some(l=>l.itemId===id)))continue;
  const patterns=await db.item.findMany({where:{id:{in:p.grammarItemIds},kind:'grammar',status:'approved'},take:2,select:{id:true,revision:true,grammar:{select:{pattern:true}}}});
  if(p.grammarItemRevisions&&patterns.some(pattern=>p.grammarItemRevisions[pattern.id]!==pattern.revision))continue;
  const sentences=await db.content.findMany({where:{id:{in:p.examples.map(e=>e.contentId)},kind:'sentence',status:'approved',successor:null},take:2,select:{...contentSelect,items:{select:{itemId:true}}}});
  if(patterns.length!==2||sentences.length!==2||p.examples.some(e=>!sentences.some(s=>s.id===e.contentId&&s.items.some(l=>l.itemId===e.grammarItemId)&&text(s.payloadJson.japanese))))continue;
  results.push({id:c.id,difference:p.difference,origin:c.origin,sources:c.sourceEntries,patterns:p.grammarItemIds.map(id=>({itemId:id,pattern:patterns.find(x=>x.id===id).grammar.pattern,example:example(sentences.find(s=>s.id===p.examples.find(e=>e.grammarItemId===id).contentId))}))});
 }
 return results;
}
export async function studyContent(db,card){
 const item=await db.item.findFirst({where:{id:card.itemId,status:'approved'},select:{kind:true,revision:true,vocabulary:{select:{usageJson:true}},kanji:{select:{onReadingsJson:true,kunReadingsJson:true}},grammar:{select:{formationRulesJson:true,explanationEn:true,explanationJa:true}},contentLinks:{where:{content:{status:'approved',successor:null,kind:{in:['sentence','explanation']}}},take:20,orderBy:{contentId:'asc'},select:{content:{select:contentSelect}}},sourceEntries:sources}});
 if(!item)return null;
 const pinned=Number.isInteger(card.promptSpecJson.itemRevision)?await db.itemRevision.findUnique({where:{itemId_revision:{itemId:card.itemId,revision:card.promptSpecJson.itemRevision}},select:{typedJson:true,fieldOriginsJson:true}}):null;
 const typed=pinned?.typedJson||{};
 const examples=item.contentLinks.filter(l=>l.content.kind==='sentence'&&text(l.content.payloadJson.japanese)).slice(0,6).map(l=>example(l.content));
 const result={examples,sources:item.sourceEntries};
 if(item.kanji)result.readings={on:words(typed.onReadingsJson),kun:words(typed.kunReadingsJson)};
 if(item.grammar){
  const question=card.contentId?await db.content.findFirst({where:{id:card.contentId,status:'approved',kind:'question'},select:contentSelect}):null;
  const authored=question?await db.content.findFirst({where:{parentContentId:question.id,kind:'explanation',status:'approved',successor:null},orderBy:{id:'asc'},select:contentSelect}):null;
  const rationale=text(question?.payloadJson.rationale)||text(authored?.payloadJson.rationale);
  const formation=Array.isArray(typed.formationRulesJson)?typed.formationRulesJson.map(r=>text(r.sourceWording)||text(r.label)).filter(Boolean):[];
  const field=typed.explanationEn?'explanationEn':'explanationJa';
  const originId=pinned?.fieldOriginsJson?.[field];
  const evidence=typeof originId==='string'?await db.sourceEntry.findUnique({where:{id:originId},select:{id:true,sourceId:true,printedPage:true,source:{select:{title:true,sourceType:true}},content:{select:{origin:true}}}}):null;
  const direct=text(question?.payloadJson.rationale);
  result.grammar={formation,guidance:rationale||text(typed.explanationEn)||text(typed.explanationJa),guidanceLabel:rationale?'Why this fits':'General guidance',guidanceOrigin:rationale?(direct?question.origin:authored.origin):(evidence?.content?.origin||evidence?.source.sourceType||'Source'),sources:rationale?(direct?question.sourceEntries:authored.sourceEntries):(evidence?[evidence]:item.sourceEntries),comparisons:await grammarComparisons(db,card.itemId)};
 }
 return result;
}
