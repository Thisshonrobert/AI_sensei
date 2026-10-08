import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
const id=z.string().uuid(),text=z.string().trim().min(1).max(10000),ids=z.array(id).max(60).refine(a=>new Set(a).size===a.length);
export const questionSchema=z.object({
 id,domain:z.enum(['vocabulary','kanji','grammar','reading']),
 objective:z.enum(['vocab_reading_meaning','kanji_meaning','kanji_reading_context','grammar_cloze','grammar_formation','comprehension']),
 primaryTargetItemId:id,targetIds:ids.refine(a=>a.length>0),supportingItemIds:ids,exposesItemIds:ids,
 prompt:text,format:z.enum(['multiple_choice','fill_in_blank','short_answer']),
 options:z.array(z.object({label:z.string().min(1).max(20),text}).strict()).max(8),
 supportingReviewed:z.literal(true),unresolved:z.literal(false),passageId:id.optional(),
 rubric:z.object({mode:z.enum(['choice','reading','self']),expectedAnswer:text,explanation:text,acceptableAnswers:z.array(text).max(30)}).strict(),
}).strict().superRefine((q,ctx)=>{
 const fail=message=>ctx.addIssue({code:'custom',message});
 if(!q.targetIds.includes(q.primaryTargetItemId))fail('Primary target must be a linked target');
 if(q.domain==='reading'&&!q.passageId||q.domain!=='reading'&&q.passageId)fail('Reading requires a passage; other domains have none');
 if(q.domain==='vocabulary'&&q.objective!=='vocab_reading_meaning'||q.domain==='kanji'&&!q.objective.startsWith('kanji_')||q.domain==='grammar'&&!q.objective.startsWith('grammar_')||q.domain==='reading'&&q.objective!=='comprehension')fail('Objective/domain mismatch');
 if(q.rubric.mode!=='self'&&!q.rubric.acceptableAnswers.length)fail('Rule grading requires accepted answers');
 if(q.rubric.mode==='choice'&&(q.format!=='multiple_choice'||q.options.length<2||new Set(q.options.map(o=>o.label)).size!==q.options.length||q.rubric.acceptableAnswers.some(a=>!q.options.some(o=>o.label===a))))fail('Choice rubric must reference unique option labels');
 if(q.rubric.mode==='reading'&&q.objective!=='kanji_reading_context')fail('Reading-only grading cannot score a combined vocabulary objective');
 if(q.objective==='vocab_reading_meaning'&&q.rubric.mode!=='self')fail('Combined vocabulary requires both-component self scoring');
});
const passageSchema=z.object({id,title:text,japanese:text,targetIds:ids,supportingItemIds:ids,exposesItemIds:ids,supportingReviewed:z.literal(true),unresolved:z.literal(false)}).strict();
const schema=z.object({version:z.literal(1),passages:z.array(passageSchema).max(20),questions:z.array(questionSchema).min(1).max(500)}).strict();
export function parseBank(value){
 const bank=schema.parse(value),all=[...bank.passages,...bank.questions];
 if(new Set(all.map(x=>x.id)).size!==all.length)throw new Error('Duplicate content identity');
 for(const q of bank.questions)if(q.passageId&&!bank.passages.some(p=>p.id===q.passageId))throw new Error('Passage missing from bank');
 for(const p of bank.passages)if(bank.questions.filter(q=>q.passageId===p.id).length<2)throw new Error('Passage requires two reviewed questions');
 return bank;
}
export const bankHash=value=>createHash('sha256').update(JSON.stringify(parseBank(value))).digest('hex');
export async function publishBank(db,value,{confirmation,reviewer}){
 const bank=parseBank(value),hash=bankHash(bank);
 if(confirmation!==hash||typeof reviewer!=='string'||!reviewer.trim()||reviewer.length>100)throw new Error('Exact bank hash and human reviewer required');
 return db.$transaction(async tx=>{
  const records=[...bank.passages,...bank.questions];
  const linked=[...new Set(records.flatMap(r=>[...r.targetIds,...r.supportingItemIds,...r.exposesItemIds]))];
  const items=await tx.item.findMany({where:{id:{in:linked},status:'approved'},select:{id:true,kind:true},take:2000});
  if(items.length!==linked.length)throw new Error('Every linked item must be approved');
  for(const q of bank.questions)if(q.domain!=='reading'&&items.find(i=>i.id===q.primaryTargetItemId)?.kind!==q.domain)throw new Error('Primary target/domain mismatch');
  let inserted=0;
  for(const r of records){
   const kind=bank.passages.includes(r)?'passage':'question';
   const payload={assessment:r,assessmentSchemaVersion:1,answerVerified:kind==='question',targetsVerified:true,review:{hash,reviewer},...(kind==='question'?{prompt:r.prompt,format:r.format,options:r.options,answer_specification:{acceptable_answers:r.rubric.acceptableAnswers}}:{japanese:r.japanese,title:r.title})};
   const existing=await tx.content.findUnique({where:{id:r.id},select:{kind:true,origin:true,status:true,payloadJson:true}});
   if(existing){if(existing.kind!==kind||existing.origin!=='user'||existing.status!=='approved'||!isDeepStrictEqual(existing.payloadJson,payload))throw new Error('Changed existing content requires a separate reviewed revision');continue;}
   await tx.content.create({data:{id:r.id,kind,origin:'user',status:'approved',revision:1,parentContentId:r.passageId||null,payloadJson:payload}});
   for(const [role,list] of [['target',r.targetIds],['support',r.supportingItemIds]])for(const itemId of list)await tx.contentItem.create({data:{contentId:r.id,itemId,role}});
   inserted++;
  }
  return {inserted,hash};
 },{timeout:30000});
}
