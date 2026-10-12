import {createHash} from 'node:crypto';

function stable(value){
 if(Array.isArray(value))return value.map(stable);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
 return value;
}
const hash=value=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');

// Human-verified source text is independent of the deferred scored-answer fields.
export function verifiedOption(question){
 const p=question?.payloadJson;
 if(question?.kind!=='question'||question.origin!=='book'||p?.questionReview?.sourceAnswerTextVerified!==true)return null;
 const text=p.answer_specification?.source_answer_text;
 if(typeof text!=='string'||!Array.isArray(p.options))return null;
 let label=text.trim();
 if(p.format==='sentence_ordering'){
  // This retained source syntax explicitly gives the star answer and full order.
  const match=/^([1-4])\s*\(([1-4]{4})\)$/.exec(label);
  const slots=typeof p.prompt==='string'?p.prompt.match(/[_＿]+|★/g)||[]:[];
  if(!match||slots.length!==4||slots.filter(s=>s==='★').length!==1||new Set(match[2]).size!==4||p.options.length!==4||new Set(p.options.map(o=>o.label)).size!==4||![...match[2]].every(n=>p.options.some(o=>o.label===n))||match[2][slots.indexOf('★')]!==match[1])return null;
  label=match[1];
 }
 const matches=p.options.filter(o=>o.label===label);
 return matches.length===1?matches[0].label:null;
}

export function answerBinding(question){
 const p=question.payloadJson;
 return hash({questionId:question.id,questionRevision:question.revision,prompt:p.prompt,format:p.format,options:p.options,answer:p.answer_specification,questionReview:p.questionReview});
}

export function reasonFor(question,children){
 const label=verifiedOption(question);if(!label)return null;
 const reasons=children.filter(c=>c.parentContentId===question.id&&c.kind==='explanation'&&c.origin==='generated'&&['draft','approved'].includes(c.status)&&!c.successor&&c.payloadJson?.explanationType==='lesson_answer_reason');
 // A competing current reason is uncertainty, never an arbitrary winner.
 if(reasons.length!==1)return null;
 const p=reasons[0].payloadJson;
 if(p.questionId!==question.id||p.questionRevision!==question.revision||p.answerBinding!==answerBinding(question)||p.correctOption!==label||typeof p.answer_reason!=='string'||!p.answer_reason.trim())return null;
 return {answer_reason:p.answer_reason,origin:'generated',status:reasons[0].status};
}

export function answerReasonData(question,draft){
 const correctOption=verifiedOption(question);
 if(!correctOption||typeof draft?.answer_reason!=='string'||!draft.answer_reason.trim()||draft.answer_reason.length>6000)throw new Error('Verified unambiguous answer and bounded draft required');
 return {kind:'explanation',origin:'generated',status:'draft',revision:1,parentContentId:question.id,payloadJson:{explanationType:'lesson_answer_reason',questionId:question.id,questionRevision:question.revision,answerBinding:answerBinding(question),correctOption,answer_reason:draft.answer_reason.trim(),generationProvenance:draft.generationProvenance||{method:'bounded engineering draft'},addedBy:'AI',publicationStatus:'unreviewed_generated_draft'}};
}

export async function storeAnswerReason(db,question,draft){
 const data=answerReasonData(question,draft);
 return db.$transaction(async tx=>{
  const current=await tx.content.findUnique({where:{id:question.id},include:{successor:true}});
  if(!current||current.successor||answerBinding(current)!==data.payloadJson.answerBinding)throw new Error('Question changed before reason storage');
  const entry=await tx.sourceEntry.findFirst({where:{contentId:question.id,successor:null},select:{importBatchId:true,sourceRecordKey:true,promotionReviewHash:true}});
  if(!entry?.importBatchId||!entry.promotionReviewHash)throw new Error('Human approval binding missing');
  const approval=await tx.promotionApproval.findUnique({where:{importBatchId_recordKey_reviewHash:{importBatchId:entry.importBatchId,recordKey:entry.sourceRecordKey,reviewHash:entry.promotionReviewHash}}});
  if(approval?.reviewJson?.decision?.questionReview?.sourceAnswerTextVerified!==true||hash(approval.reviewJson.raw.answer_specification)!==hash(current.payloadJson.answer_specification))throw new Error('Exact human answer decision missing');
  const existing=await tx.content.findMany({where:{parentContentId:question.id,kind:'explanation',successor:null,payloadJson:{path:['explanationType'],equals:'lesson_answer_reason'}},take:3});
  if(existing.length===1&&hash(existing[0].payloadJson)===hash(data.payloadJson)&&existing[0].origin==='generated'&&existing[0].status==='draft')return {inserted:false,id:existing[0].id};
  if(existing.length)throw new Error('Competing reason requires explicit resolution');
  const result=await tx.content.create({data,select:{id:true}});return {inserted:true,id:result.id};
 },{isolationLevel:'Serializable'});
}
