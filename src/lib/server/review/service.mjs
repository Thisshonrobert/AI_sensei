import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { configuration, initialState, schedule, effectiveRating, studyDay, nextStudyDay } from './scheduler.mjs';
import { studyContent } from '../content/study.mjs';

export const LOCAL_USER_ID='00000000-0000-4000-8000-000000000001';
const limits={vocabulary:5,kanji:2,grammar:1,total:8};
const uuid=z.string().uuid();
export const normalizeReading=value=>value.normalize('NFKC').replace(/\s+/gu,'').replace(/[ァ-ヶ]/gu,char=>String.fromCodePoint(char.codePointAt(0)-0x60));
const responseSchema=z.object({sessionId:uuid,cardId:uuid,stateVersion:z.number().int().nonnegative(),clientEventId:uuid,answer:z.object({reading:z.string().max(500).optional(),meaning:z.string().max(2000).optional(),response:z.string().max(2000).optional()}).strict()}).strict();
const ratingSchema=responseSchema.extend({rating:z.number().int().min(1).max(4),components:z.record(z.boolean())});
export class ReviewError extends Error { constructor(message,status=409){super(message);this.status=status;} }
export async function createUser(db,id=LOCAL_USER_ID,timezone='Asia/Calcutta') {
 uuid.parse(id);studyDay(new Date(),timezone);
 return db.user.upsert({where:{id},create:{id,timezone,settingsJson:{scheduler:configuration(),timeBudgetMinutes:30,reviewBudgetMinutes:20,reviewCardBudget:40,newCardLimits:limits}},update:{}});
}
async function locked(db,userId,work) {
 return db.$transaction(async tx=>{
  // ponytail: one user-row lock serializes this personal app; per-card locks if multi-user throughput ever matters.
  await tx.$queryRaw`SELECT id FROM users WHERE id=${userId}::uuid FOR UPDATE`;
  const user=await tx.user.findUnique({where:{id:userId}});
  if(!user)throw new ReviewError('User ownership unavailable',403);
  return work(tx,user);
 },{timeout:30000,maxWait:30000});
}
const strings=value=>Array.isArray(value)?value.filter(x=>typeof x==='string'&&x.trim()):[];
const evidenceWhere={verificationStatus:'verified',successor:null};
const wordKey=(writing,reading)=>createHash('sha256').update(JSON.stringify([writing.normalize('NFC'),reading.normalize('NFC')])).digest('hex');
async function addCard(tx,user,item,objective,prompt,answer,now,extra={}) {
 const prior=await tx.card.findFirst({where:{userId:user.id,itemId:item.id,objective,status:{not:'retired'}}});
 if(prior)return 0;
 const evidence=await tx.sourceEntry.findMany({where:{id:{in:prompt.sourceEntryIds},verificationStatus:'verified'},select:{id:true,sourceId:true},take:20});
 await tx.card.create({data:{userId:user.id,itemId:item.id,objective,promptSpecJson:{...prompt,sources:evidence,itemRevision:item.revision,templateVersion:1},answerSpecJson:answer,fsrsStateJson:initialState(now),...extra}});
 return 1;
}
async function contextReference(tx,content) {
 const p=content.payloadJson;
 const existing=await tx.vocabulary.findFirst({where:{writtenForm:p.japanese,reading:p.reading,item:{status:'approved',sourceEntries:{some:evidenceWhere}}},orderBy:{itemId:'asc'}});
 if(existing)return existing;
 const evidence=content.sourceEntries[0], id=randomUUID(),entryId=randomUUID();
 const glosses=strings(p.meanings);
 // A literal approved source-word reference has no inferred part of speech or new learner familiarity.
 const typed={writtenForm:p.japanese,reading:p.reading,partOfSpeech:'not supplied',senseKey:`source-context:${content.id}`,meaningEn:glosses[0]||'Meaning not supplied by source',acceptedGlossesJson:glosses,alternativeFormsJson:[],usageJson:{referenceOnly:true}};
 const origins=Object.fromEntries(Object.keys(typed).map(k=>[k,entryId]));
 await tx.item.create({data:{id,kind:'vocabulary',canonicalKey:`source-context:${content.id}`,status:'approved',revision:1,fieldOriginsJson:origins}});
 await tx.vocabulary.create({data:{itemId:id,...typed}});
 await tx.sourceEntry.create({data:{id:entryId,sourceId:evidence.sourceId,itemId:id,sourceRecordKey:`${evidence.sourceRecordKey}/context-reference`,revision:1,printedPage:evidence.printedPage,pdfPageIndex:evidence.pdfPageIndex,curriculumRole:'context_reference',originalPayloadJson:evidence.originalPayloadJson,fieldPresenceJson:{word:'supplied',reading:'supplied',meanings:glosses.length?'supplied':'not_supplied',partOfSpeech:'not_supplied',derivedFromContentId:content.id},verificationStatus:'verified',verifiedAt:evidence.verifiedAt,promotionReviewHash:evidence.promotionReviewHash}});
 await tx.itemRevision.create({data:{itemId:id,revision:1,typedJson:typed,fieldOriginsJson:origins}});
 return {itemId:id,...typed};
}

export async function syncCards(db,userId,now=new Date()) {
 return locked(db,userId,async(tx,user)=>{
  let created=0;const gaps=[];
  // Explicit bounded pool. Larger intake is phase 6; never fetch the entire library into memory.
  const items=await tx.item.findMany({where:{status:'approved',sourceEntries:{some:evidenceWhere}},take:500,orderBy:{id:'asc'},include:{vocabulary:true,kanji:true,grammar:true,sourceEntries:{where:evidenceWhere,take:12,select:{id:true,curriculumRole:true}},contentLinks:{where:{content:{status:'approved',successor:null}},take:20,include:{content:{include:{sourceEntries:{where:evidenceWhere,take:4}}}}}}});
  const existingCards=await tx.card.findMany({where:{userId,status:{not:'retired'},itemId:{in:items.map(item=>item.id)}},select:{itemId:true,objective:true},take:1500});
  const existing=new Set(existingCards.map(card=>`${card.itemId}:${card.objective}`));
  const ensureCard=async(item,objective,prompt,answer,extra={})=>{
   const key=`${item.id}:${objective}`;if(existing.has(key))return 0;
   const added=await addCard(tx,user,item,objective,prompt,answer,now,extra);
   if(added)existing.add(key);return added;
  };
  for(const item of items) {
   const sources=item.sourceEntries.map(e=>e.id);
   if(item.vocabulary&&!item.sourceEntries.every(e=>e.curriculumRole==='context_reference')) {
    const v=item.vocabulary;
    if(!v.reading.trim()||!v.meaningEn.trim()){gaps.push({itemId:item.id,reason:'vocabulary reading or selected meaning missing'});continue;}
    created+=await ensureCard(item,'vocab_reading_meaning',{text:v.writtenForm,cue:'Recall the reading and selected meaning.',sourceEntryIds:sources},{reading:v.reading,meaning:v.meaningEn,acceptedGlosses:strings(v.acceptedGlossesJson)},{siblingKey:wordKey(v.writtenForm,v.reading)});
   }
   if(item.kanji&&item.sourceEntries.some(e=>e.curriculumRole==='core_kanji')) {
    let meanings=strings(item.kanji.meaningsJson);let meaningSources=sources;
    if(!meanings.length) {
     const dictionary=item.contentLinks.find(l=>l.content.kind==='explanation'&&l.content.origin==='user'&&l.content.sourceEntries.length&&strings(l.content.payloadJson.selectedMeanings).length&&!l.content.payloadJson.addedBy&&!l.content.payloadJson.acceptedLimitations);
     if(dictionary){meanings=strings(dictionary.content.payloadJson.selectedMeanings);meaningSources=dictionary.content.sourceEntries.map(e=>e.id);}
    }
    if(meanings.length)created+=await ensureCard(item,'kanji_meaning',{text:item.kanji.glyph,cue:'Recall the selected core meaning.',sourceEntryIds:meaningSources},{meaning:meanings.join('; '),acceptedGlosses:meanings});
    else gaps.push({itemId:item.id,reason:'core meaning evidence missing'});
    if(!existing.has(`${item.id}:kanji_reading_context`)) {
     const words=item.contentLinks.filter(l=>l.content.kind==='sentence'&&l.content.origin==='book'&&l.content.payloadJson.sourceWord===true&&l.content.sourceEntries.length&&typeof l.content.payloadJson.japanese==='string'&&typeof l.content.payloadJson.reading==='string'&&l.content.payloadJson.reading.trim()&&l.content.payloadJson.japanese.includes(item.kanji.glyph));
     let context=null;
     for(const link of words) {
      const p=link.content.payloadJson;
      const vocabulary=await contextReference(tx,link.content);
      if(vocabulary){context={link,p,vocabulary};break;}
     }
     if(context) {
      const {link,p,vocabulary}=context;
      await tx.vocabularyKanji.upsert({where:{vocabularyItemId_kanjiItemId:{vocabularyItemId:vocabulary.itemId,kanjiItemId:item.id}},create:{vocabularyItemId:vocabulary.itemId,kanjiItemId:item.id,occurrencesJson:{sourceContentId:link.content.id}},update:{}});
      created+=await ensureCard(item,'kanji_reading_context',{text:p.japanese,highlight:item.kanji.glyph,cue:'Recall the whole word’s reading.',sourceEntryIds:link.content.sourceEntries.map(e=>e.id)}, {reading:p.reading},{contentId:link.content.id,contextVocabularyItemId:vocabulary.itemId,siblingKey:wordKey(p.japanese,p.reading)});
     } else gaps.push({itemId:item.id,reason:'context requires an approved source word, whole-word reading and matching vocabulary reference'});
    }
   }
   if(item.grammar) {
    const link=item.contentLinks.find(l=>l.role==='target'&&l.content.kind==='question'&&l.content.payloadJson.answerVerified===true&&l.content.payloadJson.targetsVerified===true&&l.content.payloadJson.format==='fill_in_blank'&&typeof l.content.payloadJson.prompt==='string'&&strings(l.content.payloadJson.answer_specification?.acceptable_answers).length&&l.content.sourceEntries.length);
    if(link){const answers=strings(link.content.payloadJson.answer_specification.acceptable_answers);created+=await ensureCard(item,'grammar_cloze',{text:link.content.payloadJson.prompt,cue:link.content.payloadJson.cue||'Complete the verified cloze.',sourceEntryIds:link.content.sourceEntries.map(e=>e.id)},{response:answers[0],alternatives:answers.slice(1)},{contentId:link.content.id});}
    else gaps.push({itemId:item.id,reason:'no approved contextual cloze with structured answers and target'});
   }
  }
  return {created,gaps,boundedPool:items.length,limit:500};
 });
}
const eligible=now=>({OR:[{buriedUntil:null},{buriedUntil:{lte:now}}],item:{status:'approved'}});
function siblingWhere(card) {
 const OR=[{itemId:card.itemId},{contextVocabularyItemId:card.itemId}];
 if(card.siblingKey)OR.push({siblingKey:card.siblingKey});
 if(card.contextVocabularyItemId)OR.push({itemId:card.contextVocabularyItemId},{contextVocabularyItemId:card.contextVocabularyItemId});
 return {userId:card.userId,id:{not:card.id},status:{in:['new','active']},OR};
}
async function bury(tx,card,user,now){await tx.card.updateMany({where:siblingWhere(card),data:{buriedUntil:nextStudyDay(now,user.timezone)}});}
const category=card=>card.objective.startsWith('vocab')?'vocabulary':card.objective.startsWith('kanji')?'kanji':'grammar';
function siblings(a,b){return a.itemId===b.itemId||(a.siblingKey&&a.siblingKey===b.siblingKey)||(a.contextVocabularyItemId&&a.contextVocabularyItemId===b.contextVocabularyItemId)||a.contextVocabularyItemId===b.itemId||b.contextVocabularyItemId===a.itemId;}
async function counts(tx,user,now) {
 const day=studyDay(now,user.timezone);
 const groups=await tx.card.groupBy({by:['objective'],where:{userId:user.id,introductionDay:day},_count:true});
 const used={vocabulary:0,kanji:0,grammar:0,total:0};
 for(const g of groups){used[category(g)]+=g._count;used.total+=g._count;}
 return used;
}
function effectiveLimits(user) {
 const settings=user.settingsJson.newCardLimits||limits;
 return Object.fromEntries(Object.entries(limits).map(([key,max])=>[key,Math.max(0,Math.min(max,Number.isInteger(settings[key])?settings[key]:max))]));
}
const elapsed=(session,now)=>Math.min(2147483647,(session.elapsedActiveMs||0)+(session.status==='active'&&session.activeSince?Math.max(0,now-session.activeSince):0));
async function dueSelection(tx,user,now) {
 const budget=Math.max(1,Math.min(100,user.settingsJson.reviewCardBudget||40));
 const dueCount=await tx.card.count({where:{userId:user.id,status:'active',dueAt:{lte:now},item:{status:'approved'}}});
 const due=await tx.card.findMany({where:{userId:user.id,status:'active',dueAt:{lte:now},...eligible(now)},take:budget,orderBy:[{dueAt:'asc'},{id:'asc'}]});
 const chosen=[];
 for(const c of due)if(!chosen.some(s=>siblings(s,c)))chosen.push(c);
 return {budget,dueCount,due,chosen};
}
export async function startSession(db,userId,{now=new Date(),includeNew=false}={}) {
 return locked(db,userId,async(tx,user)=>{
  const prior=await tx.studySession.findFirst({where:{userId,status:{in:['active','paused']}},orderBy:{startedAt:'desc'}});
  if(prior) {
   const view=await viewInTransaction(tx,user,prior,now);
   if(view.card){if(prior.status==='paused')await tx.studySession.update({where:{id:prior.id},data:{status:'active',activeSince:now}});return {id:prior.id};}
   await tx.studySession.update({where:{id:prior.id},data:{status:'completed',endedAt:now,elapsedActiveMs:elapsed(prior,now),activeSince:null}});
  }
  const {budget,dueCount,due,chosen}=await dueSelection(tx,user,now);
  const used=await counts(tx,user,now), caps=effectiveLimits(user);
  if(includeNew&&dueCount<=budget&&dueCount===chosen.length) {
   const pool=await tx.card.findMany({where:{userId,status:'new',...eligible(now)},take:100,orderBy:[{createdAt:'asc'},{id:'asc'}]});
   for(const c of pool){const cat=category(c);if(used.total>=caps.total)break;if(used[cat]>=caps[cat]||chosen.some(s=>siblings(s,c)))continue;chosen.push(c);used[cat]++;used.total++;}
  }
  const snapshot={policyVersion:1,studyDay:studyDay(now,user.timezone),includeNew,introductionsPaused:dueCount>budget||dueCount>due.length,entries:chosen.map(c=>({cardId:c.id,stateVersion:c.stateVersion,role:c.status==='new'?'new':'review'}))};
  const overall=user.settingsJson.timeBudgetMinutes||30;
  const s=await tx.studySession.create({data:{userId,startedAt:now,activeSince:now,selectionSeed:randomUUID(),selectionSnapshotJson:snapshot,timeBudgetMinutes:includeNew?overall:Math.min(overall,user.settingsJson.reviewBudgetMinutes||20)}});
  for(const [i,c] of chosen.entries())await tx.sessionItem.create({data:{sessionId:s.id,itemId:c.itemId,role:c.status==='new'?'new':'review',order:i}});
  return {id:s.id};
 });
}
async function ownedSession(tx,userId,id){const s=await tx.studySession.findFirst({where:{id,userId}});if(!s)throw new ReviewError('Session ownership mismatch',403);return s;}
async function viewInTransaction(tx,user,session,now) {
 const entries=session.selectionSnapshotJson.entries;
 const completed=await tx.attempt.findMany({where:{sessionId:session.id,userId:user.id,reviewLogId:{not:null}},select:{cardId:true},take:108});
 const done=new Set(completed.map(a=>a.cardId));
 let card=null,attempt=null,deferred=0;
 for(const e of entries) {
  if(done.has(e.cardId))continue;
  const c=await tx.card.findFirst({where:{id:e.cardId,userId:user.id,...eligible(now),status:{in:['new','active']}}});
  if(!c||c.stateVersion!==e.stateVersion){deferred++;continue;}
  if(c.status==='new'&&await tx.card.count({where:{userId:user.id,status:'active',dueAt:{lte:now},...eligible(now)}})>0){deferred++;continue;}
  if(!card){card=c;attempt=await tx.attempt.findFirst({where:{sessionId:session.id,userId:user.id,cardId:c.id,reviewLogId:null}});}
 }
 const due=await tx.card.count({where:{userId:user.id,status:'active',dueAt:{lte:now},item:{status:'approved'}}});
 const actionableDue=await tx.card.count({where:{userId:user.id,status:'active',dueAt:{lte:now},...eligible(now)}});
 const repair=card?await tx.reviewLog.count({where:{userId:user.id,cardId:card.id,rating:1,reviewedAt:{gte:new Date(now.getTime()-30*86400000)}}}):0;
  const duration=elapsed(session,now);
  return {sessionId:session.id,status:session.status,completed:done.size,total:entries.length,deferred,due,actionableDue,buriedDue:due-actionableDue,introductionsPaused:session.selectionSnapshotJson.introductionsPaused,elapsedActiveMs:duration,timeBudgetMinutes:session.timeBudgetMinutes,timeBudgetReached:duration>=session.timeBudgetMinutes*60000,used:await counts(tx,user,now),limits:effectiveLimits(user),repairSuggested:repair>=5,card:card?{id:card.id,itemId:card.itemId,objective:card.objective,status:card.status,stateVersion:card.stateVersion,prompt:card.promptSpecJson}:null,...(attempt?{attempt:{clientEventId:attempt.clientEventId,answer:attempt.answerJson,readingMatch:attempt.feedbackJson.readingMatch},answer:card.answerSpecJson,study:await studyContent(tx,card)}:{} )};
}
export async function sessionView(db,userId,id,now=new Date()) {return locked(db,userId,async(tx,user)=>viewInTransaction(tx,user,await ownedSession(tx,userId,id),now));}
async function selectedCard(tx,user,sessionId,cardId,stateVersion,now) {
 const s=await ownedSession(tx,user.id,sessionId);
 if(s.status!=='active')throw new ReviewError('Resume the session first');
 const entry=s.selectionSnapshotJson.entries.find(e=>e.cardId===cardId);
 const c=await tx.card.findFirst({where:{id:cardId,userId:user.id}});
 if(!c||!entry)throw new ReviewError('Card ownership or selection mismatch',403);
 if(c.stateVersion!==stateVersion||entry.stateVersion!==stateVersion)throw new ReviewError('Stale card state; reload the session');
 if(!['new','active'].includes(c.status)||(c.buriedUntil&&c.buriedUntil>now)||c.itemId==null)throw new ReviewError('Card is not eligible');
 const item=await tx.item.findUnique({where:{id:c.itemId}});
 if(item.status!=='approved')throw new ReviewError('Content is no longer eligible');
 const view=await viewInTransaction(tx,user,s,now);
 if(view.card?.id!==c.id)throw new ReviewError('Finish the current due card first');
 return c;
}
export async function introduce(db,userId,sessionId,cardId,now=new Date()) {
 return locked(db,userId,async(tx,user)=>{
  const raw=await tx.card.findFirst({where:{id:cardId,userId}});if(!raw)throw new ReviewError('Card ownership mismatch',403);
  const card=await selectedCard(tx,user,sessionId,cardId,raw.stateVersion,now);
  if(card.status==='new') {
   const used=await counts(tx,user,now),caps=effectiveLimits(user);
   if(used.total>=caps.total||used[category(card)]>=caps[category(card)])throw new ReviewError('Daily introduction limit reached');
   const backlog=await tx.card.count({where:{userId,status:'active',dueAt:{lte:now},item:{status:'approved'}}});
   if(backlog>Math.min(100,user.settingsJson.reviewCardBudget||40))throw new ReviewError('Introductions paused for backlog');
   await tx.card.update({where:{id:card.id},data:{status:'active',introducedAt:now,introductionDay:studyDay(now,user.timezone),dueAt:now,fsrsStateJson:initialState(now)}});
   const learner=await tx.userItem.findUnique({where:{userId_itemId:{userId,itemId:card.itemId}},select:{introducedAt:true,familiarity:true}});
   await tx.userItem.upsert({where:{userId_itemId:{userId,itemId:card.itemId}},create:{userId,itemId:card.itemId,familiarity:'introduced',introducedAt:now},update:{...(!learner?.introducedAt?{introducedAt:now}:{}),...(learner?.familiarity==='unseen'?{familiarity:'introduced'}:{})}});
   await bury(tx,card,user,now);
  }
  return {answer:card.answerSpecJson,study:await studyContent(tx,card)};
 });
}
export async function commitResponse(db,userId,input,now=new Date()) {
 const data=responseSchema.parse(input);
 return locked(db,userId,async(tx,user)=>{
  const previous=await tx.attempt.findUnique({where:{userId_clientEventId:{userId,clientEventId:data.clientEventId}}});
  if(previous){if(previous.cardId!==data.cardId||previous.sessionId!==data.sessionId||previous.promptSnapshotJson.stateVersion!==data.stateVersion||!isDeepStrictEqual(previous.answerJson,data.answer))throw new ReviewError('Event ID already used with another response');return {clientEventId:previous.clientEventId,answer:previous.promptSnapshotJson.answer,readingMatch:previous.feedbackJson.readingMatch};}
  const card=await selectedCard(tx,user,data.sessionId,data.cardId,data.stateVersion,now);
  if(card.status!=='active')throw new ReviewError('Study the new card before recall');
  if(card.dueAt>now)throw new ReviewError('Card is not due');
  const prior=await tx.attempt.findFirst({where:{userId,sessionId:data.sessionId,cardId:data.cardId,reviewLogId:null}});
  if(prior)throw new ReviewError('A response is already committed; resume it');
  const required=card.objective==='vocab_reading_meaning'?['reading','meaning']:card.objective==='kanji_meaning'?['meaning']:card.objective==='kanji_reading_context'?['reading']:['response'];
  if(required.some(k=>typeof data.answer[k]!=='string'||!data.answer[k].trim()))throw new ReviewError('Commit each required response, or write “forgot”',400);
  const feedback=card.answerSpecJson.reading?{normalizedReading:normalizeReading(data.answer.reading),readingMatch:normalizeReading(data.answer.reading)===normalizeReading(card.answerSpecJson.reading)}:{};
  await tx.attempt.create({data:{userId,sessionId:data.sessionId,cardId:card.id,contentId:card.contentId,primaryTargetItemId:card.itemId,clientEventId:data.clientEventId,promptSnapshotJson:{prompt:card.promptSpecJson,answer:card.answerSpecJson,stateVersion:card.stateVersion,templateVersion:card.templateVersion},answerJson:data.answer,feedbackJson:feedback,startedAt:now,submittedAt:now,revealedAt:now}});
  return {clientEventId:data.clientEventId,answer:card.answerSpecJson,readingMatch:feedback.readingMatch};
 });
}
const receipt=log=>({reviewLogId:log.id,cardId:log.cardId,rating:log.rating,stateVersion:log.cardAfterJson.stateVersion,dueAt:log.cardAfterJson.dueAt});
export async function rate(db,userId,input,now=new Date()) {
 const data=ratingSchema.parse(input);
 return locked(db,userId,async(tx,user)=>{
  const prior=await tx.reviewLog.findUnique({where:{userId_clientEventId:{userId,clientEventId:data.clientEventId}}});
  if(prior){if(prior.cardId!==data.cardId||prior.sessionId!==data.sessionId||prior.cardBeforeJson.stateVersion!==data.stateVersion)throw new ReviewError('Event ID already used by another review');return receipt(prior);}
  const card=await selectedCard(tx,user,data.sessionId,data.cardId,data.stateVersion,now);
  const attempt=await tx.attempt.findUnique({where:{userId_clientEventId:{userId,clientEventId:data.clientEventId}}});
  if(!attempt||attempt.cardId!==data.cardId||attempt.sessionId!==data.sessionId)throw new ReviewError('Commit and reveal the response first');
  if(attempt.promptSnapshotJson.stateVersion!==data.stateVersion||card.status!=='active')throw new ReviewError('Stale response; reload the session');
  const rating=effectiveRating(card.objective,data.rating,data.components);
  const result=schedule(card.fsrsStateJson,now,rating,user.settingsJson.scheduler);
  const before={state:card.fsrsStateJson,dueAt:card.dueAt.toISOString(),stateVersion:card.stateVersion,status:card.status};
  const after={state:result.card,dueAt:result.card.due,stateVersion:card.stateVersion+1,status:'active'};
  const log=await tx.reviewLog.create({data:{userId,cardId:card.id,sessionId:data.sessionId,clientEventId:data.clientEventId,reviewedAt:now,rating,durationMs:Math.min(2147483647,Math.max(0,now-attempt.startedAt)),libraryVersion:'5.4.2',schedulerConfigJson:user.settingsJson.scheduler,cardBeforeJson:before,cardAfterJson:after,libraryLogJson:result.log,promptSnapshotJson:attempt.promptSnapshotJson}});
  await tx.card.update({where:{id:card.id},data:{fsrsStateJson:result.card,dueAt:new Date(result.card.due),stateVersion:{increment:1}}});
  const success=card.objective==='vocab_reading_meaning'?data.components.readingCorrect&&data.components.meaningCorrect:data.components.correct;
  await tx.attempt.update({where:{id:attempt.id},data:{outcome:success?'correct':card.objective==='vocab_reading_meaning'&&(data.components.readingCorrect||data.components.meaningCorrect)?'partial':'incorrect',feedbackJson:{...attempt.feedbackJson,...data.components,requestedRating:data.rating,effectiveRating:rating},reviewLogId:log.id}});
  await bury(tx,card,user,now);
  return receipt(log);
 });
}
export async function stopSession(db,userId,id,now=new Date()){return locked(db,userId,async tx=>{const s=await ownedSession(tx,userId,id);if(s.status==='completed')throw new ReviewError('Session is completed');if(s.status==='active')await tx.studySession.update({where:{id},data:{status:'paused',elapsedActiveMs:elapsed(s,now),activeSince:null}});return {savedAt:now.toISOString()};});}

export async function updateBudget(db,userId,minutes) {
 z.number().int().min(5).max(60).parse(minutes);
 return locked(db,userId,async(tx,user)=>{
  await tx.user.update({where:{id:userId},data:{settingsJson:{...user.settingsJson,timeBudgetMinutes:minutes}}});
  const open=await tx.studySession.findFirst({where:{userId,status:{in:['active','paused']}}});
  if(open)await tx.studySession.update({where:{id:open.id},data:{timeBudgetMinutes:open.selectionSnapshotJson.includeNew?minutes:Math.min(minutes,user.settingsJson.reviewBudgetMinutes||20)}});
  return {timeBudgetMinutes:minutes};
 });
}
export async function markUnfamiliar(db,userId,itemId) {
 uuid.parse(itemId);
 return locked(db,userId,async tx=>{
  if(!await tx.item.findFirst({where:{id:itemId,status:'approved'},select:{id:true}}))throw new ReviewError('Approved item unavailable',404);
  await tx.userItem.upsert({where:{userId_itemId:{userId,itemId}},create:{userId,itemId,needsAttention:true},update:{needsAttention:true}});
  return {needsAttention:true};
 });
}
export async function dashboard(db,userId=LOCAL_USER_ID,now=new Date()) {
 const progress={};
 for(const kind of ['vocabulary','kanji','grammar']){
  const membership=kind==='kanji'?{curriculumRole:'core_kanji'}:{OR:[{curriculumRole:null},{curriculumRole:{not:'context_reference'}}],source:{sourceType:'book'}};
  const where={kind,status:'approved',sourceEntries:{some:{verificationStatus:'verified',successor:null,...membership}}};
  progress[kind]={total:await db.item.count({where}),introduced:await db.item.count({where:{...where,userItems:{some:{userId,introducedAt:{not:null}}}}})};
 }
 const user=await db.user.findUnique({where:{id:userId}});
 if(!user)return {progress,reviewCount:0,actionableDue:0,due:0,buriedDue:0,deferred:0,contentGaps:0,used:{vocabulary:0,kanji:0,grammar:0,total:0},limits,timeBudgetMinutes:30,introductionsPaused:false,sessionId:null};
 return locked(db,userId,async(tx,u)=>{
  const {budget,dueCount,due,chosen}=await dueSelection(tx,u,now);
  const active=await tx.studySession.findFirst({where:{userId,status:{in:['active','paused']}},orderBy:{startedAt:'desc'}});
  const view=active?await viewInTransaction(tx,u,active,now):null;
  const actionableDue=await tx.card.count({where:{userId,status:'active',dueAt:{lte:now},...eligible(now)}});
  const missingGrammar=await tx.item.count({where:{kind:'grammar',status:'approved',cards:{none:{userId,objective:'grammar_cloze',status:{not:'retired'}}}}});
  const missingContext=await tx.item.count({where:{kind:'kanji',status:'approved',sourceEntries:{some:{verificationStatus:'verified',curriculumRole:'core_kanji'}},cards:{none:{userId,objective:'kanji_reading_context',status:{not:'retired'}}}}});
  return {progress,reviewCount:view?.card?view.total-view.completed-view.deferred:chosen.length,sessionId:view?.card?active.id:null,sessionStatus:active?.status,due:dueCount,actionableDue,buriedDue:dueCount-actionableDue,deferred:view?.deferred||0,contentGaps:missingGrammar+missingContext,introductionsPaused:dueCount>budget||dueCount>due.length,used:await counts(tx,u,now),limits:effectiveLimits(u),timeBudgetMinutes:u.settingsJson.timeBudgetMinutes||30};
 });
}
