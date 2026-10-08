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
export const providerDraftJsonSchema={...draftJsonSchema,properties:{...draftJsonSchema.properties,
 uses:array(object({...anchor,itemId:string,reading:string,sense:string})),
 support:array(object({...anchor,classification:{type:'string',enum:['untracked_support','punctuation','configured_support']},explanation:string})),
 issues:array(object({...anchor,code:{type:'string',enum:['learner_reported_unknown','ambiguous_sense','suspicious_reading','unresolved_grammar','unreadable_analysis']},reason:string})),
 sentences:array(object({...anchor,translation:string})),
 questions:array(object({prompt:string,targetIds:array(string),options:array(object({label:string,text:string})),answer:string,explanation:string,evidence:object(anchor)})),
}};
export function normalizeProviderDraft(value){
 const anchored=z.object({quote:z.string().min(1).max(2000),occurrence:z.number().int().min(0).max(240)});
 const japanese=z.string().min(1).max(2000).parse(value.japanese);
 function resolve(entry){
  const {quote,occurrence}=anchored.parse(entry);let start=-1,cursor=0;
  for(let n=0;n<=occurrence;n++){start=japanese.indexOf(quote,cursor);if(start<0)throw new Error('Quoted annotation was not found in the final Japanese text');cursor=start+quote.length;}
  const {quote:ignoredQuote,occurrence:ignoredOccurrence,...fields}=entry;void ignoredQuote;void ignoredOccurrence;
  return {...fields,start,end:start+quote.length};
 }
 if(value.kind==='passage'&&([...new Intl.Segmenter('ja',{granularity:'sentence'}).segment(japanese)].filter(s=>s.segment.trim()).length>15||japanese.split(/\r?\n/).filter(s=>s.trim()).length>15))throw new Error('A passage must fit within fifteen sentence lines');
 return parseDraft({...value,uses:value.uses.map(resolve),support:value.support.map(resolve),issues:value.issues.map(resolve),sentences:value.sentences.map(resolve),questions:value.questions.map(q=>({...q,evidence:resolve(q.evidence)}))});
}
