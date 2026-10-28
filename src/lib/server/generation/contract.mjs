import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { z } from 'zod';
const id=z.string().uuid(),text=z.string().trim().min(1).max(4000);
const span={start:z.number().int().nonnegative(),end:z.number().int().positive()};
const ids=z.array(id).min(1).max(120).refine(a=>new Set(a).size===a.length);
const question=z.object({prompt:text,targetIds:ids,options:z.array(z.object({label:z.string().min(1).max(10),text}).strict()).min(2).max(6),answer:z.string().min(1).max(10),explanation:text,evidence:z.object(span).strict()}).strict().superRefine((q,c)=>{
 if(new Set(q.options.map(o=>o.label)).size!==q.options.length||new Set(q.options.map(o=>o.text)).size!==q.options.length||!q.options.some(o=>o.label===q.answer))c.addIssue({code:'custom',message:'Unique choices and a valid answer label required'});
});
export const draftSchema=z.object({
 version:z.literal(1),kind:z.enum(['sentence','passage']),title:text,japanese:z.string().min(1).max(2000),translation:text,
 uses:z.array(z.object({...span,itemId:id,reading:text,sense:text}).strict()).max(240),
 omissions:z.array(z.object({itemId:id,reason:text}).strict()).max(120),
 support:z.array(z.object({...span,classification:z.enum(['untracked_support','punctuation','configured_support']),explanation:z.string().max(1000)}).strict()).max(200),
 issues:z.array(z.object({...span,code:z.enum(['learner_reported_unknown','ambiguous_sense','suspicious_reading','unresolved_grammar','unreadable_analysis']),reason:text}).strict()).max(60),
 questions:z.array(question).max(2),
 sentences:z.array(z.object({...span,translation:text}).strict()).max(15).optional(),
}).strict().superRefine((p,c)=>{
 const boundary=n=>n>=0&&n<=p.japanese.length&&!(n>0&&n<p.japanese.length&&/[\uD800-\uDBFF]/.test(p.japanese[n-1])&&/[\uDC00-\uDFFF]/.test(p.japanese[n]));
 for(const s of [...p.uses,...p.support,...p.issues,...p.questions.map(q=>q.evidence),...(p.sentences||[])])if(s.start>=s.end||!boundary(s.start)||!boundary(s.end))c.addIssue({code:'custom',message:'Invalid half-open UTF-16 span'});
 if(p.sentences?.some((s,i)=>i>0&&s.start<p.sentences[i-1].end))c.addIssue({code:'custom',message:'Sentence translations overlap'});
 if(p.questions.length!==(p.kind==='passage'?2:0))c.addIssue({code:'custom',message:'A passage needs two comprehension questions; a sentence has none'});
 if(new Set(p.omissions.map(o=>o.itemId)).size!==p.omissions.length)c.addIssue({code:'custom',message:'Duplicate omission'});
});
export const parseDraft=value=>draftSchema.parse(value);
// Waller N5–N3 kanji (amendment A7): a generation/furigana scope, not a certified JLPT level or familiarity claim.
export const N5_N3_KANJI=Object.values(JSON.parse(readFileSync(join(process.cwd(),'src','lib','server','generation','kanji-n5-n3.json'),'utf8')).levels).join('');
// The single source of truth for the study-scope kanji rule: supplied target/support kanji plus N5–N3 kanji.
export function allowedKanji(scope){
 const forms=[...scope.targets,...scope.support].flatMap(t=>[t.writtenForm,...(t.variants||[])]).filter(v=>typeof v==='string');
 return [...new Set([...(forms.join('').match(/\p{Script=Han}/gu)||[]),...N5_N3_KANJI])];
}
// A conservative study-scope check, not a JLPT classifier or a familiarity claim.
export function unprovidedKanji(draft,scope){
 const allowed=new Set(allowedKanji(scope));
 const text=[draft.japanese,draft.title,...draft.questions.flatMap(q=>[q.prompt,...q.options.map(o=>o.text),q.explanation])].join('');
 return [...new Set(text.match(/\p{Script=Han}/gu)||[])].filter(glyph=>!allowed.has(glyph));
}
export const reviewHash=(draft,scope)=>createHash('sha256').update(JSON.stringify({draft:parseDraft(draft),scope})).digest('hex');
export function validateScope(value,scope){
 const draft=parseDraft(value),allowed=new Set(scope.targets.map(t=>t.id)),problems=[];
 const add=(code,reason,extra={})=>problems.push({key:`problem-${problems.length}`,code,reason,...extra});
 for(const use of draft.uses)if(!allowed.has(use.itemId))add('target_scope_violation','Use is outside the supplied targets',{itemId:use.itemId,start:use.start,end:use.end});
 for(const o of draft.omissions)if(!allowed.has(o.itemId))add('target_scope_violation','Omission is outside supplied targets',{itemId:o.itemId});
 for(const t of scope.targets){const used=draft.uses.some(u=>u.itemId===t.id),omitted=draft.omissions.some(o=>o.itemId===t.id);if(used===omitted)add('missing_target_disposition','Each supplied target needs uses or one omission',{itemId:t.id});}
 for(const q of draft.questions)for(const itemId of q.targetIds)if(!allowed.has(itemId)||!draft.uses.some(u=>u.itemId===itemId))add('target_scope_violation','Question target is outside demonstrated passage targets',{itemId});
 for(const issue of draft.issues)add(issue.code,issue.reason,{start:issue.start,end:issue.end});
 // Supplied support/uses are proposals. Independent analysis and human review follow.
 return {validatorVersion:'scope-1',supportPolicyVersion:'support-1',problems,untracked:draft.support.filter(s=>s.classification==='untracked_support'),omissions:draft.omissions,languageStatus:'unverified',targetStatus:problems.some(p=>p.code==='target_scope_violation')?'violations':'targets checked'};
}

// Provider schema covers shape only; Zod and independent local checks remain authoritative.
const string={type:'string'},integer={type:'integer',minimum:0};
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const array=items=>({type:'array',items});
const range={start:integer,end:integer};
export const draftJsonSchema=object({version:{type:'integer',enum:[1]},kind:{type:'string',enum:['sentence','passage']},title:string,japanese:string,translation:string,
 uses:array(object({...range,itemId:string,reading:string,sense:string})),omissions:array(object({itemId:string,reason:string})),
 support:array(object({...range,classification:{type:'string',enum:['untracked_support','punctuation','configured_support']},explanation:string})),
 issues:array(object({...range,code:{type:'string',enum:['learner_reported_unknown','ambiguous_sense','suspicious_reading','unresolved_grammar','unreadable_analysis']},reason:string})),
 sentences:array(object({...range,translation:string})),questions:array(object({prompt:string,targetIds:array(string),options:array(object({label:string,text:string})),answer:string,explanation:string,evidence:object(range)}))});

// Models quote exact text; the server owns positional arithmetic and validates the result.
const anchor={quote:{type:'string',minLength:1},occurrence:integer};
const nonEmpty={type:'string',minLength:1};
// The provider schema mirrors only cheap Zod minimums; large maxItems/maxLength bounds
// exceed Google's guided-decoding state limit and are rejected as INVALID_ARGUMENT.
export const providerDraftJsonSchema={...draftJsonSchema,properties:{...draftJsonSchema.properties,
 title:nonEmpty,japanese:nonEmpty,translation:nonEmpty,
 uses:array(object({...anchor,itemId:nonEmpty,reading:nonEmpty,sense:nonEmpty})),
 omissions:array(object({itemId:nonEmpty,reason:nonEmpty})),
 support:array(object({...anchor,classification:{type:'string',enum:['untracked_support','punctuation','configured_support']},explanation:string})),
 issues:array(object({...anchor,code:{type:'string',enum:['learner_reported_unknown','ambiguous_sense','suspicious_reading','unresolved_grammar','unreadable_analysis']},reason:nonEmpty})),
 sentences:{type:'array',minItems:1,items:object({...anchor,translation:nonEmpty})},
 questions:{type:'array',minItems:2,items:object({prompt:nonEmpty,targetIds:{type:'array',items:string,minItems:1},options:{type:'array',items:object({label:nonEmpty,text:nonEmpty}),minItems:2},answer:nonEmpty,explanation:nonEmpty,evidence:object(anchor)})},
}};
// Large target pools make bookkeeping slips likely. Repair annotations only, never text:
// drop uses that fail local checks or name unknown IDs, disclose every unused target as omitted and untag questions.
export function reconcileDispositions(draft,scope,invalidUses=[]){
 const ids=new Set(scope.targets.map(t=>t.id)),bad=new Set(invalidUses.map(u=>`${u.itemId}:${u.start}:${u.end}`));
 const uses=draft.uses.filter(u=>ids.has(u.itemId)&&!bad.has(`${u.itemId}:${u.start}:${u.end}`)),used=new Set(uses.map(u=>u.itemId)),kept=new Set();
 const omissions=draft.omissions.filter(o=>ids.has(o.itemId)&&!used.has(o.itemId)&&!kept.has(o.itemId)&&kept.add(o.itemId));
 const added=scope.targets.filter(t=>!used.has(t.id)&&!kept.has(t.id)).map(t=>({itemId:t.id,reason:'Not demonstrated in the passage; recorded as omitted'}));
 // A question keeps only demonstrated target tags; one left with none is retagged with the demonstrated
 // targets nearest its evidence span (overlapping ones first), and still fails validation if nothing is demonstrated.
 const gap=(u,e)=>Math.max(0,u.start-e.end,e.start-u.end);
 let untagged=0;const questions=draft.questions.map(q=>{let kept=q.targetIds.filter(id=>used.has(id));if(kept.length===q.targetIds.length)return q;if(!kept.length&&uses.length){const near=Math.min(...uses.map(u=>gap(u,q.evidence)));kept=[...new Set(uses.filter(u=>gap(u,q.evidence)===near).map(u=>u.itemId))];}if(!kept.length)return q;untagged+=q.targetIds.length;return {...q,targetIds:kept};});
 return {draft:{...draft,uses,omissions:[...omissions,...added],questions},repaired:draft.uses.length-uses.length+draft.omissions.length-omissions.length+added.length+untagged};
}
export function normalizeProviderDraft(value,onMissingUse){
 const anchored=z.object({quote:z.string().min(1).max(2000),occurrence:z.number().int().min(0).max(240)});
 const japanese=z.string().min(1).max(2000).parse(value.japanese);
 function resolve(entry){
  const {quote,occurrence}=anchored.parse(entry);let start=-1,cursor=0;
  for(let n=0;n<=occurrence;n++){start=japanese.indexOf(quote,cursor);if(start<0)throw new Error(`Quoted annotation was not found in the final Japanese text: ${JSON.stringify(quote.slice(0,40))}. Add that exact text to japanese, or remove this annotation and record an omission for its target`);cursor=start+quote.length;}
  const {quote:ignoredQuote,occurrence:ignoredOccurrence,...fields}=entry;void ignoredQuote;void ignoredOccurrence;
  return {...fields,start,end:start+quote.length};
 }
 function use(entry){
  try{return resolve(entry);}catch(error){if(onMissingUse&&/Quoted annotation was not found/.test(error.message)){onMissingUse(entry.itemId);return null;}throw error;}
 }
 if(value.kind==='passage'){const count=[...new Intl.Segmenter('ja',{granularity:'sentence'}).segment(japanese)].filter(s=>s.segment.trim()).length;if(count<10||count>15)throw new Error(`A passage must contain 10–15 sentences; this one has ${count}`);}
 return parseDraft({...value,uses:value.uses.map(use).filter(Boolean),support:value.support.map(resolve),issues:value.issues.map(resolve),sentences:value.sentences.map(resolve),questions:value.questions.map(q=>({...q,evidence:resolve(q.evidence)}))});
}
