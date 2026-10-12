'use client';
import Link from 'next/link';
import { useId,useLayoutEffect,useRef,useState } from 'react';
import type { Run,ReaderWord } from '@/lib/server/generation/service.mjs';
export function PracticeReading({run}:{run:Run}){
 const [furigana,setFurigana]=useState('request'),[active,setActive]=useState<number|null>(null),[message,setMessage]=useState(''),[revealed,setRevealed]=useState<string[]>([]),[busy,setBusy]=useState(false),[panelVisible,setPanelVisible]=useState(false);
 const trigger=useRef<HTMLElement|null>(null),panel=useRef<HTMLElement|null>(null);
 const panelId=useId(),[query,setQuery]=useState(''),[lookupUrl,setLookupUrl]=useState(''),[saved,setSaved]=useState<string[]>([]);
 const [focused,setFocused]=useState(0),wordButtons=useRef<(HTMLButtonElement|null)[]>([]);
 useLayoutEffect(()=>{
  if(!panelVisible)return;
  function position(){
   const node=panel.current,anchor=trigger.current;if(!node||!anchor)return;
   const rect=anchor.getBoundingClientRect(),height=node.getBoundingClientRect().height;
   const below=rect.bottom+8,above=rect.top-height-8;
   node.style.top=`${Math.max(16,Math.min(below+height<=window.innerHeight-16?below:above,window.innerHeight-height-16))}px`;
   node.style.left=`${Math.max(16,Math.min(rect.left,window.innerWidth-node.getBoundingClientRect().width-16))}px`;
  }
  function dismiss(event:PointerEvent){if(event.target instanceof Node&&!panel.current?.contains(event.target)&&!trigger.current?.contains(event.target)){setPanelVisible(false);setActive(null);}}
  position();window.addEventListener('resize',position);window.addEventListener('scroll',position,true);document.addEventListener('pointerdown',dismiss);
  return()=>{window.removeEventListener('resize',position);window.removeEventListener('scroll',position,true);document.removeEventListener('pointerdown',dismiss);};
 },[panelVisible,active,message]);
 const draft=run.draft;if(!draft)return null;
 const approved=run.status==='approved',reference=run.reader?.text===draft.japanese&&run.reader.revision===run.revision?run.reader:null;
 const uses:(ReaderWord&{index:number})[]=(reference?.words||draft.uses.map(u=>({...u,surface:draft.japanese.slice(u.start,u.end),readingSource:'annotation',entries:[],ambiguous:false}))).map((u,index)=>({...u,index}));
 const use=active===null?null:uses.find(u=>u.index===active),target=run.scope.targets.find(t=>t.id===use?.itemId);
 const sentence=run.sentences?.find(s=>use&&use.start>=s.start&&use.end<=s.end),saveKey=`${run.id}:${run.revision}:${use?.itemId}:${sentence?.id}`;
 function open(index:number|null,element:HTMLElement){const selected=uses.find(u=>u.index===index),item=run.scope.targets.find(t=>t.id===selected?.itemId);trigger.current=element;setPanelVisible(index!==null);setActive(index);setMessage('');setLookupUrl('');setQuery(item?.kind==='vocabulary'?item.writtenForm:selected?.lemma||selected?.surface||'');if(index!==null)requestAnimationFrame(()=>panel.current?.focus({preventScroll:true}));}
 function close(){setPanelVisible(false);setActive(null);trigger.current?.focus({preventScroll:true});}
 function lookup(){
  const url=`https://takoboto.jp/?q=${encodeURIComponent(query.trim().slice(0,500))}`,mobile=window.matchMedia('(max-width: 650px)').matches;
  const popup=window.open(url,mobile?'_blank':'ai-sensei-takoboto',mobile?'':'popup,width=700,height=700');
  if(popup){popup.opener=null;setLookupUrl('');setMessage('');}else{setLookupUrl(url);setMessage('Popup blocked. Use the link below to open Takoboto.');}
 }
 async function mutate(action:'context'|'attention'){
  if(!use?.itemId||!target)return;setBusy(true);setMessage('');
  try{const response=await fetch(action==='context'?'/api/generation':'/api/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(action==='context'?{action,runId:run.id,itemId:use.itemId,revision:run.revision,sentenceId:sentence?.id}:{action,itemId:use.itemId})});if(!response.ok)throw new Error();if(action==='context')setSaved(previous=>[...previous,saveKey]);setMessage(action==='context'?'Context saved. Review scheduling is unchanged.':'Flagged as unfamiliar. Review scheduling is unchanged.');}catch{setMessage('Could not save. Retry or resume later.');}finally{setBusy(false);}
 }
 function fragments(start:number,end:number){
  const result=[];let cursor=start;
  for(const u of [...uses].sort((a,b)=>a.start-b.start||b.end-a.end)){if(u.start<cursor||u.start<start||u.end>end)continue;if(cursor<u.start)result.push(draft!.japanese.slice(cursor,u.start));const text=draft!.japanese.slice(u.start,u.end);
   const showReading=furigana!=='off'&&!!u.reading&&/\p{Script=Han}/u.test(text);
   result.push(<button type="button" key={u.index} ref={node=>{wordButtons.current[u.index]=node;}} tabIndex={focused===u.index?0:-1} onFocus={()=>setFocused(u.index)} onKeyDown={e=>{const next=e.key==='ArrowRight'?Math.min(u.index+1,uses.length-1):e.key==='ArrowLeft'?Math.max(0,u.index-1):e.key==='Home'?0:e.key==='End'?uses.length-1:null;if(next!==null){e.preventDefault();wordButtons.current[next]?.focus();}}} className="reader-word" aria-label={`Word help: ${text}`} aria-expanded={panelVisible&&active===u.index} aria-controls={panelVisible&&active===u.index?panelId:undefined} onClick={e=>open(u.index,e.currentTarget)}>{showReading?<ruby className={approved&&u.readingSource==='annotation'&&furigana==='all'?'':'reader-ruby-on-request'}>{text}<rt title={u.readingSource==='annotation'?(approved?'Verified reading':'Proposed draft reading'):'Candidate whole-word reading; check context'}>{u.reading}</rt></ruby>:text}</button>);cursor=u.end;
  }if(cursor<end)result.push(draft!.japanese.slice(cursor,end));return result;
 }
 return <section className="practice-reader" aria-label="Reading study">
  <div className="reader-controls"><label>Furigana<select value={furigana} onChange={e=>setFurigana(e.target.value)}><option value="off">Off</option><option value="request">On request</option><option value="all">All verified readings</option></select></label><label>Word or grammar help<select value={active??''} onChange={e=>open(e.target.value===''?null:Number(e.target.value),e.currentTarget)}><option value="">Choose a word or expression</option>{uses.map(u=><option key={u.index} value={u.index}>{draft.japanese.slice(u.start,u.end)}</option>)}</select></label></div>
  <p className="field-label">Focus a passage word, then use Left/Right to move and Enter to open help. Dictionary readings and meanings are candidates; check the context.</p>
  <p className="japanese reading-passage" lang="ja">{fragments(0,draft.japanese.length)}</p>
  {!!run.sentences?.length&&<details className="reader-sentence-help"><summary>Sentence help</summary>{run.sentences.map(s=><div className="reader-sentence" key={s.id}><button type="button" className="secondary" aria-expanded={revealed.includes(s.id)} onClick={()=>setRevealed(revealed.includes(s.id)?revealed.filter(id=>id!==s.id):[...revealed,s.id])}>Sentence help · {Number(s.id.split('-')[1])+1}</button>{revealed.includes(s.id)&&<p>{s.translation||'Sentence translation unavailable.'}<small className="field-label"> · Generated {approved?'human-reviewed translation':'draft translation'}</small></p>}</div>)}</details>}
  {furigana!=='off'&&!approved&&<p className="status">Stored annotation readings are proposed in this unverified draft. Dictionary and analyzer readings remain reference candidates.</p>}
  {panelVisible&&<aside id={panelId} className="reader-panel reader-popup" ref={panel} tabIndex={-1} aria-label="Contextual word help" onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();close();}}}>
   {use&&<><h3 lang="ja">{use.surface}</h3>{use.readingSource==='annotation'?<><p className="badge generated">Generated · {approved?'human reviewed':'unverified draft'}</p>{furigana!=='off'&&<p lang="ja">{use.reading}<small className="field-label"> · {approved?'verified for this revision':'proposed reading'}</small></p>}<p>{use.sense}<small className="field-label"> · {approved?'accepted contextual explanation':'proposed contextual explanation'}</small></p><p><small className="field-label">Stored definition</small><br/>{(Array.isArray(target?.meaning)?target.meaning.join(', '):target?.meaning)||'Unavailable; use dictionary lookup.'}</p></>:<><p className="field-label">Dictionary reference · contextual answer unverified</p>{furigana!=='off'&&<p lang="ja">{use.reading||'Reading unavailable'}<small className="field-label"> · {use.readingSource==='analyzer'?'kuromoji whole-word candidate':'JMdict candidate reading'}</small></p>}{use.lemma&&use.lemma!==use.surface&&<p>Dictionary form: <span lang="ja">{use.lemma}</span>. The inflected reading is an analyzer candidate.</p>}{use.ambiguous&&<p>Multiple readings or entries; context must decide.</p>}{use.entries.length?<ul className="reader-dictionary-senses">{use.entries.map(entry=><li key={entry.id}><span lang="ja">{entry.readings.join(' / ')}</span><ol>{entry.senses.map((sense,index)=><li key={index}>{sense.meanings.join('; ')||'English meaning unavailable'}<small className="field-label"> · {sense.pos.join(', ')||'Part of speech unavailable'}{sense.readings.length?` · readings: ${sense.readings.join(' / ')}`:''}{sense.notes.length?` · ${sense.notes.join('; ')}`:''}</small></li>)}</ol></li>)}</ul>:<p>{reference?.dictionary.status==='unavailable'?'Local JMdict unavailable. Use Takoboto; stored review remains available.':'No matching local dictionary entry. Try editing the lookup.'}</p>}{use.truncated&&<p>More dictionary candidates exist; this preview is limited. Use external lookup for more.</p>}</>}{target?.kind==='grammar'&&<p>Stored formation: {target.formation?.length?target.formation.join(' · '):'Unavailable; open the stored reference.'}</p>}{target&&<Link href={`/${target.kind}/${target.id}`}>Open {target.kind} reference</Link>}{target?.kind==='vocabulary'&&<><button type="button" disabled={busy||!approved||!sentence||saved.includes(saveKey)} onClick={()=>void mutate('context')}>{saved.includes(saveKey)?'Saved to studylist':'Add to studylist'}</button><p className="field-label">{approved?'Saves this sentence on the vocabulary page.':'Approve this passage before saving its sentence context.'}</p></>}{target&&<button type="button" disabled={busy} onClick={()=>void mutate('attention')}>Mark unfamiliar</button>}</>}
   <form onSubmit={e=>{e.preventDefault();if(query.trim())lookup();}}><label htmlFor={`${panelId}-query`}>Takoboto word or phrase</label><input id={`${panelId}-query`} lang="ja" maxLength={500} value={query} onChange={e=>{setQuery(e.target.value);setLookupUrl('');}}/><button type="submit" className="secondary" disabled={!query.trim()}>Look up on Takoboto</button></form>
   {lookupUrl&&<a href={lookupUrl} target="_blank" rel="noopener noreferrer">Open Takoboto in a new tab</a>}
   <button className="secondary" type="button" onClick={close}>Close word help</button>{message&&<p role="status">{message}</p>}
  </aside>}
  {reference&&<p className="reader-dictionary-source field-label">Dictionary reference: JMdict © James William Breen and EDRDG. <a href="https://www.edrdg.org/jmdict/j_jmdict.html" target="_blank" rel="noopener noreferrer">Project and documentation</a> · <a href="https://www.edrdg.org/edrdg/licence.html" target="_blank" rel="noopener noreferrer">EDRDG licence</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>. English lookup index; readings/senses are candidates. {reference.dictionary.updatedAt?`Updated ${reference.dictionary.updatedAt.slice(0,10)}.`:'Dictionary not installed.'}{reference.dictionary.stale&&' Update overdue; refresh the local dictionary monthly.'}{reference.dictionary.analyzerUnavailable&&' Tokenization unavailable; unsegmented lookup only.'}</p>}
 </section>;
}
