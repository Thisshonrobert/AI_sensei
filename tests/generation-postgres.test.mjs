import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { createServer } from 'node:http';
import { generateDraft } from '../src/lib/server/generation/service.mjs';
import { createUser,LOCAL_USER_ID } from '../src/lib/server/review/service.mjs';
import { exportPrompt,importDraft,approveDraft,generationView,retireRun,saveContext,savedContexts,generationPoolCount,generationList } from '../src/lib/server/generation/service.mjs';
import { startAssessment,assessmentView,beginReading,saveAnswer,submitAssessment } from '../src/lib/server/assessment/service.mjs';
const enabled=!!process.env.GENERATION_TEST_URL;
const db=enabled?new PrismaClient({datasourceUrl:process.env.GENERATION_TEST_URL,errorFormat:'minimal'}):null;
test.after(()=>db?.$disconnect());
async function fixture(local=false,ownerId,meaning='eat',kind='vocabulary'){
 const user=await createUser(db,ownerId||(local?LOCAL_USER_ID:randomUUID())),id=randomUUID(),sourceId=randomUUID(),e=randomUUID();
 const typed=kind==='grammar'?{pattern:'〜もの',patternVariantsJson:[],explanationJa:null,explanationEn:meaning,nuance:null,formationRulesJson:[],usageJson:{}}:{writtenForm:'食べる',reading:'たべる',partOfSpeech:'verb',senseKey:id,meaningEn:meaning,acceptedGlossesJson:[],alternativeFormsJson:[],usageJson:{}};
 const fieldOriginsJson=Object.fromEntries(Object.keys(typed).map(k=>[k,e]));
 await db.$transaction(async tx=>{
  await tx.source.create({data:{id:sourceId,title:'Synthetic generation source',sourceType:'book',language:'ja'}});
  await tx.item.create({data:{id,kind,canonicalKey:id,status:'approved',revision:1,fieldOriginsJson}});
  await tx[kind].create({data:{itemId:id,...typed}});
  await tx.sourceEntry.create({data:{id:e,itemId:id,sourceId,sourceRecordKey:id,revision:1,originalPayloadJson:{synthetic:true},fieldPresenceJson:{},verificationStatus:'verified',verifiedAt:new Date()}});
  await tx.itemRevision.create({data:{itemId:id,revision:1,typedJson:typed,fieldOriginsJson}});
  await tx.userItem.create({data:{userId:user.id,itemId:id,introducedAt:new Date(),familiarity:'introduced'}});
 });
 return {user,id};
}
const draft=id=>({version:1,kind:'sentence',title:'A meal',japanese:'食べる。',translation:'Eat.',uses:[{itemId:id,start:0,end:3,reading:'たべる',sense:'eat'}],support:[],issues:[],omissions:[],questions:[]});
const providerDraft=id=>({...draft(id),kind:'passage',uses:[{itemId:id,quote:'食べる',occurrence:0,reading:'たべる',sense:'eat'}],sentences:[{quote:'食べる。',occurrence:0,translation:'Eat.'}],questions:[0,1].map(i=>({prompt:`Meal question ${i}`,targetIds:[id],options:[{label:'A',text:'Eating'},{label:'B',text:'Sleeping'}],answer:'A',explanation:'Eating is in the passage.',evidence:{quote:'食べる',occurrence:0}}))});
test('generation allows ten requests per rolling day and rejects the eleventh',{skip:!enabled},async t=>{
 const f=await fixture(),input={purpose:'passage',topic:'Synthetic quota',targetIds:[f.id]};
 const runs=[];for(let i=0;i<10;i++)runs.push(await exportPrompt(db,f.user.id,input,'gemini'));
 await assert.rejects(()=>exportPrompt(db,f.user.id,input,'gemini'),e=>e.status===429&&/Ten generation requests/.test(e.message));
 assert.equal(await db.generationRun.count({where:{userId:f.user.id,provider:'gemini'}}),10);
 const later=Date.now()+25*3600000;t.mock.method(Date,'now',()=>later);
 assert.ok((await exportPrompt(db,f.user.id,input,'gemini')).id);
});
test('automatic practice uses the entire eligible pool with a bounded sentence target and preserves study state',{skip:!enabled},async()=>{
 const f=await fixture(),before=await db.userItem.findMany({where:{userId:f.user.id}});
 const run=await exportPrompt(db,f.user.id,{purpose:'sentence',topic:'Automatic meal'});
 assert.deepEqual(run.scope.targets.map(t=>t.id),[f.id]);
 assert.deepEqual(await db.userItem.findMany({where:{userId:f.user.id}}),before);
 for(let i=0;i<9;i++)await fixture(false,f.user.id);
 const excluded=await fixture(false,f.user.id);
 await db.userItem.update({where:{userId_itemId:{userId:f.user.id,itemId:excluded.id}},data:{excludedFromTests:true}});
 assert.equal(await generationPoolCount(db,f.user.id),10);
 const reading=await exportPrompt(db,f.user.id,{purpose:'passage',topic:'Automatic reading'});
 assert.equal(reading.scope.targets.length,10);
 assert.equal(reading.scope.support.length,0);
 assert.ok(![...reading.scope.targets,...reading.scope.support].some(t=>t.id===excluded.id));
 await assert.rejects(()=>exportPrompt(db,randomUUID(),{purpose:'sentence',topic:'Empty pool'}));
});
test('Gemini coordinator bounds corrections, retains AI review as draft and stops quota failures',{skip:!enabled},async()=>{
 const f=await fixture(),prior=Object.fromEntries(['GEMINI_API_KEY','GEMINI_MODEL','GEMINI_FREE_TIER_CONFIRMED'].map(k=>[k,process.env[k]]));
 Object.assign(process.env,{GEMINI_API_KEY:'synthetic-key',GEMINI_MODEL:'gemini-3.1-flash-lite',GEMINI_FREE_TIER_CONFIRMED:'true'});
 let calls=0,quota=false;const server=createServer(async(req,res)=>{
  for await(const chunk of req){void chunk;}calls++;
  if(quota){res.writeHead(429);res.end('{}');return;}
  const output=calls===1?{invalid:true}:calls===2?providerDraft(f.id):{verdict:'acceptable_for_ungraded_practice',summary:'Synthetic language review',findings:[]};
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(output)}]}}]}));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const options={endpoint:`http://127.0.0.1:${server.address().port}`},input={purpose:'passage',topic:'Meal',targetIds:[f.id],review:true};
  const result=await generateDraft(db,f.user.id,input,options);
  assert.equal(calls,3);assert.equal(result.status,'draft');assert.equal(result.report.providerReport.scoredEligible,false);
  assert.equal(result.report.providerReport.failures.length,1);assert.equal(result.report.providerReport.modelReview.verdict,'acceptable_for_ungraded_practice');
  assert.equal(await db.content.count({where:{generationRunId:result.id,status:'approved'}}),0);
  quota=true;await assert.rejects(()=>generateDraft(db,f.user.id,input,options),e=>e.status===429);assert.equal(calls,4);
  assert.equal(await db.generationRun.count({where:{userId:f.user.id,status:'failed'}}),1);
  assert.ok((await generationList(db,f.user.id)).every(r=>r.status!=='failed'&&r.status!=='exported'));
  assert.equal(await db.card.count({where:{userId:f.user.id}}),0);
 }finally{await new Promise(resolve=>server.close(resolve));for(const [k,v]of Object.entries(prior)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});
test('a recent 85-item study week is included with older revision, without changing introduction dates',{skip:!enabled},async()=>{
 const f=await fixture();
 for(let n=1;n<85;n++)await fixture(false,f.user.id,'Synthetic source explanation. '.repeat(40));
 const recent=await db.userItem.findMany({where:{userId:f.user.id},orderBy:{itemId:'asc'},select:{itemId:true,introducedAt:true}});
 const old=[];for(let n=0;n<5;n++){const item=await fixture(false,f.user.id);old.push(item.id);await db.userItem.update({where:{userId_itemId:{userId:f.user.id,itemId:item.id}},data:{introducedAt:new Date(Date.now()-70*86400000)}});}
 const r=await exportPrompt(db,f.user.id,{purpose:'passage',topic:'A cumulative week'});
 assert.equal(r.scope.targets.length,90);
 assert.ok(r.prompt.length<=40000);
 assert.ok(recent.every(item=>r.scope.targets.some(t=>t.id===item.itemId)));
 assert.ok(old.every(id=>r.scope.targets.some(t=>t.id===id)));
 assert.match(r.prompt,/1–15 sentence lines/);
 assert.deepEqual(await db.userItem.findMany({where:{userId:f.user.id,itemId:{in:recent.map(i=>i.itemId)}},orderBy:{itemId:'asc'},select:{itemId:true,introducedAt:true}}),recent);
});
test('zero baseline export and draft import preserve canonical and learner state; retries and ownership enforced',{skip:!enabled},async()=>{
 const f=await fixture(),before=await db.item.findUnique({where:{id:f.id},include:{vocabulary:true}});
 const run=await exportPrompt(db,f.user.id,{purpose:'sentence',topic:'A meal',targetIds:[f.id]});
 assert.equal(run.scope.targets.length,1);assert.equal(run.provider,'manual-import');assert.equal(run.modelId,'unknown');
 assert.match(run.prompt,/untrusted/i);
 await assert.rejects(()=>generationView(db,randomUUID(),run.id));
 const imported=await importDraft(db,f.user.id,run.id,draft(f.id));
 await importDraft(db,f.user.id,run.id,draft(f.id));assert.equal(await db.content.count({where:{generationRunId:run.id}}),1);
 await assert.rejects(()=>importDraft(db,f.user.id,run.id,{...draft(f.id),translation:'Changed'}));
 assert.deepEqual(await db.item.findUnique({where:{id:f.id},include:{vocabulary:true}}),before);
 assert.equal(await db.card.count({where:{userId:f.user.id}}),0);assert.equal(await db.reviewLog.count({where:{userId:f.user.id}}),0);
 assert.equal(imported.status,'draft');
});
test('malformed generation is retained as failure and cannot publish; review still starts',{skip:!enabled},async()=>{
 const f=await fixture(),run=await exportPrompt(db,f.user.id,{purpose:'sentence',topic:'Meal',targetIds:[f.id]});
 await assert.rejects(()=>importDraft(db,f.user.id,run.id,{...draft(f.id),origin:'book'}));
 assert.equal((await generationView(db,f.user.id,run.id)).status,'failed');
 const {startSession}=await import('../src/lib/server/review/service.mjs');assert.ok((await startSession(db,f.user.id,{includeNew:false})).id);
 await assert.rejects(()=>approveDraft(db,f.user.id,run.id,{confirmation:'x',reviewer:'test',dispositions:[],acceptUntracked:true,languageReviewed:true,answersReviewed:true}));
});
test('human publication appends exact approval once; retirement keeps drafts and accepted evidence',{skip:!enabled},async()=>{
 const f=await fixture(),run=await exportPrompt(db,f.user.id,{purpose:'sentence',topic:'Meal',targetIds:[f.id]});
 let v=await importDraft(db,f.user.id,run.id,draft(f.id));
 const approval={confirmation:v.hash,reviewer:'synthetic reviewer',dispositions:[],acceptUntracked:true,languageReviewed:true,answersReviewed:true};
 assert.equal(v.report.analyzerStatus,'ready');await assert.rejects(()=>approveDraft(db,f.user.id,run.id,{...approval,confirmation:'f'.repeat(64)}));
 v=await approveDraft(db,f.user.id,run.id,approval);assert.equal(v.status,'approved');
 await approveDraft(db,f.user.id,run.id,approval);assert.equal(await db.content.count({where:{generationRunId:run.id,status:'approved'}}),1);
 await retireRun(db,f.user.id,run.id,'Incorrect translation');assert.equal((await generationView(db,f.user.id,run.id)).status,'retired');
 assert.equal(await db.content.count({where:{generationRunId:run.id}}),3);
});
test('expanded passages can retain every finding at the 240-use bound',{skip:!enabled},async()=>{
 const f=await fixture(false,undefined,'Synthetic grammar','grammar'),r=await exportPrompt(db,f.user.id,{purpose:'sentence',topic:'Capacity check',targetIds:[f.id]});
 const p={...draft(f.id),japanese:'もの、'.repeat(240)+'。',uses:Array.from({length:240},(_,i)=>({itemId:f.id,start:i*3,end:i*3+2,reading:'ねる',sense:'synthetic deliberately flagged reading'}))};
 let v=await importDraft(db,f.user.id,r.id,p);
 assert.ok(v.report.problems.length>100);
 const approval={confirmation:v.hash,reviewer:'Synthetic capacity reviewer',dispositions:v.report.problems.map(p=>({key:p.key,resolution:'checked_explanation',reason:'Synthetic reviewed evidence'})),acceptUntracked:true,languageReviewed:true,answersReviewed:false};
 await assert.rejects(()=>approveDraft(db,f.user.id,r.id,{...approval,dispositions:approval.dispositions.slice(0,100)}));
 v=await approveDraft(db,f.user.id,r.id,approval);assert.equal(v.status,'approved');
 assert.equal(v.report.approval.dispositions.length,480);
});
test('browser fixtures',{skip:!enabled||!process.env.GENERATION_BROWSER_TEST},async()=>{await fixture(true);});

test('saved contexts deduplicate with revision/ownership guards and no canonical or FSRS changes',{skip:!enabled},async()=>{
 const f=await fixture(),r=await exportPrompt(db,f.user.id,{purpose:'sentence',topic:'Meal',targetIds:[f.id]});
 let v=await importDraft(db,f.user.id,r.id,draft(f.id));const input={runId:r.id,itemId:f.id,revision:1,sentenceId:'sentence-0'};
 await assert.rejects(()=>saveContext(db,f.user.id,input));
 v=await approveDraft(db,f.user.id,r.id,{confirmation:v.hash,reviewer:'fixture',dispositions:v.report.problems.map(p=>({key:p.key,resolution:'checked_explanation',reason:'Synthetic reviewed evidence'})),acceptUntracked:true,languageReviewed:true,answersReviewed:false});
 const accepted={...input,revision:v.revision};await saveContext(db,f.user.id,accepted);await saveContext(db,f.user.id,accepted);
 assert.equal((await savedContexts(db,f.user.id,f.id)).length,1);await assert.rejects(()=>saveContext(db,randomUUID(),accepted));
 await assert.rejects(()=>saveContext(db,f.user.id,{...accepted,revision:1}));assert.equal(await db.card.count({where:{userId:f.user.id}}),0);assert.equal(await db.reviewLog.count({where:{userId:f.user.id}}),0);
});
test('only human-approved generated questions enter scoring; retirement excludes historical grades without erasing attempts',{skip:!enabled},async()=>{
 const f=await fixture(),other=await fixture();await db.userItem.create({data:{userId:f.user.id,itemId:other.id,introducedAt:new Date(),familiarity:'introduced'}});
 const r=await exportPrompt(db,f.user.id,{purpose:'passage',topic:'Meals',targetIds:[f.id,other.id]});
 const p={...draft(f.id),kind:'passage',japanese:'食べる。食べる。',translation:'Eat. Eat.',uses:[{itemId:f.id,start:0,end:3,reading:'たべる',sense:'eat'},{itemId:other.id,start:4,end:7,reading:'たべる',sense:'eat'}],questions:[f.id,other.id].map((id,i)=>({prompt:`Synthetic comprehension ${i}`,targetIds:[id],options:[{label:'A',text:'Eating'},{label:'B',text:'Sleeping'}],answer:'A',explanation:'Synthetic passage-supported answer',evidence:{start:i*4,end:i*4+3}}))};
 let v=await importDraft(db,f.user.id,r.id,p);await assert.rejects(()=>startAssessment(db,f.user.id));
 v=await approveDraft(db,f.user.id,r.id,{confirmation:v.hash,reviewer:'fixture',dispositions:v.report.problems.map(p=>({key:p.key,resolution:'checked_explanation',reason:'Synthetic reviewed evidence'})),acceptUntracked:true,languageReviewed:true,answersReviewed:true});
 const now=new Date(Date.now()+1000),s=await startAssessment(db,f.user.id,{now});await beginReading(db,f.user.id,s.id,now);const view=await assessmentView(db,f.user.id,s.id,now);assert.equal(view.questions.length,2);
 for(const q of view.questions)await saveAnswer(db,f.user.id,{sessionId:s.id,questionId:q.id,clientEventId:randomUUID(),answer:{response:'A'}},now);
 assert.equal((await submitAssessment(db,f.user.id,s.id,now)).summary.graded,2);await retireRun(db,f.user.id,r.id,'Wrong generated answer');
 const after=await assessmentView(db,f.user.id,s.id,now);assert.equal(after.summary.graded,0);assert.ok(after.results.every(q=>q.invalidQuestion));
 const evidence=await db.attempt.findMany({where:{sessionId:s.id}});assert.equal(evidence.length,2);assert.ok(evidence.every(a=>a.outcome==='correct'));
 await assert.rejects(()=>startAssessment(db,f.user.id,{now:new Date(+now+1000)}));
});
