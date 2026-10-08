'use client';
import Link from 'next/link';
import { useRef,useState } from 'react';
import type { Run } from '@/lib/server/generation/service.mjs';
export function PracticeReading({run}:{run:Run}){
 const [furigana,setFurigana]=useState('request'),[active,setActive]=useState<number|null>(null),[message,setMessage]=useState(''),[revealed,setRevealed]=useState<string[]>([]),[busy,setBusy]=useState(false),[panelVisible,setPanelVisible]=useState(false);
 const trigger=useRef<HTMLElement|null>(null),panel=useRef<HTMLElement|null>(null);
 const draft=run.draft;if(!draft)return null;
 const approved=run.status==='approved',uses=draft.uses.map((u,index)=>({...u,index})).filter(u=>run.scope.targets.some(t=>t.id===u.itemId));
 const use=active===null?null:uses.find(u=>u.index===active),target=run.scope.targets.find(t=>t.id===use?.itemId);
 function open(index:number|null,element:HTMLElement){trigger.current=element;setPanelVisible(index!==null);setActive(index);setMessage('');requestAnimationFrame(()=>panel.current?.focus());}
 function close(){setPanelVisible(false);setActive(null);trigger.current?.focus();}
 async function mutate(action:'context'|'attention'){
  if(!use)return;setBusy(true);setMessage('');
  try{const sentence=run.sentences?.find(s=>use.start>=s.start&&use.end<=s.end);const response=await fetch(action==='context'?'/api/generation':'/api/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(action==='context'?{action,runId:run.id,itemId:use.itemId,revision:run.revision,sentenceId:sentence?.id}:{action,itemId:use.itemId})});if(!response.ok)throw new Error();setMessage(action==='context'?'Context saved. Review scheduling is unchanged.':'Flagged as unfamiliar. Review scheduling is unchanged.');}catch{setMessage('Could not save. Retry or resume later.');}finally{setBusy(false);}
 }
 function fragments(start:number,end:number){
  const result=[];let cursor=start;
  for(const u of [...uses].sort((a,b)=>a.start-b.start||b.end-a.end)){if(u.start<cursor||u.start<start||u.end>end)continue;if(cursor<u.start)result.push(draft!.japanese.slice(cursor,u.start));const text=draft!.japanese.slice(u.start,u.end);
   const showReading=furigana!=='off'&&!!u.reading&&/\p{Script=Han}/u.test(text);
   result.push(<button type="button" key={u.index} className="reader-word" aria-label={`Word help: ${text}`} onClick={e=>open(u.index,e.currentTarget)}>{showReading?<ruby className={approved&&furigana==='all'?'':'reader-ruby-on-request'}>{text}<rt title={approved?'Verified reading':'Proposed draft reading'}>{u.reading}</rt></ruby>:text}</button>);cursor=u.end;
  }if(cursor<end)result.push(draft!.japanese.slice(cursor,end));return result;
 }
 return <section className="practice-reader" aria-label="Reading study">
  <div className="reader-controls"><label>Furigana<select value={furigana} onChange={e=>setFurigana(e.target.value)}><option value="off">Off</option><option value="request">On request</option><option value="all">All verified readings</option></select></label><label>Word or grammar help<select value={active??''} onChange={e=>open(e.target.value===''?null:Number(e.target.value),e.currentTarget)}><option value="">Choose a target</option>{uses.map(u=><option key={u.index} value={u.index}>{draft.japanese.slice(u.start,u.end)}</option>)}</select></label></div>
  {run.sentences?.map(s=><div className="reader-sentence" key={s.id}><p className="japanese reading-passage" lang="ja">{fragments(s.start,s.end)}</p><button type="button" className="secondary" aria-expanded={revealed.includes(s.id)} onClick={()=>setRevealed(revealed.includes(s.id)?revealed.filter(id=>id!==s.id):[...revealed,s.id])}>Sentence help · {Number(s.id.split('-')[1])+1}</button>{revealed.includes(s.id)&&<p>{s.translation||'Sentence translation unavailable.'}<small className="field-label"> · Generated {approved?'human-reviewed translation':'draft translation'}</small></p>}</div>)}
  {furigana!=='off'&&!approved&&<p className="status">Hover readings are proposed readings from this unverified draft.</p>}
  {panelVisible&&<aside className="reader-panel" ref={panel} tabIndex={-1} aria-label="Contextual word help" onKeyDown={e=>{if(e.key==='Escape')close();}}>
   <p className="badge generated">Generated · {approved?'human reviewed':'unverified draft'}</p>
   {use&&<><h3 lang="ja">{draft.japanese.slice(use.start,use.end)}</h3>{furigana!=='off'&&<p lang="ja">{use.reading}<small className="field-label"> · {approved?'verified for this revision':'proposed reading'}</small></p>}<p>{use.sense}<small className="field-label"> · {approved?'accepted contextual explanation':'proposed contextual explanation'}</small></p><p>Stored item reference: {Array.isArray(target?.meaning)?target.meaning.join(', '):target?.meaning}</p>{target?.kind==='grammar'&&<p>Stored formation: {target.formation?.length?target.formation.join(' · '):'Unavailable; open the stored reference.'}</p>}{target&&<Link href={`/${target.kind}/${target.id}`}>Open {target.kind} reference</Link>}{approved&&target?.kind==='vocabulary'&&<button type="button" disabled={busy} onClick={()=>void mutate('context')}>Save word with context</button>}<button type="button" disabled={busy} onClick={()=>void mutate('attention')}>Mark unfamiliar</button></>}
   <button className="secondary" type="button" onClick={close}>Close word help</button>{message&&<p role="status">{message}</p>}
  </aside>}
 </section>;
}
