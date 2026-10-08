import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { comparisonSchema } from './study.mjs';

const uuid=z.string().uuid();
const text=z.string().min(1).max(100000);
const list=z.array(z.string().max(100000)).max(1000).nullable();
const vocab=z.object({writtenForm:text,reading:text,partOfSpeech:text,senseKey:text,meaningEn:text,acceptedGlossesJson:list,alternativeFormsJson:list,usageJson:z.record(z.unknown())}).strict();
const kanji=z.object({glyph:text,meaningsJson:list,onReadingsJson:list,kunReadingsJson:list,notes:z.string().nullable()}).strict();
const grammar=z.object({pattern:text,patternVariantsJson:list,explanationJa:z.string().nullable(),explanationEn:z.string().nullable(),nuance:z.string().nullable(),formationRulesJson:z.array(z.record(z.unknown())),usageJson:z.record(z.unknown())}).strict();
const contentSchemas={
 sentence:z.object({japanese:z.string().nullable(),reading:z.string().nullable(),translation:z.string().nullable(),meanings:list,sourceWord:z.boolean(),sourcePayload:z.record(z.unknown())}).strict(),
 passage:z.object({japanese:text,translation:z.string().nullable().optional()}).passthrough(),
 question:z.object({prompt:text,format:z.enum(['multiple_choice','fill_in_blank','sentence_ordering','short_answer','other']),options:z.array(z.object({label:text,text:text}).passthrough()).max(100),answer_specification:z.record(z.unknown()).nullable().optional(),answerVerified:z.boolean(),targetsVerified:z.boolean()}).passthrough(),
};
const citation=z.object({sourceId:uuid,sourceTitle:text.optional(),sourceUrl:z.string().url().regex(/^https?:\/\//).optional(),sourceRecordKey:text,originalPayloadJson:z.record(z.unknown()),fieldPresence:z.record(z.enum(['supplied','not_supplied','unknown'])),printedPage:z.string().nullable(),pdfPageIndex:z.number().int().nonnegative().nullable()}).strict();
const addition=z.object({key:text,origin:z.enum(['generated','user']),payload:z.record(z.unknown()),unresolved:z.boolean(),citations:z.array(citation).max(100)}).strict();
const record=z.object({
 recordKey:text,family:z.enum(['entry','question','passage']),printedPage:z.string().nullable(),pdfPageIndex:z.number().int().nonnegative().nullable(),
 identityVerified:z.literal(true),sourceVerified:z.literal(true),
 match:z.object({mode:z.enum(['create','reuse','correct']),canonicalKey:text.optional(),itemId:uuid.optional(),expectedRevision:z.number().int().positive().optional()}).strict().optional(),
 typed:z.record(z.unknown()).optional(),fieldPresence:z.record(z.enum(['supplied','not_supplied','unknown'])).default({}),
 fieldOrigins:z.record(z.string()).default({}),citations:z.array(citation).max(100).default([]),
 kanjiLinks:z.array(z.object({kanjiItemId:uuid,occurrencesJson:z.array(z.record(z.unknown()))}).strict()).max(100).default([]),
 targets:z.array(z.object({itemId:uuid.optional(),recordKey:text.optional()}).strict()).max(100).default([]),
 answerVerified:z.boolean().default(false),targetsVerified:z.boolean().default(false),
 reviewBasis:z.enum(['source_compared','user_accepted_without_pdf_comparison']).optional(),
 questionReview:z.object({sourceAnswerTextVerified:z.boolean(),grammarConnections:z.literal('intentionally_deferred'),usage:z.literal('reference_only')}).strict().optional(),
 additions:z.array(addition).max(100).optional(),
}).strict();
const selectionSchema=z.object({batchId:uuid,records:z.array(record).min(1).max(1000)}).strict();
export function validateSelection(input) {
 const parsed=selectionSchema.safeParse(input);
 if(!parsed.success) throw new Error('Selection validation failed: '+parsed.error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; '));
 const s=parsed.data;
 if(new Set(s.records.map(r=>r.recordKey)).size!==s.records.length) throw new Error('Duplicate selection record keys');
 for(const r of s.records)if(r.questionReview){
  if(r.family!=='question')throw new Error('Question review decision requires a question record');
  if(r.targetsVerified||r.targets.length)throw new Error('Intentionally deferred grammar connections cannot be verified targets');
 }
 return s;
}
function sorted(value) {
 if(Array.isArray(value))return value.map(sorted);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,sorted(value[k])]));
 return value;
}
export function hashJson(value){return createHash('sha256').update(JSON.stringify(sorted(value))).digest('hex');}
export function normalizeKanji(glyph) {
 // NFC maps some compatibility glyphs; keep their code points and all IVS identities.
 if(!/^\p{Script=Han}[\uFE00-\uFE0F\u{E0100}-\u{E01EF}]?$/u.test(glyph))throw new Error('Expected one kanji glyph, optionally with a variation selector');
 return /[\uF900-\uFAFF\u{2F800}-\u{2FA1F}]/u.test(glyph)?glyph:glyph.normalize('NFC');
}
export function approvalToken(batchId,key,hash){return `approve:${batchId}:${key}:${hash}`;}
function rawRecord(batch,r) {
 const rows=r.family==='entry'?batch.stagedJson.entries:r.family==='question'?batch.stagedJson.lesson_questions:batch.stagedJson.exercise_passages;
 const found=(rows||[]).filter(x=>x.source_record_key===r.recordKey);
 if(found.length!==1)throw new Error('Record key missing or ambiguous in staged payload');
 return found[0];
}
async function loadItem(tx,id) {
 const item=await tx.item.findUnique({where:{id},include:{vocabulary:true,kanji:true,grammar:true}});
 if(!item||item.status!=='approved')throw new Error('Canonical match/dependency must be an approved item');
 const typed={...item[item.kind]}; delete typed.itemId;
 return {item:{id:item.id,kind:item.kind,canonicalKey:item.canonicalKey,revision:item.revision},typed};
}
function typedData(kind,data) {
 const result=({vocabulary:vocab,kanji,grammar}[kind]).safeParse(data);
 if(!result.success)throw new Error('Typed payload validation failed');
 if(kind==='kanji')result.data.glyph=normalizeKanji(result.data.glyph);
 return result.data;
}
async function reviewRecord(tx,batch,r,selection,seen=new Set()) {
 if(seen.has(r.recordKey))throw new Error('Cyclic selected dependencies');
 seen=new Set(seen); seen.add(r.recordKey);
 const raw=rawRecord(batch,r);
 const source=await tx.source.findUnique({where:{id:batch.sourceId}});
 const context={source:batch.stagedJson.source,lesson:batch.stagedJson.batch||null,pageRange:batch.pageRangeJson,schemaVersion:batch.schemaVersion,extractorVersion:batch.extractorVersion};
 if(source?.sourceType!=='book'||(!source.edition&&r.reviewBasis!=='user_accepted_without_pdf_comparison'))throw new Error('Confirmed book edition required before approval');
 const checkOrigin=value=>{
  if(!value||typeof value!=='object')return;
  if(value.origin&&value.origin!=='book')throw new Error('Book importer rejects generated/user origin; retain as separate assistance');
  for(const v of Object.values(value))checkOrigin(v);
 };
 checkOrigin(raw);
 const receipt=await tx.sourceEntry.findFirst({where:{importBatchId:batch.id,sourceRecordKey:r.recordKey}});
 if(receipt){
  const approval=await tx.promotionApproval.findUnique({where:{importBatchId_recordKey_reviewHash:{importBatchId:batch.id,recordKey:r.recordKey,reviewHash:receipt.promotionReviewHash||''}}});
  if(!approval||hashJson(approval.reviewJson.decision)!==hashJson(r)||hashJson(approval.reviewJson.raw)!==hashJson(raw)||hashJson(approval.reviewJson.source)!==hashJson(source)||hashJson(approval.reviewJson.context)!==hashJson(context))throw new Error('Changed promoted payload/decision requires a new draft batch');
  return approval.reviewJson;
 }
 let typed=null,matchSnapshot=null,resolvedMode=r.match?.mode;
 if(r.family==='entry') {
  if(!r.match)throw new Error('Record-specific canonical match decision required');
  typed=typedData(batch.stagedJson.content_type,r.typed);
  if(r.match.mode==='create') {
   if(!r.match.canonicalKey||r.match.itemId)throw new Error('Explicit new canonical identity required');
   if(batch.stagedJson.content_type==='kanji'&&r.match.canonicalKey!==typed.glyph)throw new Error('Kanji canonical key must equal retained glyph');
   if(batch.stagedJson.content_type==='kanji'){
    const exact=await tx.kanji.findUnique({where:{glyph:typed.glyph}});
    if(exact){
     matchSnapshot=await loadItem(tx,exact.itemId);
     if(hashJson(typed)!==hashJson(matchSnapshot.typed))throw new Error('Exact approved kanji identity exists; review canonical fields and choose reuse or an explicit correction');
     resolvedMode='reuse';
    }
   }
  }else {
   if(!r.match.itemId||!r.match.expectedRevision)throw new Error('Explicit canonical ID/revision required');
   matchSnapshot=await loadItem(tx,r.match.itemId);
   if(matchSnapshot.item.kind!==batch.stagedJson.content_type)throw new Error('Wrong canonical item kind');
   if(matchSnapshot.item.revision!==r.match.expectedRevision)throw new Error('Stale canonical revision');
   if(r.match.mode==='reuse'&&hashJson(typed)!==hashJson(matchSnapshot.typed))throw new Error('Reuse requires exact approved typed payload; propose a correction separately');
   if(batch.stagedJson.content_type==='kanji'&&typed.glyph!==matchSnapshot.typed.glyph)throw new Error('Cannot change kanji identity');
  }
 }
 const provenance={};
 for(const [field,ref] of Object.entries(r.fieldOrigins)) {
  if(!typed||!(field in typed))throw new Error('Unknown field provenance');
  if(ref==='book'||/^citation:\d+$/.test(ref))continue;
  const e=await tx.sourceEntry.findUnique({where:{id:ref}});
  if(!e||e.verificationStatus!=='verified'||e.itemId!==r.match?.itemId)throw new Error('Invalid provenance evidence for item');
  provenance[ref]=hashJson(e);
 }
 const citations=[];
 for(const c of [...r.citations,...(r.additions||[]).flatMap(a=>a.citations)]) {
  let s=await tx.source.findUnique({where:{id:c.sourceId}});
  if(!s&&c.sourceTitle&&c.sourceUrl)s={id:c.sourceId,title:c.sourceTitle,edition:null,sourceType:'dictionary',language:'ja',fileReference:c.sourceUrl,levelLabel:null,levelAuthority:null,notes:null};
  if(!s||s.sourceType!=='dictionary'||!s.fileReference||(c.sourceUrl&&c.sourceUrl!==s.fileReference)||(c.sourceTitle&&c.sourceTitle!==s.title))throw new Error('Enrichment requires separately cited dictionary source');
  citations.push({citation:c,source:s});
 }
 if(new Set((r.additions||[]).map(a=>a.key)).size!==(r.additions||[]).length)throw new Error('Duplicate supplementary key');
 for(const a of r.additions||[]){
  if(!a.unresolved&&a.payload.explanationType==='grammar_comparison'&&!comparisonSchema.safeParse(a.payload).success)throw new Error('Invalid grammar comparison payload');
  if(new Set(a.citations.map(c=>`${c.sourceId}:${c.sourceRecordKey}`)).size!==a.citations.length)throw new Error('Duplicate supplementary citation');
  if(a.origin==='user'&&!a.citations.length)throw new Error('Dictionary addition requires independent citation');
  if(a.payload.sourcePayloadHash&&a.payload.sourcePayloadHash!==hashJson(raw))throw new Error('Supplementary source payload mismatch');
  if(!a.unresolved&&Array.isArray(a.payload.uncertainty)&&a.payload.uncertainty.length)throw new Error('Uncertain addition must remain draft');
 }
 for(const ref of Object.values(r.fieldOrigins))if(ref.startsWith('citation:')&&!r.citations[Number(ref.split(':')[1])])throw new Error('Missing dictionary citation');
 if(typed){
  const sourceFields={glyph:'character',meaningsJson:'meanings',onReadingsJson:'on_readings',kunReadingsJson:'kun_readings',reading:'reading',meaningEn:'meanings'};
  for(const [field,sourceField] of Object.entries(sourceFields)){
   const supplied=raw[sourceField];const value=typed[field];
   const missing=supplied==null||supplied===''||(Array.isArray(supplied)&&!supplied.length)||r.fieldPresence[sourceField]==='not_supplied';
   const enriched=value!=null&&value!==''&&(!Array.isArray(value)||value.length>0);
   if(field in typed&&missing&&enriched&&(!r.fieldOrigins[field]||r.fieldOrigins[field]==='book'))throw new Error('Missing book field requires independent cited enrichment evidence');
  }
 }
 const dependencies=[];
 for(const addition of r.additions||[]){
  if(addition.unresolved||addition.payload.explanationType!=='grammar_comparison')continue;
  const comparison=comparisonSchema.parse(addition.payload),patterns=[],examples=[];
  if(selection.records.some(record=>record.family==='entry'&&record.match?.mode==='correct'&&comparison.grammarItemIds.includes(record.match.itemId)))throw new Error('Approve pattern corrections separately before reviewing a comparison');
  for(const id of comparison.grammarItemIds){
   const pattern=await loadItem(tx,id);
   if(pattern.item.kind!=='grammar')throw new Error('Comparison requires approved grammar patterns');
   patterns.push(pattern);
  }
  for(const ref of comparison.examples){
   const sentence=await tx.content.findFirst({where:{id:ref.contentId,kind:'sentence',status:'approved',successor:null},include:{items:{orderBy:{itemId:'asc'}}}});
   if(!sentence||!sentence.items.some(link=>link.itemId===ref.grammarItemId)||typeof sentence.payloadJson.japanese!=='string'||!sentence.payloadJson.japanese.trim())throw new Error('Comparison requires current approved linked examples');
   examples.push(JSON.parse(JSON.stringify(sentence)));
  }
  dependencies.push({comparisonKey:addition.key,patterns,examples});
 }
 for(const target of r.targets) {
  if(!!target.itemId===!!target.recordKey)throw new Error('Target requires exactly one itemId or selected recordKey');
  if(target.itemId) {
   const dep=await loadItem(tx,target.itemId);
   if(r.family==='question'&&dep.item.kind!=='grammar')throw new Error('Grammar question target must be grammar');
   dependencies.push(dep);
  }else {
   const dep=selection.records.find(x=>x.recordKey===target.recordKey&&x.family==='entry');
   if(!dep)throw new Error('Selected dependency missing');
   if(r.family==='question'&&batch.stagedJson.content_type!=='grammar')throw new Error('Wrong question target kind');
   dependencies.push(await reviewRecord(tx,batch,dep,selection,seen));
  }
 }
 for(const link of r.kanjiLinks){
  const exists=await tx.kanji.findUnique({where:{itemId:link.kanjiItemId}});
  if(!exists)throw new Error('Verified kanji dependency missing');
  if(batch.stagedJson.content_type!=='vocabulary'||![typed.writtenForm,...typed.alternativeFormsJson||[]].some(form=>form.includes(exists.glyph)))throw new Error('Kanji link is not present in vocabulary form');
  dependencies.push(await loadItem(tx,link.kanjiItemId));
 }
 if(r.family==='question')validateQuestion(raw,r);
 if(r.family==='passage'&&!raw.japanese)throw new Error('Passage text required');
 return {raw,decision:r,typed,source,context,provenance,citations,matchSnapshot,resolvedMode,dependencies};
}
function validateQuestion(raw,r) {
 if(raw.origin!=='book')throw new Error('Book importer rejects generated questions');
 if(!['multiple_choice','fill_in_blank','sentence_ordering','short_answer','other'].includes(raw.format)||!raw.prompt)throw new Error('Invalid question structure');
 const options=raw.options||[],labels=options.map(o=>o.label);
 if(new Set(labels).size!==labels.length||new Set(options.map(o=>o.text)).size!==options.length)throw new Error('Duplicate answer options');
 const answer=raw.answer_specification;
 if(answer) {
  if([...answer.correct_option_labels||[],...answer.ordered_option_labels||[]].some(l=>!labels.includes(l)))throw new Error('Answer option not present');
  if(answer.target_position!=null&&(answer.target_position<0||answer.target_position>=(answer.ordered_option_labels||[]).length))throw new Error('Invalid answer target position');
 }
 if(r.answerVerified&&(!answer||!((answer.correct_option_labels||[]).length||(answer.acceptable_answers||[]).length||(answer.ordered_option_labels||[]).length||answer.scoring_rubric)))throw new Error('Cannot verify absent answer specification');
 if(r.targetsVerified&&!r.targets.length)throw new Error('Cannot verify absent target grammar');
}
async function prepare(tx,input) {
 const selection=validateSelection(input);
 const batch=await tx.importBatch.findUnique({where:{id:selection.batchId}});
 if(!batch)throw new Error('Import batch not found');
 const records=[];
 for(const r of selection.records){
  const review=await reviewRecord(tx,batch,r,selection);
  const reviewHash=hashJson({version:'canonical-import-1',batchId:batch.id,fileHash:batch.fileHash,review});
  const previous=await tx.promotionApproval.findUnique({where:{importBatchId_recordKey_reviewHash:{importBatchId:batch.id,recordKey:r.recordKey,reviewHash}}});
  records.push({recordKey:r.recordKey,reviewHash,confirmationToken:approvalToken(batch.id,r.recordKey,reviewHash),approved:!!previous,review});
 }
 return {selection,batch,records};
}
export async function previewPromotion(db,input){
 return db.$transaction(async tx=>{
  const p=await prepare(tx,input);
  for(const r of p.records) {
   r.candidates=r.review.typed?await tx.item.findMany({where:r.review.source&&p.batch.stagedJson.content_type==='kanji'?{kind:'kanji',canonicalKey:r.review.typed.glyph}:p.batch.stagedJson.content_type==='vocabulary'?{kind:'vocabulary',vocabulary:{writtenForm:r.review.typed.writtenForm}}:{kind:'grammar',grammar:{pattern:r.review.typed?.pattern}},select:{id:true,canonicalKey:true,revision:true},take:20}):[];
  }
  return {batchId:p.batch.id,records:p.records};
 },{isolationLevel:'RepeatableRead',timeout:30000,maxWait:30000});
}

export async function previewBatch(db,batchId){
 return db.$transaction(async tx=>{
  const batch=await tx.importBatch.findUnique({where:{id:uuid.parse(batchId)},include:{source:true}});
  if(!batch)throw new Error('Batch not found');
  const staged=batch.stagedJson;
  const records=[];
  const all=[...(staged.entries||[]).map(raw=>({family:'entry',raw})),...(staged.exercise_passages||[]).map(raw=>({family:'passage',raw})),...(staged.lesson_questions||[]).map(raw=>({family:'question',raw}))];
  // One bounded read per spelling group avoids a network round trip per entry.
  const identities=[...new Set((staged.entries||[]).map(raw=>staged.content_type==='kanji'?normalizeKanji(raw.character):staged.content_type==='vocabulary'?raw.word:raw.pattern))];
  const candidateMap=new Map();
  for(let offset=0;offset<identities.length;offset+=50){
   const group=identities.slice(offset,offset+50),kind=staged.content_type;
   const where=kind==='kanji'?{kind,kanji:{glyph:{in:group}}}:kind==='vocabulary'?{kind,vocabulary:{writtenForm:{in:group}}}:{kind,grammar:{pattern:{in:group}}};
   const rows=await tx.item.findMany({where,take:1001,select:{id:true,kind:true,canonicalKey:true,revision:true,...(kind==='kanji'?{kanji:{select:{glyph:true}}}:kind==='vocabulary'?{vocabulary:{select:{writtenForm:true}}}:{grammar:{select:{pattern:true}}})}});
   if(rows.length>1000)throw new Error('Inventory candidate group exceeds its bounded limit');
   for(const row of rows){const identity=row.kanji?.glyph??row.vocabulary?.writtenForm??row.grammar?.pattern;const {id,kind,canonicalKey,revision}=row;const candidates=candidateMap.get(identity)||[];if(candidates.length<20)candidates.push({id,kind,canonicalKey,revision});candidateMap.set(identity,candidates);}
  }
  for(const {family,raw} of all){
   const kind=staged.content_type;
   const identity=family!=='entry'?null:kind==='kanji'?normalizeKanji(raw.character):kind==='vocabulary'?raw.word:raw.pattern;
   const candidates=family==='entry'?(candidateMap.get(identity)||[]):[];
   records.push({recordKey:raw.source_record_key,family,payloadHash:hashJson(raw),raw,sourcePdfPages:raw.source_pdf_pages,sourcePrintedPages:raw.source_printed_pages,candidates,issues:(batch.validationErrorsJson||[]).filter(i=>i.record_key===raw.source_record_key),promotionReady:false,requiredDecisions:['Human compare complete record and nested examples/words','Confirm edition and exact PDF/printed page mapping','Choose canonical identity or exact match',...(family==='question'?['Verify answer independently','Approve actual target grammar']:[])]});
  }
  return {batchId:batch.id,sourceId:batch.sourceId,fileHash:batch.fileHash,source:batch.source,status:batch.status,editionConfirmationHash:hashJson(batch.source),pageConvention:'source_pdf_pages are supplied one-based pages (unverified locator frame); SourceEntry.pdfPageIndex is zero-based within the confirmed PDF. Preserve supplied locator pages and confirm whether full book or selected excerpt before converting. Printed pages are independent strings; never use a constant offset.',records,ready:0,blocked:records.length};
 },{isolationLevel:'RepeatableRead',timeout:30000,maxWait:30000});
}

export async function confirmEdition(db,sourceId,edition,confirmation,reviewer){
 if(!edition?.trim()||!reviewer?.trim())throw new Error('Edition and human reviewer required');
 return db.$transaction(async tx=>{
  const source=await tx.source.findUnique({where:{id:uuid.parse(sourceId)}});
  if(!source||source.edition||await tx.sourceEntry.count({where:{sourceId}}))throw new Error('Edition can only be confirmed once on an unpromoted source; distinct editions require separate Source identity');
  if(confirmation!==`edition:${sourceId}:${hashJson(source)}:${edition}`)throw new Error('Explicit edition/hash confirmation required');
  return tx.source.update({where:{id:sourceId},data:{edition,notes:`${source.notes||''}\nEdition confirmed by ${reviewer} on ${new Date().toISOString()}.`},select:{id:true,edition:true}});
 },{isolationLevel:'Serializable',timeout:30000,maxWait:30000});
}
export async function recordApproval(db,input,key,confirmation,reviewer){
 if(!reviewer?.trim())throw new Error('Named human reviewer required');
 return db.$transaction(async tx=>{
  const p=await prepare(tx,input); const r=p.records.find(x=>x.recordKey===key);
  if(!r||confirmation!==r.confirmationToken)throw new Error('Explicit record/hash confirmation required; JSON status is not approval');
  return tx.promotionApproval.upsert({where:{importBatchId_recordKey_reviewHash:{importBatchId:p.batch.id,recordKey:key,reviewHash:r.reviewHash}},create:{importBatchId:p.batch.id,recordKey:key,reviewHash:r.reviewHash,reviewJson:r.review,reviewer},update:{},select:{id:true,reviewHash:true}});
 },{isolationLevel:'Serializable',timeout:30000,maxWait:30000});
}
async function evidence(tx,batch,key,target,raw,r,role=null,reviewHash=null){
 const prior=await tx.sourceEntry.findFirst({where:{sourceId:batch.sourceId,sourceRecordKey:key},orderBy:{revision:'desc'}});
 if(prior&&((prior.itemId&&prior.itemId!==target.itemId)||(prior.contentId&&target.contentId&&!(await tx.content.findUnique({where:{id:target.contentId}})).supersedesId)))throw new Error('Cannot remap an established source record identity');
 return tx.sourceEntry.create({data:{id:randomUUID(),sourceId:batch.sourceId,...target,sourceRecordKey:key,revision:(prior?.revision||0)+1,supersedesId:prior?.id||null,printedPage:r.printedPage,pdfPageIndex:r.pdfPageIndex,lessonKey:batch.stagedJson.batch?.lesson_key||null,lessonTitle:batch.stagedJson.batch?.lesson_title||null,orderInSource:null,curriculumRole:role,originalPayloadJson:raw,fieldPresenceJson:{...r.fieldPresence,...(r.reviewBasis?{reviewBasis:r.reviewBasis}:{})},verificationStatus:'verified',verifiedAt:new Date(),importBatchId:batch.id,promotionReviewHash:reviewHash}});
}
async function addContent(tx,batch,key,raw,r,kind,payload,links=[],approved=true,parentId=null,reviewHash=null){
 const valid=contentSchemas[kind].safeParse(payload);
 if(!valid.success)throw new Error('Content kind payload validation failed');
 if(kind==='sentence'&&!payload.japanese)approved=false;
 const prior=await tx.sourceEntry.findFirst({where:{sourceId:batch.sourceId,sourceRecordKey:key},orderBy:{revision:'desc'},include:{content:true}});
 const c=await tx.content.create({data:{kind,origin:'book',payloadJson:payload,status:approved?'approved':'draft',revision:(prior?.content?.revision||0)+1,supersedesId:prior?.contentId||null,parentContentId:parentId}});
 await evidence(tx,batch,key,{contentId:c.id},raw,r,null,reviewHash);
 for(const itemId of links)await tx.contentItem.create({data:{contentId:c.id,itemId,role:'target'}});
 return c.id;
}
export async function promote(db,input){
 return db.$transaction(async tx=>{
  const selection=validateSelection(input);
  // One local import at a time; lock also makes duplicate clicks/retries no-ops.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(6132026)`;
  const p=await prepare(tx,selection);
  for(const r of p.records)if(!r.approved)throw new Error('Record-specific human approval missing or invalidated by changed payload/decision');
  let promoted=0;
  const resolved=new Map();
  for(const reviewed of p.records.filter(x=>x.review.decision.family==='entry')) {
   const {decision:r,raw,typed}=reviewed.review;
   const receipt=await tx.sourceEntry.findFirst({where:{importBatchId:p.batch.id,sourceRecordKey:r.recordKey}});
   if(receipt){
    const approval=await tx.promotionApproval.findFirst({where:{importBatchId:p.batch.id,recordKey:r.recordKey,reviewHash:reviewed.reviewHash}});
    if(!approval||hashJson(receipt.originalPayloadJson)!==hashJson(raw))throw new Error('Changed promoted payload requires a new draft batch');
    resolved.set(r.recordKey,receipt.itemId);continue;
   }
   const kind=p.batch.stagedJson.content_type;
   const mode=reviewed.review.resolvedMode;
   const existing=reviewed.review.matchSnapshot?await loadItem(tx,reviewed.review.matchSnapshot.item.id):null;
   const itemId=existing?.item.id||randomUUID();
   const revision=mode==='correct'?existing.item.revision+1:(existing?.item.revision||1);
   const entry=await (async()=>{
    if(!existing)await tx.item.create({data:{id:itemId,kind,canonicalKey:r.match.canonicalKey,status:'approved',revision,fieldOriginsJson:{}}});
    return evidence(tx,p.batch,r.recordKey,{itemId},raw,r,kind==='kanji'?'core_kanji':null,reviewed.reviewHash);
   })();
   const citations=[];
   for(const [index,c] of r.citations.entries()){
    const source=reviewed.review.citations[index].source;
    await tx.source.upsert({where:{id:c.sourceId},create:source,update:{}});
    const prior=await tx.sourceEntry.findFirst({where:{sourceId:c.sourceId,sourceRecordKey:c.sourceRecordKey},orderBy:{revision:'desc'}});
    citations.push(await tx.sourceEntry.create({data:{sourceId:c.sourceId,itemId,sourceRecordKey:c.sourceRecordKey,revision:(prior?.revision||0)+1,supersedesId:prior?.id||null,printedPage:c.printedPage,pdfPageIndex:c.pdfPageIndex,originalPayloadJson:c.originalPayloadJson,fieldPresenceJson:c.fieldPresence,verificationStatus:'verified',verifiedAt:new Date()}}));
   }
   if(mode!=='reuse') {
    const origins=Object.fromEntries(Object.keys(typed).map(field=>{
     const ref=r.fieldOrigins[field]||'book';
     return [field,ref==='book'?entry.id:ref.startsWith('citation:')?citations[Number(ref.split(':')[1])].id:ref];
    }));
    await tx[kind].upsert({where:{itemId},create:{itemId,...typed},update:typed});
    await tx.itemRevision.create({data:{itemId,revision,typedJson:typed,fieldOriginsJson:origins}});
    await tx.item.update({where:{id:itemId},data:{revision,fieldOriginsJson:origins}});
   }
   for(const link of r.kanjiLinks)await tx.vocabularyKanji.upsert({where:{vocabularyItemId_kanjiItemId:{vocabularyItemId:itemId,kanjiItemId:link.kanjiItemId}},create:{vocabularyItemId:itemId,...link},update:{}});
   for(const [i,x] of [...raw.examples||[],...raw.example_words||[]].entries()) {
    // Keep complete source payload even if text/readings/meanings were not supplied.
    const locator=hashJson(x.source_pdf_pages||[])===hashJson(raw.source_pdf_pages||[])?r:{...r,printedPage:null,pdfPageIndex:null};
    await addContent(tx,p.batch,`${r.recordKey}/example/${i+1}`,x,locator,'sentence',{japanese:x.japanese??x.word??null,reading:x.reading??null,translation:x.translation??null,meanings:x.meanings??null,sourceWord:!!x.word,sourcePayload:x},[itemId],true,null,reviewed.reviewHash);
   }
   resolved.set(r.recordKey,itemId);promoted++;
  }
  for(const reviewed of p.records.filter(x=>x.review.decision.family!=='entry')){
   const {decision:r,raw}=reviewed.review;
   if(await tx.sourceEntry.findFirst({where:{importBatchId:p.batch.id,sourceRecordKey:r.recordKey}}))continue;
   const targets=r.targets.map(t=>t.itemId||resolved.get(t.recordKey));
   if(targets.some(x=>!x))throw new Error('Verified target dependency unresolved');
   let parentId=null;
   if(raw.parent_passage_key){
    const parent=await tx.sourceEntry.findFirst({where:{sourceId:p.batch.sourceId,sourceRecordKey:raw.parent_passage_key},orderBy:{revision:'desc'}});
    if(!parent?.contentId||(await tx.content.findUnique({where:{id:parent.contentId}})).kind!=='passage')throw new Error('Parent passage must be promoted first or selected before question');
    parentId=parent.contentId;
   }
   await addContent(tx,p.batch,r.recordKey,raw,r,r.family==='question'?'question':'passage',{...raw,answerVerified:r.answerVerified,targetsVerified:r.targetsVerified,...(r.questionReview?{questionReview:r.questionReview}:{})},targets,r.family!=='question'||(r.answerVerified&&r.targetsVerified),parentId,reviewed.reviewHash);
   promoted++;
  }
  // Supplementary content never replaces book payloads or answer specifications.
  for(const reviewed of p.records){
   const r=reviewed.review.decision;
   const receipt=await tx.sourceEntry.findFirst({where:{importBatchId:p.batch.id,sourceRecordKey:r.recordKey}});
   for(const a of r.additions||[]){
    const key=`${r.recordKey}/addition/${a.key}`;
    if(await tx.sourceEntry.findFirst({where:{importBatchId:p.batch.id,sourceRecordKey:key}}))continue;
    const previous=await tx.sourceEntry.findFirst({where:{sourceId:p.batch.sourceId,sourceRecordKey:key},orderBy:{revision:'desc'},include:{content:true}});
    const comparisonDependency=reviewed.review.dependencies.find(d=>d.comparisonKey===a.key);
    const comparisonRevision=comparisonDependency?{grammarItemRevisions:Object.fromEntries(comparisonDependency.patterns.map(p=>[p.item.id,p.item.revision]))}:{};
    const content=await tx.content.create({data:{kind:'explanation',origin:a.origin,status:a.unresolved?'draft':'approved',revision:(previous?.content?.revision||0)+1,supersedesId:previous?.contentId||null,parentContentId:receipt.contentId,payloadJson:{...a.payload,...comparisonRevision,additionKey:a.key,reviewBasis:r.reviewBasis||'source_compared',sourceRecordKey:r.recordKey}}});
    await evidence(tx,p.batch,key,{contentId:content.id},a,r,null,reviewed.reviewHash);
    let itemIds=receipt.itemId?[receipt.itemId]:r.targets.map(t=>t.itemId||resolved.get(t.recordKey));
    if(!a.unresolved&&a.payload.explanationType==='grammar_comparison'){
     const comparison=comparisonSchema.parse(a.payload);
     if(!itemIds.some(id=>comparison.grammarItemIds.includes(id)))throw new Error('Comparison must include the reviewed grammar target');
     itemIds=comparison.grammarItemIds;
    }
    for(const itemId of new Set(itemIds))await tx.contentItem.create({data:{contentId:content.id,itemId,role:'support'}});
    for(const c of a.citations){
     const source=reviewed.review.citations.find(x=>hashJson(x.citation)===hashJson(c)).source;
     await tx.source.upsert({where:{id:c.sourceId},create:source,update:{}});
     // Each content revision cites its own snapshot, including after citation gaps.
     const citationKey=`${p.batch.sourceId}/${key}/${c.sourceRecordKey}/content-revision/${content.revision}`;
     await tx.sourceEntry.create({data:{sourceId:c.sourceId,contentId:content.id,sourceRecordKey:citationKey,revision:1,printedPage:c.printedPage,pdfPageIndex:c.pdfPageIndex,originalPayloadJson:c.originalPayloadJson,fieldPresenceJson:c.fieldPresence,verificationStatus:'verified',verifiedAt:new Date()}});
    }
   }
  }
  const keys=[...(p.batch.stagedJson.entries||[]),...(p.batch.stagedJson.lesson_questions||[]),...(p.batch.stagedJson.exercise_passages||[])].map(x=>x.source_record_key);
  const count=await tx.sourceEntry.count({where:{importBatchId:p.batch.id,sourceRecordKey:{in:keys}}});
  const approvedCount=await tx.sourceEntry.count({where:{importBatchId:p.batch.id,sourceRecordKey:{in:keys},OR:[{item:{status:'approved'}},{content:{status:'approved'}}]}});
  const status=approvedCount===keys.length?'promoted':'partial';
  if(p.batch.status!==status||(status==='promoted'&&!p.batch.committedAt))await tx.importBatch.update({where:{id:p.batch.id},data:{status,committedAt:status==='promoted'?(p.batch.committedAt||new Date()):null}});
  return {batchId:p.batch.id,promoted,totalPersisted:count,approvedRecords:approvedCount,totalRecords:keys.length};
 },{isolationLevel:'Serializable',timeout:60000,maxWait:30000});
}
