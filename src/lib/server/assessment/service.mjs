import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { selectAssessment } from './selection.mjs';
import { questionSchema } from './bank.mjs';
import { normalizeReading } from '../review/service.mjs';
import { studyDay } from '../review/scheduler.mjs';
const uuid=z.string().uuid();
export class AssessmentError extends Error {constructor(message,status=409){super(message);this.status=status;}}
async function locked(db,userId,work){
 uuid.parse(userId);
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM users WHERE id=${userId}::uuid FOR UPDATE`;
  const user=await tx.user.findUnique({where:{id:userId}});if(!user)throw new AssessmentError('User ownership unavailable',403);
  return work(tx,user);
 },{timeout:30000,maxWait:30000});
}
async function owned(tx,userId,id){uuid.parse(id);const s=await tx.studySession.findFirst({where:{id,userId,mode:{in:['weekly','test','practice']}}});if(!s)throw new AssessmentError('Assessment ownership mismatch',403);return s;}
async function pool(tx,user,now){
 const rows=await tx.userItem.findMany({where:{userId:user.id,excludedFromTests:false,item:{status:'approved'},OR:[{introducedAt:{lt:now}},{baselineStatus:{in:['assumed','verified']}}]},orderBy:{itemId:'asc'},take:2000,select:{itemId:true,introducedAt:true,baselineStatus:true,needsAttention:true,item:{select:{kind:true,status:true}}}});
 const ids=rows.map(r=>r.itemId);
 if(!ids.length)return {items:[],questions:[],passages:[],bounded:false};
 const history=await tx.$queryRaw`SELECT "primaryTargetItemId" AS id,
  max(a."submittedAt") FILTER (WHERE s.mode IN ('weekly','test')) AS "lastAssessedAt",
  max(a."submittedAt") FILTER (WHERE a.outcome='incorrect' AND a."submittedAt">=${new Date(+now-30*86400000)}) AS "lastFailureAt",
  count(*) FILTER (WHERE a.outcome='incorrect' AND a."submittedAt">=${new Date(+now-30*86400000)})::int AS "recentFailures"
  FROM attempts a JOIN study_sessions s ON s.id=a."sessionId" WHERE a."userId"=${user.id}::uuid AND a."primaryTargetItemId"=ANY(${ids}::uuid[]) AND a."submittedAt"<${now} AND s.mode<>'practice' GROUP BY a."primaryTargetItemId"`;
 const exposure=await tx.reviewLog.findMany({where:{userId:user.id,reviewedAt:{gte:new Date(+now-48*3600000),lte:now}},take:2000,select:{reviewedAt:true,card:{select:{itemId:true}}}});
 const items=rows.map(r=>({id:r.itemId,...r.item,introducedAt:r.introducedAt?.toISOString()||null,baselineStatus:r.baselineStatus,needsAttention:r.needsAttention,...history.find(h=>h.id===r.itemId),reviewedToday:exposure.some(e=>e.card.itemId===r.itemId&&studyDay(e.reviewedAt,user.timezone)===studyDay(now,user.timezone))}));
 const contents=await tx.content.findMany({where:{kind:'question',status:'approved',successor:null,origin:{in:['book','user']},items:{some:{role:'target',itemId:{in:ids}},every:{OR:[{role:{not:'target'}},{itemId:{in:ids}}]}}},orderBy:{id:'asc'},take:1000,select:{id:true,revision:true,origin:true,payloadJson:true,parentContentId:true,items:{select:{itemId:true,role:true}},sourceEntries:{take:8,select:{sourceId:true,verificationStatus:true}}}});
 const prior=await tx.$queryRaw`SELECT "contentId" AS id,max(a."submittedAt") FILTER (WHERE s.mode IN ('weekly','test')) AS "lastQuestionAt",bool_or(a."feedbackJson"->>'repairRequested'='true') AS "repairRequested" FROM attempts a JOIN study_sessions s ON s.id=a."sessionId" WHERE a."userId"=${user.id}::uuid AND s.mode IN ('weekly','test','practice') AND a."contentId" IS NOT NULL AND a."submittedAt"<${now} GROUP BY a."contentId"`;
 const questions=[];
 for(const c of contents){
  const parsed=questionSchema.safeParse(c.payloadJson.assessment);if(!parsed.success||c.payloadJson.answerVerified!==true||c.payloadJson.targetsVerified!==true||prior.some(h=>h.id===c.id&&h.repairRequested))continue;
  const q=parsed.data,targets=c.items.filter(l=>l.role==='target').map(l=>l.itemId);
  if(q.id!==c.id||q.passageId!== (c.parentContentId||undefined)||q.targetIds.length!==targets.length||q.targetIds.some(id=>!targets.includes(id)))continue;
  if(c.origin==='book'&&!c.sourceEntries.some(e=>e.verificationStatus==='verified'))continue;
  questions.push({...q,targetKind:items.find(i=>i.id===q.primaryTargetItemId)?.kind,baselineCheck:!items.find(i=>i.id===q.primaryTargetItemId)?.introducedAt,revision:c.revision,origin:c.origin,sourceIds:c.sourceEntries.map(e=>e.sourceId),lastQuestionAt:prior.find(h=>h.id===c.id)?.lastQuestionAt?.toISOString()||null});
 }
 const passages=await tx.content.findMany({where:{id:{in:[...new Set(questions.map(q=>q.passageId).filter(Boolean))]},kind:'passage',status:'approved',successor:null,origin:{in:['book','user']}},take:100,select:{id:true,revision:true,origin:true,payloadJson:true,items:{select:{itemId:true,role:true}},sourceEntries:{take:8,select:{verificationStatus:true}}}});
 const validPassages=passages.filter(p=>p.payloadJson.assessment?.supportingReviewed===true&&p.payloadJson.assessment?.unresolved===false&&typeof p.payloadJson.assessment?.japanese==='string'&&p.items.filter(l=>l.role==='target').every(l=>ids.includes(l.itemId))&&(p.origin!=='book'||p.sourceEntries.some(e=>e.verificationStatus==='verified'))).map(p=>({id:p.id,revision:p.revision,origin:p.origin,...p.payloadJson.assessment}));
 // Passage links constrain eligibility; only each question's directly assessed targets consume slots.
 const validQuestions=questions.filter(q=>!q.passageId||validPassages.some(p=>p.id===q.passageId)).map(q=>q.passageId?{...q,exposesItemIds:[...new Set([...q.exposesItemIds,...validPassages.find(p=>p.id===q.passageId).exposesItemIds])]}:q);
 return {items,questions:validQuestions,passages:validPassages,bounded:rows.length===2000||contents.length===1000||exposure.length===2000};
}
export async function startAssessment(db,userId,options={}){
 const {now=new Date(),size=20,domain='mixed',readingMinutes=5}=options;
 z.number().int().min(1).max(20).parse(size);z.enum(['mixed','vocabulary','kanji','grammar']).parse(domain);z.number().int().min(1).max(15).parse(readingMinutes);
 return locked(db,userId,async(tx,user)=>{
  const prior=await tx.studySession.findFirst({where:{userId,mode:{in:['weekly','test']},status:'active'},select:{id:true}});if(prior)return prior;
  const p=await pool(tx,user,now),selection=selectAssessment({...p,now,seed:randomUUID(),size,domain});
  if(!selection.questions.length)throw new AssessmentError('No approved questions with eligible introduced or enabled baseline targets are available.',422);
  if(p.bounded)selection.omissions.push('Selection uses the bounded pilot bank (2,000 targets / 1,000 questions).');
  const snapshot={...selection,startedAt:now.toISOString(),readingMinutes,furigana:'off',passages:p.passages.filter(p=>selection.questions.some(q=>q.passageId===p.id))};
  const s=await tx.studySession.create({data:{userId,mode:domain==='mixed'?'weekly':'test',startedAt:now,selectionSeed:selection.seed,selectionSnapshotJson:snapshot,timeBudgetMinutes:30,assessmentResultJson:{timing:null}}});
  for(const [order,q] of selection.questions.entries())await tx.sessionItem.create({data:{sessionId:s.id,itemId:q.primaryTargetItemId,role:'test',order}});
  return {id:s.id};
 });
}
function timing(s,now){const t=s.assessmentResultJson?.timing;return t?{...t,expired:t.expired||+now>+new Date(t.deadline),remainingMs:Math.max(0,+new Date(t.deadline)-+now)}:null;}
async function view(tx,userId,s,now){
 const snap=s.selectionSnapshotJson,done=s.status==='completed',t=timing(s,done?s.endedAt:now);
 const attempts=await tx.attempt.findMany({where:{sessionId:s.id,userId},take:20,select:{contentId:true,answerJson:true,outcome:true,feedbackJson:true,hintUsed:true}});
 const visible=snap.questions.filter(q=>q.domain!=='reading'||t||done||s.mode==='practice');
 const results=done?snap.questions.map(q=>{const a=attempts.find(a=>a.contentId===q.id);return {questionId:q.id,primaryTargetItemId:q.primaryTargetItemId,targetKind:q.targetKind,domain:q.domain,objective:q.objective,prompt:q.prompt,rubric:q.rubric,outcome:a?.outcome||'ungraded',answer:a?.answerJson||{},assisted:!!a?.hintUsed,expired:q.domain==='reading'&&!!t?.expired,canSelfGrade:q.rubric.mode==='self'&&!a?.feedbackJson?.graded&&!!a?.answerJson?.response&&!(q.domain==='reading'&&t?.expired),canReport:!!a&&!a.feedbackJson.repairRequested,repairRequested:!!a?.feedbackJson.repairRequested,sourceIds:q.sourceIds||[],origin:q.origin};}):[];
 const graded=results.filter(r=>r.outcome!=='ungraded'&&!r.assisted&&!r.expired),correct=graded.filter(r=>r.outcome==='correct').length;
 return {sessionId:s.id,status:s.status,mode:s.mode,total:snap.questions.length,requestedSize:snap.requestedSize,coverage:snap.coverage,omissions:snap.omissions,readingMinutes:snap.readingMinutes,timing:t,furigana:snap.furigana,
  questions:visible.map(q=>({id:q.id,prompt:q.prompt,format:q.format,options:q.options,domain:q.domain,objective:q.objective,primaryTargetItemId:q.primaryTargetItemId,stratum:q.stratum,baselineCheck:q.baselineCheck,recentExposure:q.recentExposure,answer:attempts.find(a=>a.contentId===q.id)?.answerJson||null})),
  reading:(t||done||s.mode==='practice')?(snap.passages[0]?{id:snap.passages[0].id,title:snap.passages[0].title,japanese:snap.passages[0].japanese,origin:snap.passages[0].origin}:null):null,
  readyForReading:s.mode!=='practice'&&!t&&snap.questions.some(q=>q.domain==='reading')&&snap.questions.filter(q=>q.domain!=='reading').every(q=>attempts.some(a=>a.contentId===q.id)),
  ...(done?{results,summary:{correct,graded:graded.length,ungraded:results.filter(r=>r.outcome==='ungraded').length,assisted:results.filter(r=>r.assisted).length,expired:results.filter(r=>r.expired).length},repairTargets:[...new Set(results.filter(r=>r.outcome==='incorrect').map(r=>r.primaryTargetItemId))].slice(0,3)}:{})};
}
export async function assessmentView(db,userId,id,now=new Date()){return locked(db,userId,async tx=>view(tx,userId,await owned(tx,userId,id),now));}
export async function currentAssessment(db,userId){
 const s=await db.studySession.findFirst({where:{userId,mode:{in:['weekly','test']},status:'active'},select:{id:true}});
 return s?assessmentView(db,userId,s.id):null;
}
export async function assessmentAvailability(db,userId){
 const user=await db.user.findUnique({where:{id:userId}});if(!user)return {count:0,domains:{vocabulary:0,kanji:0,grammar:0,mixed:0}};
 const now=new Date(),p=await pool(db,user,now);
 const domains=Object.fromEntries(['mixed','vocabulary','kanji','grammar'].map(domain=>[domain,selectAssessment({...p,now,seed:'availability',domain,size:20}).questions.length]));
 return {count:domains.mixed,domains};
}
export async function beginReading(db,userId,id,now=new Date()){
 return locked(db,userId,async tx=>{
  const s=await owned(tx,userId,id);if(s.status!=='active')throw new AssessmentError('Test already submitted');
  if(s.assessmentResultJson?.timing||s.mode==='practice')return view(tx,userId,s,now);
  const v=await view(tx,userId,s,now);if(!v.readyForReading)throw new AssessmentError('Commit short answers before timed reading');
  const t={startedAt:now.toISOString(),deadline:new Date(+now+s.selectionSnapshotJson.readingMinutes*60000).toISOString(),expired:false,assisted:false};
  const updated=await tx.studySession.update({where:{id},data:{assessmentResultJson:{timing:t}}});return view(tx,userId,updated,now);
 });
}
const answerSchema=z.object({sessionId:uuid,questionId:uuid,clientEventId:uuid,answer:z.object({response:z.string().trim().min(1).max(2000),reading:z.string().max(500).optional()}).strict()}).strict();
export async function saveAnswer(db,userId,input,now=new Date()){
 const data=answerSchema.parse(input);
 return locked(db,userId,async tx=>{
  const s=await owned(tx,userId,data.sessionId),q=s.selectionSnapshotJson.questions.find(q=>q.id===data.questionId);
  if(!q)throw new AssessmentError('Question is outside the frozen selection');
  const prior=await tx.attempt.findFirst({where:{userId,OR:[{sessionId:s.id,contentId:q.id},{clientEventId:data.clientEventId}]}});
  if(prior){if(prior.sessionId!==s.id||prior.contentId!==q.id||prior.clientEventId!==data.clientEventId||!isDeepStrictEqual(prior.answerJson,data.answer))throw new AssessmentError('Answer is already committed; resume the saved response');return view(tx,userId,s,now);}
  if(s.status!=='active')throw new AssessmentError('Test already submitted');
  if(q.domain==='reading'&&s.mode!=='practice'){
   const t=timing(s,now);if(!t)throw new AssessmentError('Present the passage first');if(t.expired)throw new AssessmentError('Reading time expired. Submit the timed result, then continue as separate practice.');
  }
  if(q.rubric.mode==='choice'&&!q.options.some(o=>o.label===data.answer.response))throw new AssessmentError('Select an offered answer',400);
  if(q.objective==='vocab_reading_meaning'&&!data.answer.reading?.trim())throw new AssessmentError('Commit reading and meaning together',400);
  await tx.attempt.create({data:{userId,sessionId:s.id,contentId:q.id,primaryTargetItemId:q.primaryTargetItemId,clientEventId:data.clientEventId,promptSnapshotJson:q,answerJson:data.answer,grader:q.rubric.mode==='self'?'self':'rule',hintUsed:s.mode==='practice',startedAt:q.domain==='reading'&&s.mode!=='practice'?new Date(s.assessmentResultJson.timing.startedAt):s.startedAt,submittedAt:now}});
  return view(tx,userId,s,now);
 });
}
async function attention(tx,userId,q){await tx.userItem.updateMany({where:{userId,itemId:q.primaryTargetItemId},data:{needsAttention:true}});}
export async function submitAssessment(db,userId,id,now=new Date()){
 return locked(db,userId,async tx=>{
  const s=await owned(tx,userId,id);if(s.status==='completed')return view(tx,userId,s,now);
  const snap=s.selectionSnapshotJson,attempts=await tx.attempt.findMany({where:{userId,sessionId:id},take:20});
  const t=timing(s,now);
  if(snap.questions.some(q=>!attempts.some(a=>a.contentId===q.id)&&!(q.domain==='reading'&&t?.expired)))throw new AssessmentError('Commit every answer before submission');
  for(const q of snap.questions){const a=attempts.find(a=>a.contentId===q.id);if(!a)continue;
   const expired=q.domain==='reading'&&!!t?.expired;
   const outcome=expired||q.rubric.mode==='self'?'ungraded':q.rubric.acceptableAnswers.some(v=>q.rubric.mode==='reading'?normalizeReading(v)===normalizeReading(a.answerJson.response):v===a.answerJson.response)?'correct':'incorrect';
   await tx.attempt.update({where:{id:a.id},data:{outcome,feedbackJson:{graded:expired||q.rubric.mode!=='self',expired,rubric:q.rubric}}});
   if(outcome==='incorrect')await attention(tx,userId,q);
  }
  const finalTiming=t?{startedAt:t.startedAt,deadline:t.deadline,endedAt:now.toISOString(),elapsedMs:Math.max(0,+now-+new Date(t.startedAt)),expired:t.expired,assisted:s.mode==='practice'}:null;
  const updated=await tx.studySession.update({where:{id},data:{status:'completed',endedAt:now,assessmentResultJson:{timing:finalTiming,submittedAt:now.toISOString(),assisted:s.mode==='practice'}}});
  const report=await view(tx,userId,updated,now);
  await tx.studySession.update({where:{id},data:{assessmentResultJson:{...updated.assessmentResultJson,summary:report.summary,coverage:snap.coverage}}});
  return report;
 });
}
const gradeSchema=z.object({sessionId:uuid,questionId:uuid,outcome:z.enum(['correct','incorrect','ungraded']),components:z.object({readingCorrect:z.boolean(),meaningCorrect:z.boolean()}).strict().optional()}).strict();
export async function selfGrade(db,userId,input,now=new Date()){
 const data=gradeSchema.parse(input);
 return locked(db,userId,async tx=>{
  const s=await owned(tx,userId,data.sessionId),q=s.selectionSnapshotJson.questions.find(q=>q.id===data.questionId);
  if(s.status!=='completed'||q?.rubric.mode!=='self')throw new AssessmentError('Submit before self scoring');
  if(q.domain==='reading'&&s.assessmentResultJson?.timing?.expired)throw new AssessmentError('Expired reading remains ungraded; continue as practice');
  if(q.objective==='vocab_reading_meaning'&&data.outcome!=='ungraded'&&!data.components)throw new AssessmentError('Assess both reading and selected meaning',400);
  const a=await tx.attempt.findFirst({where:{sessionId:s.id,userId,contentId:q.id}});if(!a)throw new AssessmentError('Committed response unavailable');
  const outcome=data.outcome==='ungraded'?'ungraded':q.objective==='vocab_reading_meaning'?data.components.readingCorrect&&data.components.meaningCorrect?'correct':'incorrect':data.outcome;
  if(a.feedbackJson.graded){if(a.feedbackJson.selfOutcome!==data.outcome||!isDeepStrictEqual(a.feedbackJson.components||null,data.components||null))throw new AssessmentError('Final self score is already saved');return view(tx,userId,s,now);}
  await tx.attempt.update({where:{id:a.id},data:{outcome,feedbackJson:{...a.feedbackJson,graded:true,selfOutcome:data.outcome,components:data.components||null,repairRequested:data.outcome==='ungraded'}}});
  if(outcome==='incorrect')await attention(tx,userId,q);
  const report=await view(tx,userId,s,now);
  await tx.studySession.update({where:{id:s.id},data:{assessmentResultJson:{...s.assessmentResultJson,summary:report.summary}}});
  return report;
 });
}
export async function reportQuestion(db,userId,input,now=new Date()){
 const data=z.object({sessionId:uuid,questionId:uuid}).strict().parse(input);
 return locked(db,userId,async tx=>{
  const s=await owned(tx,userId,data.sessionId);if(s.status!=='completed')throw new AssessmentError('Submit before reporting a question');
  const a=await tx.attempt.findFirst({where:{userId,sessionId:s.id,contentId:data.questionId}});if(!a)throw new AssessmentError('Committed response unavailable');
  if(!a.feedbackJson.repairRequested)await tx.attempt.update({where:{id:a.id},data:{outcome:'ungraded',feedbackJson:{...a.feedbackJson,graded:true,repairRequested:true,originalOutcome:a.outcome,reportedAt:now.toISOString()}}});
  const report=await view(tx,userId,s,now);
  await tx.studySession.update({where:{id:s.id},data:{assessmentResultJson:{...s.assessmentResultJson,summary:report.summary}}});
  return report;
 });
}
export async function continuePractice(db,userId,id,now=new Date()){
 return locked(db,userId,async tx=>{
  const source=await owned(tx,userId,id);if(source.status!=='completed'||source.mode==='practice'||!source.selectionSnapshotJson.passages.length)throw new AssessmentError('Submit the timed reading first');
  const existing=await tx.studySession.findFirst({where:{userId,mode:'practice',selectionSnapshotJson:{path:['sourceSessionId'],equals:id}},select:{id:true}});if(existing)return existing;
  const questions=source.selectionSnapshotJson.questions.filter(q=>q.domain==='reading');
  const snapshot={...source.selectionSnapshotJson,sourceSessionId:id,questions,requestedSize:questions.length,coverage:{vocabulary:0,kanji:0,grammar:0,reading:questions.length},omissions:[]};
  const s=await tx.studySession.create({data:{userId,mode:'practice',startedAt:now,selectionSeed:source.selectionSeed,selectionSnapshotJson:snapshot,assessmentResultJson:{timing:null,assisted:true}}});
  return {id:s.id};
 });
}
