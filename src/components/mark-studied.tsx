'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { StudyStatus } from '@/lib/server/review/service.mjs';

export function MarkStudied({itemId,initial}:{itemId:string;initial:StudyStatus}){
 const [status,setStatus]=useState(initial),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const router=useRouter();
 return <section className="study-completion" aria-label="Study completion">
  <button className="secondary" disabled={busy} onClick={async()=>{
   setBusy(true);setError('');
   try{const r=await fetch('/api/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'studied',itemId})});const data=await r.json();if(!r.ok)throw new Error(data.error);setStatus(data);router.refresh();}
   catch(e){setError(e instanceof Error?e.message:'Could not save study completion. Retry.');}finally{setBusy(false);}
  }}>{busy?'Saving…':'Mark as studied'}</button>
  <p role="status">{status.introducedAt?`Studied · first recorded ${new Date(status.introducedAt).toLocaleDateString()}. ${status.waiting} waiting review objectives · ${status.active} active${status.paused?` · ${status.paused} suspended or retired`:''}.`:'Record your first completed study. This does not mean mastered or complete a due review.'}</p>
  {status.introducedAt&&status.missing.length>0&&<p className="notice">Review content unavailable: {status.missing.map(o=>({kanji_meaning:'verified core meaning',kanji_reading_context:'verified contextual reading',grammar_cloze:'approved grammar prompt',vocab_reading_meaning:'verified reading and meaning'}[o]||o)).join(', ')}. Your study is recorded.</p>}
  {status.introducedAt&&status.optional&&<p className="muted">Incidental kanji review cards remain opt-in.</p>}
  {error&&<p role="alert" className="notice">{error}</p>}
 </section>;
}
