'use client';
import { useEffect, useRef, useState } from 'react';
import type { Answer, ResponseInput, SessionView } from '@/lib/server/review/service.mjs';
import { StudyBack } from './study-content';
import { Dictionary } from './dictionary';

const labels:Record<string,string>={vocab_reading_meaning:'Vocabulary · reading + meaning',kanji_meaning:'Core kanji · reading + meaning',kanji_reading_context:'Core kanji · whole-word reading',grammar_cloze:'Grammar · contextual cloze'};
async function call<T>(body?:unknown):Promise<T>{
 const result=await fetch('/api/review',body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});
 const data=await result.json();if(!result.ok)throw new Error(data.error||'Could not save. Retry or resume.');return data;
}
function AnswerView({answer}: {answer:Answer}) {return <div className="content-block" data-testid="revealed-answer"><h2>Answer</h2>{answer.reading&&<p lang="ja" data-field="reading" className="japanese sentence">{answer.reading}</p>}{answer.meaning&&<p data-field="meaning">{answer.meaning}</p>}{answer.response&&<p lang="ja" className="japanese">{answer.response}</p>}{answer.acceptedGlosses?.length!==0&&answer.acceptedGlosses&&<p className="muted">Accepted glosses: {answer.acceptedGlosses.join('; ')}</p>}{answer.alternatives?.length!==0&&answer.alternatives&&<p>Accepted alternatives: {answer.alternatives.join('; ')}</p>}</div>;}
export function Review({initialStart}:{initialStart?:string}){
 const [view,setView]=useState<(SessionView & {contentGaps?:number})|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [answer,setAnswer]=useState<Answer>({}),[components,setComponents]=useState<Record<string,boolean>>({});
 const [tick,setTick]=useState(0),[choiceId,setChoiceId]=useState('');
 const event=useRef<string|null>(null);const heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{call<SessionView|null>().then(async saved=>{
  let next=saved;
  if(initialStart&&(!saved||saved.status==='paused'||!saved.card))next=await call<SessionView&{empty?:boolean}>({action:'start'}).then(v=>v.empty?saved:v);
  else if(saved?.status==='active')next=await call<SessionView>({action:'resume',sessionId:saved.sessionId});
  setView(next);setAnswer(next?.attempt?.answer||{});event.current=next?.attempt?.clientEventId||null;
 }).catch(e=>setError(e.message)).finally(()=>setLoading(false));},[initialStart]);
 const lastActivity=useRef(0);
 useEffect(()=>{
  const wake=()=>{lastActivity.current=Date.now();};
  wake();
  for(const type of ['pointerdown','keydown','focus'])window.addEventListener(type,wake);
  return()=>{for(const type of ['pointerdown','keydown','focus'])window.removeEventListener(type,wake);};
 },[]);
 useEffect(()=>{
  if(view?.status!=='active'||view.idleTooLong)return;
  const timer=setInterval(()=>{if(document.visibilityState==='visible'&&Date.now()-lastActivity.current<15*60*1000)setTick(t=>t+1);},1000);
  return()=>clearInterval(timer);
 },[view?.status,view?.idleTooLong]);
 const card=view?.card, revealed=view?.answer;
 const vocab=card?.objective==='vocab_reading_meaning';
 const reading=vocab||card?.objective==='kanji_reading_context', meaning=vocab||card?.objective==='kanji_meaning';
 async function work(action:()=>Promise<void>){setBusy(true);setError('');try{await action();}catch(e){setError(e instanceof Error?e.message:'Could not save. Retry or resume.');}finally{setBusy(false);}}
 function replace(next:SessionView|null){setTick(0);setChoiceId('');setView(next);setAnswer(next?.attempt?.answer||{});event.current=next?.attempt?.clientEventId||null;setComponents({});requestAnimationFrame(()=>heading.current?.focus());}
 function start(reviewMore=false){return work(async()=>{const next=await call<SessionView&{empty?:boolean}>({action:'start',...(reviewMore?{reviewMore}:{})});if(next.empty){setMessage('Nothing else to review early.');return;}replace(next);setMessage('Session saved.');});}
 function response():ResponseInput {
  if(!view||!card)throw new Error('Reload the session');
  event.current=view.attempt?.clientEventId||event.current||crypto.randomUUID();
  const committed=view.attempt?.answer||(view.recall&&choiceId?{choiceId,choiceFingerprint:view.recall.fingerprint}:answer);
  return {sessionId:view.sessionId,cardId:card.id,stateVersion:card.stateVersion,clientEventId:event.current,answer:committed};
 }
 function submit(){return work(async()=>{const payload=response();await call({action:'respond',...payload});replace(await call<SessionView>());setMessage('Response committed.');});}
 function rate(rating:number){return work(async()=>{const objectiveAttempt=view?.attempt?.grader==='objective';const result=await call<{rating:number}>({action:'rate',...response(),rating,components:objectiveAttempt?{}:vocab?{readingCorrect:!!components.readingCorrect,meaningCorrect:!!components.meaningCorrect}:{correct:!!components.correct}});replace(await call<SessionView>());setMessage(`Saved · ${['','Again','Hard','Good','Easy'][result.rating]}`);});}
 if(loading)return <p role="status">Loading saved session…</p>;
 const paused=view?.status==='paused';
 const activeMs=(view?.elapsedActiveMs||0)+(view?.idleTooLong?0:tick*1000);
 const recall=view?.recall||null;
 const objective=view?.attempt?.grader==='objective';
 const feedback=view?.attempt?.components;
 const success=objective?!!feedback?.correct:vocab?components.readingCorrect&&components.meaningCorrect:components.correct;
 // A kanji-meaning card is bilingual when the dictionary supplied a real word reading for every option.
 const paired=recall?.format==='vocab_pair'||(recall?.format==='kanji_meaning'&&recall.choices.every(choice=>choice.reading&&choice.meaning));
 const recallNoun=paired?'reading and meaning pair':recall?.format==='kanji_meaning'?'meaning':'reading';
 return <section className="review-panel" aria-label="Review session">
  <div className="review-actions">{(!view||paused||!card)&&<><button disabled={busy} onClick={()=>start()}>{view&&card?'Resume reviews':'Start daily review'}</button>{view&&!paused&&!card&&<button className="secondary" disabled={busy} onClick={()=>start(true)}>Review more (20)</button>}</>}{view&&!paused&&<button className="secondary" disabled={busy} onClick={()=>work(async()=>{await call({action:'stop',sessionId:view.sessionId});replace(await call<SessionView>());setMessage('Stopped and saved. Resume whenever you are ready.');})}>Stop and save</button>}</div>
  <p role="status" aria-live="polite">{message}</p>{error&&<div className="notice" role="alert">{error} <button disabled={busy} className="secondary" onClick={()=>work(async()=>replace(await call()))}>Reload saved session</button></div>}
  {view&&<><div className="session-progress"><progress max={Math.max(1,view.total)} value={view.completed} aria-label="Saved recalls"/><p>{view.completed} of {view.total} saved · {view.deferred} deferred</p><p className="status">{Math.max(0,Math.floor(activeMs/60000))} active minutes / {view.timeBudgetMinutes} minute block budget</p></div>{activeMs>=view.timeBudgetMinutes*60000&&<p className="notice">You have reached your time budget. Stop and save when ready; remaining cards stay due.</p>}<details className="session-details"><summary>Daily limits and remaining work</summary><p className="muted">{view.actionableDue} actionable due · {view.buriedDue} due but separated until tomorrow</p><p className="muted">Reviewed today: vocabulary {view.used.vocabulary}/{view.limits.vocabulary} · kanji {view.used.kanji}/{view.limits.kanji} · grammar {view.used.grammar}/{view.limits.grammar}</p>{view.contentGaps!==undefined&&view.contentGaps>0&&<p className="muted">{view.contentGaps} objectives need approved source evidence. They remain excluded.</p>}</details></>}
  {!view&&<p>Your daily review brings newly studied items first, then the cards you are most likely to forget.</p>}
  {paused&&<p>Your session and committed responses are saved.</p>}
  {view&&!paused&&!card&&<p className="empty">This session is finished. Start your daily review again later for newly due cards, or review more cards early.</p>}
  {card&&!paused&&<article className="flashcard"><div className="review-cue"><p className="objective-label">{labels[card.objective]}{card.role==='again'&&<span className="again-tag">Again</span>}</p><h2 className="japanese item-title" lang="ja" ref={heading} tabIndex={-1}>{card.prompt.highlight?card.prompt.text.split(card.prompt.highlight).map((part,i)=><span key={i}>{i>0&&<mark>{card.prompt.highlight}</mark>}{part}</span>):card.prompt.text}</h2><p>{card.prompt.cue}</p></div>
   {view?.repairSuggested&&<p className="notice">Five recent failed recalls: inspect the source, ambiguity or prerequisites before continuing this card.</p>}
   {!revealed&&recall&&<form onSubmit={e=>{e.preventDefault();if(choiceId)void submit();}} className="recall-form choice-form">
      <fieldset className="recall-choices" disabled={busy}>
        <legend>Choose the correct {recallNoun}</legend>
        {recall.choices.map((choice,index)=><label key={choice.id} data-choice-id={choice.id} data-reading={choice.reading||''} data-meaning={choice.meaning||''} className="choice"><input type="radio" name="recall-choice" value={choice.id} checked={choiceId===choice.id} onChange={()=>setChoiceId(choice.id)} onKeyDown={e=>{if(/^[1-4]$/.test(e.key)){e.preventDefault();setChoiceId(recall.choices[Number(e.key)-1].id);}}}/><span className="choice-index" aria-hidden="true">{index+1}</span><span className="choice-text">{choice.reading&&<span lang="ja" className="japanese choice-reading">{choice.reading}</span>}{choice.meaning&&<span className="choice-meaning">{choice.meaning}</span>}</span></label>)}
      </fieldset>
      <p className="muted">{paired?'One option pairs the source-backed reading with its meaning.':'Exactly one option is source-backed.'}</p>
      <button disabled={busy||!choiceId}>Commit choice and reveal</button>
    </form>}
    {!revealed&&!recall&&<form onSubmit={e=>{e.preventDefault();void submit();}} className="recall-form">{reading&&<label>Reading response<input required maxLength={500} autoComplete="off" value={answer.reading||''} onChange={e=>setAnswer({...answer,reading:e.target.value})}/></label>}{meaning&&<label>Meaning response<input required maxLength={2000} autoComplete="off" value={answer.meaning||''} onChange={e=>setAnswer({...answer,meaning:e.target.value})}/></label>}{!reading&&!meaning&&<label>Recall response<input required maxLength={2000} value={answer.response||''} onChange={e=>setAnswer({response:e.target.value})}/></label>}<p className="muted">Use your own words for meaning. If recall failed, write “forgot”.</p><button disabled={busy}>Commit response and reveal</button></form>}
   {revealed&&<><div className="answer-comparison"><div className="committed-answer"><h2>Your committed response</h2>{objective&&view!.attempt!.choice?<p><span className="field-label">Selected: </span>{view!.attempt!.choice.reading||view!.attempt!.choice.meaning}{view!.attempt!.choice.reading&&view!.attempt!.choice.meaning?' · ':''}{view!.attempt!.choice.meaning||''}</p>:Object.entries(view!.attempt!.answer).filter(([,x])=>typeof x==='string').map(([key,v])=><p key={key}><span className="field-label">{key}: </span>{v}</p>)}</div><AnswerView answer={revealed}/></div>{!objective&&<fieldset className="self-assessment" disabled={busy}><legend>What did you recall unaided?</legend>{(vocab?[['readingCorrect','Reading recalled correctly'],['meaningCorrect','Meaning recalled correctly']]:[['correct','Objective recalled correctly']]).map(([key,label])=><label key={key}><input type="checkbox" checked={!!components[key]} onChange={e=>setComponents({...components,[key]:e.target.checked})}/>{label}</label>)}</fieldset>}{objective&&<p className="notice" data-testid="objective-feedback">{feedback?.correct?(vocab?'Both components correct.':'Correct.'):vocab&&feedback?.readingCorrect?'Reading correct, meaning different. This is Again.':vocab&&feedback?.meaningCorrect?'Meaning correct, reading different. This is Again.':vocab?'Both components incorrect. This is Again.':'The selected answer is incorrect. This is Again.'}</p>}{!objective&&<p className="muted">Equivalent meaning paraphrases are valid. Failure of either required part means Again.</p>}<div className="review-actions ratings">{['Again','Hard','Good','Easy'].map((label,i)=><button key={label} aria-label={label} disabled={busy||(i>0&&!success)||(objective&&i===3)} onClick={()=>rate(i+1)}>{label}<small>{['Forgot','Difficult','Recalled','Effortless'][i]}</small></button>)}</div>{view?.study&&<details className="study-details"><summary>Read this card</summary><StudyBack study={view.study}/></details>}</>}
  </article>}
  <Dictionary itemId={card?.itemId} disabled={!revealed}/>
 </section>;
}
