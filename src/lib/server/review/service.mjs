import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { configuration, initialState, schedule, effectiveRating, studyDay, nextStudyDay } from './scheduler.mjs';
import { hasIdleGap, sessionElapsedMs } from './timing.mjs';
import { buildKanjiMeaningChoices, buildKanjiReadingChoices, buildVocabChoices } from './choices.mjs';
import { studyContent } from '../content/study.mjs';
import { isKanjiMeaningSupplement, resolveKanjiMeanings } from '../content/kanji-meanings.mjs';
import { localDictionary } from '../generation/dictionary.mjs';
import { activitySummary,summarizeActivity } from './activity.mjs';
import { normalizeReading } from './text.mjs';
import { DEFAULT_CAPS, category, planQueue, retrievability } from './selection.mjs';
export { normalizeReading };
export { summarizeActivity };

export const LOCAL_USER_ID='00000000-0000-4000-8000-000000000001';
const uuid=z.string().uuid();
const answerSchema=z.object({
 reading:z.string().max(500).optional(),
 meaning:z.string().max(2000).optional(),
 response:z.string().max(2000).optional(),
 choiceId:z.string().min(8).max(40).optional(),
 choiceFingerprint:z.string().regex(/^[a-f0-9]{8,32}$/).optional(),
}).strict();
const responseSchema=z.object({sessionId:uuid,cardId:uuid,stateVersion:z.number().int().nonnegative(),clientEventId:uuid,answer:answerSchema}).strict();
const ratingSchema=responseSchema.extend({rating:z.number().int().min(1).max(4),components:z.record(z.boolean()).optional()});
export class ReviewError extends Error { constructor(message,status=409){super(message);this.status=status;} }
export async function createUser(db,id=LOCAL_USER_ID,timezone='Asia/Calcutta') {
 uuid.parse(id);studyDay(new Date(),timezone);
 return db.user.upsert({where:{id},create:{id,timezone,settingsJson:{scheduler:configuration(),timeBudgetMinutes:30,reviewBudgetMinutes:20,dailyReviewCaps:{...DEFAULT_CAPS}}},update:{}});
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
let reviewDictionaryPromise;
function reviewDictionary(){return reviewDictionaryPromise||=localDictionary();}
async function kanjiExampleWords(tx,itemId) {
 const entries=await tx.sourceEntry.findMany({where:{itemId,curriculumRole:'core_kanji',...evidenceWhere},select:{originalPayloadJson:true},orderBy:{revision:'desc'},take:5});
 for(const entry of entries) {
  const words=entry.originalPayloadJson?.example_words;
  if(!Array.isArray(words))continue;
  const usable=words.filter(word=>word&&typeof word.word==='string'&&word.word.trim()).map(word=>({word:word.word,reading:typeof word.reading==='string'?word.reading:''}));
  if(usable.length)return usable;
 }
 return [];
}
const wordKey=(writing,reading)=>createHash('sha256').update(JSON.stringify([writing.normalize('NFC'),reading.normalize('NFC')])).digest('hex');
async function addCard(tx,user,item,objective,prompt,answer,now,extra={}) {
 const prior=await tx.card.findFirst({where:{userId:user.id,itemId:item.id,objective}});
 if(prior)return 0;
 const evidence=await tx.sourceEntry.findMany({where:{id:{in:prompt.sourceEntryIds},verificationStatus:'verified'},select:{id:true,sourceId:true},take:20});
 await tx.card.create({data:{userId:user.id,itemId:item.id,objective,promptSpecJson:{...prompt,sources:evidence,itemRevision:item.revision,templateVersion:1},answerSpecJson:answer,fsrsStateJson:initialState(now),...extra}});
 return 1;
}

export async function syncCards(db,userId,now=new Date(),itemIds) {
 return locked(db,userId,async(tx,user)=>{
  let created=0;const gaps=[];
  // Explicit bounded pool. Larger intake is phase 6; never fetch the entire library into memory.
  const items=await tx.item.findMany({where:{...(itemIds?{id:{in:itemIds}}:{}),status:'approved',sourceEntries:{some:evidenceWhere}},take:500,orderBy:{id:'asc'},include:{vocabulary:true,kanji:true,grammar:true,sourceEntries:{where:evidenceWhere,take:12,select:{id:true,curriculumRole:true}},contentLinks:{where:{content:{status:'approved',successor:null}},take:20,include:{content:{include:{sourceEntries:{where:evidenceWhere,take:4}}}}}}});
  const kanjiIds=items.filter(item=>item.kanji).map(item=>item.id);
  const meaningSupplements=new Map();
  if(kanjiIds.length){
   // Meaning supplements may sit outside the first 20 linked records, so resolve them explicitly.
   const supplements=await tx.content.findMany({where:{status:'approved',kind:'explanation',successor:{is:null},payloadJson:{path:['kind'],equals:'dictionaryFieldSupplement'},items:{some:{itemId:{in:kanjiIds}}}},select:{id:true,kind:true,origin:true,status:true,payloadJson:true,successor:{select:{id:true}},sourceEntries:{where:evidenceWhere,take:4,select:{id:true}},items:{where:{itemId:{in:kanjiIds}},select:{itemId:true}}},take:1200});
   for(const content of supplements)if(isKanjiMeaningSupplement(content))for(const link of content.items){const list=meaningSupplements.get(link.itemId);if(list)list.push(content);else meaningSupplements.set(link.itemId,[content]);}
  }
  const existingCards=await tx.card.findMany({where:{userId,itemId:{in:items.map(item=>item.id)}},select:{itemId:true,objective:true},take:1500});
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
    const resolved=resolveKanjiMeanings([...(meaningSupplements.get(item.id)??[]),...item.contentLinks.map(link=>link.content)],item.kanji.meaningsJson);
    let meanings=resolved.meanings,meaningSources=resolved.supplement?resolved.supplement.sourceEntries.map(e=>e.id):sources;
    if(!meaningSources.length)meaningSources=sources;
    if(!meanings.length) {
     const dictionary=item.contentLinks.find(l=>l.content.kind==='explanation'&&l.content.origin==='user'&&l.content.sourceEntries.length&&strings(l.content.payloadJson.selectedMeanings).length&&!l.content.payloadJson.addedBy&&!l.content.payloadJson.acceptedLimitations);
     if(dictionary){meanings=strings(dictionary.content.payloadJson.selectedMeanings);meaningSources=dictionary.content.sourceEntries.map(e=>e.id);}
    }
    if(meanings.length)created+=await ensureCard(item,'kanji_meaning',{text:item.kanji.glyph,cue:'Choose the reading and meaning.',sourceEntryIds:meaningSources},{meaning:meanings.join('; '),acceptedGlosses:meanings});
    else gaps.push({itemId:item.id,reason:'core meaning evidence missing'});
    // A6: one kanji card; reading-in-a-word cards are no longer created (scripts/retire-kanji-reading-cards.mjs).
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
function siblings(a,b){return a.itemId===b.itemId||(a.siblingKey&&a.siblingKey===b.siblingKey)||(a.contextVocabularyItemId&&a.contextVocabularyItemId===b.contextVocabularyItemId)||a.contextVocabularyItemId===b.itemId||b.contextVocabularyItemId===a.itemId;}
// Distinct cards answered in the learner's study day, per type; the daily caps count these.
// Explicit early reviews ("Review more") go past the cap, so they do not consume it.
async function answeredToday(tx,user,now) {
 const rows=await tx.$queryRaw`SELECT DISTINCT c.id,c.objective FROM review_logs l JOIN cards c ON c.id=l."cardId" LEFT JOIN study_sessions s ON s.id=l."sessionId" WHERE l."userId"=${user.id}::uuid AND to_char(l."reviewedAt" AT TIME ZONE ${user.timezone},'YYYY-MM-DD')=${studyDay(now,user.timezone)} AND COALESCE(s."selectionSnapshotJson"->>'mode','daily')<>'more'`;
 const used={vocabulary:0,kanji:0,grammar:0};
 for(const c of rows)used[category(c)]++;
 return used;
}
const capsSchema=z.object({vocabulary:z.number().int().min(0).max(300),kanji:z.number().int().min(0).max(300),grammar:z.number().int().min(0).max(300)}).strict();
function userCaps(user) {
 const saved=capsSchema.safeParse(user.settingsJson.dailyReviewCaps);
 return saved.success?saved.data:{...DEFAULT_CAPS};
}
// Studied items' first recalls (oldest study first) plus due cards, split 70/30 under today's remaining caps.
async function dailyQueue(tx,user,now) {
 const waitingIds=await tx.$queryRaw`SELECT c.id FROM cards c JOIN user_items ui ON ui."userId"=c."userId" AND ui."itemId"=c."itemId" JOIN items i ON i.id=c."itemId" WHERE c."userId"=${user.id}::uuid AND c.status='new' AND i.status='approved' AND ui."introducedAt" IS NOT NULL AND (c."buriedUntil" IS NULL OR c."buriedUntil"<=${now}) ORDER BY ui."introducedAt",c."createdAt",c.id LIMIT 2000`;
 const ready=new Map((await tx.card.findMany({where:{id:{in:waitingIds.map(c=>c.id)},userId:user.id,status:'new',...eligible(now)}})).map(c=>[c.id,c]));
 const waiting=waitingIds.map(c=>ready.get(c.id)).filter(Boolean);
 const due=await tx.card.findMany({where:{userId:user.id,status:'active',dueAt:{lte:now},...eligible(now)}});
 return planQueue({waiting,due,caps:userCaps(user),used:await answeredToday(tx,user,now),now,config:user.settingsJson.scheduler,siblings});
}
// Explicit early review: up to 20 not-due cards, lowest retrievability first; caps do not apply.
async function moreQueue(tx,user,now) {
 const cards=await tx.card.findMany({where:{userId:user.id,status:'active',dueAt:{gt:now},...eligible(now)}});
 const r=new Map(cards.map(c=>[c.id,retrievability(c.fsrsStateJson,now,user.settingsJson.scheduler)]));
 const chosen=[];
 for(const c of cards.sort((a,b)=>r.get(a.id)-r.get(b.id)||a.dueAt-b.dueAt)){if(chosen.length>=20)break;if(!chosen.some(s=>siblings(s,c)))chosen.push(c);}
 return chosen;
}
const sameStudyDay=(session,user,now)=>(session.selectionSnapshotJson.studyDay||studyDay(session.startedAt,user.timezone))===studyDay(now,user.timezone);
// The open daily session for the current study day, if any.
export async function currentSession(db,userId,now=new Date()) {
 const user=await db.user.findUnique({where:{id:userId}});
 const s=user&&await db.studySession.findFirst({where:{userId,mode:'daily',status:{in:['active','paused']}},orderBy:{startedAt:'desc'}});
 return s&&sameStudyDay(s,user,now)?s.id:null;
}
export async function startSession(db,userId,{now=new Date(),reviewMore=false}={}) {
 return locked(db,userId,async(tx,user)=>{
  const prior=await tx.studySession.findFirst({where:{userId,mode:'daily',status:{in:['active','paused']}},orderBy:{startedAt:'desc'}});
  if(prior) {
   // A session from an earlier study day was sized against that day's cap: close it and build today's queue.
   const view=sameStudyDay(prior,user,now)?await viewInTransaction(tx,user,prior,now):null;
   if(view?.card){
    if(prior.status==='paused'||hasIdleGap(prior,now))await tx.studySession.update({where:{id:prior.id},data:{status:'active',activeSince:now}});
    return {id:prior.id};
   }
   await tx.studySession.update({where:{id:prior.id},data:{status:'completed',endedAt:now,elapsedActiveMs:sessionElapsedMs(prior,now),activeSince:null}});
  }
  const chosen=reviewMore?await moreQueue(tx,user,now):await dailyQueue(tx,user,now);
  if(reviewMore&&!chosen.length)return {id:null};
  const snapshot={policyVersion:2,mode:reviewMore?'more':'daily',studyDay:studyDay(now,user.timezone),entries:chosen.map(c=>({cardId:c.id,stateVersion:c.stateVersion,role:c.status==='new'?'new':'review'}))};
  const s=await tx.studySession.create({data:{userId,startedAt:now,activeSince:now,selectionSeed:randomUUID(),selectionSnapshotJson:snapshot,timeBudgetMinutes:user.settingsJson.timeBudgetMinutes||30}});
  for(const [i,c] of chosen.entries())await tx.sessionItem.create({data:{sessionId:s.id,itemId:c.itemId,role:c.status==='new'?'new':'review',order:i}});
  return {id:s.id};
 });
}
async function ownedSession(tx,userId,id){const s=await tx.studySession.findFirst({where:{id,userId,mode:'daily'}});if(!s)throw new ReviewError('Session ownership mismatch',403);return s;}
const choiceObjectives=new Set(['vocab_reading_meaning','kanji_meaning','kanji_reading_context']);
function feedbackComponents(feedback) {
 const result={};
 for(const key of ['correct','readingCorrect','meaningCorrect'])if(typeof feedback?.[key]==='boolean')result[key]=feedback[key];
 return Object.keys(result).length?result:undefined;
}
function chosenChoice(attempt) {
 const id=attempt.answerJson?.choiceId;
 const choices=attempt.promptSnapshotJson?.choices;
 if(!id||!Array.isArray(choices))return undefined;
 const choice=choices.find(item=>item?.id===id);
 return choice?{id:choice.id,...(choice.reading?{reading:choice.reading}:{}),...(choice.meaning?{meaning:choice.meaning}:{})}:undefined;
}
async function recallChoices(tx,user,card,session) {
 if(!choiceObjectives.has(card.objective)||!card.answerSpecJson)return null;
 const seed=`${session.selectionSeed}:${card.id}:${card.stateVersion}`;
 if(card.objective==='vocab_reading_meaning') {
  const vocabulary=await tx.vocabulary.findUnique({where:{itemId:card.itemId},select:{writtenForm:true,partOfSpeech:true}});
  if(!vocabulary)return null;
  const rows=await tx.vocabulary.findMany({
   where:{itemId:{not:card.itemId},item:{status:'approved',sourceEntries:{some:evidenceWhere}}},
   select:{itemId:true,writtenForm:true,reading:true,meaningEn:true,partOfSpeech:true},
   take:240,orderBy:{itemId:'asc'},
  });
  return buildVocabChoices({
   target:{itemId:card.itemId,writtenForm:vocabulary.writtenForm,reading:card.answerSpecJson.reading,meaning:card.answerSpecJson.meaning,acceptedGlosses:strings(card.answerSpecJson.acceptedGlosses),partOfSpeech:vocabulary.partOfSpeech},
   candidates:rows.map(row=>({itemId:row.itemId,writtenForm:row.writtenForm,reading:row.reading,meaning:row.meaningEn,partOfSpeech:row.partOfSpeech})),
   seed,
  });
 }
 if(card.objective==='kanji_meaning') {
  const kanji=await tx.kanji.findUnique({where:{itemId:card.itemId},select:{glyph:true,meaningsJson:true,onReadingsJson:true,kunReadingsJson:true}});
  if(!kanji)return null;
  const rows=await tx.kanji.findMany({
   where:{itemId:{not:card.itemId},item:{status:'approved',sourceEntries:{some:{...evidenceWhere,curriculumRole:'core_kanji'}}}},
   select:{itemId:true,glyph:true,meaningsJson:true,onReadingsJson:true,kunReadingsJson:true},take:240,orderBy:{itemId:'asc'},
  });
  const dictionary=await reviewDictionary(),examples=new Map();
  return buildKanjiMeaningChoices({
   target:{itemId:card.itemId,glyph:kanji.glyph,meaning:card.answerSpecJson.meaning,meanings:strings(kanji.meaningsJson),onReadings:strings(kanji.onReadingsJson),kunReadings:strings(kanji.kunReadingsJson)},
   candidates:rows.map(row=>({itemId:row.itemId,glyph:row.glyph,meanings:strings(row.meaningsJson),onReadings:strings(row.onReadingsJson),kunReadings:strings(row.kunReadingsJson)})),
   seed,
   lookup:dictionary.lookup,
   examplesFor:async ({itemId})=>{
    if(!itemId)return [];
    if(!examples.has(itemId))examples.set(itemId,await kanjiExampleWords(tx,itemId));
    return examples.get(itemId);
   },
  });
 }
 const rows=await tx.card.findMany({
  where:{userId:user.id,objective:'kanji_reading_context',status:{in:['new','active']},itemId:{not:card.itemId}},
  select:{itemId:true,answerSpecJson:true},take:240,orderBy:{id:'asc'},
 });
 return buildKanjiReadingChoices({
  target:{itemId:card.itemId,reading:card.answerSpecJson.reading},
  candidates:rows.map(row=>({itemId:row.itemId,reading:row.answerSpecJson?.reading})),
  seed,
 });
}
// The saved selection is immutable (DB trigger). A card whose first review in this session was Again
// returns once at the end, derived from the session's own logs, so retries and replays cannot add more.
async function sessionEntries(tx,session) {
 const entries=session.selectionSnapshotJson.entries,listed=new Set(entries.map(e=>e.cardId)),first=new Map();
 const logs=await tx.reviewLog.findMany({where:{sessionId:session.id},select:{cardId:true,rating:true,cardAfterJson:true},orderBy:[{reviewedAt:'asc'},{id:'asc'}],take:800});
 for(const l of logs)if(!first.has(l.cardId))first.set(l.cardId,l);
 const again=[...first.values()].filter(l=>l.rating===1&&listed.has(l.cardId)).map(l=>({cardId:l.cardId,stateVersion:l.cardAfterJson.stateVersion,role:'again'}));
 return [...entries,...again];
}
async function viewInTransaction(tx,user,session,now,{choices=false}={}) {
 const entries=await sessionEntries(tx,session);
 const completed=await tx.attempt.findMany({where:{sessionId:session.id,userId:user.id,reviewLogId:{not:null}},select:{cardId:true},take:800});
 // A card may appear twice (an Again repeat): its k-th entry is done once the session holds k reviews of it.
 const reviewed=new Map(),seen=new Map();
 for(const a of completed)reviewed.set(a.cardId,(reviewed.get(a.cardId)||0)+1);
 const used=await answeredToday(tx,user,now),caps=userCaps(user);
 let card=null,attempt=null,deferred=0,done=0,role;
 for(const e of entries) {
  const k=(seen.get(e.cardId)||0)+1;seen.set(e.cardId,k);
  if((reviewed.get(e.cardId)||0)>=k){done++;continue;}
  const c=await tx.card.findFirst({where:{id:e.cardId,userId:user.id,...eligible(now),status:{in:['new','active']}}});
  if(!c||c.stateVersion!==e.stateVersion){deferred++;continue;}
  if(!card){card=c;role=e.role;attempt=await tx.attempt.findFirst({where:{sessionId:session.id,userId:user.id,cardId:c.id,reviewLogId:null}});}
 }
 const due=await tx.card.count({where:{userId:user.id,status:'active',dueAt:{lte:now},item:{status:'approved'}}});
 const actionableDue=await tx.card.count({where:{userId:user.id,status:'active',dueAt:{lte:now},...eligible(now)}});
 const repair=card?await tx.reviewLog.count({where:{userId:user.id,cardId:card.id,rating:1,reviewedAt:{gte:new Date(now.getTime()-30*86400000)}}}):0;
  const duration=sessionElapsedMs(session,now);
  const choiceSet=choices&&card&&!attempt&&(card.status==='active'||card.status==='new')?await recallChoices(tx,user,card,session):null;
  return {sessionId:session.id,status:session.status,completed:done,total:entries.length,deferred,due,actionableDue,buriedDue:due-actionableDue,elapsedActiveMs:duration,idleTooLong:hasIdleGap(session,now),timeBudgetMinutes:session.timeBudgetMinutes,timeBudgetReached:duration>=session.timeBudgetMinutes*60000,used,limits:caps,repairSuggested:repair>=5,
   card:card?{id:card.id,itemId:card.itemId,objective:card.objective,status:card.status,stateVersion:card.stateVersion,role,prompt:card.promptSpecJson}:null,
   recall:choiceSet?{format:choiceSet.format,fingerprint:choiceSet.fingerprint,choices:choiceSet.choices.map(({id,reading,meaning})=>({id,...(reading?{reading}:{}),...(meaning?{meaning}:{})}))}:null,
   ...(attempt?{
    attempt:{clientEventId:attempt.clientEventId,answer:attempt.answerJson,readingMatch:attempt.feedbackJson.readingMatch,grader:attempt.grader,components:feedbackComponents(attempt.feedbackJson),choice:chosenChoice(attempt)},
    answer:card.answerSpecJson,
    study:await studyContent(tx,card),
   }:{}),
  };
}
export async function sessionView(db,userId,id,now=new Date()) {return locked(db,userId,async(tx,user)=>viewInTransaction(tx,user,await ownedSession(tx,userId,id),now,{choices:true}));}
export async function resumeSession(db,userId,id,now=new Date()) {
 return locked(db,userId,async(tx,user)=>{
  const session=await ownedSession(tx,userId,id);
  if(session.status==='completed')throw new ReviewError('Session is completed');
  if(session.status==='paused'||hasIdleGap(session,now))await tx.studySession.update({where:{id},data:{status:'active',activeSince:now}});
  return viewInTransaction(tx,user,{...session,status:'active',activeSince:session.status==='paused'||hasIdleGap(session,now)?now:session.activeSince},now,{choices:true});
 });
}
async function selectedCard(tx,user,sessionId,cardId,stateVersion,now) {
 const s=await ownedSession(tx,user.id,sessionId);
 if(s.status!=='active')throw new ReviewError('Resume the session first');
 const entries=await sessionEntries(tx,s);
 const entry=entries.find(e=>e.cardId===cardId&&e.stateVersion===stateVersion)||entries.find(e=>e.cardId===cardId);
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
async function activateCard(tx,user,card,now) {
 if(card.status!=='new')return card;
 const active=await tx.card.update({where:{id:card.id},data:{status:'active',introducedAt:now,introductionDay:studyDay(now,user.timezone),dueAt:now,fsrsStateJson:initialState(now)}});
 const learner=await tx.userItem.findUnique({where:{userId_itemId:{userId:user.id,itemId:card.itemId}},select:{introducedAt:true,familiarity:true}});
 await tx.userItem.upsert({where:{userId_itemId:{userId:user.id,itemId:card.itemId}},create:{userId:user.id,itemId:card.itemId,familiarity:'introduced',introducedAt:now},update:{...(!learner?.introducedAt?{introducedAt:now}:{}),...(learner?.familiarity==='unseen'?{familiarity:'introduced'}:{})}});
 await bury(tx,card,user,now);
 return active;
}
export async function introduce(db,userId,sessionId,cardId,now=new Date()) {
 return locked(db,userId,async(tx,user)=>{
  const raw=await tx.card.findFirst({where:{id:cardId,userId}});if(!raw)throw new ReviewError('Card ownership mismatch',403);
  const card=await selectedCard(tx,user,sessionId,cardId,raw.stateVersion,now);
  await activateCard(tx,user,card,now);
  return {answer:card.answerSpecJson,study:await studyContent(tx,card)};
 });
}
function normalizeGloss(value) {
 return String(value || '').normalize('NFKC').trim().toLowerCase().replace(/\s+/gu, ' ');
}
function gradeChoice(card, choice, correctChoiceId) {
 const answer = card.answerSpecJson;
 if (card.objective === 'vocab_reading_meaning') {
  const readingCorrect = normalizeReading(choice.reading || '') === normalizeReading(answer.reading || '');
  const meaningCorrect = [answer.meaning, ...strings(answer.acceptedGlosses)].filter(Boolean)
   .some(gloss => normalizeGloss(gloss) === normalizeGloss(choice.meaning));
  return { readingCorrect, meaningCorrect, correct: readingCorrect && meaningCorrect, readingMatch: readingCorrect };
 }
 const correct = choice.id === correctChoiceId;
 return card.objective === 'kanji_reading_context' ? { correct, readingMatch: correct } : { correct };
}
export async function commitResponse(db,userId,input,now=new Date()) {
 const data=responseSchema.parse(input);
 return locked(db,userId,async(tx,user)=>{
  const previous=await tx.attempt.findUnique({where:{userId_clientEventId:{userId,clientEventId:data.clientEventId}}});
  if(previous){if(previous.cardId!==data.cardId||previous.sessionId!==data.sessionId||previous.promptSnapshotJson.stateVersion!==data.stateVersion||!isDeepStrictEqual(previous.answerJson,data.answer))throw new ReviewError('Event ID already used with another response');return {clientEventId:previous.clientEventId,answer:previous.promptSnapshotJson.answer,readingMatch:previous.feedbackJson.readingMatch,grader:previous.grader};}
  const card=await activateCard(tx,user,await selectedCard(tx,user,data.sessionId,data.cardId,data.stateVersion,now),now);
  const prior=await tx.attempt.findFirst({where:{userId,sessionId:data.sessionId,cardId:data.cardId,reviewLogId:null}});
  if(prior)throw new ReviewError('A response is already committed; resume it');
  const session=await ownedSession(tx,user.id,data.sessionId);
  const choices=data.answer.choiceId?await recallChoices(tx,user,card,session):null;
  if(data.answer.choiceId&&!data.answer.choiceFingerprint)throw new ReviewError('Choice fingerprint required',400);
  let answerJson=data.answer,feedback={},grader='self';
  if(data.answer.choiceId) {
   if(!choices)throw new ReviewError('Choice response unavailable; reload the card');
   if(data.answer.choiceFingerprint!==choices.fingerprint)throw new ReviewError('Choices changed; reload the card');
   const choice=choices.choices.find(item=>item.id===data.answer.choiceId);
   if(!choice)throw new ReviewError('Selected choice was not offered; reload the card');
   answerJson={choiceId:choice.id,choiceFingerprint:choices.fingerprint};
   feedback={choiceId:choice.id,...gradeChoice(card,choice,choices.correctChoiceId)};
   grader='objective';
  } else {
   const required=card.objective==='vocab_reading_meaning'?['reading','meaning']:card.objective==='kanji_meaning'?['meaning']:card.objective==='kanji_reading_context'?['reading']:['response'];
   if(required.some(k=>typeof data.answer[k]!=='string'||!data.answer[k].trim()))throw new ReviewError('Commit each required response, or write “forgot”',400);
   feedback=card.answerSpecJson.reading?{normalizedReading:normalizeReading(data.answer.reading),readingMatch:normalizeReading(data.answer.reading)===normalizeReading(card.answerSpecJson.reading)}:{};
  }
  await tx.attempt.create({data:{userId,sessionId:data.sessionId,cardId:card.id,contentId:card.contentId,primaryTargetItemId:card.itemId,clientEventId:data.clientEventId,promptSnapshotJson:{prompt:card.promptSpecJson,answer:card.answerSpecJson,stateVersion:card.stateVersion,templateVersion:card.templateVersion,...(choices?{choiceFormat:choices.format,choices:choices.choices,correctChoiceId:choices.correctChoiceId}:{})},answerJson,feedbackJson:feedback,grader,startedAt:now,submittedAt:now,revealedAt:now}});
  return {clientEventId:data.clientEventId,answer:card.answerSpecJson,readingMatch:feedback.readingMatch,grader};
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
  const components=attempt.grader==='objective'?attempt.feedbackJson:data.components;
  const requestedRating=attempt.grader==='objective'?Math.min(3,data.rating):data.rating;
  const rating=effectiveRating(card.objective,requestedRating,components);
  const result=schedule(card.fsrsStateJson,now,rating,user.settingsJson.scheduler);
  const before={state:card.fsrsStateJson,dueAt:card.dueAt.toISOString(),stateVersion:card.stateVersion,status:card.status};
  const after={state:result.card,dueAt:result.card.due,stateVersion:card.stateVersion+1,status:'active'};
  const log=await tx.reviewLog.create({data:{userId,cardId:card.id,sessionId:data.sessionId,clientEventId:data.clientEventId,reviewedAt:now,rating,durationMs:Math.min(2147483647,Math.max(0,now-attempt.startedAt)),libraryVersion:'5.4.2',schedulerConfigJson:user.settingsJson.scheduler,cardBeforeJson:before,cardAfterJson:after,libraryLogJson:result.log,promptSnapshotJson:attempt.promptSnapshotJson}});
  await tx.card.update({where:{id:card.id},data:{fsrsStateJson:result.card,dueAt:new Date(result.card.due),stateVersion:{increment:1}}});
  const success=card.objective==='vocab_reading_meaning'?components.readingCorrect&&components.meaningCorrect:components.correct;
  await tx.attempt.update({where:{id:attempt.id},data:{outcome:success?'correct':card.objective==='vocab_reading_meaning'&&(components.readingCorrect||components.meaningCorrect)?'partial':'incorrect',feedbackJson:{...attempt.feedbackJson,...components,requestedRating:data.rating,effectiveRating:rating},reviewLogId:log.id}});
  await bury(tx,card,user,now);
  return receipt(log);
 });
}
export async function stopSession(db,userId,id,now=new Date()){return locked(db,userId,async tx=>{const s=await ownedSession(tx,userId,id);if(s.status==='completed')throw new ReviewError('Session is completed');if(s.status==='active')await tx.studySession.update({where:{id},data:{status:'paused',elapsedActiveMs:sessionElapsedMs(s,now),activeSince:null}});return {savedAt:now.toISOString()};});}

export async function updateBudget(db,userId,minutes) {
 z.number().int().min(5).max(60).parse(minutes);
 return locked(db,userId,async(tx,user)=>{
  await tx.user.update({where:{id:userId},data:{settingsJson:{...user.settingsJson,timeBudgetMinutes:minutes}}});
  const open=await tx.studySession.findFirst({where:{userId,mode:'daily',status:{in:['active','paused']}}});
  if(open)await tx.studySession.update({where:{id:open.id},data:{timeBudgetMinutes:minutes}});
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
export async function studyStatus(db,userId,itemId) {
 const learner=await db.userItem.findUnique({where:{userId_itemId:{userId,itemId}},select:{introducedAt:true}});
 const item=await db.item.findUnique({where:{id:itemId},select:{kind:true,sourceEntries:{where:{...evidenceWhere,curriculumRole:'core_kanji'},take:1,select:{id:true}}}});
 if(!item)throw new ReviewError('Item unavailable',404);
 const cards=await db.card.findMany({where:{userId,itemId},select:{objective:true,status:true},take:10});
 const expected=item.kind==='kanji'?(item.sourceEntries.length?['kanji_meaning']:[]):[item.kind==='grammar'?'grammar_cloze':'vocab_reading_meaning'];
 return {introducedAt:learner?.introducedAt?.toISOString()||null,waiting:cards.filter(c=>c.status==='new').length,active:cards.filter(c=>c.status==='active').length,paused:cards.filter(c=>['suspended','retired'].includes(c.status)).length,missing:expected.filter(o=>!cards.some(c=>c.objective===o)),optional:item.kind==='kanji'&&!expected.length};
}
export async function markStudied(db,userId,itemId,now=new Date()) {
 uuid.parse(itemId);
 await locked(db,userId,async tx=>{
  if(!await tx.item.findFirst({where:{id:itemId,status:'approved'},select:{id:true}}))throw new ReviewError('Approved item unavailable',404);
  const learner=await tx.userItem.findUnique({where:{userId_itemId:{userId,itemId}}});
  await tx.userItem.upsert({where:{userId_itemId:{userId,itemId}},create:{userId,itemId,familiarity:'introduced',introducedAt:now},update:{...(!learner?.introducedAt?{introducedAt:now}:{}),...(learner?.familiarity==='unseen'?{familiarity:'introduced'}:{})}});
 });
 // Preparation is source-gated and dormant; retries never recreate retired objectives.
 await syncCards(db,userId,now,[itemId]);
 return studyStatus(db,userId,itemId);
}
export async function updateCaps(db,userId,values) {
 const caps=capsSchema.parse(values);
 return locked(db,userId,async(tx,user)=>{
  await tx.user.update({where:{id:userId},data:{settingsJson:{...user.settingsJson,dailyReviewCaps:caps}}});
  return {caps};
 });
}
async function poolSummary(tx,user,now){
 const day=studyDay(now,user.timezone);
 const [row]=await tx.$queryRaw`WITH pool AS (
  SELECT ui."introducedAt",i.kind,
   CASE WHEN i.kind='kanji' THEN CASE WHEN EXISTS(SELECT 1 FROM source_entries se WHERE se."itemId"=i.id AND se."curriculumRole"='core_kanji' AND se."verificationStatus"='verified') THEN 1 ELSE 0 END ELSE 1 END expected,
   count(c.id)::int objectives,count(c.id) FILTER(WHERE c.status='new')::int waiting,
   count(c.id) FILTER(WHERE c.status='active')::int active
  FROM user_items ui JOIN items i ON i.id=ui."itemId" LEFT JOIN cards c ON c."itemId"=i.id AND c."userId"=ui."userId"
  WHERE ui."userId"=${user.id}::uuid AND ui."introducedAt" IS NOT NULL AND i.status='approved'
  GROUP BY ui."itemId",ui."introducedAt",i.id,i.kind
 ) SELECT count(*) FILTER(WHERE ("introducedAt" AT TIME ZONE ${user.timezone})::date=${day}::date)::int AS "studiedToday",
 count(*) FILTER(WHERE waiting>0)::int AS "waitingItems",COALESCE(sum(waiting),0)::int AS "waitingObjectives",
 count(*) FILTER(WHERE waiting>0 AND active>0)::int AS "partialItems",
 count(*) FILTER(WHERE objectives<expected OR expected=0)::int AS "blockedItems",
 COALESCE(sum(GREATEST(expected-objectives,0)),0)::int AS "missingObjectives" FROM pool`;
 return row;
}
export async function dashboard(db,userId=LOCAL_USER_ID,now=new Date()) {
 const progress={};
 for(const kind of ['vocabulary','kanji','grammar']){
  const membership=kind==='kanji'?{curriculumRole:'core_kanji'}:{OR:[{curriculumRole:null},{curriculumRole:{not:'context_reference'}}],source:{sourceType:'book'}};
  const where={kind,status:'approved',sourceEntries:{some:{verificationStatus:'verified',successor:null,...membership}}};
  progress[kind]={total:await db.item.count({where}),introduced:await db.item.count({where:{...where,userItems:{some:{userId,introducedAt:{not:null}}}}})};
 }
 const user=await db.user.findUnique({where:{id:userId}});
 if(!user)return {activity:summarizeActivity([],now),progress,studiedToday:0,waitingItems:0,waitingObjectives:0,partialItems:0,blockedItems:0,missingObjectives:0,caps:{...DEFAULT_CAPS},waitingFirstRecall:0,reviewMoreAvailable:false,reviewCount:0,actionableDue:0,due:0,buriedDue:0,deferred:0,contentGaps:0,used:{vocabulary:0,kanji:0,grammar:0},limits:{...DEFAULT_CAPS},timeBudgetMinutes:30,sessionId:null};
 return locked(db,userId,async(tx,u)=>{
  const chosen=await dailyQueue(tx,u,now);
  const dueCount=await tx.card.count({where:{userId,status:'active',dueAt:{lte:now},item:{status:'approved'}}});
  const notDue=await tx.card.count({where:{userId,status:'active',dueAt:{gt:now},...eligible(now)}});
  const active=await tx.studySession.findFirst({where:{userId,mode:'daily',status:{in:['active','paused']}},orderBy:{startedAt:'desc'}});
  const view=active&&sameStudyDay(active,u,now)?await viewInTransaction(tx,u,active,now):null;
  const actionableDue=await tx.card.count({where:{userId,status:'active',dueAt:{lte:now},...eligible(now)}});
  const missingGrammar=await tx.item.count({where:{kind:'grammar',status:'approved',cards:{none:{userId,objective:'grammar_cloze',status:{not:'retired'}}}}});
  const pool=await poolSummary(tx,u,now),caps=userCaps(u);
  return {activity:await activitySummary(tx,u,now),progress,...pool,caps,waitingFirstRecall:pool.waitingObjectives,reviewMoreAvailable:notDue>0,reviewCount:view?.card?view.total-view.completed-view.deferred:chosen.length,sessionId:view?.card?active.id:null,sessionStatus:active?.status,due:dueCount,actionableDue,buriedDue:dueCount-actionableDue,deferred:view?.deferred||0,contentGaps:missingGrammar,used:await answeredToday(tx,u,now),limits:caps,timeBudgetMinutes:u.settingsJson.timeBudgetMinutes||30};
 });
}
