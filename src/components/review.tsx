'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Answer, ResponseInput, SessionView } from '@/lib/server/review/service.mjs';

const labels:Record<string,string>={vocab_reading_meaning:'Vocabulary · reading + meaning',kanji_meaning:'Core kanji · meaning',kanji_reading_context:'Core kanji · whole-word reading',grammar_cloze:'Grammar · contextual cloze'};
async function call<T>(body?:unknown):Promise<T>{
 const result=await fetch('/api/review',body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});
 const data=await result.json();if(!result.ok)throw new Error(data.error||'Could not save. Retry or resume.');return data;
}
function AnswerView({answer}: {answer:Answer}) {return <div className="content-block" data-testid="revealed-answer"><h2>Answer</h2>{answer.reading&&<p lang="ja" className="japanese sentence">{answer.reading}</p>}{answer.meaning&&<p>{answer.meaning}</p>}{answer.response&&<p lang="ja" className="japanese">{answer.response}</p>}{answer.acceptedGlosses?.length!==0&&answer.acceptedGlosses&&<p className="muted">Accepted glosses: {answer.acceptedGlosses.join('; ')}</p>}{answer.alternatives?.length!==0&&answer.alternatives&&<p>Accepted alternatives: {answer.alternatives.join('; ')}</p>}</div>;}
export function Review(){
 const [view,setView]=useState<(SessionView & {contentGaps?:number})|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [answer,setAnswer]=useState<Answer>({}),[teaching,setTeaching]=useState<Answer|null>(null),[components,setComponents]=useState<Record<string,boolean>>({});
 const event=useRef<string|null>(null);const heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{call<SessionView|null>().then(setView).catch(e=>setError(e.message)).finally(()=>setLoading(false));},[]);
 const card=view?.card, revealed=view?.answer;
 const vocab=card?.objective==='vocab_reading_meaning';
 const reading=vocab||card?.objective==='kanji_reading_context', meaning=vocab||card?.objective==='kanji_meaning';
 async function work(action:()=>Promise<void>){setBusy(true);setError('');try{await action();}catch(e){setError(e instanceof Error?e.message:'Could not save. Retry or resume.');}finally{setBusy(false);}}
 function replace(next:SessionView|null){setView(next);setAnswer(next?.attempt?.answer||{});event.current=next?.attempt?.clientEventId||null;setTeaching(null);setComponents({});heading.current?.focus();}
 function start(includeNew:boolean){return work(async()=>{replace(await call({action:'start',includeNew}));setMessage('Session saved.');});}
 function response():ResponseInput {
  if(!view||!card)throw new Error('Reload the session');
  event.current=view.attempt?.clientEventId||event.current||crypto.randomUUID();
  return {sessionId:view.sessionId,cardId:card.id,stateVersion:card.stateVersion,clientEventId:event.current,answer:view.attempt?.answer||answer};
 }
 function submit(){return work(async()=>{const payload=response();const result=await call<{answer:Answer;readingMatch?:boolean}>({action:'respond',...payload});setView(current=>current?{...current,answer:result.answer,attempt:{clientEventId:payload.clientEventId,answer:payload.answer,readingMatch:result.readingMatch}}:current);setMessage('Response committed.');});}
 function rate(rating:number){return work(async()=>{const result=await call<{rating:number}>({action:'rate',...response(),rating,components:vocab?{readingCorrect:!!components.readingCorrect,meaningCorrect:!!components.meaningCorrect}:{correct:!!components.correct}});replace(await call<SessionView>());setMessage(`Saved · ${['','Again','Hard','Good','Easy'][result.rating]}`);});}
 if(loading)return <p role="status">Loading saved session…</p>;
 const paused=view?.status==='paused';
 const success=vocab?components.readingCorrect&&components.meaningCorrect:components.correct;
 return <section className="review-panel" aria-label="Review session">
  <div className="review-actions">{(!view||paused||!card)&&<><button disabled={busy} onClick={()=>start(false)}>{view&&card?'Resume reviews':'Start due reviews'}</button><button className="secondary" disabled={busy} onClick={()=>start(true)}>Continue learning</button></>}{view&&!paused&&card&&<button className="secondary" disabled={busy} onClick={()=>work(async()=>{await call({action:'stop',sessionId:view.sessionId});setView({...view,status:'paused'});setTeaching(null);setMessage('Stopped and saved. Resume whenever you are ready.');})}>Stop and save</button>}</div>
  <p role="status" aria-live="polite">{message}</p>{error&&<div className="notice" role="alert">{error} <button disabled={busy} className="secondary" onClick={()=>work(async()=>replace(await call()))}>Reload saved session</button></div>}
  {view&&<><p className="muted">{view.completed} of {view.total} saved · {view.actionableDue} actionable due · {view.buriedDue} due but separated until tomorrow</p><p className="muted">New today: {view.used.total}/{view.limits.total} total · vocabulary {view.used.vocabulary}/{view.limits.vocabulary} · kanji objectives {view.used.kanji}/{view.limits.kanji} · grammar {view.used.grammar}/{view.limits.grammar}</p>{view.introductionsPaused&&<p className="notice">New introductions are paused while the due backlog remains.</p>}{view.contentGaps!==undefined&&view.contentGaps>0&&<p className="muted">{view.contentGaps} objectives need approved source evidence. They remain excluded.</p>}</>}
  {!view&&<p>Begin with due reviews, or study a small new batch when the backlog allows.</p>}
  {paused&&<p>Your session and committed responses are saved.</p>}
  {view&&!paused&&!card&&<p className="empty">This selected block is finished or deferred. Start another block to check due learning steps, or continue learning if capacity remains.</p>}
  {card&&!paused&&<><div className="review-cue"><div className="eyebrow">{labels[card.objective]}</div><h2 className="japanese item-title" lang="ja" ref={heading} tabIndex={-1}>{card.prompt.highlight?card.prompt.text.split(card.prompt.highlight).map((part,i)=><span key={i}>{i>0&&<mark>{card.prompt.highlight}</mark>}{part}</span>):card.prompt.text}</h2><p>{card.prompt.cue}</p></div>
   {view?.repairSuggested&&<p className="notice">Five recent failed recalls: inspect the source, ambiguity or prerequisites before continuing this card.</p>}
   {card.status==='new'&&!teaching&&<button disabled={busy} onClick={()=>work(async()=>{const result=await call<{answer:Answer}>({action:'introduce',sessionId:view!.sessionId,cardId:card.id});setTeaching(result.answer);})}>Study this new card</button>}
   {teaching&&<><h2>Study first</h2><AnswerView answer={teaching}/><p>Reading this answer introduces the objective; it does not record a successful review.</p><button disabled={busy} onClick={()=>work(async()=>{replace(await call());})}>Hide and recall</button></>}
   {card.status==='active'&&!teaching&&!revealed&&<form onSubmit={e=>{e.preventDefault();void submit();}} className="recall-form">{reading&&<label>Reading response<input required maxLength={500} autoComplete="off" value={answer.reading||''} onChange={e=>setAnswer({...answer,reading:e.target.value})}/></label>}{meaning&&<label>Meaning response<input required maxLength={2000} autoComplete="off" value={answer.meaning||''} onChange={e=>setAnswer({...answer,meaning:e.target.value})}/></label>}{!reading&&!meaning&&<label>Recall response<input required maxLength={2000} value={answer.response||''} onChange={e=>setAnswer({response:e.target.value})}/></label>}<p className="muted">Use your own words for meaning. If recall failed, write “forgot”.</p><button disabled={busy}>Commit response and reveal</button></form>}
   {revealed&&!teaching&&<><div className="content-block"><h2>Your committed response</h2>{Object.values(view!.attempt!.answer).filter(x=>typeof x==='string').map((v,i)=><p key={i}>{v}</p>)}</div><AnswerView answer={revealed}/><fieldset className="self-assessment" disabled={busy}><legend>Assess the recall before reveal</legend>{(vocab?[['readingCorrect','Reading recalled correctly'],['meaningCorrect','Meaning recalled correctly']]:[['correct','Objective recalled correctly']]).map(([key,label])=><label key={key}><input type="checkbox" checked={!!components[key]} onChange={e=>setComponents({...components,[key]:e.target.checked})}/>{label}</label>)}</fieldset><p className="muted">Equivalent meaning paraphrases are valid. Failure of either required part means Again.</p><div className="review-actions">{['Again','Hard','Good','Easy'].map((label,i)=><button key={label} disabled={busy||(i>0&&!success)} onClick={()=>rate(i+1)}>{label}</button>)}</div></>}
   {(revealed||teaching)&&<p className="status">Sources: {card.prompt.sources.map((source,i)=><span key={source.id}>{i>0?' · ':''}<Link href={`/sources/${source.sourceId}?record=${source.id}#record-${source.id}`}>Evidence {i+1}</Link></span>)}</p>}
  </>}
 </section>;
}
